-- =============================================================================
-- FASE 11 — Hardening de seguridad: RPCs BI
-- Problema: las 4 RPCs de BI usan SECURITY DEFINER + LANGUAGE sql
-- y aceptan p_empresa_id sin validar que auth.uid() sea miembro de esa empresa.
-- Esto permite a cualquier usuario autenticado consultar datos de otras empresas.
--
-- Solución: convertir a LANGUAGE plpgsql y agregar guard de membresía al inicio.
-- =============================================================================

-- Helper privado reutilizable ─────────────────────────────────────────────────
-- Verifica que auth.uid() pertenece activamente a la empresa.
-- Lanza insufficient_privilege si la validación falla.
CREATE OR REPLACE FUNCTION _bi_assert_empresa_member(p_empresa_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Se requiere autenticación' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM empresas_usuarios
    WHERE usuario_id = auth.uid()
      AND empresa_id = p_empresa_id
      AND activo = true
  ) THEN
    RAISE EXCEPTION 'Acceso denegado a empresa %', p_empresa_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION _bi_assert_empresa_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _bi_assert_empresa_member(uuid) TO authenticated;

-- =============================================================================
-- RPC 1: rpt_evolucion_mensual  (patched)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpt_evolucion_mensual(
  p_empresa_id   uuid,
  p_anio_desde   integer,
  p_anio_hasta   integer,
  p_categoria_id uuid DEFAULT NULL
)
RETURNS TABLE (
  anio          integer,
  mes           integer,
  label         text,
  facturado     numeric,
  reembolsable  numeric
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM _bi_assert_empresa_member(p_empresa_id);

  RETURN QUERY
  SELECT
    EXTRACT(YEAR  FROM g.fecha)::integer AS anio,
    EXTRACT(MONTH FROM g.fecha)::integer AS mes,
    TO_CHAR(g.fecha, 'Mon YYYY')         AS label,
    COALESCE(SUM(g.valor_factura), 0)    AS facturado,
    COALESCE(SUM(g.valor_reembolsable), 0) AS reembolsable
  FROM gastos g
  INNER JOIN rendiciones r ON r.id = g.rendicion_id
  WHERE r.empresa_id = p_empresa_id
    AND g.fecha IS NOT NULL
    AND EXTRACT(YEAR FROM g.fecha) BETWEEN p_anio_desde AND p_anio_hasta
    AND (p_categoria_id IS NULL OR g.categoria_gasto_id = p_categoria_id)
    AND g.deleted_at IS NULL
    AND r.deleted_at IS NULL
  GROUP BY
    EXTRACT(YEAR  FROM g.fecha),
    EXTRACT(MONTH FROM g.fecha),
    TO_CHAR(g.fecha, 'Mon YYYY')
  ORDER BY anio, mes;
END;
$$;

-- =============================================================================
-- RPC 2: rpt_top_proveedores  (patched)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpt_top_proveedores(
  p_empresa_id  uuid,
  p_fecha_desde date,
  p_fecha_hasta date,
  p_limite      integer DEFAULT 10
)
RETURNS TABLE (
  proveedor_id        uuid,
  nombre              text,
  pais                text,
  ciudad              text,
  n_gastos            bigint,
  total               numeric,
  pct_total           numeric,
  categoria_principal text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM _bi_assert_empresa_member(p_empresa_id);

  RETURN QUERY
  WITH total_empresa AS (
    SELECT COALESCE(SUM(g.valor_factura), 0) AS monto
    FROM gastos g
    INNER JOIN rendiciones r ON r.id = g.rendicion_id
    WHERE r.empresa_id = p_empresa_id
      AND g.fecha BETWEEN p_fecha_desde AND p_fecha_hasta
      AND g.deleted_at IS NULL AND r.deleted_at IS NULL
  ),
  por_proveedor AS (
    SELECT
      g.proveedor_id,
      COUNT(*)             AS n_gastos,
      SUM(g.valor_factura) AS total
    FROM gastos g
    INNER JOIN rendiciones r ON r.id = g.rendicion_id
    WHERE r.empresa_id = p_empresa_id
      AND g.fecha BETWEEN p_fecha_desde AND p_fecha_hasta
      AND g.proveedor_id IS NOT NULL
      AND g.deleted_at IS NULL AND r.deleted_at IS NULL
    GROUP BY g.proveedor_id
    ORDER BY total DESC
    LIMIT p_limite
  ),
  cat_principal AS (
    SELECT DISTINCT ON (g.proveedor_id)
      g.proveedor_id,
      cg.nombre AS categoria_nombre
    FROM gastos g
    INNER JOIN rendiciones      r  ON r.id  = g.rendicion_id
    LEFT  JOIN categorias_gasto cg ON cg.id = g.categoria_gasto_id
    WHERE r.empresa_id = p_empresa_id
      AND g.fecha BETWEEN p_fecha_desde AND p_fecha_hasta
      AND g.deleted_at IS NULL AND r.deleted_at IS NULL
      AND g.proveedor_id IS NOT NULL
    ORDER BY g.proveedor_id, COUNT(*) DESC
  )
  SELECT
    pp.proveedor_id,
    pv.nombre::text,
    pv.pais::text,
    pv.ciudad::text,
    pp.n_gastos,
    pp.total,
    ROUND(pp.total / NULLIF(te.monto, 0) * 100, 2) AS pct_total,
    cp.categoria_nombre::text AS categoria_principal
  FROM por_proveedor pp
  CROSS JOIN total_empresa te
  LEFT JOIN proveedores   pv ON pv.id = pp.proveedor_id
  LEFT JOIN cat_principal cp ON cp.proveedor_id = pp.proveedor_id
  ORDER BY pp.total DESC;
END;
$$;

-- =============================================================================
-- RPC 3: rpt_tiempos_workflow  (patched)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpt_tiempos_workflow(
  p_empresa_id  uuid,
  p_fecha_desde date,
  p_fecha_hasta date
)
RETURNS TABLE (
  rendicion_id           uuid,
  rendicion_numero       text,
  usuario_nombre         text,
  fecha_envio            timestamp with time zone,
  fecha_primera_accion   timestamp with time zone,
  fecha_aprobacion_final timestamp with time zone,
  horas_espera_total     numeric,
  n_acciones             bigint,
  n_rechazos             bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM _bi_assert_empresa_member(p_empresa_id);

  RETURN QUERY
  SELECT
    r.id                                                       AS rendicion_id,
    r.numero                                                   AS rendicion_numero,
    (u.nombres || ' ' || COALESCE(u.apellidos, ''))::text     AS usuario_nombre,
    r.fecha_envio,
    MIN(a.fecha_accion)                                        AS fecha_primera_accion,
    r.fecha_aprobacion                                         AS fecha_aprobacion_final,
    ROUND(
      EXTRACT(EPOCH FROM (r.fecha_aprobacion - r.fecha_envio)) / 3600.0, 2
    )                                                          AS horas_espera_total,
    COUNT(a.id)                                                AS n_acciones,
    COUNT(a.id) FILTER (WHERE ac.codigo = 'rechazar')         AS n_rechazos
  FROM rendiciones r
  LEFT JOIN usuarios            u  ON u.id = r.usuario_id
  LEFT JOIN aprobaciones        a  ON a.rendicion_id = r.id
  LEFT JOIN acciones_aprobacion ac ON ac.id = a.accion_id
  WHERE r.empresa_id = p_empresa_id
    AND r.fecha_envio::date BETWEEN p_fecha_desde AND p_fecha_hasta
    AND r.deleted_at IS NULL
  GROUP BY r.id, r.numero, u.nombres, u.apellidos, r.fecha_envio, r.fecha_aprobacion
  ORDER BY r.fecha_envio DESC;
END;
$$;

-- =============================================================================
-- RPC 4: rpt_resumen_ejecutivo  (patched — ya era plpgsql, agrega guard)
-- =============================================================================
CREATE OR REPLACE FUNCTION rpt_resumen_ejecutivo(
  p_empresa_id  uuid,
  p_fecha_desde date,
  p_fecha_hasta date
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_facturado      numeric;
  v_total_reembolsable   numeric;
  v_total_rendiciones    bigint;
  v_pendientes           bigint;
  v_aprobadas            bigint;
  v_rechazadas           bigint;
  v_score_ia             numeric;
  v_total_anticipos      numeric;
  v_anticipos_liquidados bigint;
BEGIN
  -- [SEC] Validar membresía antes de cualquier consulta
  PERFORM _bi_assert_empresa_member(p_empresa_id);

  SELECT
    COALESCE(SUM(r.total_facturado), 0),
    COALESCE(SUM(r.total_reembolsable), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE er.codigo = 'aprobada'),
    COUNT(*) FILTER (WHERE er.codigo = 'rechazada')
  INTO v_total_facturado, v_total_reembolsable, v_total_rendiciones, v_aprobadas, v_rechazadas
  FROM rendiciones r
  LEFT JOIN estados_rendicion er ON er.id = r.estado_rendicion_id
  WHERE r.empresa_id = p_empresa_id
    AND (r.fecha_rendicion BETWEEN p_fecha_desde AND p_fecha_hasta)
    AND r.deleted_at IS NULL;

  SELECT COUNT(*)
  INTO v_pendientes
  FROM rendiciones r
  LEFT JOIN estados_rendicion er ON er.id = r.estado_rendicion_id
  WHERE r.empresa_id = p_empresa_id
    AND er.codigo = 'enviada'
    AND r.deleted_at IS NULL;

  SELECT ROUND(AVG(ai.score)::numeric, 1)
  INTO v_score_ia
  FROM auditorias_ia ai
  WHERE ai.empresa_id = p_empresa_id
    AND ai.procesado_en::date BETWEEN p_fecha_desde AND p_fecha_hasta;

  SELECT
    COALESCE(SUM(valor), 0),
    COUNT(*) FILTER (WHERE rendicion_id IS NOT NULL)
  INTO v_total_anticipos, v_anticipos_liquidados
  FROM anticipos
  WHERE empresa_id = p_empresa_id
    AND (fecha BETWEEN p_fecha_desde AND p_fecha_hasta);

  RETURN jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_facturado',        v_total_facturado,
      'total_reembolsable',     v_total_reembolsable,
      'total_rendiciones',      v_total_rendiciones,
      'rendiciones_aprobadas',  v_aprobadas,
      'rendiciones_rechazadas', v_rechazadas,
      'pendientes',             v_pendientes,
      'tasa_aprobacion',        CASE WHEN v_total_rendiciones > 0
                                  THEN ROUND(v_aprobadas::numeric / v_total_rendiciones * 100, 2)
                                  ELSE NULL END,
      'score_promedio_ia',      v_score_ia,
      'total_anticipos',        v_total_anticipos,
      'anticipos_liquidados',   v_anticipos_liquidados
    ),
    'periodo', jsonb_build_object(
      'fecha_desde', p_fecha_desde,
      'fecha_hasta', p_fecha_hasta
    )
  );
END;
$$;
