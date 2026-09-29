-- ─────────────────────────────────────────────────────────────────────────────
-- IVA: arrastre de crédito tributario entre meses
-- LRTI Art. 69 / Reglamento LRTI Art. 154
-- El saldo a favor (crédito no consumido) de un mes se arrastra al siguiente.
-- ─────────────────────────────────────────────────────────────────────────────

SET statement_timeout = 0;

CREATE OR REPLACE FUNCTION public.calcular_iva_periodo(
  p_empresa_id  UUID,
  p_anio        INT,
  p_mes         INT  DEFAULT NULL,   -- 1‑12 para declaración mensual
  p_semestre    INT  DEFAULT NULL    -- 1 ó 2 para declaración semestral
)
RETURNS TABLE (
  iva_ventas                    NUMERIC,
  retenciones_iva_recibidas     NUMERIC,
  credito_tributario_compras    NUMERIC,
  credito_tributario_anterior   NUMERIC,   -- ← nuevo: arrastre de meses previos
  iva_a_pagar                   NUMERIC,
  num_facturas                  BIGINT,
  num_compras                   BIGINT,
  detalle_ventas                JSONB,
  detalle_compras               JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_desde              DATE;
  v_hasta              DATE;
  -- acumulación de crédito de meses anteriores
  v_credito_anterior   NUMERIC := 0;
  v_mes_iter           INT;
  v_iva_v              NUMERIC;
  v_ret                NUMERIC;
  v_cred_c             NUMERIC;
  v_net                NUMERIC;
BEGIN
  -- ── Definir rango del período solicitado ────────────────────────────────────
  IF p_mes IS NOT NULL THEN
    v_desde := make_date(p_anio, p_mes, 1);
    v_hasta := (v_desde + INTERVAL '1 month - 1 day')::DATE;
  ELSIF p_semestre = 1 THEN
    v_desde := make_date(p_anio,  1,  1);
    v_hasta := make_date(p_anio,  6, 30);
  ELSIF p_semestre = 2 THEN
    v_desde := make_date(p_anio,  7,  1);
    v_hasta := make_date(p_anio, 12, 31);
  ELSE
    v_desde := make_date(p_anio,  1,  1);
    v_hasta := make_date(p_anio, 12, 31);
  END IF;

  -- ── Calcular crédito acumulado de meses 1..(p_mes-1) ───────────────────────
  -- Solo aplica para declaración mensual y a partir de febrero (p_mes > 1).
  IF p_mes IS NOT NULL AND p_mes > 1 THEN
    FOR v_mes_iter IN 1..(p_mes - 1) LOOP

      -- IVA ventas del mes iterado
      SELECT
        COALESCE(SUM(f.iva), 0),
        COALESCE(SUM(ROUND(f.iva * COALESCE(f.retencion_iva_pct, 0) / 100.0, 2)), 0)
      INTO v_iva_v, v_ret
      FROM public.facturas_emitidas f
      WHERE f.empresa_id   = p_empresa_id
        AND f.deleted_at  IS NULL
        AND f.estado_sri  != 'ANULADA'
        AND f.tipo         = 'factura'
        AND EXTRACT(YEAR  FROM f.fecha::DATE)::INT = p_anio
        AND EXTRACT(MONTH FROM f.fecha::DATE)::INT = v_mes_iter;

      -- IVA compras deducibles del mes iterado
      SELECT COALESCE(SUM(g.iva), 0)
      INTO v_cred_c
      FROM public.gastos_empresa g
      WHERE g.empresa_id   = p_empresa_id
        AND g.deleted_at  IS NULL
        AND g.es_deducible = true
        AND EXTRACT(YEAR  FROM g.fecha::DATE)::INT = p_anio
        AND EXTRACT(MONTH FROM g.fecha::DATE)::INT = v_mes_iter;

      -- Resultado neto del mes (incluyendo crédito arrastrado de meses aún anteriores)
      v_net := v_iva_v - v_ret - v_cred_c - v_credito_anterior;

      IF v_net < 0 THEN
        -- Saldo a favor: se arrastra al mes siguiente
        v_credito_anterior := -v_net;
      ELSE
        -- Se pagó IVA (o quedó en cero): no hay crédito a arrastrar
        v_credito_anterior := 0;
      END IF;

    END LOOP;
  END IF;

  -- ── Calcular IVA del período solicitado ────────────────────────────────────
  RETURN QUERY
  WITH ventas AS (
    SELECT
      COALESCE(SUM(f.iva), 0)::NUMERIC                                                     AS t_iva,
      COALESCE(SUM(ROUND(f.iva * COALESCE(f.retencion_iva_pct, 0) / 100.0, 2)), 0)::NUMERIC AS t_ret,
      COUNT(*)::BIGINT                                                                     AS cnt,
      COALESCE(jsonb_agg(jsonb_build_object(
        'numero',        f.numero,
        'razon_social',  f.razon_social,
        'fecha',         f.fecha,
        'subtotal',      f.subtotal,
        'iva',           f.iva,
        'ret_iva_pct',   COALESCE(f.retencion_iva_pct, 0),
        'ret_iva_monto', ROUND(f.iva * COALESCE(f.retencion_iva_pct, 0) / 100.0, 2)
      ) ORDER BY f.fecha), '[]'::jsonb)                                                    AS detalle
    FROM public.facturas_emitidas f
    WHERE f.empresa_id   = p_empresa_id
      AND f.deleted_at  IS NULL
      AND f.estado_sri  != 'ANULADA'
      AND f.tipo         = 'factura'
      AND f.fecha::DATE BETWEEN v_desde AND v_hasta
  ),
  compras AS (
    SELECT
      COALESCE(SUM(g.iva), 0)::NUMERIC AS t_iva,
      COUNT(*)::BIGINT                  AS cnt,
      COALESCE(jsonb_agg(jsonb_build_object(
        'descripcion', g.descripcion,
        'fecha',       g.fecha,
        'subtotal',    g.subtotal,
        'iva',         g.iva,
        'ruc_emisor',  g.ruc_emisor,
        'numero_doc',  g.numero_documento
      ) ORDER BY g.fecha), '[]'::jsonb) AS detalle
    FROM public.gastos_empresa g
    WHERE g.empresa_id   = p_empresa_id
      AND g.deleted_at  IS NULL
      AND g.es_deducible = true
      AND g.fecha::DATE BETWEEN v_desde AND v_hasta
  )
  SELECT
    v.t_iva,                                                                     -- iva_ventas
    v.t_ret,                                                                     -- retenciones_iva_recibidas
    c.t_iva,                                                                     -- credito_tributario_compras
    v_credito_anterior::NUMERIC,                                                 -- credito_tributario_anterior
    GREATEST(v.t_iva - v.t_ret - c.t_iva - v_credito_anterior, 0)::NUMERIC,    -- iva_a_pagar
    v.cnt,
    c.cnt,
    v.detalle,
    c.detalle
  FROM ventas v, compras c;
END;
$$;
