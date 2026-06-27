-- =============================================================================
-- FASE 9A — Infraestructura de Notificaciones
-- Extiende la tabla notificaciones existente con tipo, prioridad y url_destino.
-- Agrega índices de rendimiento y función RPC para marcar todas como leídas.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extender tabla notificaciones
-- ---------------------------------------------------------------------------

ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS tipo       TEXT     NOT NULL DEFAULT 'sistema',
  ADD COLUMN IF NOT EXISTS prioridad  TEXT     NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS url_destino TEXT             DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS metadata   JSONB            DEFAULT '{}';

-- Restricción de valores válidos para tipo
ALTER TABLE notificaciones
  DROP CONSTRAINT IF EXISTS notificaciones_tipo_check;
ALTER TABLE notificaciones
  ADD CONSTRAINT notificaciones_tipo_check
    CHECK (tipo IN (
      'workflow', 'presupuesto', 'ocr', 'politica',
      'ia', 'sistema', 'viajes', 'rendiciones'
    ));

-- Restricción de valores válidos para prioridad
ALTER TABLE notificaciones
  DROP CONSTRAINT IF EXISTS notificaciones_prioridad_check;
ALTER TABLE notificaciones
  ADD CONSTRAINT notificaciones_prioridad_check
    CHECK (prioridad IN ('alta', 'media', 'baja'));

-- ---------------------------------------------------------------------------
-- 2. Índices de rendimiento
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_leida
  ON notificaciones (usuario_id, leida)
  WHERE leida = false;

CREATE INDEX IF NOT EXISTS idx_notificaciones_empresa_created
  ON notificaciones (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificaciones_tipo
  ON notificaciones (tipo);

-- ---------------------------------------------------------------------------
-- 3. RPC: marcar todas como leídas para un usuario en una empresa
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION marcar_todas_notificaciones_leidas(
  p_usuario_id UUID,
  p_empresa_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notificaciones
  SET
    leida        = true,
    fecha_lectura = NOW()
  WHERE
    usuario_id = p_usuario_id
    AND empresa_id = p_empresa_id
    AND leida = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. RPC: contar no leídas para un usuario
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION contar_notificaciones_no_leidas(
  p_usuario_id UUID,
  p_empresa_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notificaciones
    WHERE usuario_id = p_usuario_id
      AND empresa_id = p_empresa_id
      AND leida = false
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Actualizar workflow RPCs para usar tipo y url_destino
--    (los INSERT existentes que no pasan tipo/url usarán los DEFAULT)
-- ---------------------------------------------------------------------------

-- No es necesario modificar los INSERT existentes ya que tienen DEFAULT.

-- ---------------------------------------------------------------------------
-- 6. RLS — ya existe en tabla notificaciones; confirmar política básica
-- ---------------------------------------------------------------------------

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notificaciones_select_own ON notificaciones;
CREATE POLICY notificaciones_select_own ON notificaciones
  FOR SELECT
  USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS notificaciones_update_own ON notificaciones;
CREATE POLICY notificaciones_update_own ON notificaciones
  FOR UPDATE
  USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS notificaciones_delete_own ON notificaciones;
CREATE POLICY notificaciones_delete_own ON notificaciones
  FOR DELETE
  USING (auth.uid() = usuario_id);

-- INSERT solo desde funciones SECURITY DEFINER (RPCs)
DROP POLICY IF EXISTS notificaciones_insert_rpc ON notificaciones;
CREATE POLICY notificaciones_insert_rpc ON notificaciones
  FOR INSERT
  WITH CHECK (true);
