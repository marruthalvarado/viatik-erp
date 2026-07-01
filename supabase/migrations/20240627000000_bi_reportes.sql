-- =============================================================================
-- FASE 8A: Infraestructura BI y Reportes
-- Viatik ERP · feature/reportes
-- =============================================================================
-- Contiene:
--   · 7 vistas SQL analíticas (vw_rpt_*)
--   · 4 RPCs de reportes (rpt_*)
--   · 12 índices de rendimiento
-- Todas las vistas son de solo lectura. No modifica tablas existentes.
-- =============================================================================

-- ─── ÍNDICES DE RENDIMIENTO ───────────────────────────────────────────────────
-- Se crean primero para que las vistas los usen al ejecutarse.

-- Gastos: filtros más frecuentes en reportes
CREATE INDEX IF NOT EXISTS idx_gastos_fecha
  ON gastos (empresa_id, fecha);

CREATE INDEX IF NOT EXISTS idx_gastos_categoria_fecha
  ON gastos (empresa_id, categoria_gasto_id, fecha);

CREATE INDEX IF NOT EXISTS idx_gastos_proveedor
  ON gastos (empresa_id, proveedor_id);

CREATE INDEX IF NOT EXISTS idx_gastos_rendicion
  ON gastos (rendicion_id);

-- Rendiciones: filtros por estado y período
CREATE INDEX IF NOT EXISTS idx_rendiciones_estado
  ON rendiciones (empresa_id, estado_rendicion_id);

CREATE INDEX IF NOT EXISTS idx_rendiciones_fecha
  ON rendiciones (empresa_id, fecha_rendicion);

CREATE INDEX IF NOT EXISTS idx_rendiciones_usuario
  ON rendiciones (empresa_id, usuario_id);

CREATE INDEX IF NOT EXISTS idx_rendiciones_proyecto
  ON rendiciones (empresa_id, proyecto_id);

-- Aprobaciones: análisis de workflow
CREATE INDEX IF NOT EXISTS idx_aprobaciones_usuario_fecha
  ON aprobaciones (empresa_id, usuario_id, fecha_accion);

CREATE INDEX IF NOT EXISTS idx_aprobaciones_rendicion_fecha
  ON aprobaciones (rendicion_id, fecha_accion);

-- Historial workflow
CREATE INDEX IF NOT EXISTS idx_historial_rendicion_fecha
  ON historial_workflow (rendicion_id, created_at);

-- Auditoría IA: filtros por score y empresa
CREATE INDEX IF NOT EXISTS idx_auditorias_ia_score
  ON auditorias_ia (empresa_id, score);


-- =============================================================================
-- VISTA 1: vw_rpt_rendiciones_estado
-- Propósito: Reporte operativo RPT-OPS-01 — estado de todas las rendiciones.
-- Joins: rendiciones + estados + tipos + proyectos + usuarios
-- =============================================================================
CREATE OR REPLACE VIEW vw_rpt_rendiciones_estado AS
SELECT
  r.id,
  r.numero,
  r.fecha_rendicion,
  r.fecha_envio,
  r.fecha_aprobacion,
  r.created_at,
  er.codigo                                                         AS estado_codigo,
  er.nombre                                                         AS estado_nombre,
  tr.nombre                                                         AS tipo_nombre,
  p.nombre                                                          AS proyecto_nombre,
  p.id                                                              AS proyecto_id,
  (u.nombres || ' ' || COALESCE(u.apellidos, ''))                  AS usuario_nombre,
  r.usuario_id,
  r.total_facturado,
  r.total_reembolsable,
  r.total_anticipos,
  r.saldo,
  EXTRACT(DAY FROM NOW() - r.updated_at)::integer                  AS dias_en_estado,
  r.score_auditoria,
  r.empresa_id,
  r.politica_id,
  r.tipo_rendicion_id,
  r.estado_rendicion_id,
  r.workflow_id
FROM rendiciones r
LEFT JOIN estados_rendicion  er ON er.id = r.estado_rendicion_id
LEFT JOIN tipos_rendicion    tr ON tr.id = r.tipo_rendicion_id
LEFT JOIN proyectos          p  ON p.id  = r.proyecto_id
LEFT JOIN usuarios           u  ON u.id  = r.usuario_id
WHERE r.deleted_at IS NULL;

-- RLS: filtrar por empresa del usuario autenticado
ALTER VIEW vw_rpt_rendiciones_estado OWNER TO postgres;


-- =============================================================================
-- VISTA 2: vw_rpt_gastos_detalle
-- Propósito: Reporte operativo RPT-OPS-02 — gastos con clasificación completa.
-- Joins: gastos + rendiciones + proyectos + categorías + proveedores + estados
-- =============================================================================
CREATE OR REPLACE VIEW vw_rpt_gastos_detalle AS
SELECT
  g.id,
  g.fecha,
  g.rendicion_id,
  r.numero                                                          AS rendicion_numero,
  r.proyecto_id,
  p.nombre                                                          AS proyecto_nombre,
  cg.nombre                                                         AS categoria_nombre,
  cg.id                                                             AS categoria_gasto_id,
  pv.nombre                                                         AS proveedor_nombre,
  pv.id                                                             AS proveedor_id,
  g.valor_factura,
  g.valor_reembolsable,
  g.valor_moneda_base,
  g.valor_moneda_origen,
  g.moneda_codigo,
  g.tipo_cambio,
  g.numero_documento,
  g.es_manual,
  eg.codigo                                                         AS estado_codigo,
  og.nombre                                                         AS origen_nombre,
  g.empresa_id,
  g.created_at,
  g.observaciones
FROM gastos g
LEFT JOIN rendiciones      r  ON r.id  = g.rendicion_id
LEFT JOIN proyectos        p  ON p.id  = r.proyecto_id
LEFT JOIN categorias_gasto cg ON cg.id = g.categoria_gasto_id
LEFT JOIN proveedores      pv ON pv.id = g.proveedor_id
LEFT JOIN estados_gasto    eg ON eg.id = g.estado_gasto_id
LEFT JOIN origenes_gasto   og ON og.id = g.origen_gasto_id
WHERE g.deleted_at IS NULL;

ALTER VIEW vw_rpt_gastos_detalle OWNER TO postgres;


-- =============================================================================
-- VISTA 3: vw_rpt_viajes_detalle
-- Propósito: Reporte operativo RPT-OPS-03 — viajes con datos geográficos.
-- Joins: viajes + paises + rendiciones + proyectos + usuarios
-- =============================================================================
CREATE OR REPLACE VIEW vw_rpt_viajes_detalle AS
SELECT
  v.id,
  v.numero,
  v.fecha_inicio,
  v.fecha_fin,
  v.destino,
  pa.nombre                                                         AS pais_nombre,
  pa.id                                                             AS pais_id,
  v.distancia_km,
  v.vehiculo_propio,
  v.observaciones,
  CASE
    WHEN v.fecha_inicio IS NOT NULL AND v.fecha_fin IS NOT NULL
    THEN (v.fecha_fin::date - v.fecha_inicio::date + 1)
    ELSE NULL
  END                                                               AS duracion_dias,
  r.empresa_id,
  r.proyecto_id,
  p.nombre                                                          AS proyecto_nombre,
  r.usuario_id,
  (u.nombres || ' ' || COALESCE(u.apellidos, ''))                  AS usuario_nombre,
  v.rendicion_id,
  r.numero                                                          AS rendicion_numero
FROM viajes v
LEFT JOIN rendiciones r  ON r.id  = v.rendicion_id
LEFT JOIN proyectos   p  ON p.id  = r.proyecto_id
LEFT JOIN usuarios    u  ON u.id  = r.usuario_id
LEFT JOIN paises      pa ON pa.id = v.pais_id;

ALTER VIEW vw_rpt_viajes_detalle OWNER TO postgres;


-- =============================================================================
-- VISTA 4: vw_rpt_anticipos
-- Propósito: Reporte operativo RPT-OPS-04 — anticipos vs liquidaciones.
-- Joins: anticipos + proyectos + rendiciones
-- =============================================================================
CREATE OR REPLACE VIEW vw_rpt_anticipos AS
SELECT
  a.id,
  a.numero,
  a.fecha,
  a.valor,
  a.moneda_codigo,
  a.observacion,
  a.proyecto_id,
  p.nombre                                                          AS proyecto_nombre,
  a.rendicion_id,
  r.numero                                                          AS rendicion_numero,
  a.empresa_id,
  (a.rendicion_id IS NOT NULL)                                      AS liquidado
FROM anticipos a
LEFT JOIN proyectos  p ON p.id = a.proyecto_id
LEFT JOIN rendiciones r ON r.id = a.rendicion_id;

ALTER VIEW vw_rpt_anticipos OWNER TO postgres;


-- =============================================================================
-- VISTA 5: vw_rpt_aprobaciones_eficiencia
-- Propósito: Reportes de workflow RPT-WF-02 y RPT-WF-03.
-- Joins: aprobaciones + acciones + pasos + workflows + usuarios + rendiciones
-- =============================================================================
CREATE OR REPLACE VIEW vw_rpt_aprobaciones_eficiencia AS
SELECT
  ap.id                                                             AS aprobacion_id,
  ap.rendicion_id,
  r.numero                                                          AS rendicion_numero,
  ap.usuario_id                                                     AS aprobador_id,
  (u.nombres || ' ' || COALESCE(u.apellidos, ''))                  AS aprobador_nombre,
  wa.nombre                                                         AS workflow_nombre,
  wa.id                                                             AS workflow_id,
  wp.nombre                                                         AS paso_nombre,
  wp.orden                                                          AS paso_orden,
  ac.codigo                                                         AS accion_codigo,
  ac.nombre                                                         AS accion_nombre,
  ap.fecha_accion,
  ap.comentario,
  r.empresa_id,
  ap.created_at
FROM aprobaciones ap
LEFT JOIN rendiciones           r  ON r.id  = ap.rendicion_id
LEFT JOIN usuarios              u  ON u.id  = ap.usuario_id
LEFT JOIN workflow_pasos        wp ON wp.id = ap.workflow_paso_id
LEFT JOIN workflows_aprobacion  wa ON wa.id = wp.workflow_id
LEFT JOIN acciones_aprobacion   ac ON ac.id = ap.accion_id;

ALTER VIEW vw_rpt_aprobaciones_eficiencia OWNER TO postgres;


-- =============================================================================
-- VISTA 6: vw_rpt_ejecucion_presupuestaria
-- Propósito: Reporte financiero RPT-FIN-01 — presupuesto vs ejecución.
-- Joins: presupuestos + detalle + proyectos + categorías + gastos (agregado)
-- =============================================================================
CREATE OR REPLACE VIEW vw_rpt_ejecucion_presupuestaria AS
SELECT
  pr.id                                                             AS presupuesto_id,
  pr.nombre                                                         AS presupuesto_nombre,
  pr.anio,
  pr.proyecto_id,
  py.nombre                                                         AS proyecto_nombre,
  pr.empresa_id,
  pd.id                                                             AS detalle_id,
  pd.categoria_gasto_id,
  cg.nombre                                                         AS categoria_nombre,
  pd.valor_presupuestado,
  COALESCE(SUM(g.valor_factura), 0)                                 AS ejecutado,
  pd.valor_presupuestado - COALESCE(SUM(g.valor_factura), 0)        AS disponible,
  CASE
    WHEN pd.valor_presupuestado > 0
    THEN ROUND(
      (COALESCE(SUM(g.valor_factura), 0) / pd.valor_presupuestado)::numeric,
      4
    )
    ELSE 0
  END                                                               AS pct_ejecucion
FROM presupuestos pr
LEFT JOIN presupuesto_detalle pd ON pd.presupuesto_id = pr.id
LEFT JOIN proyectos           py ON py.id  = pr.proyecto_id
LEFT JOIN categorias_gasto    cg ON cg.id  = pd.categoria_gasto_id
LEFT JOIN gastos g
  ON  g.categoria_gasto_id = pd.categoria_gasto_id
  AND g.deleted_at IS NULL
  AND g.rendicion_id IN (
        SELECT id
        FROM rendiciones
        WHERE proyecto_id = pr.proyecto_id
          AND empresa_id  = pr.empresa_id
          AND deleted_at IS NULL
      )
WHERE pr.activo = true
GROUP BY
  pr.id, pr.nombre, pr.anio, pr.proyecto_id, py.nombre, pr.empresa_id,
  pd.id, pd.categoria_gasto_id, cg.nombre, pd.valor_presupuestado;

ALTER VIEW vw_rpt_ejecucion_presupuestaria OWNER TO postgres;


-- =============================================================================
-- VISTA 7: vw_rpt_cumplimiento_politicas
-- Propósito: Reporte de auditoría RPT-AUD-04 — gastos vs topes de política.
-- Joins: gastos + rendiciones + usuarios + categorías + políticas
-- =============================================================================
CREATE OR REPLACE VIEW vw_rpt_cumplimiento_politicas AS
SELECT
  g.id                                                              AS gasto_id,
  g.fecha,
  r.id                                                              AS rendicion_id,
  r.numero                                                          AS rendicion_numero,
  r.usuario_id,
  (u.nombres || ' ' || COALESCE(u.apellidos, ''))                  AS usuario_nombre,
  cg.nombre                                                         AS categoria_nombre,
  cg.id                                                             AS categoria_gasto_id,
  cg.codigo                                                         AS categoria_codigo,
  pol.id                                                            AS politica_id,
  pol.nombre                                                        AS politica_nombre,
  CASE cg.codigo
    WHEN 'almuerzo'   THEN pol.tope_almuerzo
    WHEN 'cena'       THEN pol.tope_cena
    WHEN 'desayuno'   THEN pol.tope_desayuno
    WHEN 'hospedaje'  THEN pol.tope_hospedaje
    WHEN 'miscelaneo' THEN pol.tope_miscelaneo
    ELSE NULL
  END                                                               AS tope_politica,
  g.valor_reembolsable                                              AS valor_gasto,
  GREATEST(
    g.valor_reembolsable - COALESCE(
      CASE cg.codigo
        WHEN 'almuerzo'   THEN pol.tope_almuerzo
        WHEN 'cena'       THEN pol.tope_cena
        WHEN 'desayuno'   THEN pol.tope_desayuno
        WHEN 'hospedaje'  THEN pol.tope_hospedaje
        WHEN 'miscelaneo' THEN pol.tope_miscelaneo
        ELSE NULL
      END,
      0
    ),
    0
  )                                                                 AS excedente,
  r.empresa_id
FROM gastos g
LEFT JOIN rendiciones      r   ON r.id   = g.rendicion_id
LEFT JOIN usuarios         u   ON u.id   = r.usuario_id
LEFT JOIN categorias_gasto cg  ON cg.id  = g.categoria_gasto_id
LEFT JOIN politicas        pol ON pol.id = r.politica_id
WHERE g.deleted_at IS NULL
  AND pol.id IS NOT NULL;

ALTER VIEW vw_rpt_cumplimiento_politicas OWNER TO postgres;


-- =============================================================================
-- RPC 1: rpt_evolucion_mensual
-- Propósito: Serie temporal de gastos por mes y año para RPT-FIN-02.
-- Parámetros: empresa_id, anio_desde, anio_hasta, categoria_id (opcional)
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
LANGUAGE sql
AS $$
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
$$;


-- =============================================================================
-- RPC 2: rpt_top_proveedores
-- Propósito: Ranking de proveedores por gasto para RPT-GER-05.
-- Parámetros: empresa_id, fecha_desde, fecha_hasta, limite (default 10)
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
LANGUAGE sql
AS $$
  WITH total_empresa AS (
    SELECT COALESCE(SUM(g.valor_factura), 0) AS monto
    FROM gastos g
    INNER JOIN rendiciones r ON r.id = g.rendicion_id
    WHERE r.empresa_id = p_empresa_id
      AND g.fecha BETWEEN p_fecha_desde AND p_fecha_hasta
      AND g.deleted_at IS NULL
      AND r.deleted_at IS NULL
  ),
  por_proveedor AS (
    SELECT
      g.proveedor_id,
      COUNT(*)                     AS n_gastos,
      SUM(g.valor_factura)         AS total
    FROM gastos g
    INNER JOIN rendiciones r ON r.id = g.rendicion_id
    WHERE r.empresa_id = p_empresa_id
      AND g.fecha BETWEEN p_fecha_desde AND p_fecha_hasta
      AND g.proveedor_id IS NOT NULL
      AND g.deleted_at IS NULL
      AND r.deleted_at IS NULL
    GROUP BY g.proveedor_id
    ORDER BY total DESC
    LIMIT p_limite
  ),
  cat_principal AS (
    SELECT DISTINCT ON (sub.proveedor_id)
      sub.proveedor_id,
      sub.categoria_nombre
    FROM (
      SELECT
        g.proveedor_id,
        cg.nombre AS categoria_nombre,
        COUNT(*)  AS cnt
      FROM gastos g
      INNER JOIN rendiciones      r  ON r.id  = g.rendicion_id
      LEFT  JOIN categorias_gasto cg ON cg.id = g.categoria_gasto_id
      WHERE r.empresa_id = p_empresa_id
        AND g.fecha BETWEEN p_fecha_desde AND p_fecha_hasta
        AND g.deleted_at IS NULL
        AND r.deleted_at IS NULL
        AND g.proveedor_id IS NOT NULL
      GROUP BY g.proveedor_id, cg.nombre
    ) sub
    ORDER BY sub.proveedor_id, sub.cnt DESC
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
  LEFT JOIN proveedores       pv ON pv.id = pp.proveedor_id
  LEFT JOIN cat_principal     cp ON cp.proveedor_id = pp.proveedor_id
  ORDER BY pp.total DESC;
$$;


-- =============================================================================
-- RPC 3: rpt_tiempos_workflow
-- Propósito: Análisis de tiempos de ciclo en workflow para RPT-WF-02.
-- Parámetros: empresa_id, fecha_desde, fecha_hasta
-- =============================================================================
CREATE OR REPLACE FUNCTION rpt_tiempos_workflow(
  p_empresa_id  uuid,
  p_fecha_desde date,
  p_fecha_hasta date
)
RETURNS TABLE (
  rendicion_id          uuid,
  rendicion_numero      text,
  usuario_nombre        text,
  fecha_envio           timestamp with time zone,
  fecha_primera_accion  timestamp with time zone,
  fecha_aprobacion_final timestamp with time zone,
  horas_espera_total    numeric,
  n_acciones            bigint,
  n_rechazos            bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT
    r.id                                                              AS rendicion_id,
    r.numero                                                          AS rendicion_numero,
    (u.nombres || ' ' || COALESCE(u.apellidos, ''))::text            AS usuario_nombre,
    r.fecha_envio,
    MIN(a.fecha_accion)                                               AS fecha_primera_accion,
    r.fecha_aprobacion                                                AS fecha_aprobacion_final,
    ROUND(
      EXTRACT(EPOCH FROM (r.fecha_aprobacion - r.fecha_envio)) / 3600.0,
      2
    )                                                                 AS horas_espera_total,
    COUNT(a.id)                                                       AS n_acciones,
    COUNT(a.id) FILTER (WHERE ac.codigo = 'rechazar')                AS n_rechazos
  FROM rendiciones r
  LEFT JOIN usuarios              u  ON u.id  = r.usuario_id
  LEFT JOIN aprobaciones          a  ON a.rendicion_id = r.id
  LEFT JOIN acciones_aprobacion   ac ON ac.id = a.accion_id
  WHERE r.empresa_id = p_empresa_id
    AND r.fecha_envio::date BETWEEN p_fecha_desde AND p_fecha_hasta
    AND r.deleted_at IS NULL
  GROUP BY
    r.id, r.numero, u.nombres, u.apellidos, r.fecha_envio, r.fecha_aprobacion
  ORDER BY r.fecha_envio DESC;
$$;


-- =============================================================================
-- RPC 4: rpt_resumen_ejecutivo
-- Propósito: KPIs consolidados para RPT-GER-01 (una sola llamada).
-- Parámetros: empresa_id, fecha_desde, fecha_hasta
-- Retorna: JSONB con kpis consolidados
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
  v_total_facturado     numeric;
  v_total_reembolsable  numeric;
  v_total_rendiciones   bigint;
  v_pendientes          bigint;
  v_aprobadas           bigint;
  v_rechazadas          bigint;
  v_score_ia            numeric;
  v_total_anticipos     numeric;
  v_anticipos_liquidados bigint;
BEGIN
  -- KPIs de rendiciones en el período
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

  -- Rendiciones pendientes (estado=enviada, sin límite de fecha)
  SELECT COUNT(*)
  INTO v_pendientes
  FROM rendiciones r
  LEFT JOIN estados_rendicion er ON er.id = r.estado_rendicion_id
  WHERE r.empresa_id = p_empresa_id
    AND er.codigo = 'enviada'
    AND r.deleted_at IS NULL;

  -- Score promedio IA en el período
  SELECT ROUND(AVG(ai.score)::numeric, 1)
  INTO v_score_ia
  FROM auditorias_ia ai
  WHERE ai.empresa_id = p_empresa_id
    AND ai.procesado_en::date BETWEEN p_fecha_desde AND p_fecha_hasta;

  -- Anticipos
  SELECT
    COALESCE(SUM(valor), 0),
    COUNT(*) FILTER (WHERE rendicion_id IS NOT NULL)
  INTO v_total_anticipos, v_anticipos_liquidados
  FROM anticipos
  WHERE empresa_id = p_empresa_id
    AND (fecha BETWEEN p_fecha_desde AND p_fecha_hasta);

  RETURN jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_facturado',       v_total_facturado,
      'total_reembolsable',    v_total_reembolsable,
      'total_rendiciones',     v_total_rendiciones,
      'rendiciones_aprobadas', v_aprobadas,
      'rendiciones_rechazadas', v_rechazadas,
      'pendientes',            v_pendientes,
      'tasa_aprobacion',       CASE WHEN v_total_rendiciones > 0
                                 THEN ROUND(v_aprobadas::numeric / v_total_rendiciones * 100, 2)
                                 ELSE NULL END,
      'score_promedio_ia',     v_score_ia,
      'total_anticipos',       v_total_anticipos,
      'anticipos_liquidados',  v_anticipos_liquidados
    ),
    'periodo', jsonb_build_object(
      'fecha_desde', p_fecha_desde,
      'fecha_hasta', p_fecha_hasta
    )
  );
END;
$$;
