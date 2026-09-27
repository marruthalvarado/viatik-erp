-- ─────────────────────────────────────────────────────────────────────────────
-- Módulo Impuestos SRI Ecuador — Fase A
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tipo de contribuyente por empresa
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS tipo_contribuyente TEXT DEFAULT 'sociedad'
    CHECK (tipo_contribuyente IN (
      'sociedad',
      'persona_natural_obligada',
      'persona_natural_no_obligada',
      'rise'
    ));

-- 2. Tabla historial de declaraciones SRI
CREATE TABLE IF NOT EXISTS public.declaraciones_sri (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo                        TEXT NOT NULL
    CHECK (tipo IN ('iva_mensual','iva_semestral','ir_anual','anticipo_ir')),
  anio                        INT  NOT NULL,
  periodo                     INT,          -- mes 1‑12 (mensual) | semestre 1‑2 | NULL (anual)
  -- IVA
  iva_ventas                  NUMERIC(14,2) NOT NULL DEFAULT 0,
  retenciones_iva_recibidas   NUMERIC(14,2) NOT NULL DEFAULT 0,
  credito_tributario_compras  NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_a_pagar                 NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- IR
  ingresos_gravables          NUMERIC(14,2) NOT NULL DEFAULT 0,
  gastos_deducibles           NUMERIC(14,2) NOT NULL DEFAULT 0,
  utilidad_gravable           NUMERIC(14,2) NOT NULL DEFAULT 0,
  ir_causado                  NUMERIC(14,2) NOT NULL DEFAULT 0,
  retenciones_ir_recibidas    NUMERIC(14,2) NOT NULL DEFAULT 0,
  anticipos_pagados           NUMERIC(14,2) NOT NULL DEFAULT 0,
  ir_a_pagar                  NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Estado
  estado                      TEXT NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador','presentada','pagada')),
  fecha_presentacion          DATE,
  observacion                 TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.declaraciones_sri ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'declaraciones_sri' AND policyname = 'declaraciones_sri_empresa_all'
  ) THEN
    CREATE POLICY declaraciones_sri_empresa_all ON public.declaraciones_sri
      FOR ALL USING (
        empresa_id IN (
          SELECT eu.empresa_id FROM public.empresas_usuarios eu
          WHERE eu.usuario_id = auth.uid() AND eu.activo = true
        )
      );
  END IF;
END $$;

-- 3. RPC — calcular IVA de un período
CREATE OR REPLACE FUNCTION public.calcular_iva_periodo(
  p_empresa_id  UUID,
  p_anio        INT,
  p_mes         INT  DEFAULT NULL,     -- 1‑12 para mensual
  p_semestre    INT  DEFAULT NULL      -- 1 ó 2 para semestral
)
RETURNS TABLE (
  iva_ventas                  NUMERIC,
  retenciones_iva_recibidas   NUMERIC,
  credito_tributario_compras  NUMERIC,
  iva_a_pagar                 NUMERIC,
  num_facturas                BIGINT,
  num_compras                 BIGINT,
  detalle_ventas              JSONB,
  detalle_compras             JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_desde DATE;
  v_hasta DATE;
BEGIN
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

  RETURN QUERY
  WITH ventas AS (
    SELECT
      COALESCE(SUM(f.iva), 0)::NUMERIC                                                    AS t_iva,
      COALESCE(SUM(ROUND(f.iva * COALESCE(f.retencion_iva_pct,0) / 100, 2)), 0)::NUMERIC AS t_ret,
      COUNT(*)::BIGINT                                                                    AS cnt,
      COALESCE(jsonb_agg(jsonb_build_object(
        'numero',         f.numero,
        'razon_social',   f.razon_social,
        'fecha',          f.fecha,
        'subtotal',       f.subtotal,
        'iva',            f.iva,
        'ret_iva_pct',    COALESCE(f.retencion_iva_pct, 0),
        'ret_iva_monto',  ROUND(f.iva * COALESCE(f.retencion_iva_pct,0) / 100, 2)
      ) ORDER BY f.fecha), '[]'::jsonb)                                                   AS detalle
    FROM public.facturas_emitidas f
    WHERE f.empresa_id  = p_empresa_id
      AND f.deleted_at IS NULL
      AND f.estado_sri != 'ANULADA'
      AND f.tipo        = 'factura'
      AND f.fecha::DATE BETWEEN v_desde AND v_hasta
  ),
  compras AS (
    SELECT
      COALESCE(SUM(g.iva), 0)::NUMERIC AS t_iva,
      COUNT(*)::BIGINT                 AS cnt,
      COALESCE(jsonb_agg(jsonb_build_object(
        'descripcion', g.descripcion,
        'fecha',       g.fecha,
        'subtotal',    g.subtotal,
        'iva',         g.iva,
        'ruc_emisor',  g.ruc_emisor,
        'numero_doc',  g.numero_documento
      ) ORDER BY g.fecha), '[]'::jsonb) AS detalle
    FROM public.gastos_empresa g
    WHERE g.empresa_id  = p_empresa_id
      AND g.deleted_at IS NULL
      AND g.es_deducible = true
      AND g.fecha::DATE BETWEEN v_desde AND v_hasta
  )
  SELECT
    v.t_iva,
    v.t_ret,
    c.t_iva,
    GREATEST(v.t_iva - v.t_ret - c.t_iva, 0)::NUMERIC,
    v.cnt,
    c.cnt,
    v.detalle,
    c.detalle
  FROM ventas v, compras c;
END;
$$;

-- 4. RPC — calcular Impuesto a la Renta anual
CREATE OR REPLACE FUNCTION public.calcular_ir_anual(
  p_empresa_id UUID,
  p_anio       INT
)
RETURNS TABLE (
  tipo_contribuyente       TEXT,
  ingresos_gravables       NUMERIC,
  gastos_deducibles        NUMERIC,
  utilidad_gravable        NUMERIC,
  ir_causado               NUMERIC,
  retenciones_ir_recibidas NUMERIC,
  ir_a_pagar               NUMERIC,
  anticipo_siguiente       NUMERIC    -- 50 % del IR para anticipos año siguiente
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_tipo      TEXT;
  v_ingresos  NUMERIC;
  v_gastos    NUMERIC;
  v_utilidad  NUMERIC;
  v_ir        NUMERIC;
  v_ret_ir    NUMERIC;
  v_desde     DATE := make_date(p_anio,  1,  1);
  v_hasta     DATE := make_date(p_anio, 12, 31);
BEGIN
  SELECT COALESCE(e.tipo_contribuyente,'sociedad') INTO v_tipo
  FROM public.empresas e WHERE e.id = p_empresa_id;

  -- Ingresos gravables (subtotal sin IVA)
  SELECT COALESCE(SUM(f.subtotal), 0) INTO v_ingresos
  FROM public.facturas_emitidas f
  WHERE f.empresa_id  = p_empresa_id
    AND f.deleted_at IS NULL
    AND f.estado_sri != 'ANULADA'
    AND f.fecha::DATE BETWEEN v_desde AND v_hasta;

  -- Gastos deducibles
  SELECT COALESCE(SUM(g.total), 0) INTO v_gastos
  FROM public.gastos_empresa g
  WHERE g.empresa_id  = p_empresa_id
    AND g.deleted_at IS NULL
    AND g.es_deducible = true
    AND g.fecha::DATE  BETWEEN v_desde AND v_hasta;

  v_utilidad := GREATEST(v_ingresos - v_gastos, 0);

  -- IR causado
  IF v_tipo = 'sociedad' THEN
    v_ir := ROUND(v_utilidad * 0.25, 2);
  ELSE
    -- Tabla progresiva Ecuador 2024 (personas naturales)
    v_ir := CASE
      WHEN v_utilidad <=  11722 THEN 0
      WHEN v_utilidad <=  14931 THEN ROUND((v_utilidad -  11722) * 0.05,           2)
      WHEN v_utilidad <=  19385 THEN ROUND(   160 + (v_utilidad -  14931) * 0.10,  2)
      WHEN v_utilidad <=  25463 THEN ROUND(   606 + (v_utilidad -  19385) * 0.12,  2)
      WHEN v_utilidad <=  33603 THEN ROUND(  1336 + (v_utilidad -  25463) * 0.15,  2)
      WHEN v_utilidad <=  44721 THEN ROUND(  2557 + (v_utilidad -  33603) * 0.20,  2)
      WHEN v_utilidad <=  59960 THEN ROUND(  4781 + (v_utilidad -  44721) * 0.25,  2)
      WHEN v_utilidad <=  80000 THEN ROUND(  8591 + (v_utilidad -  59960) * 0.30,  2)
      ELSE                           ROUND( 14603 + (v_utilidad -  80000) * 0.35,  2)
    END;
  END IF;

  -- Retenciones IR recibidas de clientes
  SELECT COALESCE(SUM(ROUND(f.subtotal * COALESCE(f.retencion_ir_pct,0) / 100, 2)), 0) INTO v_ret_ir
  FROM public.facturas_emitidas f
  WHERE f.empresa_id  = p_empresa_id
    AND f.deleted_at IS NULL
    AND f.estado_sri != 'ANULADA'
    AND f.fecha::DATE BETWEEN v_desde AND v_hasta;

  RETURN QUERY SELECT
    v_tipo,
    v_ingresos,
    v_gastos,
    v_utilidad,
    v_ir,
    v_ret_ir,
    GREATEST(v_ir - v_ret_ir, 0)::NUMERIC,
    ROUND(v_ir * 0.50, 2)::NUMERIC;
END;
$$;
