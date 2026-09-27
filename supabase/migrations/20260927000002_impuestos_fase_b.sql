-- ─────────────────────────────────────────────────────────────────────────────
-- Módulo Impuestos SRI Ecuador — Fase B: IR Anual + Anticipos
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tabla de anticipos IR pagados (cuotas julio y septiembre)
CREATE TABLE IF NOT EXISTS public.anticipos_ir (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID          NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  anio          INT           NOT NULL,
  cuota         INT           NOT NULL CHECK (cuota IN (1, 2)),  -- 1=julio, 2=septiembre
  monto         NUMERIC(14,2) NOT NULL DEFAULT 0,
  fecha_pago    DATE,
  comprobante   TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, anio, cuota)
);

ALTER TABLE public.anticipos_ir ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'anticipos_ir' AND policyname = 'anticipos_ir_empresa_all'
  ) THEN
    CREATE POLICY anticipos_ir_empresa_all ON public.anticipos_ir
      FOR ALL USING (
        empresa_id IN (
          SELECT eu.empresa_id FROM public.empresas_usuarios eu
          WHERE eu.usuario_id = auth.uid() AND eu.activo = true
        )
      );
  END IF;
END $$;

-- 2. RPC — upsert de un anticipo IR (cuota 1 o 2)
CREATE OR REPLACE FUNCTION public.upsert_anticipo_ir(
  p_empresa_id  UUID,
  p_anio        INT,
  p_cuota       INT,           -- 1 = julio, 2 = septiembre
  p_monto       NUMERIC,
  p_fecha       DATE    DEFAULT NULL,
  p_comprobante TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.anticipos_ir (empresa_id, anio, cuota, monto, fecha_pago, comprobante)
  VALUES (p_empresa_id, p_anio, p_cuota, p_monto, p_fecha, p_comprobante)
  ON CONFLICT (empresa_id, anio, cuota) DO UPDATE
    SET monto       = EXCLUDED.monto,
        fecha_pago  = EXCLUDED.fecha_pago,
        comprobante = EXCLUDED.comprobante,
        updated_at  = NOW();
END;
$$;

-- 3. RPC — calcular IR anual (versión Fase B)
--    Agrega: anticipos_pagados, retenciones_por_mes
--    Actualiza: ir_a_pagar = GREATEST(ir_causado - retenciones - anticipos, 0)
-- DROP requerido porque cambia el RETURNS TABLE (Postgres no permite OR REPLACE con distinto tipo de retorno)
DROP FUNCTION IF EXISTS public.calcular_ir_anual(UUID, INT);
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
  anticipos_pagados        NUMERIC,
  ir_a_pagar               NUMERIC,
  anticipo_siguiente       NUMERIC,   -- 50 % del IR causado para el año siguiente
  retenciones_por_mes      JSONB      -- [{mes: 1, monto: 320.00}, ...]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_tipo      TEXT;
  v_ingresos  NUMERIC;
  v_gastos    NUMERIC;
  v_utilidad  NUMERIC;
  v_ir        NUMERIC;
  v_ret_ir    NUMERIC;
  v_anticipos NUMERIC;
  v_ret_mes   JSONB;
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

  -- Retenciones IR recibidas (total y por mes)
  SELECT
    COALESCE(SUM(ROUND(f.subtotal * COALESCE(f.retencion_ir_pct,0) / 100, 2)), 0)
  INTO v_ret_ir
  FROM public.facturas_emitidas f
  WHERE f.empresa_id  = p_empresa_id
    AND f.deleted_at IS NULL
    AND f.estado_sri != 'ANULADA'
    AND f.fecha::DATE BETWEEN v_desde AND v_hasta;

  SELECT COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object('mes', mes, 'monto', monto)
      ORDER BY mes
    )
    FROM (
      SELECT
        EXTRACT(MONTH FROM f.fecha)::INT AS mes,
        ROUND(SUM(f.subtotal * COALESCE(f.retencion_ir_pct,0) / 100), 2) AS monto
      FROM public.facturas_emitidas f
      WHERE f.empresa_id  = p_empresa_id
        AND f.deleted_at IS NULL
        AND f.estado_sri != 'ANULADA'
        AND f.fecha::DATE BETWEEN v_desde AND v_hasta
        AND COALESCE(f.retencion_ir_pct, 0) > 0
      GROUP BY mes
    ) sub),
    '[]'::jsonb
  ) INTO v_ret_mes;

  -- Anticipos pagados este año (cuota 1 + cuota 2)
  SELECT COALESCE(SUM(a.monto), 0) INTO v_anticipos
  FROM public.anticipos_ir a
  WHERE a.empresa_id = p_empresa_id
    AND a.anio = p_anio;

  RETURN QUERY SELECT
    v_tipo,
    v_ingresos,
    v_gastos,
    v_utilidad,
    v_ir,
    v_ret_ir,
    v_anticipos,
    GREATEST(v_ir - v_ret_ir - v_anticipos, 0)::NUMERIC,
    ROUND(v_ir * 0.50, 2)::NUMERIC,
    v_ret_mes;
END;
$$;
