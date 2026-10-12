-- =============================================================================
-- MÓDULO IMPORTACIONES — Costeo de Proyecto
-- Agrupa múltiples productos ya costeados, prorratea gastos compartidos y
-- calcula el precio de venta del proyecto completo.
-- =============================================================================

-- Limpieza idempotente (por si la migración falló a mitad)
DROP FUNCTION IF EXISTS public._cp_calcular_item CASCADE;
DROP FUNCTION IF EXISTS public.crear_costeo_proyecto CASCADE;
DROP FUNCTION IF EXISTS public.actualizar_costeo_proyecto CASCADE;
DROP TABLE IF EXISTS public.costeo_proyecto_items CASCADE;
DROP TABLE IF EXISTS public.costeos_proyecto CASCADE;

-- ── Tabla principal: costeos_proyecto ────────────────────────────────────────
CREATE TABLE public.costeos_proyecto (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL REFERENCES public.empresas(id),
  numero                text NOT NULL,               -- CP-2026-0001

  -- Vínculos opcionales
  proyecto_id           uuid REFERENCES public.proyectos(id) ON DELETE SET NULL,
  cotizacion_id         uuid REFERENCES public.cotizaciones(id) ON DELETE SET NULL,

  -- Metadatos
  descripcion           text NOT NULL DEFAULT '',
  estado                text NOT NULL DEFAULT 'borrador'
                          CHECK (estado IN ('borrador', 'finalizado')),
  moneda                text NOT NULL DEFAULT 'USD',

  -- Gastos compartidos de importación (USD)
  flete_total           numeric(14,2) NOT NULL DEFAULT 0,
  seguro_total          numeric(14,2) NOT NULL DEFAULT 0,
  agente_aduanas        numeric(14,2) NOT NULL DEFAULT 0,
  bodega                numeric(14,2) NOT NULL DEFAULT 0,
  otros_logistica       numeric(14,2) NOT NULL DEFAULT 0,

  -- Tasas arancelarias comunes (%)
  fodinfa_pct           numeric(5,2) NOT NULL DEFAULT 0.5,
  arancel_pct           numeric(5,2) NOT NULL DEFAULT 0,
  isd_pct               numeric(5,2) NOT NULL DEFAULT 5,
  iva_importacion_pct   numeric(5,2) NOT NULL DEFAULT 15,

  -- Parámetros de precio de venta
  margen_empresa_pct    numeric(5,2) NOT NULL DEFAULT 0,
  comision_venta_pct    numeric(5,2) NOT NULL DEFAULT 0,
  gastos_admin_pct      numeric(5,2) NOT NULL DEFAULT 0,

  -- Totales calculados
  total_fob_usd         numeric(14,2) NOT NULL DEFAULT 0,
  total_gastos_imp      numeric(14,2) NOT NULL DEFAULT 0,
  total_costo_aterrizaje numeric(14,2) NOT NULL DEFAULT 0,
  total_precio_venta    numeric(14,2) NOT NULL DEFAULT 0,

  -- Control
  notas                 text,
  created_by            uuid REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX costeos_proyecto_numero_uidx
  ON public.costeos_proyecto(empresa_id, numero);

CREATE INDEX costeos_proyecto_empresa_idx
  ON public.costeos_proyecto(empresa_id, created_at DESC);

CREATE INDEX costeos_proyecto_proyecto_idx
  ON public.costeos_proyecto(proyecto_id) WHERE proyecto_id IS NOT NULL;

CREATE INDEX costeos_proyecto_cotizacion_idx
  ON public.costeos_proyecto(cotizacion_id) WHERE cotizacion_id IS NOT NULL;

-- ── Tabla de ítems del costeo de proyecto ────────────────────────────────────
CREATE TABLE public.costeo_proyecto_items (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  costeo_proyecto_id        uuid NOT NULL REFERENCES public.costeos_proyecto(id) ON DELETE CASCADE,

  -- Referencia opcional al costeo individual de producto
  costeo_id                 uuid REFERENCES public.costeos(id) ON DELETE SET NULL,

  -- Datos del ítem
  orden                     integer NOT NULL DEFAULT 0,
  descripcion               text NOT NULL DEFAULT '',
  fabricante                text,
  modelo                    text,
  codigo_nandina            text,
  cantidad                  numeric(10,3) NOT NULL DEFAULT 1,
  precio_fob_unitario_usd   numeric(14,2) NOT NULL DEFAULT 0,

  -- Tasas propias del ítem (NULL = usar el del header)
  fodinfa_pct               numeric(5,2),
  arancel_pct               numeric(5,2),
  isd_pct                   numeric(5,2),
  iva_importacion_pct       numeric(5,2),

  -- Calculados por prorrateo
  total_fob_usd             numeric(14,2) NOT NULL DEFAULT 0,
  flete_prorrateado         numeric(14,2) NOT NULL DEFAULT 0,
  seguro_prorrateado        numeric(14,2) NOT NULL DEFAULT 0,
  agente_prorrateado        numeric(14,2) NOT NULL DEFAULT 0,
  bodega_prorrateado        numeric(14,2) NOT NULL DEFAULT 0,
  otros_prorrateados        numeric(14,2) NOT NULL DEFAULT 0,
  fodinfa_usd               numeric(14,2) NOT NULL DEFAULT 0,
  arancel_usd               numeric(14,2) NOT NULL DEFAULT 0,
  isd_usd                   numeric(14,2) NOT NULL DEFAULT 0,
  iva_importacion_usd       numeric(14,2) NOT NULL DEFAULT 0,
  costo_aterrizaje_total    numeric(14,2) NOT NULL DEFAULT 0,
  costo_aterrizaje_unitario numeric(14,2) NOT NULL DEFAULT 0,
  precio_venta_unitario     numeric(14,2) NOT NULL DEFAULT 0,
  precio_venta_total        numeric(14,2) NOT NULL DEFAULT 0
);

CREATE INDEX cp_items_costeo_idx ON public.costeo_proyecto_items(costeo_proyecto_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.costeos_proyecto       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costeo_proyecto_items  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_costeos_proyecto" ON public.costeos_proyecto
  FOR ALL TO authenticated
  USING (empresa_id IN (
    SELECT empresa_id FROM public.empresas_usuarios WHERE usuario_id = auth.uid()
  ));

CREATE POLICY "empresa_cp_items" ON public.costeo_proyecto_items
  FOR ALL TO authenticated
  USING (costeo_proyecto_id IN (
    SELECT id FROM public.costeos_proyecto
    WHERE empresa_id IN (
      SELECT empresa_id FROM public.empresas_usuarios WHERE usuario_id = auth.uid()
    )
  ));

-- ── Función interna de cálculo por ítem ──────────────────────────────────────
-- Evita duplicar lógica en crear y actualizar.
CREATE OR REPLACE FUNCTION public._cp_calcular_item(
  p_fob_item   numeric,
  p_qty        numeric,
  p_ratio      numeric,
  p_flete      numeric,
  p_seguro     numeric,
  p_agente     numeric,
  p_bodega     numeric,
  p_otros      numeric,
  p_fodinfa_pct  numeric,
  p_arancel_pct  numeric,
  p_isd_pct      numeric,
  p_iva_pct      numeric,
  p_margen_pct   numeric,
  p_comision_pct numeric,
  p_admin_pct    numeric
)
RETURNS TABLE (
  flete_p   numeric,
  seguro_p  numeric,
  agente_p  numeric,
  bodega_p  numeric,
  otros_p   numeric,
  fodinfa_usd  numeric,
  arancel_usd  numeric,
  isd_usd      numeric,
  iva_usd      numeric,
  aterrizaje   numeric,
  aterrizaje_u numeric,
  pvp_u        numeric,
  pvp_total    numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_flete_p    numeric;
  v_seguro_p   numeric;
  v_agente_p   numeric;
  v_bodega_p   numeric;
  v_otros_p    numeric;
  v_cif        numeric;
  v_fodinfa    numeric;
  v_arancel    numeric;
  v_isd        numeric;
  v_iva        numeric;
  v_aterr      numeric;
  v_aterr_u    numeric;
  v_divisor    numeric;
  v_pvp_u      numeric;
  v_pvp_tot    numeric;
BEGIN
  v_flete_p  := ROUND(p_flete  * p_ratio, 2);
  v_seguro_p := ROUND(p_seguro * p_ratio, 2);
  v_agente_p := ROUND(p_agente * p_ratio, 2);
  v_bodega_p := ROUND(p_bodega * p_ratio, 2);
  v_otros_p  := ROUND(p_otros  * p_ratio, 2);
  v_cif      := p_fob_item + v_flete_p + v_seguro_p;

  v_fodinfa  := ROUND(v_cif       * p_fodinfa_pct / 100, 2);
  v_arancel  := ROUND(v_cif       * p_arancel_pct / 100, 2);
  v_isd      := ROUND(p_fob_item  * p_isd_pct     / 100, 2);
  v_iva      := ROUND((v_cif + v_fodinfa + v_arancel) * p_iva_pct / 100, 2);

  v_aterr    := ROUND(p_fob_item + v_flete_p + v_seguro_p + v_agente_p + v_bodega_p
                      + v_otros_p + v_fodinfa + v_arancel + v_isd + v_iva, 2);
  v_aterr_u  := CASE WHEN p_qty > 0 THEN ROUND(v_aterr / p_qty, 2) ELSE 0 END;

  v_divisor  := 1 - p_margen_pct / 100 - p_comision_pct / 100 - p_admin_pct / 100;
  v_pvp_u    := CASE WHEN v_divisor > 0 THEN ROUND(v_aterr_u / v_divisor, 2) ELSE v_aterr_u END;
  v_pvp_tot  := ROUND(v_pvp_u * p_qty, 2);

  RETURN QUERY SELECT
    v_flete_p, v_seguro_p, v_agente_p, v_bodega_p, v_otros_p,
    v_fodinfa, v_arancel, v_isd, v_iva,
    v_aterr, v_aterr_u, v_pvp_u, v_pvp_tot;
END;
$$;

-- ── RPC: crear_costeo_proyecto ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crear_costeo_proyecto(
  p_empresa_id uuid,
  p_datos      jsonb,
  p_items      jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid    := auth.uid();
  v_year         int     := EXTRACT(YEAR FROM CURRENT_DATE);
  v_seq          int;
  v_numero       text;
  v_cp_id        uuid;
  v_item         jsonb;

  -- gastos compartidos
  v_flete        numeric(14,2);
  v_seguro       numeric(14,2);
  v_agente       numeric(14,2);
  v_bodega       numeric(14,2);
  v_otros        numeric(14,2);
  v_gastos_imp   numeric(14,2);

  -- tasas header
  v_fodinfa_pct  numeric(5,2);
  v_arancel_pct  numeric(5,2);
  v_isd_pct      numeric(5,2);
  v_iva_pct      numeric(5,2);
  v_margen_pct   numeric(5,2);
  v_comision_pct numeric(5,2);
  v_admin_pct    numeric(5,2);

  -- totales
  v_total_fob        numeric(14,2) := 0;
  v_total_aterrizaje numeric(14,2) := 0;
  v_total_venta      numeric(14,2) := 0;

  -- por ítem
  v_qty          numeric(10,3);
  v_fob_item     numeric(14,2);
  v_ratio        numeric(18,8);
  v_item_fodinfa numeric(5,2);
  v_item_arancel numeric(5,2);
  v_item_isd     numeric(5,2);
  v_item_iva     numeric(5,2);

  -- fila de cálculo
  v_calc         record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = p_empresa_id AND usuario_id = v_user_id
  ) THEN RAISE EXCEPTION 'Acceso denegado'; END IF;

  -- Auto-número
  SELECT COALESCE(MAX(CAST(SPLIT_PART(numero, '-', 3) AS int)), 0) + 1
  INTO v_seq
  FROM public.costeos_proyecto
  WHERE empresa_id = p_empresa_id
    AND EXTRACT(YEAR FROM created_at) = v_year;

  v_numero := 'CP-' || v_year || '-' || LPAD(v_seq::text, 4, '0');

  -- Gastos compartidos
  v_flete      := COALESCE((p_datos->>'flete_total')::numeric,    0);
  v_seguro     := COALESCE((p_datos->>'seguro_total')::numeric,   0);
  v_agente     := COALESCE((p_datos->>'agente_aduanas')::numeric, 0);
  v_bodega     := COALESCE((p_datos->>'bodega')::numeric,         0);
  v_otros      := COALESCE((p_datos->>'otros_logistica')::numeric,0);
  v_gastos_imp := v_flete + v_seguro + v_agente + v_bodega + v_otros;

  -- Tasas header
  v_fodinfa_pct  := COALESCE((p_datos->>'fodinfa_pct')::numeric,        0.5);
  v_arancel_pct  := COALESCE((p_datos->>'arancel_pct')::numeric,        0);
  v_isd_pct      := COALESCE((p_datos->>'isd_pct')::numeric,            5);
  v_iva_pct      := COALESCE((p_datos->>'iva_importacion_pct')::numeric, 15);
  v_margen_pct   := COALESCE((p_datos->>'margen_empresa_pct')::numeric,  0);
  v_comision_pct := COALESCE((p_datos->>'comision_venta_pct')::numeric,  0);
  v_admin_pct    := COALESCE((p_datos->>'gastos_admin_pct')::numeric,    0);

  -- Total FOB
  SELECT COALESCE(SUM(
    COALESCE((elem->>'cantidad')::numeric, 1) *
    COALESCE((elem->>'precio_fob_unitario_usd')::numeric, 0)
  ), 0)
  INTO v_total_fob
  FROM jsonb_array_elements(p_items) AS elem;

  -- Insertar header
  INSERT INTO public.costeos_proyecto (
    empresa_id, numero, proyecto_id, cotizacion_id,
    descripcion, estado, moneda,
    flete_total, seguro_total, agente_aduanas, bodega, otros_logistica,
    fodinfa_pct, arancel_pct, isd_pct, iva_importacion_pct,
    margen_empresa_pct, comision_venta_pct, gastos_admin_pct,
    total_fob_usd, total_gastos_imp,
    notas, created_by
  ) VALUES (
    p_empresa_id, v_numero,
    NULLIF(p_datos->>'proyecto_id',   '')::uuid,
    NULLIF(p_datos->>'cotizacion_id', '')::uuid,
    COALESCE(p_datos->>'descripcion', ''),
    COALESCE(p_datos->>'estado',      'borrador'),
    COALESCE(p_datos->>'moneda',      'USD'),
    v_flete, v_seguro, v_agente, v_bodega, v_otros,
    v_fodinfa_pct, v_arancel_pct, v_isd_pct, v_iva_pct,
    v_margen_pct, v_comision_pct, v_admin_pct,
    v_total_fob, v_gastos_imp,
    p_datos->>'notas',
    v_user_id
  ) RETURNING id INTO v_cp_id;

  -- Insertar ítems
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty      := COALESCE((v_item->>'cantidad')::numeric, 1);
    v_fob_item := ROUND(v_qty * COALESCE((v_item->>'precio_fob_unitario_usd')::numeric, 0), 2);
    v_ratio    := CASE WHEN v_total_fob > 0 THEN v_fob_item / v_total_fob ELSE 0 END;

    -- Tasas del ítem (usa header si no se especifican)
    v_item_fodinfa := COALESCE(NULLIF(v_item->>'fodinfa_pct', '')::numeric,        v_fodinfa_pct);
    v_item_arancel := COALESCE(NULLIF(v_item->>'arancel_pct', '')::numeric,        v_arancel_pct);
    v_item_isd     := COALESCE(NULLIF(v_item->>'isd_pct', '')::numeric,            v_isd_pct);
    v_item_iva     := COALESCE(NULLIF(v_item->>'iva_importacion_pct', '')::numeric, v_iva_pct);

    SELECT * INTO v_calc
    FROM public._cp_calcular_item(
      v_fob_item, v_qty, v_ratio,
      v_flete, v_seguro, v_agente, v_bodega, v_otros,
      v_item_fodinfa, v_item_arancel, v_item_isd, v_item_iva,
      v_margen_pct, v_comision_pct, v_admin_pct
    );

    v_total_aterrizaje := v_total_aterrizaje + v_calc.aterrizaje;
    v_total_venta      := v_total_venta      + v_calc.pvp_total;

    INSERT INTO public.costeo_proyecto_items (
      costeo_proyecto_id, costeo_id,
      orden, descripcion, fabricante, modelo, codigo_nandina,
      cantidad, precio_fob_unitario_usd,
      fodinfa_pct, arancel_pct, isd_pct, iva_importacion_pct,
      total_fob_usd,
      flete_prorrateado, seguro_prorrateado, agente_prorrateado,
      bodega_prorrateado, otros_prorrateados,
      fodinfa_usd, arancel_usd, isd_usd, iva_importacion_usd,
      costo_aterrizaje_total, costo_aterrizaje_unitario,
      precio_venta_unitario, precio_venta_total
    ) VALUES (
      v_cp_id,
      NULLIF(v_item->>'costeo_id', '')::uuid,
      COALESCE((v_item->>'orden')::int, 0),
      COALESCE(v_item->>'descripcion', ''),
      v_item->>'fabricante',
      v_item->>'modelo',
      v_item->>'codigo_nandina',
      v_qty,
      COALESCE((v_item->>'precio_fob_unitario_usd')::numeric, 0),
      v_item_fodinfa, v_item_arancel, v_item_isd, v_item_iva,
      v_fob_item,
      v_calc.flete_p, v_calc.seguro_p, v_calc.agente_p,
      v_calc.bodega_p, v_calc.otros_p,
      v_calc.fodinfa_usd, v_calc.arancel_usd, v_calc.isd_usd, v_calc.iva_usd,
      v_calc.aterrizaje, v_calc.aterrizaje_u,
      v_calc.pvp_u, v_calc.pvp_total
    );
  END LOOP;

  UPDATE public.costeos_proyecto SET
    total_costo_aterrizaje = v_total_aterrizaje,
    total_precio_venta     = v_total_venta
  WHERE id = v_cp_id;

  RETURN json_build_object('id', v_cp_id, 'numero', v_numero);
END;
$$;

-- ── RPC: actualizar_costeo_proyecto ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.actualizar_costeo_proyecto(
  p_id    uuid,
  p_datos jsonb,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_empresa_id   uuid;
  v_item         jsonb;

  -- gastos compartidos
  v_flete        numeric(14,2);
  v_seguro       numeric(14,2);
  v_agente       numeric(14,2);
  v_bodega       numeric(14,2);
  v_otros        numeric(14,2);
  v_gastos_imp   numeric(14,2);

  -- tasas header
  v_fodinfa_pct  numeric(5,2);
  v_arancel_pct  numeric(5,2);
  v_isd_pct      numeric(5,2);
  v_iva_pct      numeric(5,2);
  v_margen_pct   numeric(5,2);
  v_comision_pct numeric(5,2);
  v_admin_pct    numeric(5,2);

  -- totales
  v_total_fob        numeric(14,2) := 0;
  v_total_aterrizaje numeric(14,2) := 0;
  v_total_venta      numeric(14,2) := 0;

  -- por ítem
  v_qty          numeric(10,3);
  v_fob_item     numeric(14,2);
  v_ratio        numeric(18,8);
  v_item_fodinfa numeric(5,2);
  v_item_arancel numeric(5,2);
  v_item_isd     numeric(5,2);
  v_item_iva     numeric(5,2);

  -- fila de cálculo
  v_calc         record;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM public.costeos_proyecto WHERE id = p_id;

  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Costeo de proyecto no encontrado'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = v_empresa_id AND usuario_id = v_user_id
  ) THEN RAISE EXCEPTION 'Acceso denegado'; END IF;

  -- Gastos compartidos
  v_flete      := COALESCE((p_datos->>'flete_total')::numeric,    0);
  v_seguro     := COALESCE((p_datos->>'seguro_total')::numeric,   0);
  v_agente     := COALESCE((p_datos->>'agente_aduanas')::numeric, 0);
  v_bodega     := COALESCE((p_datos->>'bodega')::numeric,         0);
  v_otros      := COALESCE((p_datos->>'otros_logistica')::numeric,0);
  v_gastos_imp := v_flete + v_seguro + v_agente + v_bodega + v_otros;

  -- Tasas header
  v_fodinfa_pct  := COALESCE((p_datos->>'fodinfa_pct')::numeric,        0.5);
  v_arancel_pct  := COALESCE((p_datos->>'arancel_pct')::numeric,        0);
  v_isd_pct      := COALESCE((p_datos->>'isd_pct')::numeric,            5);
  v_iva_pct      := COALESCE((p_datos->>'iva_importacion_pct')::numeric, 15);
  v_margen_pct   := COALESCE((p_datos->>'margen_empresa_pct')::numeric,  0);
  v_comision_pct := COALESCE((p_datos->>'comision_venta_pct')::numeric,  0);
  v_admin_pct    := COALESCE((p_datos->>'gastos_admin_pct')::numeric,    0);

  -- Total FOB
  SELECT COALESCE(SUM(
    COALESCE((elem->>'cantidad')::numeric, 1) *
    COALESCE((elem->>'precio_fob_unitario_usd')::numeric, 0)
  ), 0)
  INTO v_total_fob
  FROM jsonb_array_elements(p_items) AS elem;

  -- Actualizar header
  UPDATE public.costeos_proyecto SET
    proyecto_id         = NULLIF(p_datos->>'proyecto_id',   '')::uuid,
    cotizacion_id       = NULLIF(p_datos->>'cotizacion_id', '')::uuid,
    descripcion         = COALESCE(p_datos->>'descripcion', ''),
    estado              = COALESCE(p_datos->>'estado',      'borrador'),
    flete_total         = v_flete,
    seguro_total        = v_seguro,
    agente_aduanas      = v_agente,
    bodega              = v_bodega,
    otros_logistica     = v_otros,
    fodinfa_pct         = v_fodinfa_pct,
    arancel_pct         = v_arancel_pct,
    isd_pct             = v_isd_pct,
    iva_importacion_pct = v_iva_pct,
    margen_empresa_pct  = v_margen_pct,
    comision_venta_pct  = v_comision_pct,
    gastos_admin_pct    = v_admin_pct,
    total_fob_usd       = v_total_fob,
    total_gastos_imp    = v_gastos_imp,
    notas               = p_datos->>'notas',
    updated_at          = now()
  WHERE id = p_id;

  -- Reemplazar ítems
  DELETE FROM public.costeo_proyecto_items WHERE costeo_proyecto_id = p_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty      := COALESCE((v_item->>'cantidad')::numeric, 1);
    v_fob_item := ROUND(v_qty * COALESCE((v_item->>'precio_fob_unitario_usd')::numeric, 0), 2);
    v_ratio    := CASE WHEN v_total_fob > 0 THEN v_fob_item / v_total_fob ELSE 0 END;

    v_item_fodinfa := COALESCE(NULLIF(v_item->>'fodinfa_pct', '')::numeric,        v_fodinfa_pct);
    v_item_arancel := COALESCE(NULLIF(v_item->>'arancel_pct', '')::numeric,        v_arancel_pct);
    v_item_isd     := COALESCE(NULLIF(v_item->>'isd_pct', '')::numeric,            v_isd_pct);
    v_item_iva     := COALESCE(NULLIF(v_item->>'iva_importacion_pct', '')::numeric, v_iva_pct);

    SELECT * INTO v_calc
    FROM public._cp_calcular_item(
      v_fob_item, v_qty, v_ratio,
      v_flete, v_seguro, v_agente, v_bodega, v_otros,
      v_item_fodinfa, v_item_arancel, v_item_isd, v_item_iva,
      v_margen_pct, v_comision_pct, v_admin_pct
    );

    v_total_aterrizaje := v_total_aterrizaje + v_calc.aterrizaje;
    v_total_venta      := v_total_venta      + v_calc.pvp_total;

    INSERT INTO public.costeo_proyecto_items (
      costeo_proyecto_id, costeo_id,
      orden, descripcion, fabricante, modelo, codigo_nandina,
      cantidad, precio_fob_unitario_usd,
      fodinfa_pct, arancel_pct, isd_pct, iva_importacion_pct,
      total_fob_usd,
      flete_prorrateado, seguro_prorrateado, agente_prorrateado,
      bodega_prorrateado, otros_prorrateados,
      fodinfa_usd, arancel_usd, isd_usd, iva_importacion_usd,
      costo_aterrizaje_total, costo_aterrizaje_unitario,
      precio_venta_unitario, precio_venta_total
    ) VALUES (
      p_id,
      NULLIF(v_item->>'costeo_id', '')::uuid,
      COALESCE((v_item->>'orden')::int, 0),
      COALESCE(v_item->>'descripcion', ''),
      v_item->>'fabricante',
      v_item->>'modelo',
      v_item->>'codigo_nandina',
      v_qty,
      COALESCE((v_item->>'precio_fob_unitario_usd')::numeric, 0),
      v_item_fodinfa, v_item_arancel, v_item_isd, v_item_iva,
      v_fob_item,
      v_calc.flete_p, v_calc.seguro_p, v_calc.agente_p,
      v_calc.bodega_p, v_calc.otros_p,
      v_calc.fodinfa_usd, v_calc.arancel_usd, v_calc.isd_usd, v_calc.iva_usd,
      v_calc.aterrizaje, v_calc.aterrizaje_u,
      v_calc.pvp_u, v_calc.pvp_total
    );
  END LOOP;

  UPDATE public.costeos_proyecto SET
    total_costo_aterrizaje = v_total_aterrizaje,
    total_precio_venta     = v_total_venta
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public._cp_calcular_item     TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_costeo_proyecto TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_costeo_proyecto TO authenticated;
