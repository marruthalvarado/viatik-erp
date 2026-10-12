-- =============================================================================
-- MÓDULO IMPORTACIONES — Costeo de Proyecto
-- Agrupa múltiples productos ya costeados, prorratea gastos compartidos y
-- calcula el precio de venta del proyecto completo.
-- =============================================================================

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

  -- Tasas arancelarias comunes (%) — pueden variar por ítem, pero se captura default
  fodinfa_pct           numeric(5,2) NOT NULL DEFAULT 0.5,
  arancel_pct           numeric(5,2) NOT NULL DEFAULT 0,
  isd_pct               numeric(5,2) NOT NULL DEFAULT 5,
  iva_importacion_pct   numeric(5,2) NOT NULL DEFAULT 15,

  -- Parámetros de precio de venta
  margen_empresa_pct    numeric(5,2) NOT NULL DEFAULT 0,
  comision_venta_pct    numeric(5,2) NOT NULL DEFAULT 0,
  gastos_admin_pct      numeric(5,2) NOT NULL DEFAULT 0,

  -- Totales calculados (actualizados al guardar vía RPC)
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

  -- Datos del ítem (copiados o ingresados manualmente)
  orden                     integer NOT NULL DEFAULT 0,
  descripcion               text NOT NULL DEFAULT '',
  fabricante                text,
  modelo                    text,
  codigo_nandina            text,
  cantidad                  numeric(10,3) NOT NULL DEFAULT 1,
  precio_fob_unitario_usd   numeric(14,2) NOT NULL DEFAULT 0,

  -- Tasas propias del ítem (pueden diferir del header)
  fodinfa_pct               numeric(5,2),   -- NULL = usar el del header
  arancel_pct               numeric(5,2),
  isd_pct                   numeric(5,2),
  iva_importacion_pct       numeric(5,2),

  -- Calculados por prorrateo (actualizados por RPC)
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
  v_user_id   uuid := auth.uid();
  v_year      int  := EXTRACT(YEAR FROM CURRENT_DATE);
  v_seq       int;
  v_numero    text;
  v_cp_id     uuid;
  v_item      jsonb;

  -- gastos compartidos
  v_flete     numeric(14,2);
  v_seguro    numeric(14,2);
  v_agente    numeric(14,2);
  v_bodega    numeric(14,2);
  v_otros     numeric(14,2);
  v_gastos_imp numeric(14,2);

  -- tasas header
  v_fodinfa_pct   numeric(5,2);
  v_arancel_pct   numeric(5,2);
  v_isd_pct       numeric(5,2);
  v_iva_imp_pct   numeric(5,2);
  v_margen_pct    numeric(5,2);
  v_comision_pct  numeric(5,2);
  v_admin_pct     numeric(5,2);

  -- totales
  v_total_fob      numeric(14,2) := 0;
  v_total_aterrizaje numeric(14,2) := 0;
  v_total_venta    numeric(14,2) := 0;

  -- por ítem
  v_fob_item       numeric(14,2);
  v_ratio          numeric(18,8);
  v_cif_item       numeric(14,2);
  v_fodinfa_item   numeric(14,2);
  v_arancel_item   numeric(14,2);
  v_isd_item       numeric(14,2);
  v_iva_item       numeric(14,2);
  v_aterrizaje     numeric(14,2);
  v_aterrizaje_u   numeric(14,2);
  v_pvp_u          numeric(14,2);
  v_pvp_total      numeric(14,2);
  v_qty            numeric(10,3);

  -- array temporal de ítems calculados
  TYPE t_item IS RECORD (
    orden int, costeo_id uuid, descripcion text, fabricante text, modelo text,
    codigo_nandina text, cantidad numeric, precio_fob_unitario_usd numeric,
    item_fodinfa_pct numeric, item_arancel_pct numeric, item_isd_pct numeric, item_iva_pct numeric,
    total_fob numeric, flete_p numeric, seguro_p numeric, agente_p numeric, bodega_p numeric, otros_p numeric,
    fodinfa_usd numeric, arancel_usd numeric, isd_usd numeric, iva_usd numeric,
    aterrizaje_total numeric, aterrizaje_u numeric, pvp_u numeric, pvp_total numeric
  );
BEGIN
  -- Verificar acceso
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = p_empresa_id AND usuario_id = v_user_id
  ) THEN RAISE EXCEPTION 'Acceso denegado'; END IF;

  -- Auto-número
  SELECT COALESCE(MAX(CAST(SPLIT_PART(numero, '-', 3) AS int)), 0) + 1
  INTO v_seq
  FROM public.costeos_proyecto
  WHERE empresa_id = p_empresa_id AND EXTRACT(YEAR FROM created_at) = v_year;
  v_numero := 'CP-' || v_year || '-' || LPAD(v_seq::text, 4, '0');

  -- Gastos compartidos
  v_flete   := COALESCE((p_datos->>'flete_total')::numeric, 0);
  v_seguro  := COALESCE((p_datos->>'seguro_total')::numeric, 0);
  v_agente  := COALESCE((p_datos->>'agente_aduanas')::numeric, 0);
  v_bodega  := COALESCE((p_datos->>'bodega')::numeric, 0);
  v_otros   := COALESCE((p_datos->>'otros_logistica')::numeric, 0);
  v_gastos_imp := v_flete + v_seguro + v_agente + v_bodega + v_otros;

  -- Tasas
  v_fodinfa_pct  := COALESCE((p_datos->>'fodinfa_pct')::numeric, 0.5);
  v_arancel_pct  := COALESCE((p_datos->>'arancel_pct')::numeric, 0);
  v_isd_pct      := COALESCE((p_datos->>'isd_pct')::numeric, 5);
  v_iva_imp_pct  := COALESCE((p_datos->>'iva_importacion_pct')::numeric, 15);
  v_margen_pct   := COALESCE((p_datos->>'margen_empresa_pct')::numeric, 0);
  v_comision_pct := COALESCE((p_datos->>'comision_venta_pct')::numeric, 0);
  v_admin_pct    := COALESCE((p_datos->>'gastos_admin_pct')::numeric, 0);

  -- Calcular total FOB
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
    created_by
  ) VALUES (
    p_empresa_id, v_numero,
    NULLIF(p_datos->>'proyecto_id', '')::uuid,
    NULLIF(p_datos->>'cotizacion_id', '')::uuid,
    COALESCE(p_datos->>'descripcion', ''),
    COALESCE(p_datos->>'estado', 'borrador'),
    COALESCE(p_datos->>'moneda', 'USD'),
    v_flete, v_seguro, v_agente, v_bodega, v_otros,
    v_fodinfa_pct, v_arancel_pct, v_isd_pct, v_iva_imp_pct,
    v_margen_pct, v_comision_pct, v_admin_pct,
    v_total_fob, v_gastos_imp,
    v_user_id
  ) RETURNING id INTO v_cp_id;

  -- Insertar ítems con prorrateo
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty   := COALESCE((v_item->>'cantidad')::numeric, 1);
    v_fob_item := ROUND(v_qty * COALESCE((v_item->>'precio_fob_unitario_usd')::numeric, 0), 2);

    -- Ratio de prorrateo por valor FOB
    v_ratio := CASE WHEN v_total_fob > 0 THEN v_fob_item / v_total_fob ELSE 0 END;

    -- Tasas del ítem (usa las del header si no se especifican)
    v_fodinfa_pct  := COALESCE(NULLIF(v_item->>'fodinfa_pct', '')::numeric, (p_datos->>'fodinfa_pct')::numeric, 0.5);
    v_arancel_pct  := COALESCE(NULLIF(v_item->>'arancel_pct', '')::numeric, (p_datos->>'arancel_pct')::numeric, 0);
    v_isd_pct      := COALESCE(NULLIF(v_item->>'isd_pct', '')::numeric, (p_datos->>'isd_pct')::numeric, 5);
    v_iva_imp_pct  := COALESCE(NULLIF(v_item->>'iva_importacion_pct', '')::numeric, (p_datos->>'iva_importacion_pct')::numeric, 15);

    -- Gastos prorrateados
    DECLARE
      v_flete_p numeric(14,2)  := ROUND(v_flete  * v_ratio, 2);
      v_seguro_p numeric(14,2) := ROUND(v_seguro * v_ratio, 2);
      v_agente_p numeric(14,2) := ROUND(v_agente * v_ratio, 2);
      v_bodega_p numeric(14,2) := ROUND(v_bodega * v_ratio, 2);
      v_otros_p  numeric(14,2) := ROUND(v_otros  * v_ratio, 2);
      v_cif      numeric(14,2) := v_fob_item + v_flete_p + v_seguro_p;
    BEGIN
      v_fodinfa_item := ROUND(v_cif * v_fodinfa_pct / 100, 2);
      v_arancel_item := ROUND(v_cif * v_arancel_pct / 100, 2);
      v_isd_item     := ROUND(v_fob_item * v_isd_pct / 100, 2);
      v_iva_item     := ROUND((v_cif + v_fodinfa_item + v_arancel_item) * v_iva_imp_pct / 100, 2);
      v_aterrizaje   := ROUND(v_fob_item + v_flete_p + v_seguro_p + v_agente_p + v_bodega_p + v_otros_p
                              + v_fodinfa_item + v_arancel_item + v_isd_item + v_iva_item, 2);
      v_aterrizaje_u := CASE WHEN v_qty > 0 THEN ROUND(v_aterrizaje / v_qty, 2) ELSE 0 END;
      -- Precio de venta: costo_aterrizaje / (1 - margen% - comisión% - admin%)
      DECLARE
        v_divisor numeric := 1
          - COALESCE((p_datos->>'margen_empresa_pct')::numeric, 0) / 100
          - COALESCE((p_datos->>'comision_venta_pct')::numeric, 0) / 100
          - COALESCE((p_datos->>'gastos_admin_pct')::numeric, 0) / 100;
      BEGIN
        v_pvp_u     := CASE WHEN v_divisor > 0 THEN ROUND(v_aterrizaje_u / v_divisor, 2) ELSE v_aterrizaje_u END;
        v_pvp_total := ROUND(v_pvp_u * v_qty, 2);
        v_total_aterrizaje := v_total_aterrizaje + v_aterrizaje;
        v_total_venta      := v_total_venta + v_pvp_total;

        INSERT INTO public.costeo_proyecto_items (
          costeo_proyecto_id, costeo_id,
          orden, descripcion, fabricante, modelo, codigo_nandina,
          cantidad, precio_fob_unitario_usd,
          fodinfa_pct, arancel_pct, isd_pct, iva_importacion_pct,
          total_fob_usd, flete_prorrateado, seguro_prorrateado, agente_prorrateado,
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
          v_fodinfa_pct, v_arancel_pct, v_isd_pct, v_iva_imp_pct,
          v_fob_item, v_flete_p, v_seguro_p, v_agente_p, v_bodega_p, v_otros_p,
          v_fodinfa_item, v_arancel_item, v_isd_item, v_iva_item,
          v_aterrizaje, v_aterrizaje_u, v_pvp_u, v_pvp_total
        );
      END;
    END;
  END LOOP;

  -- Actualizar totales en header
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
  v_user_id    uuid := auth.uid();
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM public.costeos_proyecto WHERE id = p_id;

  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Costeo de proyecto no encontrado'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = v_empresa_id AND usuario_id = v_user_id
  ) THEN RAISE EXCEPTION 'Acceso denegado'; END IF;

  -- Borrar ítems y recalcular desde cero usando la lógica de crear
  DELETE FROM public.costeo_proyecto_items WHERE costeo_proyecto_id = p_id;

  -- Reusar lógica de cálculo (actualizar header + reinsert items)
  DECLARE
    v_flete     numeric(14,2) := COALESCE((p_datos->>'flete_total')::numeric, 0);
    v_seguro    numeric(14,2) := COALESCE((p_datos->>'seguro_total')::numeric, 0);
    v_agente    numeric(14,2) := COALESCE((p_datos->>'agente_aduanas')::numeric, 0);
    v_bodega    numeric(14,2) := COALESCE((p_datos->>'bodega')::numeric, 0);
    v_otros     numeric(14,2) := COALESCE((p_datos->>'otros_logistica')::numeric, 0);
    v_gastos_imp numeric(14,2);
    v_total_fob  numeric(14,2) := 0;
    v_total_aterrizaje numeric(14,2) := 0;
    v_total_venta      numeric(14,2) := 0;
    v_item       jsonb;
    v_qty        numeric(10,3);
    v_fob_item   numeric(14,2);
    v_ratio      numeric(18,8);
    v_fodinfa_pct  numeric(5,2);
    v_arancel_pct  numeric(5,2);
    v_isd_pct      numeric(5,2);
    v_iva_imp_pct  numeric(5,2);
  BEGIN
    v_gastos_imp := v_flete + v_seguro + v_agente + v_bodega + v_otros;

    SELECT COALESCE(SUM(
      COALESCE((elem->>'cantidad')::numeric, 1) *
      COALESCE((elem->>'precio_fob_unitario_usd')::numeric, 0)
    ), 0)
    INTO v_total_fob
    FROM jsonb_array_elements(p_items) AS elem;

    UPDATE public.costeos_proyecto SET
      proyecto_id         = NULLIF(p_datos->>'proyecto_id', '')::uuid,
      cotizacion_id       = NULLIF(p_datos->>'cotizacion_id', '')::uuid,
      descripcion         = COALESCE(p_datos->>'descripcion', ''),
      estado              = COALESCE(p_datos->>'estado', 'borrador'),
      flete_total         = v_flete,
      seguro_total        = v_seguro,
      agente_aduanas      = v_agente,
      bodega              = v_bodega,
      otros_logistica     = v_otros,
      fodinfa_pct         = COALESCE((p_datos->>'fodinfa_pct')::numeric, 0.5),
      arancel_pct         = COALESCE((p_datos->>'arancel_pct')::numeric, 0),
      isd_pct             = COALESCE((p_datos->>'isd_pct')::numeric, 5),
      iva_importacion_pct = COALESCE((p_datos->>'iva_importacion_pct')::numeric, 15),
      margen_empresa_pct  = COALESCE((p_datos->>'margen_empresa_pct')::numeric, 0),
      comision_venta_pct  = COALESCE((p_datos->>'comision_venta_pct')::numeric, 0),
      gastos_admin_pct    = COALESCE((p_datos->>'gastos_admin_pct')::numeric, 0),
      total_fob_usd       = v_total_fob,
      total_gastos_imp    = v_gastos_imp,
      notas               = p_datos->>'notas',
      updated_at          = now()
    WHERE id = p_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_qty      := COALESCE((v_item->>'cantidad')::numeric, 1);
      v_fob_item := ROUND(v_qty * COALESCE((v_item->>'precio_fob_unitario_usd')::numeric, 0), 2);
      v_ratio    := CASE WHEN v_total_fob > 0 THEN v_fob_item / v_total_fob ELSE 0 END;

      v_fodinfa_pct  := COALESCE(NULLIF(v_item->>'fodinfa_pct', '')::numeric, (p_datos->>'fodinfa_pct')::numeric, 0.5);
      v_arancel_pct  := COALESCE(NULLIF(v_item->>'arancel_pct', '')::numeric, (p_datos->>'arancel_pct')::numeric, 0);
      v_isd_pct      := COALESCE(NULLIF(v_item->>'isd_pct', '')::numeric, (p_datos->>'isd_pct')::numeric, 5);
      v_iva_imp_pct  := COALESCE(NULLIF(v_item->>'iva_importacion_pct', '')::numeric, (p_datos->>'iva_importacion_pct')::numeric, 15);

      DECLARE
        v_flete_p  numeric(14,2) := ROUND(v_flete  * v_ratio, 2);
        v_seguro_p numeric(14,2) := ROUND(v_seguro * v_ratio, 2);
        v_agente_p numeric(14,2) := ROUND(v_agente * v_ratio, 2);
        v_bodega_p numeric(14,2) := ROUND(v_bodega * v_ratio, 2);
        v_otros_p  numeric(14,2) := ROUND(v_otros  * v_ratio, 2);
        v_cif      numeric(14,2) := v_fob_item + v_flete_p + v_seguro_p;
        v_fodinfa_usd numeric(14,2) := ROUND(v_cif * v_fodinfa_pct / 100, 2);
        v_arancel_usd numeric(14,2) := ROUND(v_cif * v_arancel_pct / 100, 2);
        v_isd_usd     numeric(14,2) := ROUND(v_fob_item * v_isd_pct / 100, 2);
        v_iva_usd     numeric(14,2) := ROUND((v_cif + ROUND(v_cif * v_fodinfa_pct / 100, 2) + ROUND(v_cif * v_arancel_pct / 100, 2)) * v_iva_imp_pct / 100, 2);
        v_aterrizaje  numeric(14,2) := ROUND(v_fob_item + v_flete_p + v_seguro_p + v_agente_p + v_bodega_p + v_otros_p + ROUND(v_cif * v_fodinfa_pct / 100, 2) + ROUND(v_cif * v_arancel_pct / 100, 2) + ROUND(v_fob_item * v_isd_pct / 100, 2) + ROUND((v_cif + ROUND(v_cif * v_fodinfa_pct / 100, 2) + ROUND(v_cif * v_arancel_pct / 100, 2)) * v_iva_imp_pct / 100, 2), 2);
        v_aterrizaje_u numeric(14,2) := CASE WHEN v_qty > 0 THEN ROUND(v_aterrizaje / v_qty, 2) ELSE 0 END;
        v_divisor numeric := 1
          - COALESCE((p_datos->>'margen_empresa_pct')::numeric, 0) / 100
          - COALESCE((p_datos->>'comision_venta_pct')::numeric, 0) / 100
          - COALESCE((p_datos->>'gastos_admin_pct')::numeric, 0) / 100;
        v_pvp_u    numeric(14,2) := CASE WHEN v_divisor > 0 THEN ROUND(v_aterrizaje_u / v_divisor, 2) ELSE v_aterrizaje_u END;
        v_pvp_total numeric(14,2) := ROUND(v_pvp_u * v_qty, 2);
      BEGIN
        v_total_aterrizaje := v_total_aterrizaje + v_aterrizaje;
        v_total_venta      := v_total_venta + v_pvp_total;

        INSERT INTO public.costeo_proyecto_items (
          costeo_proyecto_id, costeo_id,
          orden, descripcion, fabricante, modelo, codigo_nandina,
          cantidad, precio_fob_unitario_usd,
          fodinfa_pct, arancel_pct, isd_pct, iva_importacion_pct,
          total_fob_usd, flete_prorrateado, seguro_prorrateado, agente_prorrateado,
          bodega_prorrateado, otros_prorrateados,
          fodinfa_usd, arancel_usd, isd_usd, iva_importacion_usd,
          costo_aterrizaje_total, costo_aterrizaje_unitario,
          precio_venta_unitario, precio_venta_total
        ) VALUES (
          p_id, NULLIF(v_item->>'costeo_id', '')::uuid,
          COALESCE((v_item->>'orden')::int, 0),
          COALESCE(v_item->>'descripcion', ''),
          v_item->>'fabricante', v_item->>'modelo', v_item->>'codigo_nandina',
          v_qty, COALESCE((v_item->>'precio_fob_unitario_usd')::numeric, 0),
          v_fodinfa_pct, v_arancel_pct, v_isd_pct, v_iva_imp_pct,
          v_fob_item, v_flete_p, v_seguro_p, v_agente_p, v_bodega_p, v_otros_p,
          v_fodinfa_usd, v_arancel_usd, v_isd_usd, v_iva_usd,
          v_aterrizaje, v_aterrizaje_u, v_pvp_u, v_pvp_total
        );
      END;
    END LOOP;

    UPDATE public.costeos_proyecto SET
      total_costo_aterrizaje = v_total_aterrizaje,
      total_precio_venta     = v_total_venta
    WHERE id = p_id;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_costeo_proyecto     TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_costeo_proyecto TO authenticated;
