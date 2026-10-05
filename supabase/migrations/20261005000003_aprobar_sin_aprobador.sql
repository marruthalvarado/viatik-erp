-- =============================================================================
-- Fix: rendir_aprobar y rendir_rechazar cuando aprobador_id es NULL
--
-- Rendiciones enviadas antes del auto-aprobador pueden tener aprobador_id NULL.
-- En lugar de lanzar excepción, si el usuario actual tiene rol "aprobador"
-- en la empresa, se auto-asigna y procede con la acción.
-- =============================================================================

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

  SELECT * INTO v_rendicion
    FROM rendiciones
   WHERE id = p_rendicion_id AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Rendicion no encontrada'; END IF;

  -- Validar aprobador: si aprobador_id es NULL, el usuario actual debe tener
  -- rol "aprobador" en la empresa → se auto-asigna y continúa.
  IF v_rendicion.aprobador_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM empresas_usuarios eu
      JOIN roles r ON r.id = eu.rol_id
      WHERE eu.usuario_id = auth.uid()
        AND eu.empresa_id = v_rendicion.empresa_id
        AND eu.activo = TRUE
        AND r.codigo = 'aprobador'
    ) THEN
      RAISE EXCEPTION 'Solo un aprobador asignado puede aprobar esta rendicion';
    END IF;
    -- Auto-asignar aprobador
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
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'El motivo de rechazo es obligatorio';
  END IF;

  SELECT * INTO v_rendicion
    FROM rendiciones
   WHERE id = p_rendicion_id AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Rendicion no encontrada'; END IF;

  -- Misma lógica: si aprobador_id es NULL, verificar rol "aprobador"
  IF v_rendicion.aprobador_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM empresas_usuarios eu
      JOIN roles r ON r.id = eu.rol_id
      WHERE eu.usuario_id = auth.uid()
        AND eu.empresa_id = v_rendicion.empresa_id
        AND eu.activo = TRUE
        AND r.codigo = 'aprobador'
    ) THEN
      RAISE EXCEPTION 'Solo un aprobador asignado puede rechazar esta rendicion';
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
