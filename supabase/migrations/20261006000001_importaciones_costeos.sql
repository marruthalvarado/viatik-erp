-- =============================================================================
-- MÓDULO IMPORTACIONES — Fase 1: Costeos (Cotizador pre-importación)
-- Reemplaza el Excel de costeo manual con un flujo integrado en VIATIQ.
-- =============================================================================

-- ── Secuencia para número de costeo ─────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.costeos_numero_seq START 1;

-- ── Tabla principal: costeos ─────────────────────────────────────────────────
CREATE TABLE public.costeos (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                    uuid NOT NULL REFERENCES public.empresas(id),
  numero                        text NOT NULL,            -- CST-2026-0001

  -- Vínculos opcionales
  proyecto_id                   uuid REFERENCES public.proyectos(id),
  producto_id                   uuid REFERENCES public.productos_catalogo(id),
  proveedor_id                  uuid NOT NULL REFERENCES public.proveedores(id),
  importacion_id                uuid REFERENCES public.importaciones(id), -- se llena al importar

  -- Precio base del proveedor
  descripcion_producto          text NOT NULL DEFAULT '',
  moneda_proveedor              text NOT NULL DEFAULT 'USD'
                                  CHECK (moneda_proveedor IN ('USD', 'EUR')),
  precio_fob                    numeric(14,2) NOT NULL DEFAULT 0,
  tipo_cambio_eur               numeric(10,4) NOT NULL DEFAULT 1.08,
  -- precio_fob_usd = precio_fob * tipo_cambio_eur si EUR, sino precio_fob
  precio_fob_usd                numeric(14,2) NOT NULL DEFAULT 0, -- actualizado por RPC

  -- Costos logísticos estimados (USD)
  flete_estimado                numeric(14,2) NOT NULL DEFAULT 0,
  seguro_estimado               numeric(14,2) NOT NULL DEFAULT 0,
  agente_aduanas_est            numeric(14,2) NOT NULL DEFAULT 0,
  bodega_est                    numeric(14,2) NOT NULL DEFAULT 0,
  otros_logistica               numeric(14,2) NOT NULL DEFAULT 0,

  -- Partida arancelaria y tasas (%)
  codigo_nandina                text,
  fodinfa_pct                   numeric(5,2) NOT NULL DEFAULT 0.5,
  arancel_pct                   numeric(5,2) NOT NULL DEFAULT 0,
  isd_pct                       numeric(5,2) NOT NULL DEFAULT 5,
  iva_importacion_pct           numeric(5,2) NOT NULL DEFAULT 15,

  -- Servicios propios de la empresa (en USD)
  instalacion                   numeric(14,2) NOT NULL DEFAULT 0,
  entrenamiento                 numeric(14,2) NOT NULL DEFAULT 0,
  gastos_admin_fabrica          numeric(14,2) NOT NULL DEFAULT 0,
  fee_agente_comercial          numeric(14,2) NOT NULL DEFAULT 0,

  -- Reservas de posventa (en USD)
  garantia_reserva              numeric(14,2) NOT NULL DEFAULT 0,
  mantenimiento_preventivo_res  numeric(14,2) NOT NULL DEFAULT 0,

  -- Precios y márgenes
  comision_venta_pct            numeric(5,2) NOT NULL DEFAULT 0,
  margen_empresa_pct            numeric(5,2) NOT NULL DEFAULT 0,
  pvp_privado                   numeric(14,2) NOT NULL DEFAULT 0,
  pvp_general                   numeric(14,2) NOT NULL DEFAULT 0,

  -- Totales calculados por RPC calcular_costeo()
  total_componentes_usd         numeric(14,2) NOT NULL DEFAULT 0,
  fob_total_usd                 numeric(14,2) NOT NULL DEFAULT 0,
  cif_usd                       numeric(14,2) NOT NULL DEFAULT 0,
  fodinfa_usd                   numeric(14,2) NOT NULL DEFAULT 0,
  arancel_usd                   numeric(14,2) NOT NULL DEFAULT 0,
  isd_usd                       numeric(14,2) NOT NULL DEFAULT 0,
  iva_importacion_usd           numeric(14,2) NOT NULL DEFAULT 0,
  costo_aterrizaje_usd          numeric(14,2) NOT NULL DEFAULT 0,
  servicios_propios_usd         numeric(14,2) NOT NULL DEFAULT 0,
  garantia_total_usd            numeric(14,2) NOT NULL DEFAULT 0,
  costo_total_usd               numeric(14,2) NOT NULL DEFAULT 0,
  comision_venta_usd            numeric(14,2) NOT NULL DEFAULT 0,

  -- Control
  estado                        text NOT NULL DEFAULT 'borrador'
                                  CHECK (estado IN ('borrador','aprobado','vigente','archivado')),
  version                       integer NOT NULL DEFAULT 1,
  notas                         text,
  created_by                    uuid REFERENCES auth.users(id),
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  deleted_at                    timestamptz
);

CREATE UNIQUE INDEX costeos_numero_empresa_uidx ON public.costeos(empresa_id, numero)
  WHERE deleted_at IS NULL;

CREATE INDEX costeos_empresa_fecha_idx ON public.costeos(empresa_id, created_at DESC);
CREATE INDEX costeos_proyecto_idx      ON public.costeos(proyecto_id) WHERE proyecto_id IS NOT NULL;
CREATE INDEX costeos_importacion_idx   ON public.costeos(importacion_id) WHERE importacion_id IS NOT NULL;

-- ── Tabla de componentes/ítems dinámicos ─────────────────────────────────────
CREATE TABLE public.costeo_componentes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  costeo_id       uuid NOT NULL REFERENCES public.costeos(id) ON DELETE CASCADE,
  orden           integer NOT NULL DEFAULT 0,
  tipo            text NOT NULL DEFAULT 'componente_opcional'
                    CHECK (tipo IN ('equipo_base','componente_opcional','servicio_adicional')),
  descripcion     text NOT NULL,
  fabricante      text,
  modelo          text,
  moneda          text NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD','EUR')),
  precio_unitario numeric(14,2) NOT NULL DEFAULT 0,
  tipo_cambio     numeric(10,4) NOT NULL DEFAULT 1,
  precio_usd      numeric(14,2) NOT NULL DEFAULT 0,
  cantidad        integer NOT NULL DEFAULT 1,
  subtotal_usd    numeric(14,2) NOT NULL DEFAULT 0,
  incluir_en_fob  boolean NOT NULL DEFAULT true,
  notas           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX costeo_componentes_costeo_idx ON public.costeo_componentes(costeo_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.costeos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costeo_componentes ENABLE ROW LEVEL SECURITY;

-- Helper reutilizable
CREATE OR REPLACE FUNCTION public.es_miembro_activo_empresa(p_empresa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = p_empresa_id
      AND usuario_id = auth.uid()
      AND activo = true
  );
$$;

-- costeos
CREATE POLICY cst_select ON public.costeos FOR SELECT
  USING (es_miembro_activo_empresa(empresa_id));
CREATE POLICY cst_insert ON public.costeos FOR INSERT
  WITH CHECK (es_miembro_activo_empresa(empresa_id));
CREATE POLICY cst_update ON public.costeos FOR UPDATE
  USING (es_miembro_activo_empresa(empresa_id));
CREATE POLICY cst_delete ON public.costeos FOR DELETE
  USING (es_miembro_activo_empresa(empresa_id));

-- costeo_componentes (a través del costeo padre)
CREATE POLICY cst_comp_select ON public.costeo_componentes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.costeos c
    WHERE c.id = costeo_componentes.costeo_id
      AND es_miembro_activo_empresa(c.empresa_id)));
CREATE POLICY cst_comp_insert ON public.costeo_componentes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.costeos c
    WHERE c.id = costeo_componentes.costeo_id
      AND es_miembro_activo_empresa(c.empresa_id)));
CREATE POLICY cst_comp_update ON public.costeo_componentes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.costeos c
    WHERE c.id = costeo_componentes.costeo_id
      AND es_miembro_activo_empresa(c.empresa_id)));
CREATE POLICY cst_comp_delete ON public.costeo_componentes FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.costeos c
    WHERE c.id = costeo_componentes.costeo_id
      AND es_miembro_activo_empresa(c.empresa_id)));

-- ── RPC: calcular_costeo ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calcular_costeo(p_costeo_id uuid)
RETURNS public.costeos
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v   public.costeos;
  v_fob_base     numeric;
  v_total_comp   numeric;
  v_fob_total    numeric;
  v_cif          numeric;
  v_fodinfa      numeric;
  v_arancel      numeric;
  v_isd          numeric;
  v_iva_imp      numeric;
  v_costo_aterr  numeric;
  v_servicios    numeric;
  v_garantia_tot numeric;
  v_costo_total  numeric;
  v_comision     numeric;
  v_pvp_priv     numeric;
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

  -- 2. Total componentes en USD (solo los que incluir_en_fob)
  SELECT COALESCE(SUM(subtotal_usd), 0) INTO v_total_comp
  FROM public.costeo_componentes
  WHERE costeo_id = p_costeo_id AND incluir_en_fob = true;

  -- 3. FOB total
  v_fob_total := v_fob_base + v_total_comp;

  -- 4. CIF
  v_cif := v_fob_total + v.flete_estimado + v.seguro_estimado;

  -- 5. Impuestos sobre la importación
  v_fodinfa := ROUND(v_cif * v.fodinfa_pct / 100.0, 2);
  v_arancel  := ROUND(v_cif * v.arancel_pct / 100.0, 2);
  -- ISD se aplica sobre el FOB (valor de la remesa al exterior)
  v_isd      := ROUND(v_fob_total * v.isd_pct / 100.0, 2);
  -- IVA sobre (CIF + fodinfa + arancel)
  v_iva_imp  := ROUND((v_cif + v_fodinfa + v_arancel) * v.iva_importacion_pct / 100.0, 2);

  -- 6. Costo de aterrizaje
  v_costo_aterr := v_cif + v_fodinfa + v_arancel + v_isd + v_iva_imp
                 + v.agente_aduanas_est + v.bodega_est + v.otros_logistica;

  -- 7. Servicios propios
  v_servicios := v.instalacion + v.entrenamiento + v.gastos_admin_fabrica + v.fee_agente_comercial;

  -- 8. Reservas
  v_garantia_tot := v.garantia_reserva + v.mantenimiento_preventivo_res;

  -- 9. Costo total
  v_costo_total := v_costo_aterr + v_servicios + v_garantia_tot;

  -- 10. Comisión de venta
  v_comision := ROUND(v_costo_total * v.comision_venta_pct / 100.0, 2);

  -- 11. PVP privado: margen sobre PVP (precio de venta / (1 - margen%))
  --     Si margen >= 100% usamos markup simple (costo * (1 + margen%))
  IF v.margen_empresa_pct >= 100 OR v.margen_empresa_pct < 0 THEN
    v_pvp_priv := ROUND((v_costo_total + v_comision) * 2, 2); -- fallback
  ELSIF v.margen_empresa_pct = 0 THEN
    v_pvp_priv := v_costo_total + v_comision;
  ELSE
    v_pvp_priv := ROUND((v_costo_total + v_comision) / (1.0 - v.margen_empresa_pct / 100.0), 2);
  END IF;

  -- 12. PVP general: si el usuario no lo ha personalizado, iguala al privado
  --     (la UI permite editarlo libremente)

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

-- ── RPC: crear_costeo ────────────────────────────────────────────────────────
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
  -- Generar número
  v_numero := 'CST-' || to_char(now(), 'YYYY') || '-'
    || LPAD((nextval('public.costeos_numero_seq'))::text, 4, '0');

  INSERT INTO public.costeos (
    empresa_id, numero,
    proyecto_id, producto_id, proveedor_id,
    descripcion_producto, moneda_proveedor, precio_fob, tipo_cambio_eur,
    flete_estimado, seguro_estimado, agente_aduanas_est, bodega_est, otros_logistica,
    codigo_nandina, fodinfa_pct, arancel_pct, isd_pct, iva_importacion_pct,
    instalacion, entrenamiento, gastos_admin_fabrica, fee_agente_comercial,
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
    COALESCE((p_datos->>'entrenamiento')::numeric, 0),
    COALESCE((p_datos->>'gastos_admin_fabrica')::numeric, 0),
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

  -- Insertar componentes
  FOR v_comp IN SELECT * FROM jsonb_array_elements(p_componentes)
  LOOP
    INSERT INTO public.costeo_componentes (
      costeo_id, orden, tipo, descripcion, fabricante, modelo,
      moneda, precio_unitario, tipo_cambio, precio_usd, cantidad, subtotal_usd,
      incluir_en_fob, notas
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
      v_comp->>'notas'
    );
  END LOOP;

  -- Calcular totales
  PERFORM public.calcular_costeo(v_id);

  SELECT * INTO v_result FROM public.costeos WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'numero', v_numero);
END;
$$;

-- ── RPC: actualizar_costeo ───────────────────────────────────────────────────
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
    entrenamiento                = COALESCE((p_datos->>'entrenamiento')::numeric, entrenamiento),
    gastos_admin_fabrica         = COALESCE((p_datos->>'gastos_admin_fabrica')::numeric, gastos_admin_fabrica),
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

  -- Reemplazar componentes
  DELETE FROM public.costeo_componentes WHERE costeo_id = p_id;

  FOR v_comp IN SELECT * FROM jsonb_array_elements(p_componentes)
  LOOP
    INSERT INTO public.costeo_componentes (
      costeo_id, orden, tipo, descripcion, fabricante, modelo,
      moneda, precio_unitario, tipo_cambio, precio_usd, cantidad, subtotal_usd,
      incluir_en_fob, notas
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
      v_comp->>'notas'
    );
  END LOOP;

  -- Recalcular
  PERFORM public.calcular_costeo(p_id);
END;
$$;

-- ── RPC: eliminar_costeo (soft delete) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.eliminar_costeo(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.costeos
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_id AND deleted_at IS NULL;
END;
$$;

-- ── Trigger: updated_at automático ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER costeos_updated_at
  BEFORE UPDATE ON public.costeos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Comentarios ──────────────────────────────────────────────────────────────
COMMENT ON TABLE public.costeos IS
  'Costeo pre-importación. Reemplaza el Excel de cálculo de costo aterrizaje y PVP. '
  'Cada registro representa un producto que se quiere importar, con todos los impuestos '
  'y costos logísticos estimados. Se vincula a una importacion_id cuando se concreta.';

COMMENT ON TABLE public.costeo_componentes IS
  'Componentes/accesorios opcionales de un costeo. Permiten agregar ítems dinámicos '
  '(como en el Excel) que varían por cliente o proyecto.';
