-- Fix: rendir_aprobar y rendir_rechazar usaban LEFT JOIN con FOR UPDATE
-- PostgreSQL no permite FOR UPDATE en el lado nullable de un outer join.
-- Solución: separar el SELECT con FOR UPDATE (solo rendiciones) del
-- lookup de estado (estados_rendicion), idéntico a como lo hace rendir_devolver.

-- ─── rendir_aprobar ──────────────────────────────────────────────────────────
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

  -- Bloquear la fila sin JOIN (FOR UPDATE no funciona con LEFT JOIN)
  SELECT * INTO v_rendicion
    FROM rendiciones
   WHERE id = p_rendicion_id AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Rendicion no encontrada o sin aprobador asignado'; END IF;

  -- Validar aprobador
  IF v_rendicion.aprobador_id IS NULL THEN RAISE EXCEPTION 'Rendicion sin aprobador asignado'; END IF;
  IF v_rendicion.aprobador_id <> auth.uid() THEN RAISE EXCEPTION 'Solo el aprobador asignado puede aprobar esta rendicion'; END IF;

  -- Obtener estado actual por separado
  SELECT er.codigo INTO v_estado_actual
    FROM estados_rendicion er
   WHERE er.id = v_rendicion.estado_rendicion_id;

  IF v_estado_actual <> 'enviada' THEN RAISE EXCEPTION 'La rendicion debe estar enviada (estado: %)', v_estado_actual; END IF;

  SELECT id INTO v_estado_id FROM estados_rendicion WHERE codigo = 'aprobada' LIMIT 1;

  UPDATE rendiciones SET
    estado_rendicion_id = v_estado_id,
    fecha_aprobacion    = now(),
    comentario_rechazo  = NULL,
    updated_at          = now()
  WHERE id = p_rendicion_id;

  INSERT INTO rendir_log (rendicion_id, empresa_id, usuario_id, estado_codigo, observacion)
  VALUES (p_rendicion_id, v_rendicion.empresa_id, auth.uid(), 'aprobada',
          NULLIF(TRIM(COALESCE(p_comentario, '')), ''));
END;
$$;

-- ─── rendir_rechazar ─────────────────────────────────────────────────────────
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
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN RAISE EXCEPTION 'El motivo de rechazo es obligatorio'; END IF;

  -- Bloquear la fila sin JOIN
  SELECT * INTO v_rendicion
    FROM rendiciones
   WHERE id = p_rendicion_id AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Rendicion no encontrada'; END IF;

  -- Validar aprobador
  IF v_rendicion.aprobador_id IS NULL THEN RAISE EXCEPTION 'Rendicion sin aprobador asignado'; END IF;
  IF v_rendicion.aprobador_id <> auth.uid() THEN RAISE EXCEPTION 'Solo el aprobador asignado puede rechazar esta rendicion'; END IF;

  -- Obtener estado actual por separado
  SELECT er.codigo INTO v_estado_actual
    FROM estados_rendicion er
   WHERE er.id = v_rendicion.estado_rendicion_id;

  IF v_estado_actual <> 'enviada' THEN RAISE EXCEPTION 'La rendicion debe estar enviada (estado: %)', v_estado_actual; END IF;

  SELECT id INTO v_estado_id FROM estados_rendicion WHERE codigo = 'rechazada' LIMIT 1;

  UPDATE rendiciones SET
    estado_rendicion_id = v_estado_id,
    comentario_rechazo  = p_motivo,
    updated_at          = now()
  WHERE id = p_rendicion_id;

  INSERT INTO rendir_log (rendicion_id, empresa_id, usuario_id, estado_codigo, observacion)
  VALUES (p_rendicion_id, v_rendicion.empresa_id, auth.uid(), 'rechazada', p_motivo);
END;
$$;
