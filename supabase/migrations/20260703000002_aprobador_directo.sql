-- =============================================================================
-- Opcion B: Aprobador directo por rendicion
--
-- Agrega aprobador_id + comentario_rechazo a rendiciones.
-- 4 RPCs simples (sin workflows_aprobacion / workflow_pasos).
-- RLS: aprobador puede leer sus rendiciones asignadas.
--
-- Flujo: borrador → enviada (con aprobador) → aprobada | rechazada
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Columnas nuevas en rendiciones (idempotente)
-- ---------------------------------------------------------------------------
ALTER TABLE rendiciones
  ADD COLUMN IF NOT EXISTS aprobador_id      UUID REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS comentario_rechazo TEXT;

-- ---------------------------------------------------------------------------
-- 2. Seed estados_rendicion (idempotente)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM estados_rendicion WHERE codigo = 'borrador') THEN
    INSERT INTO estados_rendicion (codigo, nombre) VALUES ('borrador', 'Borrador');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM estados_rendicion WHERE codigo = 'enviada') THEN
    INSERT INTO estados_rendicion (codigo, nombre) VALUES ('enviada', 'Enviada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM estados_rendicion WHERE codigo = 'aprobada') THEN
    INSERT INTO estados_rendicion (codigo, nombre) VALUES ('aprobada', 'Aprobada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM estados_rendicion WHERE codigo = 'rechazada') THEN
    INSERT INTO estados_rendicion (codigo, nombre) VALUES ('rechazada', 'Rechazada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM estados_rendicion WHERE codigo = 'pagada') THEN
    INSERT INTO estados_rendicion (codigo, nombre) VALUES ('pagada', 'Pagada');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. RLS: aprobador puede leer rendiciones donde es el aprobador asignado
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rendiciones' AND policyname = 'rend_select_aprobador'
  ) THEN
    CREATE POLICY "rend_select_aprobador" ON rendiciones
      FOR SELECT TO authenticated
      USING (aprobador_id = auth.uid());
  END IF;
END $$;

-- RLS UPDATE: aprobador puede actualizar estado de sus rendiciones asignadas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rendiciones' AND policyname = 'rend_update_aprobador'
  ) THEN
    CREATE POLICY "rend_update_aprobador" ON rendiciones
      FOR UPDATE TO authenticated
      USING (aprobador_id = auth.uid())
      WITH CHECK (aprobador_id = auth.uid());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. RPC: rendir_enviar
-- Empleado envia su rendicion a un aprobador especifico.
-- Pre: estado = borrador | rechazada | NULL
-- Post: estado = enviada, aprobador_id asignado, fecha_envio = now()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rendir_enviar(
  p_rendicion_id UUID,
  p_aprobador_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado_actual TEXT;
  v_owner_id      UUID;
  v_estado_id     UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT r.usuario_id, er.codigo
    INTO v_owner_id, v_estado_actual
    FROM rendiciones r
    LEFT JOIN estados_rendicion er ON er.id = r.estado_rendicion_id
   WHERE r.id = p_rendicion_id
     AND r.deleted_at IS NULL
   FOR UPDATE;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Rendicion no encontrada';
  END IF;
  IF v_owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo el propietario puede enviar esta rendicion';
  END IF;
  IF v_estado_actual NOT IN ('borrador', 'rechazada') AND v_estado_actual IS NOT NULL THEN
    RAISE EXCEPTION 'La rendicion debe estar en borrador o rechazada (estado actual: %)', v_estado_actual;
  END IF;
  IF p_aprobador_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes ser tu propio aprobador';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = p_aprobador_id) THEN
    RAISE EXCEPTION 'El aprobador seleccionado no existe';
  END IF;

  SELECT id INTO v_estado_id FROM estados_rendicion WHERE codigo = 'enviada' LIMIT 1;
  IF v_estado_id IS NULL THEN
    RAISE EXCEPTION 'Estado "enviada" no configurado en el sistema';
  END IF;

  UPDATE rendiciones SET
    aprobador_id        = p_aprobador_id,
    estado_rendicion_id = v_estado_id,
    fecha_envio         = now(),
    comentario_rechazo  = NULL,
    updated_at          = now()
  WHERE id = p_rendicion_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. RPC: rendir_aprobar
-- Aprobador aprueba la rendicion asignada.
-- Pre: aprobador_id = auth.uid(), estado = enviada
-- Post: estado = aprobada, fecha_aprobacion = now()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rendir_aprobar(
  p_rendicion_id UUID,
  p_comentario   TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado_actual TEXT;
  v_aprobador_id  UUID;
  v_estado_id     UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT er.codigo, r.aprobador_id
    INTO v_estado_actual, v_aprobador_id
    FROM rendiciones r
    LEFT JOIN estados_rendicion er ON er.id = r.estado_rendicion_id
   WHERE r.id = p_rendicion_id
     AND r.deleted_at IS NULL
   FOR UPDATE;

  IF v_aprobador_id IS NULL THEN
    RAISE EXCEPTION 'Rendicion no encontrada o sin aprobador asignado';
  END IF;
  IF v_aprobador_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo el aprobador asignado puede aprobar esta rendicion';
  END IF;
  IF v_estado_actual <> 'enviada' THEN
    RAISE EXCEPTION 'La rendicion debe estar enviada para aprobar (estado: %)', v_estado_actual;
  END IF;

  SELECT id INTO v_estado_id FROM estados_rendicion WHERE codigo = 'aprobada' LIMIT 1;

  UPDATE rendiciones SET
    estado_rendicion_id = v_estado_id,
    fecha_aprobacion    = now(),
    comentario_rechazo  = NULL,
    updated_at          = now()
  WHERE id = p_rendicion_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC: rendir_rechazar
-- Aprobador rechaza la rendicion asignada con un motivo obligatorio.
-- Pre: aprobador_id = auth.uid(), estado = enviada
-- Post: estado = rechazada, comentario_rechazo = motivo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rendir_rechazar(
  p_rendicion_id UUID,
  p_motivo       TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado_actual TEXT;
  v_aprobador_id  UUID;
  v_estado_id     UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'El motivo de rechazo es obligatorio';
  END IF;

  SELECT er.codigo, r.aprobador_id
    INTO v_estado_actual, v_aprobador_id
    FROM rendiciones r
    LEFT JOIN estados_rendicion er ON er.id = r.estado_rendicion_id
   WHERE r.id = p_rendicion_id
     AND r.deleted_at IS NULL
   FOR UPDATE;

  IF v_aprobador_id IS NULL THEN
    RAISE EXCEPTION 'Rendicion no encontrada o sin aprobador asignado';
  END IF;
  IF v_aprobador_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo el aprobador asignado puede rechazar esta rendicion';
  END IF;
  IF v_estado_actual <> 'enviada' THEN
    RAISE EXCEPTION 'La rendicion debe estar enviada para rechazar (estado: %)', v_estado_actual;
  END IF;

  SELECT id INTO v_estado_id FROM estados_rendicion WHERE codigo = 'rechazada' LIMIT 1;

  UPDATE rendiciones SET
    estado_rendicion_id = v_estado_id,
    comentario_rechazo  = p_motivo,
    updated_at          = now()
  WHERE id = p_rendicion_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC: rendir_mis_pendientes
-- Devuelve rendiciones donde auth.uid() es el aprobador y estado = enviada.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rendir_mis_pendientes()
RETURNS TABLE (
  id                UUID,
  numero            TEXT,
  proyecto_id       UUID,
  empresa_id        UUID,
  usuario_id        UUID,
  fecha_envio       TIMESTAMPTZ,
  total_facturado   NUMERIC,
  anticipo_efectivo NUMERIC,
  anticipo_credito  NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.numero::text,
    r.proyecto_id,
    r.empresa_id,
    r.usuario_id,
    r.fecha_envio,
    COALESCE(r.total_facturado,   0)::numeric,
    COALESCE(r.anticipo_efectivo, 0)::numeric,
    COALESCE(r.anticipo_credito,  0)::numeric
  FROM rendiciones r
  JOIN estados_rendicion er ON er.id = r.estado_rendicion_id
  WHERE r.aprobador_id = auth.uid()
    AND er.codigo = 'enviada'
    AND r.deleted_at IS NULL
  ORDER BY r.fecha_envio DESC NULLS LAST;
END;
$$;
