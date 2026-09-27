-- ============================================================
-- COTIZACIONES — Módulo de propuestas técnico-comerciales
-- Fase E — 2026-09-27
-- ============================================================
SET statement_timeout = 0;

-- ── 1. Extender productos_catalogo para cotizaciones ────────
ALTER TABLE public.productos_catalogo
  ADD COLUMN IF NOT EXISTS fabricante          text,
  ADD COLUMN IF NOT EXISTS modelo              text,
  ADD COLUMN IF NOT EXISTS descripcion_tecnica text,
  ADD COLUMN IF NOT EXISTS precio_referencial  numeric(14,2),
  ADD COLUMN IF NOT EXISTS tipo_item           text NOT NULL DEFAULT 'producto'
                            CHECK (tipo_item IN ('producto', 'servicio')),
  ADD COLUMN IF NOT EXISTS dias_entrega_est    integer,
  ADD COLUMN IF NOT EXISTS meses_garantia      integer,
  ADD COLUMN IF NOT EXISTS para_cotizar        boolean NOT NULL DEFAULT true;

-- ── 2. Tabla cotizaciones ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cotizaciones (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- Numeración automática: COT-2026-0001
  numero              text        NOT NULL,

  -- Cliente
  cliente_id          uuid        REFERENCES public.clientes(id) ON DELETE SET NULL,
  razon_social        text        NOT NULL,
  ruc_cliente         text,
  email_cliente       text,

  -- Fechas
  fecha               date        NOT NULL DEFAULT CURRENT_DATE,
  valida_hasta        date,

  -- Estado
  estado              text        NOT NULL DEFAULT 'borrador'
                      CHECK (estado IN ('borrador','enviada','aprobada','rechazada','vencida')),

  -- Condiciones
  lugar_entrega       text,
  dias_entrega        integer,
  meses_garantia      integer,
  terminos_pago       jsonb       DEFAULT '[]'::jsonb,
  -- Ejemplo: [{"concepto":"Anticipo","porcentaje":40},{"concepto":"Embarque","porcentaje":30},{"concepto":"Entrega","porcentaje":30}]

  -- Montos calculados
  subtotal            numeric(14,2) NOT NULL DEFAULT 0,
  descuento_total     numeric(14,2) NOT NULL DEFAULT 0,
  iva_pct             numeric(5,2)  NOT NULL DEFAULT 15,
  iva                 numeric(14,2) NOT NULL DEFAULT 0,
  total               numeric(14,2) NOT NULL DEFAULT 0,

  -- Notas / observaciones
  notas               text,
  observacion_interna text,

  -- Referencias
  cotizacion_origen_id uuid       REFERENCES public.cotizaciones(id) ON DELETE SET NULL,
  factura_id           uuid       REFERENCES public.facturas_emitidas(id) ON DELETE SET NULL,

  -- Auditoría
  created_by          uuid        REFERENCES public.usuarios(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Tabla cotizacion_items ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.cotizacion_items (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id    uuid          NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  orden            integer       NOT NULL DEFAULT 0,

  -- Puede venir del catálogo o ser texto libre
  catalogo_id      uuid          REFERENCES public.productos_catalogo(id) ON DELETE SET NULL,
  descripcion      text          NOT NULL,
  fabricante       text,
  modelo           text,

  -- Cantidades y precios
  cantidad         numeric(10,3) NOT NULL DEFAULT 1,
  precio_unitario  numeric(14,2) NOT NULL DEFAULT 0,
  descuento_pct    numeric(5,2)  NOT NULL DEFAULT 0,
  precio_neto      numeric(14,2) GENERATED ALWAYS AS
                     (ROUND(precio_unitario * cantidad * (1 - descuento_pct / 100), 2)) STORED,

  -- Condiciones del ítem
  dias_entrega     integer,
  meses_garantia   integer,
  notas            text,

  created_at       timestamptz   NOT NULL DEFAULT now()
);

-- ── 4. Secuencia para numeración COT ───────────────────────
CREATE SEQUENCE IF NOT EXISTS public.seq_cotizacion_numero START 1;

-- ── 5. Índices ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cotizaciones_empresa ON public.cotizaciones(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado  ON public.cotizaciones(empresa_id, estado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente ON public.cotizaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cotizacion_items_cot ON public.cotizacion_items(cotizacion_id);

-- ── 6. Trigger updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at_cotizaciones()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_cotizaciones_updated_at ON public.cotizaciones;
CREATE TRIGGER trg_cotizaciones_updated_at
  BEFORE UPDATE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_cotizaciones();

-- ── 7. RLS ──────────────────────────────────────────────────
ALTER TABLE public.cotizaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_items  ENABLE ROW LEVEL SECURITY;

-- Cotizaciones: acceso por empresa del usuario
DROP POLICY IF EXISTS cotizaciones_all ON public.cotizaciones;
CREATE POLICY cotizaciones_all ON public.cotizaciones
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM public.empresas_usuarios
      WHERE usuario_id = auth.uid()
    )
  );

-- Cotizacion items: acceso a través de cotizacion
DROP POLICY IF EXISTS cotizacion_items_all ON public.cotizacion_items;
CREATE POLICY cotizacion_items_all ON public.cotizacion_items
  FOR ALL USING (
    cotizacion_id IN (
      SELECT c.id FROM public.cotizaciones c
      JOIN public.empresas_usuarios eu ON eu.empresa_id = c.empresa_id
      WHERE eu.usuario_id = auth.uid()
    )
  );

-- ── 8. RPC: crear_cotizacion ────────────────────────────────
CREATE OR REPLACE FUNCTION public.crear_cotizacion(
  p_empresa_id       uuid,
  p_datos            jsonb,   -- campos de cabecera
  p_items            jsonb    -- array de ítems
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
  item         jsonb;
  v_precio_neto numeric(14,2);
BEGIN
  -- Verificar pertenencia
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = p_empresa_id AND usuario_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  -- Obtener secuencia anual (reinicia por año en la numeración, no en la seq)
  v_seq := nextval('public.seq_cotizacion_numero');
  -- Contar cotizaciones del año para numeración limpia por año
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(numero, '-', 3) AS int)
  ), 0) + 1
  INTO v_seq
  FROM public.cotizaciones
  WHERE empresa_id = p_empresa_id
    AND EXTRACT(YEAR FROM fecha) = v_year;

  v_numero := 'COT-' || v_year || '-' || LPAD(v_seq::text, 4, '0');

  -- Calcular totales desde items
  v_iva_pct := COALESCE((p_datos->>'iva_pct')::numeric, 15);

  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_precio_neto := ROUND(
      (item->>'precio_unitario')::numeric *
      (item->>'cantidad')::numeric *
      (1 - COALESCE((item->>'descuento_pct')::numeric, 0) / 100), 2
    );
    v_subtotal   := v_subtotal + v_precio_neto;
    v_desc_total := v_desc_total + ROUND(
      (item->>'precio_unitario')::numeric *
      (item->>'cantidad')::numeric *
      COALESCE((item->>'descuento_pct')::numeric, 0) / 100, 2
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

  -- Insertar ítems
  INSERT INTO public.cotizacion_items (
    cotizacion_id, orden, catalogo_id, descripcion, fabricante, modelo,
    cantidad, precio_unitario, descuento_pct, dias_entrega, meses_garantia, notas
  )
  SELECT
    v_cot_id,
    (item->>'orden')::integer,
    NULLIF(item->>'catalogo_id', '')::uuid,
    item->>'descripcion',
    item->>'fabricante',
    item->>'modelo',
    COALESCE((item->>'cantidad')::numeric, 1),
    COALESCE((item->>'precio_unitario')::numeric, 0),
    COALESCE((item->>'descuento_pct')::numeric, 0),
    NULLIF(item->>'dias_entrega', '')::integer,
    NULLIF(item->>'meses_garantia', '')::integer,
    item->>'notas'
  FROM jsonb_array_elements(p_items) AS item;

  RETURN json_build_object('id', v_cot_id, 'numero', v_numero);
END;
$$;

-- ── 9. RPC: actualizar_estado_cotizacion ────────────────────
CREATE OR REPLACE FUNCTION public.actualizar_estado_cotizacion(
  p_id     uuid,
  p_estado text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_empresa   uuid;
  v_actual    text;
BEGIN
  SELECT empresa_id, estado INTO v_empresa, v_actual
  FROM public.cotizaciones WHERE id = p_id;

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Cotización no encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = v_empresa AND usuario_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  -- Transiciones válidas
  IF p_estado = 'enviada'   AND v_actual NOT IN ('borrador')               THEN RAISE EXCEPTION 'Solo se puede enviar desde Borrador'; END IF;
  IF p_estado = 'aprobada'  AND v_actual NOT IN ('enviada')                THEN RAISE EXCEPTION 'Solo se puede aprobar desde Enviada'; END IF;
  IF p_estado = 'rechazada' AND v_actual NOT IN ('enviada','borrador')     THEN RAISE EXCEPTION 'No se puede rechazar en estado %', v_actual; END IF;
  IF p_estado = 'vencida'   AND v_actual NOT IN ('borrador','enviada')     THEN RAISE EXCEPTION 'No se puede marcar vencida'; END IF;
  IF p_estado = 'borrador'  AND v_actual NOT IN ('enviada')                THEN RAISE EXCEPTION 'Solo se puede devolver a Borrador desde Enviada'; END IF;

  UPDATE public.cotizaciones
  SET estado = p_estado, updated_at = now()
  WHERE id = p_id;
END;
$$;

-- ── 10. RPC: convertir_cotizacion_a_factura ─────────────────
CREATE OR REPLACE FUNCTION public.convertir_cotizacion_a_factura(
  p_cotizacion_id  uuid,
  p_numero_factura text DEFAULT NULL,
  p_fecha_factura  date DEFAULT CURRENT_DATE
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_cot       public.cotizaciones%ROWTYPE;
  v_factura_id uuid;
  v_numero    text;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id = p_cotizacion_id;

  IF v_cot.id IS NULL THEN
    RAISE EXCEPTION 'Cotización no encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = v_cot.empresa_id AND usuario_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  IF v_cot.estado != 'aprobada' THEN
    RAISE EXCEPTION 'Solo se puede convertir a factura una cotización Aprobada (estado actual: %)', v_cot.estado;
  END IF;

  IF v_cot.factura_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta cotización ya tiene una factura asociada';
  END IF;

  -- Número de factura
  v_numero := COALESCE(p_numero_factura, 'PRF-' || TO_CHAR(p_fecha_factura, 'YYYY') || '-' ||
    LPAD(
      (SELECT COALESCE(COUNT(*), 0) + 1 FROM public.facturas_emitidas WHERE empresa_id = v_cot.empresa_id)::text,
      6, '0'
    )
  );

  -- Crear factura emitida (proforma/pendiente)
  INSERT INTO public.facturas_emitidas (
    empresa_id, numero, fecha, tipo,
    ruc_cliente, razon_social,
    subtotal, descuento, iva, total,
    estado_sri, observacion
  ) VALUES (
    v_cot.empresa_id,
    v_numero,
    p_fecha_factura,
    'factura',
    COALESCE(v_cot.ruc_cliente, ''),
    v_cot.razon_social,
    v_cot.subtotal,
    v_cot.descuento_total,
    v_cot.iva,
    v_cot.total,
    'PENDIENTE',
    'Generada desde cotización ' || v_cot.numero
  ) RETURNING id INTO v_factura_id;

  -- Vincular
  UPDATE public.cotizaciones
  SET factura_id = v_factura_id, updated_at = now()
  WHERE id = p_cotizacion_id;

  RETURN json_build_object('factura_id', v_factura_id, 'numero', v_numero);
END;
$$;

-- ── 11. RPC: actualizar_cotizacion ──────────────────────────
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
  item         jsonb;
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

  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal   := v_subtotal + ROUND(
      (item->>'precio_unitario')::numeric * (item->>'cantidad')::numeric *
      (1 - COALESCE((item->>'descuento_pct')::numeric, 0) / 100), 2);
    v_desc_total := v_desc_total + ROUND(
      (item->>'precio_unitario')::numeric * (item->>'cantidad')::numeric *
      COALESCE((item->>'descuento_pct')::numeric, 0) / 100, 2);
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

  -- Reemplazar ítems
  DELETE FROM public.cotizacion_items WHERE cotizacion_id = p_id;

  INSERT INTO public.cotizacion_items (
    cotizacion_id, orden, catalogo_id, descripcion, fabricante, modelo,
    cantidad, precio_unitario, descuento_pct, dias_entrega, meses_garantia, notas
  )
  SELECT
    p_id,
    (item->>'orden')::integer,
    NULLIF(item->>'catalogo_id', '')::uuid,
    item->>'descripcion',
    item->>'fabricante',
    item->>'modelo',
    COALESCE((item->>'cantidad')::numeric, 1),
    COALESCE((item->>'precio_unitario')::numeric, 0),
    COALESCE((item->>'descuento_pct')::numeric, 0),
    NULLIF(item->>'dias_entrega', '')::integer,
    NULLIF(item->>'meses_garantia', '')::integer,
    item->>'notas'
  FROM jsonb_array_elements(p_items) AS item;
END;
$$;

-- ── 12. GRANT ───────────────────────────────────────────────
GRANT USAGE ON SEQUENCE public.seq_cotizacion_numero TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotizaciones     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotizacion_items TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_cotizacion              TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_cotizacion         TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_estado_cotizacion  TO authenticated;
GRANT EXECUTE ON FUNCTION public.convertir_cotizacion_a_factura TO authenticated;
