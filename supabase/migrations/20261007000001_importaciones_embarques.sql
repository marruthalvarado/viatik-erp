-- =============================================================================
-- MÓDULO IMPORTACIONES — Fase 2: Embarques (DAI / Liquidación aduanera)
-- Agrega numero_embarque + costeo_id a la tabla importaciones existente.
-- Los embarques son las liquidaciones DAI reales que se comparan contra costeos.
-- =============================================================================

-- ── Secuencia para número de embarque ───────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.importaciones_numero_seq START 1;

-- ── Nuevas columnas en importaciones ────────────────────────────────────────
ALTER TABLE public.importaciones
  ADD COLUMN IF NOT EXISTS numero_embarque text,
  ADD COLUMN IF NOT EXISTS costeo_id       uuid REFERENCES public.costeos(id);

-- Índice para búsqueda por número
CREATE INDEX IF NOT EXISTS idx_importaciones_numero
  ON public.importaciones(empresa_id, numero_embarque)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_importaciones_costeo
  ON public.importaciones(costeo_id)
  WHERE costeo_id IS NOT NULL;

-- ── RPC: crear_embarque ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crear_embarque(
  p_empresa_id uuid,
  p_datos      jsonb,
  p_lineas     jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id      uuid;
  v_numero  text;
  v_linea   jsonb;
BEGIN
  -- Generar número IMP-YYYY-NNNN
  v_numero := 'IMP-' || to_char(now(), 'YYYY') || '-'
    || LPAD((nextval('public.importaciones_numero_seq'))::text, 4, '0');

  INSERT INTO public.importaciones (
    empresa_id, numero_embarque,
    numero_liquidacion, referencia_dai,
    fecha, proveedor_id, gasto_empresa_id, bodega_destino_id,
    pais_origen, costeo_id,
    fob_total, seguro, flete, ajustes, valor_aduanas,
    arancel, fodinfa, iva_importacion, total_liquidado,
    estado, observacion, created_by
  ) VALUES (
    p_empresa_id, v_numero,
    p_datos->>'numero_liquidacion',
    p_datos->>'referencia_dai',
    COALESCE((p_datos->>'fecha')::date, CURRENT_DATE),
    NULLIF((p_datos->>'proveedor_id')::text, '')::uuid,
    NULLIF((p_datos->>'gasto_empresa_id')::text, '')::uuid,
    NULLIF((p_datos->>'bodega_destino_id')::text, '')::uuid,
    p_datos->>'pais_origen',
    NULLIF((p_datos->>'costeo_id')::text, '')::uuid,
    COALESCE((p_datos->>'fob_total')::numeric, 0),
    COALESCE((p_datos->>'seguro')::numeric, 0),
    COALESCE((p_datos->>'flete')::numeric, 0),
    COALESCE((p_datos->>'ajustes')::numeric, 0),
    COALESCE((p_datos->>'valor_aduanas')::numeric, 0),
    COALESCE((p_datos->>'arancel')::numeric, 0),
    COALESCE((p_datos->>'fodinfa')::numeric, 0),
    COALESCE((p_datos->>'iva_importacion')::numeric, 0),
    COALESCE((p_datos->>'total_liquidado')::numeric, 0),
    COALESCE(p_datos->>'estado', 'En tránsito'),
    p_datos->>'observacion',
    auth.uid()
  ) RETURNING id INTO v_id;

  -- Insertar líneas
  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    INSERT INTO public.importacion_lineas (
      importacion_id, producto_id, descripcion_original,
      fob_linea, cantidad, unidad_medida, peso_kg, pais_origen, observacion
    ) VALUES (
      v_id,
      NULLIF((v_linea->>'producto_id')::text, '')::uuid,
      COALESCE(v_linea->>'descripcion_original', ''),
      COALESCE((v_linea->>'fob_linea')::numeric, 0),
      COALESCE((v_linea->>'cantidad')::numeric, 1),
      v_linea->>'unidad_medida',
      NULLIF((v_linea->>'peso_kg')::text, '')::numeric,
      v_linea->>'pais_origen',
      v_linea->>'observacion'
    );
  END LOOP;

  -- Calcular prorrateo automático si hay total_liquidado > 0
  IF COALESCE((p_datos->>'total_liquidado')::numeric, 0) > 0 THEN
    PERFORM public.inv_calcular_prorrateo(v_id);
  END IF;

  RETURN jsonb_build_object('id', v_id, 'numero_embarque', v_numero);
END;
$$;

-- ── RPC: actualizar_embarque ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.actualizar_embarque(
  p_id     uuid,
  p_datos  jsonb,
  p_lineas jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_linea jsonb;
BEGIN
  UPDATE public.importaciones SET
    numero_liquidacion = COALESCE(p_datos->>'numero_liquidacion', numero_liquidacion),
    referencia_dai     = COALESCE(p_datos->>'referencia_dai',     referencia_dai),
    fecha              = COALESCE((p_datos->>'fecha')::date,       fecha),
    proveedor_id       = CASE
                           WHEN p_datos ? 'proveedor_id'
                           THEN NULLIF((p_datos->>'proveedor_id')::text, '')::uuid
                           ELSE proveedor_id
                         END,
    gasto_empresa_id   = CASE
                           WHEN p_datos ? 'gasto_empresa_id'
                           THEN NULLIF((p_datos->>'gasto_empresa_id')::text, '')::uuid
                           ELSE gasto_empresa_id
                         END,
    bodega_destino_id  = CASE
                           WHEN p_datos ? 'bodega_destino_id'
                           THEN NULLIF((p_datos->>'bodega_destino_id')::text, '')::uuid
                           ELSE bodega_destino_id
                         END,
    costeo_id          = CASE
                           WHEN p_datos ? 'costeo_id'
                           THEN NULLIF((p_datos->>'costeo_id')::text, '')::uuid
                           ELSE costeo_id
                         END,
    pais_origen        = COALESCE(p_datos->>'pais_origen',         pais_origen),
    fob_total          = COALESCE((p_datos->>'fob_total')::numeric, fob_total),
    seguro             = COALESCE((p_datos->>'seguro')::numeric,    seguro),
    flete              = COALESCE((p_datos->>'flete')::numeric,     flete),
    ajustes            = COALESCE((p_datos->>'ajustes')::numeric,   ajustes),
    valor_aduanas      = COALESCE((p_datos->>'valor_aduanas')::numeric, valor_aduanas),
    arancel            = COALESCE((p_datos->>'arancel')::numeric,   arancel),
    fodinfa            = COALESCE((p_datos->>'fodinfa')::numeric,   fodinfa),
    iva_importacion    = COALESCE((p_datos->>'iva_importacion')::numeric, iva_importacion),
    total_liquidado    = COALESCE((p_datos->>'total_liquidado')::numeric, total_liquidado),
    estado             = COALESCE(p_datos->>'estado',               estado),
    observacion        = COALESCE(p_datos->>'observacion',          observacion),
    updated_at         = now()
  WHERE id = p_id AND deleted_at IS NULL;

  -- Reemplazar líneas si se enviaron
  IF p_lineas IS NOT NULL THEN
    DELETE FROM public.importacion_lineas WHERE importacion_id = p_id;

    FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas)
    LOOP
      INSERT INTO public.importacion_lineas (
        importacion_id, producto_id, descripcion_original,
        fob_linea, cantidad, unidad_medida, peso_kg, pais_origen, observacion
      ) VALUES (
        p_id,
        NULLIF((v_linea->>'producto_id')::text, '')::uuid,
        COALESCE(v_linea->>'descripcion_original', ''),
        COALESCE((v_linea->>'fob_linea')::numeric, 0),
        COALESCE((v_linea->>'cantidad')::numeric, 1),
        v_linea->>'unidad_medida',
        NULLIF((v_linea->>'peso_kg')::text, '')::numeric,
        v_linea->>'pais_origen',
        v_linea->>'observacion'
      );
    END LOOP;

    PERFORM public.inv_calcular_prorrateo(p_id);
  END IF;
END;
$$;

-- ── RPC: eliminar_embarque (soft delete) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.eliminar_embarque(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.importaciones
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_id AND deleted_at IS NULL;
END;
$$;

-- ── RPC: vincular_costeo_embarque ────────────────────────────────────────────
-- Vincula un costeo aprobado a un embarque para comparación real vs estimado.
-- También actualiza costeo.importacion_id si aún no tiene.
CREATE OR REPLACE FUNCTION public.vincular_costeo_embarque(
  p_embarque_id uuid,
  p_costeo_id   uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.importaciones
  SET costeo_id  = p_costeo_id,
      updated_at = now()
  WHERE id = p_embarque_id AND deleted_at IS NULL;

  UPDATE public.costeos
  SET importacion_id = p_embarque_id,
      updated_at     = now()
  WHERE id = p_costeo_id AND deleted_at IS NULL
    AND importacion_id IS NULL;
END;
$$;

-- ── Comentarios ──────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.importaciones.numero_embarque IS
  'Número secuencial del embarque (IMP-YYYY-NNNN), generado automáticamente.';
COMMENT ON COLUMN public.importaciones.costeo_id IS
  'Referencia al costeo pre-importación (CST-XXXX) para comparar estimado vs real.';
