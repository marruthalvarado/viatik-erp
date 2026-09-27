-- ============================================================
-- FIX: renombrar variable 'item' → 'v_item' en RPCs de cotizaciones
-- Causa: ambigüedad entre variable PL/pgSQL y alias de jsonb_array_elements
-- ============================================================
SET statement_timeout = 0;

-- ── Fix crear_cotizacion ────────────────────────────────────
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
  -- Verificar pertenencia
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = p_empresa_id AND usuario_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  -- Numeración limpia por empresa y año
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(numero, '-', 3) AS int)
  ), 0) + 1
  INTO v_seq
  FROM public.cotizaciones
  WHERE empresa_id = p_empresa_id
    AND EXTRACT(YEAR FROM fecha) = v_year;

  v_numero := 'COT-' || v_year || '-' || LPAD(v_seq::text, 4, '0');

  -- Calcular totales desde ítems
  v_iva_pct := COALESCE((p_datos->>'iva_pct')::numeric, 15);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_precio_neto := ROUND(
      (v_item->>'precio_unitario')::numeric *
      (v_item->>'cantidad')::numeric *
      (1 - COALESCE((v_item->>'descuento_pct')::numeric, 0) / 100), 2
    );
    v_subtotal   := v_subtotal + v_precio_neto;
    v_desc_total := v_desc_total + ROUND(
      (v_item->>'precio_unitario')::numeric *
      (v_item->>'cantidad')::numeric *
      COALESCE((v_item->>'descuento_pct')::numeric, 0) / 100, 2
    );
  END LOOP;

  v_iva   := ROUND(v_subtotal * v_iva_pct / 100, 2);
  v_total := v_subtotal + v_iva;

  -- Insertar cabecera
  INSERT INTO public.cotizaciones (
    empresa_id, numero, cliente_id, razon_social, ruc_cliente, email_cliente,
    fecha, valida_hasta, lugar_entrega, dias_entrega, meses_garantia,
    terminos_pago, notas, observacion_interna, iva_pct,
    subtotal, descuento_total, iva, total, created_by
  ) VALUES (
    p_empresa_id,
    v_numero,
    NULLIF(p_datos->>'cliente_id', '')::uuid,
    p_datos->>'razon_social',
    p_datos->>'ruc_cliente',
    p_datos->>'email_cliente',
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

  -- Insertar ítems (alias 'elem' para evitar ambigüedad)
  INSERT INTO public.cotizacion_items (
    cotizacion_id, orden, catalogo_id, descripcion, fabricante, modelo,
    cantidad, precio_unitario, descuento_pct, dias_entrega, meses_garantia, notas
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
    elem->>'notas'
  FROM jsonb_array_elements(p_items) AS elem;

  RETURN json_build_object('id', v_cot_id, 'numero', v_numero);
END;
$$;

-- ── Fix actualizar_cotizacion ────────────────────────────────
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
  ) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

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

  -- Reemplazar ítems (alias 'elem' para evitar ambigüedad)
  DELETE FROM public.cotizacion_items WHERE cotizacion_id = p_id;

  INSERT INTO public.cotizacion_items (
    cotizacion_id, orden, catalogo_id, descripcion, fabricante, modelo,
    cantidad, precio_unitario, descuento_pct, dias_entrega, meses_garantia, notas
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
    elem->>'notas'
  FROM jsonb_array_elements(p_items) AS elem;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_cotizacion     TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_cotizacion TO authenticated;
