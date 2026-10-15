-- Agregar campo es_servicio a cotizaciones
-- Cuando es_servicio=true, no se muestran Plazo de entrega / Garantía / Soporte técnico en el export

ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS es_servicio BOOLEAN NOT NULL DEFAULT FALSE;

-- Actualizar RPCs para incluir el nuevo campo
CREATE OR REPLACE FUNCTION crear_cotizacion(
  p_empresa_id       UUID,
  p_numero           TEXT,
  p_cliente_id       UUID,
  p_razon_social     TEXT,
  p_ruc_cliente      TEXT,
  p_email_cliente    TEXT,
  p_asunto           TEXT,
  p_fecha            DATE,
  p_valida_hasta     DATE,
  p_lugar_entrega    TEXT,
  p_dias_entrega     INT,
  p_meses_garantia   INT,
  p_terminos_pago    JSONB,
  p_notas            TEXT,
  p_items            JSONB,
  p_proyecto_id      UUID    DEFAULT NULL,
  p_es_servicio      BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id    UUID;
  v_item  JSONB;
  v_sub   NUMERIC := 0;
  v_desc  NUMERIC := 0;
  v_iva_p NUMERIC;
  v_iva   NUMERIC;
  v_tot   NUMERIC;
  v_pn    NUMERIC;
BEGIN
  -- verificar pertenencia a empresa
  IF NOT EXISTS (
    SELECT 1 FROM empresas_usuarios
    WHERE empresa_id = p_empresa_id AND usuario_id = auth.uid()
  ) THEN RAISE EXCEPTION 'No autorizado'; END IF;

  -- calcular totales
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pn := ((v_item->>'precio_unitario')::NUMERIC) * ((v_item->>'cantidad')::NUMERIC)
            * (1 - COALESCE((v_item->>'descuento_pct')::NUMERIC, 0)/100);
    v_sub  := v_sub  + v_pn;
    v_desc := v_desc + ((v_item->>'precio_unitario')::NUMERIC * (v_item->>'cantidad')::NUMERIC
              * COALESCE((v_item->>'descuento_pct')::NUMERIC, 0)/100);
  END LOOP;

  SELECT COALESCE((parametros->>'iva_pct_default')::NUMERIC, 15)
    INTO v_iva_p
    FROM parametros_sistema WHERE empresa_id = p_empresa_id LIMIT 1;
  IF v_iva_p IS NULL THEN v_iva_p := 15; END IF;

  v_iva := v_sub * v_iva_p / 100;
  v_tot := v_sub + v_iva;

  INSERT INTO cotizaciones (
    empresa_id, numero, cliente_id, razon_social, ruc_cliente, email_cliente,
    asunto, fecha, valida_hasta, lugar_entrega, dias_entrega, meses_garantia,
    terminos_pago, notas, subtotal, descuento_total, iva_pct, iva, total,
    proyecto_id, es_servicio, created_by
  ) VALUES (
    p_empresa_id, p_numero, p_cliente_id, p_razon_social, p_ruc_cliente, p_email_cliente,
    p_asunto, p_fecha, p_valida_hasta, p_lugar_entrega, p_dias_entrega, p_meses_garantia,
    p_terminos_pago, p_notas, v_sub, v_desc, v_iva_p, v_iva, v_tot,
    p_proyecto_id, p_es_servicio, auth.uid()
  ) RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pn := ((v_item->>'precio_unitario')::NUMERIC) * ((v_item->>'cantidad')::NUMERIC)
            * (1 - COALESCE((v_item->>'descuento_pct')::NUMERIC, 0)/100);
    INSERT INTO cotizacion_items (
      cotizacion_id, orden, catalogo_id, descripcion, fabricante, modelo,
      cantidad, precio_unitario, descuento_pct, precio_neto
    ) VALUES (
      v_id,
      (v_item->>'orden')::INT,
      NULLIF(v_item->>'catalogo_id', '')::UUID,
      v_item->>'descripcion',
      v_item->>'fabricante',
      v_item->>'modelo',
      (v_item->>'cantidad')::NUMERIC,
      (v_item->>'precio_unitario')::NUMERIC,
      COALESCE((v_item->>'descuento_pct')::NUMERIC, 0),
      v_pn
    );
  END LOOP;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION actualizar_cotizacion(
  p_id               UUID,
  p_razon_social     TEXT,
  p_ruc_cliente      TEXT,
  p_email_cliente    TEXT,
  p_asunto           TEXT,
  p_fecha            DATE,
  p_valida_hasta     DATE,
  p_lugar_entrega    TEXT,
  p_dias_entrega     INT,
  p_meses_garantia   INT,
  p_terminos_pago    JSONB,
  p_notas            TEXT,
  p_items            JSONB,
  p_cliente_id       UUID    DEFAULT NULL,
  p_proyecto_id      UUID    DEFAULT NULL,
  p_es_servicio      BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa UUID;
  v_item    JSONB;
  v_sub     NUMERIC := 0;
  v_desc    NUMERIC := 0;
  v_iva_p   NUMERIC;
  v_iva     NUMERIC;
  v_tot     NUMERIC;
  v_pn      NUMERIC;
BEGIN
  SELECT empresa_id INTO v_empresa FROM cotizaciones WHERE id = p_id;
  IF NOT EXISTS (
    SELECT 1 FROM empresas_usuarios WHERE empresa_id = v_empresa AND usuario_id = auth.uid()
  ) THEN RAISE EXCEPTION 'No autorizado'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pn  := ((v_item->>'precio_unitario')::NUMERIC) * ((v_item->>'cantidad')::NUMERIC)
             * (1 - COALESCE((v_item->>'descuento_pct')::NUMERIC, 0)/100);
    v_sub  := v_sub  + v_pn;
    v_desc := v_desc + ((v_item->>'precio_unitario')::NUMERIC * (v_item->>'cantidad')::NUMERIC
              * COALESCE((v_item->>'descuento_pct')::NUMERIC, 0)/100);
  END LOOP;

  SELECT COALESCE((parametros->>'iva_pct_default')::NUMERIC, 15)
    INTO v_iva_p
    FROM parametros_sistema WHERE empresa_id = v_empresa LIMIT 1;
  IF v_iva_p IS NULL THEN v_iva_p := 15; END IF;

  v_iva := v_sub * v_iva_p / 100;
  v_tot := v_sub + v_iva;

  UPDATE cotizaciones SET
    razon_social   = p_razon_social,
    ruc_cliente    = p_ruc_cliente,
    email_cliente  = p_email_cliente,
    asunto         = p_asunto,
    fecha          = p_fecha,
    valida_hasta   = p_valida_hasta,
    lugar_entrega  = p_lugar_entrega,
    dias_entrega   = p_dias_entrega,
    meses_garantia = p_meses_garantia,
    terminos_pago  = p_terminos_pago,
    notas          = p_notas,
    subtotal       = v_sub,
    descuento_total = v_desc,
    iva_pct        = v_iva_p,
    iva            = v_iva,
    total          = v_tot,
    cliente_id     = p_cliente_id,
    proyecto_id    = p_proyecto_id,
    es_servicio    = p_es_servicio,
    updated_at     = now()
  WHERE id = p_id;

  DELETE FROM cotizacion_items WHERE cotizacion_id = p_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pn := ((v_item->>'precio_unitario')::NUMERIC) * ((v_item->>'cantidad')::NUMERIC)
            * (1 - COALESCE((v_item->>'descuento_pct')::NUMERIC, 0)/100);
    INSERT INTO cotizacion_items (
      cotizacion_id, orden, catalogo_id, descripcion, fabricante, modelo,
      cantidad, precio_unitario, descuento_pct, precio_neto
    ) VALUES (
      p_id,
      (v_item->>'orden')::INT,
      NULLIF(v_item->>'catalogo_id', '')::UUID,
      v_item->>'descripcion',
      v_item->>'fabricante',
      v_item->>'modelo',
      (v_item->>'cantidad')::NUMERIC,
      (v_item->>'precio_unitario')::NUMERIC,
      COALESCE((v_item->>'descuento_pct')::NUMERIC, 0),
      v_pn
    );
  END LOOP;
END;
$$;
