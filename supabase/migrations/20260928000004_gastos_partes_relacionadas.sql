-- ─────────────────────────────────────────────────────────────────────────────
-- Gastos empresa: flag partes relacionadas + tipo de gasto relacionado
-- LRTI Art. 10 numeral 5 / RLRTI Art. 28 numeral 11
-- Topes: regalías/servicios → 20% base imponible + gasto
--         gastos indirectos  →  5% base imponible + gasto
-- ─────────────────────────────────────────────────────────────────────────────

SET statement_timeout = 0;

-- Campo: ¿es gasto con parte relacionada?
ALTER TABLE public.gastos_empresa
  ADD COLUMN IF NOT EXISTS es_parte_relacionada BOOLEAN NOT NULL DEFAULT false;

-- Tipo de gasto relacionado (para determinar qué tope aplica)
ALTER TABLE public.gastos_empresa
  ADD COLUMN IF NOT EXISTS tipo_parte_relacionada TEXT
    CHECK (tipo_parte_relacionada IN ('royalties_servicios', 'gastos_indirectos', 'intereses'))
    DEFAULT NULL;

-- RPC: calcular topes de partes relacionadas para un año fiscal
CREATE OR REPLACE FUNCTION public.calcular_topes_partes_relacionadas(
  p_empresa_id UUID,
  p_anio       INT
)
RETURNS TABLE (
  -- Tope royalties/servicios (Art. 10 num 5): 20% de base imponible + gasto
  gastos_royalties_servicios   NUMERIC,
  limite_royalties_servicios   NUMERIC,
  exceso_royalties_servicios   NUMERIC,
  pct_usado_royalties          NUMERIC,   -- porcentaje del tope consumido

  -- Tope gastos indirectos (Art. 10 num 5): 5% de base imponible + gasto
  gastos_indirectos            NUMERIC,
  limite_indirectos            NUMERIC,
  exceso_indirectos            NUMERIC,
  pct_usado_indirectos         NUMERIC,

  -- Base imponible del año (ingresos - gastos no relacionados)
  base_imponible_referencia    NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_desde         DATE := make_date(p_anio, 1, 1);
  v_hasta         DATE := make_date(p_anio, 12, 31);
  v_ingresos      NUMERIC;
  v_gastos_otros  NUMERIC;  -- gastos no relacionados (base para el cálculo del límite)
  v_royalties     NUMERIC;
  v_indirectos    NUMERIC;
  v_base_ref      NUMERIC;
  v_lim_roy       NUMERIC;
  v_lim_ind       NUMERIC;
BEGIN
  -- Ingresos gravables del año
  SELECT COALESCE(SUM(f.subtotal), 0) INTO v_ingresos
  FROM public.facturas_emitidas f
  WHERE f.empresa_id   = p_empresa_id
    AND f.deleted_at  IS NULL
    AND f.estado_sri  != 'ANULADA'
    AND f.fecha::DATE BETWEEN v_desde AND v_hasta;

  -- Gastos deducibles NO relacionados (base para los topes)
  SELECT COALESCE(SUM(g.total), 0) INTO v_gastos_otros
  FROM public.gastos_empresa g
  WHERE g.empresa_id         = p_empresa_id
    AND g.deleted_at        IS NULL
    AND g.es_deducible       = true
    AND g.es_parte_relacionada = false
    AND g.fecha::DATE BETWEEN v_desde AND v_hasta;

  -- Gastos royalties/servicios a partes relacionadas
  SELECT COALESCE(SUM(g.total), 0) INTO v_royalties
  FROM public.gastos_empresa g
  WHERE g.empresa_id              = p_empresa_id
    AND g.deleted_at             IS NULL
    AND g.es_deducible            = true
    AND g.es_parte_relacionada    = true
    AND g.tipo_parte_relacionada  = 'royalties_servicios'
    AND g.fecha::DATE BETWEEN v_desde AND v_hasta;

  -- Gastos indirectos a partes relacionadas
  SELECT COALESCE(SUM(g.total), 0) INTO v_indirectos
  FROM public.gastos_empresa g
  WHERE g.empresa_id              = p_empresa_id
    AND g.deleted_at             IS NULL
    AND g.es_deducible            = true
    AND g.es_parte_relacionada    = true
    AND g.tipo_parte_relacionada  = 'gastos_indirectos'
    AND g.fecha::DATE BETWEEN v_desde AND v_hasta;

  -- Base imponible de referencia = ingresos - gastos no relacionados
  v_base_ref := GREATEST(v_ingresos - v_gastos_otros, 0);

  -- Límites (LRTI Art. 10 num 5)
  -- Límite royalties = 20% × (base_ref + royalties)
  v_lim_roy := 0.20 * (v_base_ref + v_royalties);
  -- Límite indirectos = 5% × (base_ref + indirectos)
  v_lim_ind := 0.05 * (v_base_ref + v_indirectos);

  RETURN QUERY SELECT
    v_royalties,
    v_lim_roy,
    GREATEST(v_royalties - v_lim_roy, 0),
    CASE WHEN v_lim_roy > 0 THEN ROUND((v_royalties / v_lim_roy) * 100, 1) ELSE 0 END,
    v_indirectos,
    v_lim_ind,
    GREATEST(v_indirectos - v_lim_ind, 0),
    CASE WHEN v_lim_ind > 0 THEN ROUND((v_indirectos / v_lim_ind) * 100, 1) ELSE 0 END,
    v_base_ref;
END;
$$;
