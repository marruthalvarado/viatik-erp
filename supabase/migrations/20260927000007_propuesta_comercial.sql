-- ============================================================
-- PROPUESTA COMERCIAL: campos para exportación profesional
-- ============================================================
SET statement_timeout = 0;

-- ── 1. Clientes: logo + contacto cotización ──────────────────
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS logo_url           text,
  ADD COLUMN IF NOT EXISTS contacto_nombre    text,
  ADD COLUMN IF NOT EXISTS contacto_cargo     text;

-- ── 2. Proveedores: logo (para fabricantes internacionales) ──
ALTER TABLE public.proveedores
  ADD COLUMN IF NOT EXISTS logo_url text;

-- ── 3. Catálogo: foto + descripción larga + vínculo proveedor
ALTER TABLE public.productos_catalogo
  ADD COLUMN IF NOT EXISTS foto_url          text,
  ADD COLUMN IF NOT EXISTS descripcion_larga text,
  ADD COLUMN IF NOT EXISTS proveedor_id      uuid REFERENCES public.proveedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_productos_catalogo_proveedor
  ON public.productos_catalogo(proveedor_id);

-- ── 4. Cotizaciones: asunto ──────────────────────────────────
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS asunto text;

-- ── 5. Cotizacion_items: proveedor_id (para agrupar en export)
ALTER TABLE public.cotizacion_items
  ADD COLUMN IF NOT EXISTS proveedor_id uuid REFERENCES public.proveedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cotizacion_items_proveedor
  ON public.cotizacion_items(proveedor_id);

-- ── 6. Storage buckets públicos para logos y fotos ───────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('clientes-logos',    'clientes-logos',    true, 5242880,  ARRAY['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('proveedores-logos', 'proveedores-logos', true, 5242880,  ARRAY['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('catalogo-fotos',    'catalogo-fotos',    true, 10485760, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS políticas Storage: cualquier usuario autenticado puede subir/leer
CREATE POLICY IF NOT EXISTS "clientes_logos_select"
  ON storage.objects FOR SELECT USING (bucket_id = 'clientes-logos');
CREATE POLICY IF NOT EXISTS "clientes_logos_insert"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'clientes-logos' AND auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "clientes_logos_delete"
  ON storage.objects FOR DELETE USING (bucket_id = 'clientes-logos' AND auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "proveedores_logos_select"
  ON storage.objects FOR SELECT USING (bucket_id = 'proveedores-logos');
CREATE POLICY IF NOT EXISTS "proveedores_logos_insert"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'proveedores-logos' AND auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "proveedores_logos_delete"
  ON storage.objects FOR DELETE USING (bucket_id = 'proveedores-logos' AND auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "catalogo_fotos_select"
  ON storage.objects FOR SELECT USING (bucket_id = 'catalogo-fotos');
CREATE POLICY IF NOT EXISTS "catalogo_fotos_insert"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'catalogo-fotos' AND auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "catalogo_fotos_delete"
  ON storage.objects FOR DELETE USING (bucket_id = 'catalogo-fotos' AND auth.role() = 'authenticated');

-- ── 7. Parámetros del sistema: resumen ejecutivo + T&C ────────
-- Se insertan con upsert; el valor vacío permite que el usuario
-- los edite desde Configuración en el frontend.
-- NOTA: empresa_id se completa desde el frontend; aquí dejamos
--       una referencia de las claves que se deben insertar.
-- (La inserción real la hace el frontend al guardar por primera vez)

-- ── 8. Actualizar RPC crear_cotizacion para incluir asunto ────
CREATE OR REPLACE FUNCTION public.crear_cotizacion(
  p_empresa_id       uuid,
  p_datos            jsonb,
  p_items            jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_year       int  := EXTRACT(YEAR FROM CURRENT_DATE);
  v_seq        int;
  v_numero     text;
  v_cot_id     uuid;
  v_subtotal   numeric(14,2) := 0;
  v_desc_total numeric(14,2) := 0;
  v_iva_pct    numeric(5,2);
  v_iva        numeric(14,2);
  v_total      numeric(14,2);
  v_item       jsonb;
  v_precio_neto numeric(14,2);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = p_empresa_id AND usuario_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  SELECT COALESCE(MAX(CAST(SPLIT_PART(numero, '-', 3) AS int)), 0) + 1
  INTO v_seq
  FROM public.cotizaciones
  WHERE empresa_id = p_empresa_id AND EXTRACT(YEAR FROM fecha) = v_year;

  v_numero := 'COT-' || v_year || '-' || LPAD(v_seq::text, 4, '0');
  v_iva_pct := COALESCE((p_datos->>'iva_pct')::numeric, 15);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_precio_neto := ROUND(
      (v_item->>'precio_unitario')::numeric *
      (v_item->>'cantidad')::numeric *
      (1 - COALESCE((v_item->>'descuento_pct')::numeric, 0) / 100), 2);
    v_subtotal   := v_subtotal + v_precio_neto;
    v_desc_total := v_desc_total + ROUND(
      (v_item->>'precio_unitario')::numeric *
      (v_item->>'cantidad')::numeric *
      COALESCE((v_item->>'descuento_pct')::numeric, 0) / 100, 2);
  END LOOP;

  v_iva   := ROUND(v_subtotal * v_iva_pct / 100, 2);
  v_total := v_subtotal + v_iva;

  INSERT INTO public.cotizaciones (
    empresa_id, numero, cliente_id, razon_social, ruc_cliente, email_cliente,
    asunto, fecha, valida_hasta, lugar_entrega, dias_entrega, meses_garantia,
    terminos_pago, notas, observacion_interna, iva_pct,
    subtotal, descuento_total, iva, total, created_by
  ) VALUES (
    p_empresa_id, v_numero,
    NULLIF(p_datos->>'cliente_id', '')::uuid,
    p_datos->>'razon_social',
    p_datos->>'ruc_cliente',
    p_datos->>'email_cliente',
    p_datos->>'asunto',
    COALESCE((p_datos->>'fecha')::date, CURRENT_DATE),
    NULLIF(p_datos->>'valida_hasta', '')::date,
    p_datos->>'lugar_entrega',
    NULLIF(p_datos->>'dias_entrega', '')::integer,
    NULLIF(p_datos->>'meses_garantia', '')::integer,
    COALESCE(p_datos->'terminos_pago', '[]'::jsonb),
    p_datos->>'notas',
    p_datos->>'observacion_interna',
    v_iva_pct,
    v_subtotal, v_desc_total, v_iva, v_total,
    v_user_id
  ) RETURNING id INTO v_cot_id;

  INSERT INTO public.cotizacion_items (
    cotizacion_id, orden, catalogo_id, descripcion, fabricante, modelo,
    cantidad, precio_unitario, descuento_pct, dias_entrega, meses_garantia,
    notas, proveedor_id
  )
  SELECT
    v_cot_id,
    (elem->>'orden')::integer,
    NULLIF(elem->>'catalogo_id', '')::uuid,
    elem->>'descripcion',
    elem->>'fabricante',
    elem->>'modelo',
    COALESCE((elem->>'cantidad')::numeric, 1),
    COALESCE((elem->>'precio_unitario')::numeric, 0),
    COALESCE((elem->>'descuento_pct')::numeric, 0),
    NULLIF(elem->>'dias_entrega', '')::integer,
    NULLIF(elem->>'meses_garantia', '')::integer,
    elem->>'notas',
    NULLIF(elem->>'proveedor_id', '')::uuid
  FROM jsonb_array_elements(p_items) AS elem;

  RETURN json_build_object('id', v_cot_id, 'numero', v_numero);
END;
$$;

-- ── 9. Actualizar RPC actualizar_cotizacion ───────────────────
CREATE OR REPLACE FUNCTION public.actualizar_cotizacion(
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
  v_empresa    uuid;
  v_estado     text;
  v_subtotal   numeric(14,2) := 0;
  v_desc_total numeric(14,2) := 0;
  v_iva_pct    numeric(5,2);
  v_iva        numeric(14,2);
  v_total      numeric(14,2);
  v_item       jsonb;
BEGIN
  SELECT empresa_id, estado INTO v_empresa, v_estado
  FROM public.cotizaciones WHERE id = p_id;

  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = v_empresa AND usuario_id = v_user_id
  ) THEN RAISE EXCEPTION 'Acceso denegado'; END IF;
  IF v_estado NOT IN ('borrador') THEN
    RAISE EXCEPTION 'Solo se puede editar una cotización en estado Borrador';
  END IF;

  v_iva_pct := COALESCE((p_datos->>'iva_pct')::numeric, 15);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal   := v_subtotal + ROUND(
      (v_item->>'precio_unitario')::numeric * (v_item->>'cantidad')::numeric *
      (1 - COALESCE((v_item->>'descuento_pct')::numeric, 0) / 100), 2);
    v_desc_total := v_desc_total + ROUND(
      (v_item->>'precio_unitario')::numeric * (v_item->>'cantidad')::numeric *
      COALESCE((v_item->>'descuento_pct')::numeric, 0) / 100, 2);
  END LOOP;

  v_iva   := ROUND(v_subtotal * v_iva_pct / 100, 2);
  v_total := v_subtotal + v_iva;

  UPDATE public.cotizaciones SET
    cliente_id          = NULLIF(p_datos->>'cliente_id', '')::uuid,
    razon_social        = p_datos->>'razon_social',
    ruc_cliente         = p_datos->>'ruc_cliente',
    email_cliente       = p_datos->>'email_cliente',
    asunto              = p_datos->>'asunto',
    fecha               = COALESCE((p_datos->>'fecha')::date, CURRENT_DATE),
    valida_hasta        = NULLIF(p_datos->>'valida_hasta', '')::date,
    lugar_entrega       = p_datos->>'lugar_entrega',
    dias_entrega        = NULLIF(p_datos->>'dias_entrega', '')::integer,
    meses_garantia      = NULLIF(p_datos->>'meses_garantia', '')::integer,
    terminos_pago       = COALESCE(p_datos->'terminos_pago', '[]'::jsonb),
    notas               = p_datos->>'notas',
    observacion_interna = p_datos->>'observacion_interna',
    iva_pct             = v_iva_pct,
    subtotal            = v_subtotal,
    descuento_total     = v_desc_total,
    iva                 = v_iva,
    total               = v_total,
    updated_at          = now()
  WHERE id = p_id;

  DELETE FROM public.cotizacion_items WHERE cotizacion_id = p_id;

  INSERT INTO public.cotizacion_items (
    cotizacion_id, orden, catalogo_id, descripcion, fabricante, modelo,
    cantidad, precio_unitario, descuento_pct, dias_entrega, meses_garantia,
    notas, proveedor_id
  )
  SELECT
    p_id,
    (elem->>'orden')::integer,
    NULLIF(elem->>'catalogo_id', '')::uuid,
    elem->>'descripcion',
    elem->>'fabricante',
    elem->>'modelo',
    COALESCE((elem->>'cantidad')::numeric, 1),
    COALESCE((elem->>'precio_unitario')::numeric, 0),
    COALESCE((elem->>'descuento_pct')::numeric, 0),
    NULLIF(elem->>'dias_entrega', '')::integer,
    NULLIF(elem->>'meses_garantia', '')::integer,
    elem->>'notas',
    NULLIF(elem->>'proveedor_id', '')::uuid
  FROM jsonb_array_elements(p_items) AS elem;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_cotizacion      TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_cotizacion TO authenticated;
