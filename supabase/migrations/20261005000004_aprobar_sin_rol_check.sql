-- =============================================================================
-- Simplificar validación en rendir_aprobar y rendir_rechazar.
-- Si aprobador_id IS NULL: cualquier usuario que NO sea el dueño puede aprobar.
-- (La UI ya controla quién ve qué en la bandeja Workflow.)
-- =============================================================================

CREATE OR REPLACE FUNCTION rendir_aprobar(
  p_rendicion_id UUID,
  p_comentario   TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_rendicion     rendiciones%ROWTYPE;
  v_estado_actual TEXT;
  v_estado_id     UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_rendicion
    FROM rendiciones
   WHERE id = p_rendicion_id AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Rendicion no encontrada'; END IF;

  -- Si no hay aprobador asignado: cualquier usuario distinto al dueño puede aprobar
  IF v_rendicion.aprobador_id IS NULL THEN
    IF v_rendicion.usuario_id = auth.uid() THEN
      RAISE EXCEPTION 'No puedes aprobar tu propia rendicion';
    END IF;
    -- Auto-asignar como aprobador
    UPDATE rendiciones SET aprobador_id = auth.uid() WHERE id = p_rendicion_id;
  ELSIF v_rendicion.aprobador_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo el aprobador asignado puede aprobar esta rendicion';
  END IF;

  SELECT er.codigo INTO v_estado_actual
    FROM estados_rendicion er
   WHERE er.id = v_rendicion.estado_rendicion_id;

  IF v_estado_actual <> 'enviada' THEN
    RAISE EXCEPTION 'La rendicion debe estar enviada (estado: %)', v_estado_actual;
  END IF;

  SELECT id INTO v_estado_id FROM estados_rendicion WHERE codigo = 'aprobada' LIMIT 1;

  UPDATE rendiciones SET
    estado_rendicion_id = v_estado_id,
    aprobador_id        = auth.uid(),
    fecha_aprobacion    = now(),
    comentario_rechazo  = NULL,
    updated_at          = now()
  WHERE id = p_rendicion_id;

  INSERT INTO rendir_log (rendicion_id, empresa_id, usuario_id, estado_codigo, observacion)
  VALUES (p_rendicion_id, v_rendicion.empresa_id, auth.uid(), 'aprobada',
          NULLIF(TRIM(COALESCE(p_comentario, '')), ''));
END;
$$;

CREATE OR REPLACE FUNCTION rendir_rechazar(
  p_rendicion_id UUID,
  p_motivo       TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_rendicion     rendiciones%ROWTYPE;
  v_estado_actual TEXT;
  v_estado_id     UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'El motivo de rechazo es obligatorio';
  END IF;

  SELECT * INTO v_rendicion
    FROM rendiciones
   WHERE id = p_rendicion_id AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Rendicion no encontrada'; END IF;

  IF v_rendicion.aprobador_id IS NULL THEN
    IF v_rendicion.usuario_id = auth.uid() THEN
      RAISE EXCEPTION 'No puedes rechazar tu propia rendicion';
    END IF;
    UPDATE rendiciones SET aprobador_id = auth.uid() WHERE id = p_rendicion_id;
  ELSIF v_rendicion.aprobador_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo el aprobador asignado puede rechazar esta rendicion';
  END IF;

  SELECT er.codigo INTO v_estado_actual
    FROM estados_rendicion er
   WHERE er.id = v_rendicion.estado_rendicion_id;

  IF v_estado_actual <> 'enviada' THEN
    RAISE EXCEPTION 'La rendicion debe estar enviada (estado: %)', v_estado_actual;
  END IF;

  SELECT id INTO v_estado_id FROM estados_rendicion WHERE codigo = 'rechazada' LIMIT 1;

  UPDATE rendiciones SET
    estado_rendicion_id = v_estado_id,
    aprobador_id        = auth.uid(),
    comentario_rechazo  = p_motivo,
    updated_at          = now()
  WHERE id = p_rendicion_id;

  INSERT INTO rendir_log (rendicion_id, empresa_id, usuario_id, estado_codigo, observacion)
  VALUES (p_rendicion_id, v_rendicion.empresa_id, auth.uid(), 'rechazada', p_motivo);
END;
$$;
