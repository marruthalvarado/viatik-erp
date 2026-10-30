-- Fix: el RPC crear_cotizacion usaba "creado_por" (columna inexistente)
-- La columna correcta en public.cotizaciones es "created_by"

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
  v_numero     text;
  v_seq        integer;
  v_year       text := to_char(CURRENT_DATE, 'YYYY');
  v_cot_id     uuid;
  v_subtotal   numeric(14,2) := 0;
  v_desc_total numeric(14,2) := 0;
  v_iva_pct    numeric(5,2);
  v_iva        numeric(14,2);
  v_total      numeric(14,2);
  v_item       jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = p_empresa_id AND usuario_id = v_user_id
  ) THEN RAISE EXCEPTION 'Acceso denegado'; END IF;

  -- Auto-número
  SELECT COALESCE(MAX((regexp_match(numero, '\d+$'))[1]::integer), 0) + 1
  INTO v_seq
  FROM public.cotizaciones
  WHERE empresa_id = p_empresa_id AND numero LIKE 'COT-' || v_year || '-%';
  v_numero := 'COT-' || v_year || '-' || lpad(v_seq::text, 4, '0');

  v_iva_pct := COALESCE((p_datos->>'iva_pct')::numeric, 15);

  -- Subtotal solo con ítems que NO son opción
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF NOT COALESCE((v_item->>'es_opcion')::boolean, false) THEN
      v_subtotal   := v_subtotal + ROUND(
        (v_item->>'precio_unitario')::numeric * (v_item->>'cantidad')::numeric *
        (1 - COALESCE((v_item->>'descuento_pct')::numeric, 0) / 100), 2);
      v_desc_total := v_desc_total + ROUND(
        (v_item->>'precio_unitario')::numeric * (v_item->>'cantidad')::numeric *
        COALESCE((v_item->>'descuento_pct')::numeric, 0) / 100, 2);
    END IF;
  END LOOP;

  v_iva   := ROUND(v_subtotal * v_iva_pct / 100, 2);
  v_total := v_subtotal + v_iva;

  INSERT INTO public.cotizaciones (
    empresa_id, numero, cliente_id, razon_social, ruc_cliente, email_cliente,
    asunto, fecha, valida_hasta, lugar_entrega, dias_entrega, meses_garantia,
    terminos_pago, notas, observacion_interna,
    iva_pct, subtotal, descuento_total, iva, total,
    proyecto_id, es_servicio, created_by
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
    v_iva_pct, v_subtotal, v_desc_total, v_iva, v_total,
    NULLIF(p_datos->>'proyecto_id', '')::uuid,
    COALESCE((p_datos->>'es_servicio')::boolean, false),
    v_user_id
  ) RETURNING id INTO v_cot_id;

  INSERT INTO public.cotizacion_items (
    cotizacion_id, orden, catalogo_id, descripcion, fabricante, modelo,
    cantidad, precio_unitario, descuento_pct, dias_entrega, meses_garantia, notas,
    es_opcion
  )
  SELECT v_cot_id,
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
    COALESCE((elem->>'es_opcion')::boolean, false)
  FROM jsonb_array_elements(p_items) AS elem;

  RETURN json_build_object('id', v_cot_id, 'numero', v_numero);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: actualizar_cotizacion (fix: agregar es_servicio al UPDATE)
-- ─────────────────────────────────────────────────────────────────────────────
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

  -- Subtotal solo con ítems que NO son opción
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF NOT COALESCE((v_item->>'es_opcion')::boolean, false) THEN
      v_subtotal   := v_subtotal + ROUND(
        (v_item->>'precio_unitario')::numeric * (v_item->>'cantidad')::numeric *
        (1 - COALESCE((v_item->>'descuento_pct')::numeric, 0) / 100), 2);
      v_desc_total := v_desc_total + ROUND(
        (v_item->>'precio_unitario')::numeric * (v_item->>'cantidad')::numeric *
        COALESCE((v_item->>'descuento_pct')::numeric, 0) / 100, 2);
    END IF;
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
    proyecto_id         = NULLIF(p_datos->>'proyecto_id', '')::uuid,
    es_servicio         = COALESCE((p_datos->>'es_servicio')::boolean, false),
    updated_at          = now()
  WHERE id = p_id;

  DELETE FROM public.cotizacion_items WHERE cotizacion_id = p_id;

  INSERT INTO public.cotizacion_items (
    cotizacion_id, orden, catalogo_id, descripcion, fabricante, modelo,
    cantidad, precio_unitario, descuento_pct, dias_entrega, meses_garantia, notas,
    es_opcion
  )
  SELECT p_id,
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
    COALESCE((elem->>'es_opcion')::boolean, false)
  FROM jsonb_array_elements(p_items) AS elem;
END;
$$;
