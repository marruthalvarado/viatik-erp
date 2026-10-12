-- ============================================================
-- 20261012000002_servicios_en_fob.sql
-- Permite marcar Instalación, Entrenamiento y Gastos admin.
-- fábrica como "incluidos en FOB" (vienen en el invoice del
-- proveedor y deben ser gravados con impuestos de importación).
-- ============================================================

-- ── 1. Nuevas columnas en costeos ────────────────────────────
ALTER TABLE public.costeos
  ADD COLUMN IF NOT EXISTS instalacion_en_fob    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS entrenamiento_en_fob  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gastos_admin_en_fob   boolean NOT NULL DEFAULT false;

-- ── 2. calcular_costeo actualizado ───────────────────────────
CREATE OR REPLACE FUNCTION public.calcular_costeo(p_costeo_id uuid)
RETURNS public.costeos
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v               public.costeos;
  v_fob_base      numeric;
  v_total_comp    numeric;
  v_fob_servicios numeric;
  v_fob_total     numeric;
  v_cif           numeric;
  v_fodinfa       numeric;
  v_arancel       numeric;
  v_isd           numeric;
  v_iva_imp       numeric;
  v_costo_aterr   numeric;
  v_servicios     numeric;
  v_garantia_tot  numeric;
  v_costo_total   numeric;
  v_comision      numeric;
  v_pvp_priv      numeric;
BEGIN
  SELECT * INTO v FROM public.costeos WHERE id = p_costeo_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Costeo % no encontrado', p_costeo_id;
  END IF;

  -- 1. Precio base en USD
  v_fob_base := CASE
    WHEN v.moneda_proveedor = 'EUR' THEN ROUND(v.precio_fob * v.tipo_cambio_eur, 2)
    ELSE v.precio_fob
  END;

  -- 2. Total componentes en USD (solo los que incluir_en_fob = true AND activo = true)
  SELECT COALESCE(SUM(subtotal_usd), 0) INTO v_total_comp
  FROM public.costeo_componentes
  WHERE costeo_id = p_costeo_id
    AND incluir_en_fob = true
    AND activo = true;

  -- 2b. Servicios del proveedor que se incluyen en FOB
  v_fob_servicios :=
    (CASE WHEN v.instalacion_en_fob   THEN v.instalacion          ELSE 0 END) +
    (CASE WHEN v.entrenamiento_en_fob  THEN v.entrenamiento         ELSE 0 END) +
    (CASE WHEN v.gastos_admin_en_fob   THEN v.gastos_admin_fabrica  ELSE 0 END);

  -- 3. FOB total (base + componentes + servicios en FOB)
  v_fob_total := v_fob_base + v_total_comp + v_fob_servicios;

  -- 4. CIF
  v_cif := v_fob_total + v.flete_estimado + v.seguro_estimado;

  -- 5. Impuestos
  v_fodinfa := ROUND(v_cif * v.fodinfa_pct / 100.0, 2);
  v_arancel  := ROUND(v_cif * v.arancel_pct / 100.0, 2);
  v_isd      := ROUND(v_fob_total * v.isd_pct / 100.0, 2);
  v_iva_imp  := ROUND((v_cif + v_fodinfa + v_arancel) * v.iva_importacion_pct / 100.0, 2);

  -- 6. Costo de aterrizaje
  v_costo_aterr := v_cif + v_fodinfa + v_arancel + v_isd + v_iva_imp
                 + v.agente_aduanas_est + v.bodega_est + v.otros_logistica;

  -- 7. Servicios propios (excluye los que ya están en FOB)
  v_servicios :=
    (CASE WHEN NOT v.instalacion_en_fob   THEN v.instalacion          ELSE 0 END) +
    (CASE WHEN NOT v.entrenamiento_en_fob  THEN v.entrenamiento         ELSE 0 END) +
    (CASE WHEN NOT v.gastos_admin_en_fob   THEN v.gastos_admin_fabrica  ELSE 0 END) +
    v.fee_agente_comercial;

  -- 8. Reservas
  v_garantia_tot := v.garantia_reserva + v.mantenimiento_preventivo_res;

  -- 9. Costo total
  v_costo_total := v_costo_aterr + v_servicios + v_garantia_tot;

  -- 10. Comisión de venta
  v_comision := ROUND(v_costo_total * v.comision_venta_pct / 100.0, 2);

  -- 11. PVP privado
  IF v.margen_empresa_pct >= 100 OR v.margen_empresa_pct < 0 THEN
    v_pvp_priv := ROUND((v_costo_total + v_comision) * 2, 2);
  ELSIF v.margen_empresa_pct = 0 THEN
    v_pvp_priv := v_costo_total + v_comision;
  ELSE
    v_pvp_priv := ROUND((v_costo_total + v_comision) / (1.0 - v.margen_empresa_pct / 100.0), 2);
  END IF;

  UPDATE public.costeos SET
    precio_fob_usd              = v_fob_base,
    total_componentes_usd       = v_total_comp,
    fob_total_usd               = v_fob_total,
    cif_usd                     = v_cif,
    fodinfa_usd                 = v_fodinfa,
    arancel_usd                 = v_arancel,
    isd_usd                     = v_isd,
    iva_importacion_usd         = v_iva_imp,
    costo_aterrizaje_usd        = v_costo_aterr,
    servicios_propios_usd       = v_servicios,
    garantia_total_usd          = v_garantia_tot,
    costo_total_usd             = v_costo_total,
    comision_venta_usd          = v_comision,
    pvp_privado                 = CASE WHEN pvp_privado = 0 THEN v_pvp_priv ELSE pvp_privado END,
    pvp_general                 = CASE WHEN pvp_general = 0 THEN v_pvp_priv ELSE pvp_general END,
    updated_at                  = now()
  WHERE id = p_costeo_id
  RETURNING * INTO v;

  RETURN v;
END;
$$;

-- ── 3. crear_costeo actualizado ──────────────────────────────
CREATE OR REPLACE FUNCTION public.crear_costeo(
  p_empresa_id  uuid,
  p_datos       jsonb,
  p_componentes jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id     uuid;
  v_numero text;
  v_comp   jsonb;
  v_result public.costeos;
BEGIN
  v_numero := 'CST-' || to_char(now(), 'YYYY') || '-'
    || LPAD((nextval('public.costeos_numero_seq'))::text, 4, '0');

  INSERT INTO public.costeos (
    empresa_id, numero,
    proyecto_id, producto_id, proveedor_id,
    descripcion_producto, moneda_proveedor, precio_fob, tipo_cambio_eur,
    flete_estimado, seguro_estimado, agente_aduanas_est, bodega_est, otros_logistica,
    codigo_nandina, fodinfa_pct, arancel_pct, isd_pct, iva_importacion_pct,
    instalacion, instalacion_en_fob,
    entrenamiento, entrenamiento_en_fob,
    gastos_admin_fabrica, gastos_admin_en_fob,
    fee_agente_comercial,
    garantia_reserva, mantenimiento_preventivo_res,
    comision_venta_pct, margen_empresa_pct, pvp_privado, pvp_general,
    notas, estado, created_by
  ) VALUES (
    p_empresa_id, v_numero,
    NULLIF((p_datos->>'proyecto_id')::text, '')::uuid,
    NULLIF((p_datos->>'producto_id')::text, '')::uuid,
    (p_datos->>'proveedor_id')::uuid,
    COALESCE(p_datos->>'descripcion_producto', ''),
    COALESCE(p_datos->>'moneda_proveedor', 'USD'),
    COALESCE((p_datos->>'precio_fob')::numeric, 0),
    COALESCE((p_datos->>'tipo_cambio_eur')::numeric, 1.08),
    COALESCE((p_datos->>'flete_estimado')::numeric, 0),
    COALESCE((p_datos->>'seguro_estimado')::numeric, 0),
    COALESCE((p_datos->>'agente_aduanas_est')::numeric, 0),
    COALESCE((p_datos->>'bodega_est')::numeric, 0),
    COALESCE((p_datos->>'otros_logistica')::numeric, 0),
    p_datos->>'codigo_nandina',
    COALESCE((p_datos->>'fodinfa_pct')::numeric, 0.5),
    COALESCE((p_datos->>'arancel_pct')::numeric, 0),
    COALESCE((p_datos->>'isd_pct')::numeric, 5),
    COALESCE((p_datos->>'iva_importacion_pct')::numeric, 15),
    COALESCE((p_datos->>'instalacion')::numeric, 0),
    COALESCE((p_datos->>'instalacion_en_fob')::boolean, false),
    COALESCE((p_datos->>'entrenamiento')::numeric, 0),
    COALESCE((p_datos->>'entrenamiento_en_fob')::boolean, false),
    COALESCE((p_datos->>'gastos_admin_fabrica')::numeric, 0),
    COALESCE((p_datos->>'gastos_admin_en_fob')::boolean, false),
    COALESCE((p_datos->>'fee_agente_comercial')::numeric, 0),
    COALESCE((p_datos->>'garantia_reserva')::numeric, 0),
    COALESCE((p_datos->>'mantenimiento_preventivo_res')::numeric, 0),
    COALESCE((p_datos->>'comision_venta_pct')::numeric, 0),
    COALESCE((p_datos->>'margen_empresa_pct')::numeric, 0),
    COALESCE((p_datos->>'pvp_privado')::numeric, 0),
    COALESCE((p_datos->>'pvp_general')::numeric, 0),
    p_datos->>'notas',
    COALESCE(p_datos->>'estado', 'borrador'),
    auth.uid()
  ) RETURNING id INTO v_id;

  FOR v_comp IN SELECT * FROM jsonb_array_elements(p_componentes)
  LOOP
    INSERT INTO public.costeo_componentes (
      costeo_id, orden, tipo, descripcion, fabricante, modelo,
      moneda, precio_unitario, tipo_cambio, precio_usd, cantidad, subtotal_usd,
      incluir_en_fob, activo, notas
    ) VALUES (
      v_id,
      COALESCE((v_comp->>'orden')::int, 0),
      COALESCE(v_comp->>'tipo', 'componente_opcional'),
      v_comp->>'descripcion',
      v_comp->>'fabricante',
      v_comp->>'modelo',
      COALESCE(v_comp->>'moneda', 'USD'),
      COALESCE((v_comp->>'precio_unitario')::numeric, 0),
      COALESCE((v_comp->>'tipo_cambio')::numeric, 1),
      COALESCE((v_comp->>'precio_usd')::numeric, 0),
      COALESCE((v_comp->>'cantidad')::int, 1),
      COALESCE((v_comp->>'subtotal_usd')::numeric, 0),
      COALESCE((v_comp->>'incluir_en_fob')::boolean, true),
      COALESCE((v_comp->>'activo')::boolean, true),
      v_comp->>'notas'
    );
  END LOOP;

  PERFORM public.calcular_costeo(v_id);

  SELECT * INTO v_result FROM public.costeos WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'numero', v_numero);
END;
$$;

-- ── 4. actualizar_costeo actualizado ─────────────────────────
CREATE OR REPLACE FUNCTION public.actualizar_costeo(
  p_id          uuid,
  p_datos       jsonb,
  p_componentes jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_comp jsonb;
BEGIN
  UPDATE public.costeos SET
    proyecto_id                  = NULLIF((p_datos->>'proyecto_id')::text, '')::uuid,
    producto_id                  = NULLIF((p_datos->>'producto_id')::text, '')::uuid,
    proveedor_id                 = (p_datos->>'proveedor_id')::uuid,
    descripcion_producto         = COALESCE(p_datos->>'descripcion_producto', descripcion_producto),
    moneda_proveedor             = COALESCE(p_datos->>'moneda_proveedor', moneda_proveedor),
    precio_fob                   = COALESCE((p_datos->>'precio_fob')::numeric, precio_fob),
    tipo_cambio_eur              = COALESCE((p_datos->>'tipo_cambio_eur')::numeric, tipo_cambio_eur),
    flete_estimado               = COALESCE((p_datos->>'flete_estimado')::numeric, flete_estimado),
    seguro_estimado              = COALESCE((p_datos->>'seguro_estimado')::numeric, seguro_estimado),
    agente_aduanas_est           = COALESCE((p_datos->>'agente_aduanas_est')::numeric, agente_aduanas_est),
    bodega_est                   = COALESCE((p_datos->>'bodega_est')::numeric, bodega_est),
    otros_logistica              = COALESCE((p_datos->>'otros_logistica')::numeric, otros_logistica),
    codigo_nandina               = COALESCE(p_datos->>'codigo_nandina', codigo_nandina),
    fodinfa_pct                  = COALESCE((p_datos->>'fodinfa_pct')::numeric, fodinfa_pct),
    arancel_pct                  = COALESCE((p_datos->>'arancel_pct')::numeric, arancel_pct),
    isd_pct                      = COALESCE((p_datos->>'isd_pct')::numeric, isd_pct),
    iva_importacion_pct          = COALESCE((p_datos->>'iva_importacion_pct')::numeric, iva_importacion_pct),
    instalacion                  = COALESCE((p_datos->>'instalacion')::numeric, instalacion),
    instalacion_en_fob           = COALESCE((p_datos->>'instalacion_en_fob')::boolean, instalacion_en_fob),
    entrenamiento                = COALESCE((p_datos->>'entrenamiento')::numeric, entrenamiento),
    entrenamiento_en_fob         = COALESCE((p_datos->>'entrenamiento_en_fob')::boolean, entrenamiento_en_fob),
    gastos_admin_fabrica         = COALESCE((p_datos->>'gastos_admin_fabrica')::numeric, gastos_admin_fabrica),
    gastos_admin_en_fob          = COALESCE((p_datos->>'gastos_admin_en_fob')::boolean, gastos_admin_en_fob),
    fee_agente_comercial         = COALESCE((p_datos->>'fee_agente_comercial')::numeric, fee_agente_comercial),
    garantia_reserva             = COALESCE((p_datos->>'garantia_reserva')::numeric, garantia_reserva),
    mantenimiento_preventivo_res = COALESCE((p_datos->>'mantenimiento_preventivo_res')::numeric, mantenimiento_preventivo_res),
    comision_venta_pct           = COALESCE((p_datos->>'comision_venta_pct')::numeric, comision_venta_pct),
    margen_empresa_pct           = COALESCE((p_datos->>'margen_empresa_pct')::numeric, margen_empresa_pct),
    pvp_privado                  = COALESCE((p_datos->>'pvp_privado')::numeric, pvp_privado),
    pvp_general                  = COALESCE((p_datos->>'pvp_general')::numeric, pvp_general),
    estado                       = COALESCE(p_datos->>'estado', estado),
    notas                        = COALESCE(p_datos->>'notas', notas),
    updated_at                   = now()
  WHERE id = p_id AND deleted_at IS NULL;

  DELETE FROM public.costeo_componentes WHERE costeo_id = p_id;

  FOR v_comp IN SELECT * FROM jsonb_array_elements(p_componentes)
  LOOP
    INSERT INTO public.costeo_componentes (
      costeo_id, orden, tipo, descripcion, fabricante, modelo,
      moneda, precio_unitario, tipo_cambio, precio_usd, cantidad, subtotal_usd,
      incluir_en_fob, activo, notas
    ) VALUES (
      p_id,
      COALESCE((v_comp->>'orden')::int, 0),
      COALESCE(v_comp->>'tipo', 'componente_opcional'),
      v_comp->>'descripcion',
      v_comp->>'fabricante',
      v_comp->>'modelo',
      COALESCE(v_comp->>'moneda', 'USD'),
      COALESCE((v_comp->>'precio_unitario')::numeric, 0),
      COALESCE((v_comp->>'tipo_cambio')::numeric, 1),
      COALESCE((v_comp->>'precio_usd')::numeric, 0),
      COALESCE((v_comp->>'cantidad')::int, 1),
      COALESCE((v_comp->>'subtotal_usd')::numeric, 0),
      COALESCE((v_comp->>'incluir_en_fob')::boolean, true),
      COALESCE((v_comp->>'activo')::boolean, true),
      v_comp->>'notas'
    );
  END LOOP;

  PERFORM public.calcular_costeo(p_id);
END;
$$;
