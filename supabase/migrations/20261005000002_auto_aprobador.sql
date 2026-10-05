-- =============================================================================
-- Auto-aprobador al enviar rendición.
--
-- Cambios:
-- 1. rendir_aprobadores_disponibles: agrega campo es_aprobador (BOOLEAN) y
--    deduplica por usuario_id (un usuario con múltiples roles solo aparece una vez).
-- 2. rendir_enviar: corrige bug FOR UPDATE + LEFT JOIN (igual que aprobar/rechazar),
--    y hace p_aprobador_id opcional (DEFAULT NULL).
--    Si es NULL: auto-detecta el único usuario con rol "aprobador" en la empresa.
--    Si hay 0 → exception; si hay >1 → exception (el frontend muestra picker).
-- =============================================================================

-- ─── 1. rendir_aprobadores_disponibles: dedup + es_aprobador ─────────────────
-- DROP primero: PostgreSQL no permite cambiar la firma con CREATE OR REPLACE
DROP FUNCTION IF EXISTS rendir_aprobadores_disponibles();

CREATE FUNCTION rendir_aprobadores_disponibles()
RETURNS TABLE (
  usuario_id   UUID,
  nombres      TEXT,
  apellidos    TEXT,
  email        TEXT,
  es_aprobador BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  SELECT eu.empresa_id INTO v_empresa_id
  FROM empresas_usuarios eu
  WHERE eu.usuario_id = auth.uid() AND eu.activo = TRUE
  LIMIT 1;

  IF v_empresa_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT DISTINCT ON (eu.usuario_id)
    eu.usuario_id,
    COALESCE(u.nombres, split_part(au.email, '@', 1)) AS nombres,
    u.apellidos,
    au.email,
    EXISTS (
      SELECT 1 FROM empresas_usuarios eu2
      JOIN roles r ON r.id = eu2.rol_id
      WHERE eu2.usuario_id = eu.usuario_id
        AND eu2.empresa_id = v_empresa_id
        AND eu2.activo = TRUE
        AND r.codigo = 'aprobador'
    ) AS es_aprobador
  FROM empresas_usuarios eu
  LEFT JOIN public.usuarios u ON u.id = eu.usuario_id
  LEFT JOIN auth.users     au ON au.id = eu.usuario_id
  WHERE eu.empresa_id = v_empresa_id
    AND eu.activo = TRUE
    AND eu.usuario_id <> auth.uid()
  ORDER BY eu.usuario_id;
END;
$$;

GRANT EXECUTE ON FUNCTION rendir_aprobadores_disponibles() TO authenticated;

-- ─── 2. rendir_enviar: fix FOR UPDATE + LEFT JOIN + aprobador auto ────────────
CREATE OR REPLACE FUNCTION rendir_enviar(
  p_rendicion_id UUID,
  p_aprobador_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth AS $$
DECLARE
  v_rendicion     rendiciones%ROWTYPE;
  v_estado_actual TEXT;
  v_estado_id     UUID;
  v_aprobador_id  UUID;
  v_count         INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  -- Bloquear la fila sin JOIN (FOR UPDATE no funciona con LEFT JOIN)
  SELECT * INTO v_rendicion
    FROM rendiciones
   WHERE id = p_rendicion_id AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Rendicion no encontrada'; END IF;
  IF v_rendicion.usuario_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo el propietario puede enviar esta rendicion';
  END IF;

  -- Estado por separado
  SELECT er.codigo INTO v_estado_actual
    FROM estados_rendicion er
   WHERE er.id = v_rendicion.estado_rendicion_id;

  IF v_estado_actual NOT IN ('borrador', 'rechazada', 'devuelta', 'registrada')
     AND v_estado_actual IS NOT NULL THEN
    RAISE EXCEPTION 'La rendicion debe estar en borrador, registrada, rechazada o devuelta (estado: %)', v_estado_actual;
  END IF;

  -- Resolver aprobador
  v_aprobador_id := p_aprobador_id;

  IF v_aprobador_id IS NULL THEN
    -- Contar usuarios con rol "aprobador" en la empresa (excluyendo al solicitante)
    SELECT COUNT(DISTINCT eu.usuario_id) INTO v_count
    FROM empresas_usuarios eu
    JOIN roles r ON r.id = eu.rol_id
    WHERE eu.empresa_id = v_rendicion.empresa_id
      AND eu.usuario_id <> auth.uid()
      AND eu.activo = TRUE
      AND r.codigo = 'aprobador';

    IF v_count = 0 THEN
      RAISE EXCEPTION 'No hay aprobadores configurados en la empresa';
    ELSIF v_count > 1 THEN
      RAISE EXCEPTION 'Multiples aprobadores disponibles, selecciona uno';
    END IF;

    SELECT eu.usuario_id INTO v_aprobador_id
    FROM empresas_usuarios eu
    JOIN roles r ON r.id = eu.rol_id
    WHERE eu.empresa_id = v_rendicion.empresa_id
      AND eu.usuario_id <> auth.uid()
      AND eu.activo = TRUE
      AND r.codigo = 'aprobador'
    LIMIT 1;
  END IF;

  IF v_aprobador_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes ser tu propio aprobador';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = v_aprobador_id) THEN
    RAISE EXCEPTION 'El aprobador seleccionado no existe';
  END IF;

  SELECT id INTO v_estado_id FROM estados_rendicion WHERE codigo = 'enviada' LIMIT 1;
  IF v_estado_id IS NULL THEN RAISE EXCEPTION 'Estado "enviada" no configurado'; END IF;

  UPDATE rendiciones SET
    aprobador_id        = v_aprobador_id,
    estado_rendicion_id = v_estado_id,
    fecha_envio         = now(),
    comentario_rechazo  = NULL,
    updated_at          = now()
  WHERE id = p_rendicion_id;

  INSERT INTO rendir_log (rendicion_id, empresa_id, usuario_id, estado_codigo)
  VALUES (p_rendicion_id, v_rendicion.empresa_id, auth.uid(), 'enviada');
END;
$$;

GRANT EXECUTE ON FUNCTION rendir_enviar(UUID, UUID) TO authenticated;
