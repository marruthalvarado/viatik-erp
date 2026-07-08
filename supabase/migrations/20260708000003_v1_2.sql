-- =============================================================================
-- Migration V1.2: estado devuelta, acepta_facturas_fuera_rango, rendir_log
-- =============================================================================

-- 1. Estado "devuelta"
INSERT INTO estados_rendicion (nombre, codigo)
VALUES ('Devuelta', 'devuelta')
ON CONFLICT (codigo) DO NOTHING;

-- 2. Campo acepta_facturas_fuera_rango en politicas (default TRUE = acepta)
ALTER TABLE politicas
  ADD COLUMN IF NOT EXISTS acepta_facturas_fuera_rango BOOLEAN DEFAULT TRUE;

-- 3. Tabla rendir_log: tracking cronologico de estados por rendicion
CREATE TABLE IF NOT EXISTS rendir_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rendicion_id UUID        NOT NULL REFERENCES rendiciones(id) ON DELETE CASCADE,
  empresa_id   UUID        NOT NULL REFERENCES empresas(id),
  usuario_id   UUID        REFERENCES auth.users(id),
  estado_codigo TEXT       NOT NULL,
  observacion  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indice para queries por rendicion
CREATE INDEX IF NOT EXISTS idx_rendir_log_rendicion
  ON rendir_log (rendicion_id, created_at);

-- 4. RLS para rendir_log
ALTER TABLE rendir_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rendir_log_empresa" ON rendir_log;
CREATE POLICY "rendir_log_empresa" ON rendir_log
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios
      WHERE usuario_id = auth.uid()
    )
  );

-- 5. Trigger: al crear una rendicion, registrar estado inicial en el log
CREATE OR REPLACE FUNCTION _rendir_log_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_estado_codigo TEXT;
BEGIN
  SELECT codigo INTO v_estado_codigo
  FROM estados_rendicion
  WHERE id = NEW.estado_rendicion_id;

  INSERT INTO rendir_log (rendicion_id, empresa_id, usuario_id, estado_codigo)
  VALUES (NEW.id, NEW.empresa_id, NEW.usuario_id, COALESCE(v_estado_codigo, 'registrada'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rendir_log_insert ON rendiciones;
CREATE TRIGGER trg_rendir_log_insert
  AFTER INSERT ON rendiciones
  FOR EACH ROW EXECUTE FUNCTION _rendir_log_on_insert();

-- 6. Actualizar rendir_enviar: permitir reenvio desde "devuelta" + loguear
CREATE OR REPLACE FUNCTION rendir_enviar(
  p_rendicion_id UUID,
  p_aprobador_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_estado_actual TEXT;
  v_owner_id      UUID;
  v_estado_id     UUID;
  v_empresa_id    UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT r.usuario_id, er.codigo, r.empresa_id
    INTO v_owner_id, v_estado_actual, v_empresa_id
    FROM rendiciones r
    LEFT JOIN estados_rendicion er ON er.id = r.estado_rendicion_id
   WHERE r.id = p_rendicion_id AND r.deleted_at IS NULL
   FOR UPDATE;

  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'Rendicion no encontrada'; END IF;
  IF v_owner_id <> auth.uid() THEN RAISE EXCEPTION 'Solo el propietario puede enviar esta rendicion'; END IF;
  IF v_estado_actual NOT IN ('borrador', 'rechazada', 'devuelta', 'registrada') AND v_estado_actual IS NOT NULL THEN
    RAISE EXCEPTION 'La rendicion debe estar en borrador, registrada, rechazada o devuelta (estado: %)', v_estado_actual;
  END IF;
  IF p_aprobador_id = auth.uid() THEN RAISE EXCEPTION 'No puedes ser tu propio aprobador'; END IF;
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = p_aprobador_id) THEN
    RAISE EXCEPTION 'El aprobador seleccionado no existe';
  END IF;

  SELECT id INTO v_estado_id FROM estados_rendicion WHERE codigo = 'enviada' LIMIT 1;
  IF v_estado_id IS NULL THEN RAISE EXCEPTION 'Estado "enviada" no configurado'; END IF;

  UPDATE rendiciones SET
    aprobador_id        = p_aprobador_id,
    estado_rendicion_id = v_estado_id,
    fecha_envio         = now(),
    comentario_rechazo  = NULL,
    updated_at          = now()
  WHERE id = p_rendicion_id;

  INSERT INTO rendir_log (rendicion_id, empresa_id, usuario_id, estado_codigo)
  VALUES (p_rendicion_id, v_empresa_id, auth.uid(), 'enviada');
END;
$$;

-- 7. Actualizar rendir_aprobar: loguear con observacion
CREATE OR REPLACE FUNCTION rendir_aprobar(
  p_rendicion_id UUID,
  p_comentario   TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_estado_actual TEXT;
  v_aprobador_id  UUID;
  v_empresa_id    UUID;
  v_estado_id     UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT er.codigo, r.aprobador_id, r.empresa_id
    INTO v_estado_actual, v_aprobador_id, v_empresa_id
    FROM rendiciones r
    LEFT JOIN estados_rendicion er ON er.id = r.estado_rendicion_id
   WHERE r.id = p_rendicion_id AND r.deleted_at IS NULL
   FOR UPDATE;

  IF v_aprobador_id IS NULL THEN RAISE EXCEPTION 'Rendicion no encontrada o sin aprobador asignado'; END IF;
  IF v_aprobador_id <> auth.uid() THEN RAISE EXCEPTION 'Solo el aprobador asignado puede aprobar esta rendicion'; END IF;
  IF v_estado_actual <> 'enviada' THEN RAISE EXCEPTION 'La rendicion debe estar enviada (estado: %)', v_estado_actual; END IF;

  SELECT id INTO v_estado_id FROM estados_rendicion WHERE codigo = 'aprobada' LIMIT 1;

  UPDATE rendiciones SET
    estado_rendicion_id = v_estado_id,
    fecha_aprobacion    = now(),
    comentario_rechazo  = NULL,
    updated_at          = now()
  WHERE id = p_rendicion_id;

  INSERT INTO rendir_log (rendicion_id, empresa_id, usuario_id, estado_codigo, observacion)
  VALUES (p_rendicion_id, v_empresa_id, auth.uid(), 'aprobada', NULLIF(TRIM(COALESCE(p_comentario, '')), ''));
END;
$$;

-- 8. Actualizar rendir_rechazar: loguear (backward compat)
CREATE OR REPLACE FUNCTION rendir_rechazar(
  p_rendicion_id UUID,
  p_motivo       TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_estado_actual TEXT;
  v_aprobador_id  UUID;
  v_empresa_id    UUID;
  v_estado_id     UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN RAISE EXCEPTION 'El motivo de rechazo es obligatorio'; END IF;

  SELECT er.codigo, r.aprobador_id, r.empresa_id
    INTO v_estado_actual, v_aprobador_id, v_empresa_id
    FROM rendiciones r
    LEFT JOIN estados_rendicion er ON er.id = r.estado_rendicion_id
   WHERE r.id = p_rendicion_id AND r.deleted_at IS NULL
   FOR UPDATE;

  IF v_aprobador_id IS NULL THEN RAISE EXCEPTION 'Rendicion no encontrada'; END IF;
  IF v_aprobador_id <> auth.uid() THEN RAISE EXCEPTION 'Solo el aprobador asignado puede rechazar esta rendicion'; END IF;
  IF v_estado_actual <> 'enviada' THEN RAISE EXCEPTION 'La rendicion debe estar enviada (estado: %)', v_estado_actual; END IF;

  SELECT id INTO v_estado_id FROM estados_rendicion WHERE codigo = 'rechazada' LIMIT 1;

  UPDATE rendiciones SET
    estado_rendicion_id = v_estado_id,
    comentario_rechazo  = p_motivo,
    updated_at          = now()
  WHERE id = p_rendicion_id;

  INSERT INTO rendir_log (rendicion_id, empresa_id, usuario_id, estado_codigo, observacion)
  VALUES (p_rendicion_id, v_empresa_id, auth.uid(), 'rechazada', p_motivo);
END;
$$;

-- 9. NUEVA RPC: rendir_devolver (aprobador o financiero devuelve con observacion)
CREATE OR REPLACE FUNCTION rendir_devolver(
  p_rendicion_id UUID,
  p_observacion  TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_rendicion     rendiciones%ROWTYPE;
  v_estado_codigo TEXT;
  v_rol_codigo    TEXT;
  v_estado_id     UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_rendicion FROM rendiciones WHERE id = p_rendicion_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rendicion no encontrada'; END IF;

  -- Verificar que el usuario pertenece a la empresa
  IF NOT EXISTS (
    SELECT 1 FROM empresas_usuarios
    WHERE empresa_id = v_rendicion.empresa_id AND usuario_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Obtener rol del usuario en la empresa
  SELECT r.codigo INTO v_rol_codigo
  FROM empresas_usuarios eu
  JOIN roles r ON r.id = eu.rol_id
  WHERE eu.empresa_id = v_rendicion.empresa_id AND eu.usuario_id = auth.uid()
  LIMIT 1;

  -- Solo aprobador, financiero o admin pueden devolver
  IF v_rol_codigo NOT IN ('aprobador', 'financiero', 'admin') THEN
    RAISE EXCEPTION 'El usuario no se encuentra autorizado para esta accion';
  END IF;

  -- Verificar estado actual: se puede devolver si esta enviada o aprobada
  SELECT er.codigo INTO v_estado_codigo
  FROM estados_rendicion er
  WHERE er.id = v_rendicion.estado_rendicion_id;

  IF v_estado_codigo NOT IN ('enviada', 'aprobada') THEN
    RAISE EXCEPTION 'La rendicion debe estar enviada o aprobada para poder devolverse (estado: %)', v_estado_codigo;
  END IF;

  SELECT id INTO v_estado_id FROM estados_rendicion WHERE codigo = 'devuelta' LIMIT 1;
  IF v_estado_id IS NULL THEN RAISE EXCEPTION 'Estado devuelta no configurado'; END IF;

  UPDATE rendiciones SET
    estado_rendicion_id = v_estado_id,
    comentario_rechazo  = p_observacion,
    updated_at          = now()
  WHERE id = p_rendicion_id;

  INSERT INTO rendir_log (rendicion_id, empresa_id, usuario_id, estado_codigo, observacion)
  VALUES (p_rendicion_id, v_rendicion.empresa_id, auth.uid(), 'devuelta',
          NULLIF(TRIM(COALESCE(p_observacion, '')), ''));
END;
$$;

-- 10. Actualizar rendir_liquidar: aceptar observacion y loguear
CREATE OR REPLACE FUNCTION rendir_liquidar(
  p_rendicion_id UUID,
  p_observacion  TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_rendicion  rendiciones%ROWTYPE;
  v_rol_codigo TEXT;
  v_estado_id  UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_rendicion FROM rendiciones WHERE id = p_rendicion_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rendicion no encontrada'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM empresas_usuarios
    WHERE empresa_id = v_rendicion.empresa_id AND usuario_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT r.codigo INTO v_rol_codigo
  FROM empresas_usuarios eu
  JOIN roles r ON r.id = eu.rol_id
  WHERE eu.empresa_id = v_rendicion.empresa_id AND eu.usuario_id = auth.uid()
  LIMIT 1;

  IF v_rol_codigo NOT IN ('financiero', 'admin') THEN
    RAISE EXCEPTION 'El usuario no se encuentra autorizado para esta accion';
  END IF;

  SELECT id INTO v_estado_id FROM estados_rendicion WHERE codigo = 'liquidada' LIMIT 1;
  IF v_estado_id IS NULL THEN RAISE EXCEPTION 'Estado liquidada no configurado'; END IF;

  UPDATE rendiciones SET
    estado_rendicion_id = v_estado_id,
    liquidado_por       = auth.uid(),
    fecha_liquidacion   = NOW(),
    updated_at          = now()
  WHERE id = p_rendicion_id;

  INSERT INTO rendir_log (rendicion_id, empresa_id, usuario_id, estado_codigo, observacion)
  VALUES (p_rendicion_id, v_rendicion.empresa_id, auth.uid(), 'liquidada',
          NULLIF(TRIM(COALESCE(p_observacion, '')), ''));
END;
$$;

-- 11. RPC: rendir_log_rendicion — leer historial de una rendicion
CREATE OR REPLACE FUNCTION rendir_log_rendicion(p_rendicion_id UUID)
RETURNS TABLE (
  id            UUID,
  created_at    TIMESTAMPTZ,
  estado_codigo TEXT,
  observacion   TEXT,
  usuario_nombre TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    rl.id,
    rl.created_at,
    rl.estado_codigo,
    rl.observacion,
    COALESCE(
      NULLIF(TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')), ''),
      'Sistema'
    ) AS usuario_nombre
  FROM rendir_log rl
  LEFT JOIN usuarios u ON u.id = rl.usuario_id
  WHERE rl.rendicion_id = p_rendicion_id
  ORDER BY rl.created_at ASC;
END;
$$;
