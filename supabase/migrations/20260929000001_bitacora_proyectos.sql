-- ============================================================
-- Módulo Bitácora de Proyectos
-- Agrega tipo_proyecto a proyectos y crea tabla
-- proyecto_actualizaciones para daily stand-ups
-- ============================================================

SET statement_timeout = 0;

-- ── 1. Tipo de proyecto ─────────────────────────────────────
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS tipo_proyecto TEXT
    CHECK (tipo_proyecto IN (
      'desarrollo_software',
      'ventas_comercial',
      'implementacion',
      'mantenimiento',
      'consultoria',
      'otro'
    ))
    DEFAULT 'otro';

COMMENT ON COLUMN proyectos.tipo_proyecto IS
  'Clasificación del proyecto: desarrollo_software, ventas_comercial, implementacion, mantenimiento, consultoria, otro';

-- ── 2. Tabla principal de actualizaciones ──────────────────
CREATE TABLE IF NOT EXISTS proyecto_actualizaciones (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  proyecto_id       UUID        NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  usuario_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  fecha             DATE        NOT NULL DEFAULT CURRENT_DATE,

  -- Campos del daily stand-up
  ayer              TEXT,                           -- Qué se hizo ayer
  hoy               TEXT,                           -- Qué se hará hoy
  bloqueos          TEXT,                           -- Descripción del bloqueo
  nivel_bloqueo     TEXT        NOT NULL DEFAULT 'ninguno'
    CHECK (nivel_bloqueo IN ('ninguno', 'bajo', 'medio', 'critico')),
  novedades         TEXT,                           -- Observaciones adicionales

  -- Avance
  porcentaje_avance INTEGER     CHECK (porcentaje_avance BETWEEN 0 AND 100),

  -- Metadatos
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE proyecto_actualizaciones IS
  'Registro diario de avance por usuario y proyecto (daily stand-up)';

-- ── 3. Índices ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pact_proyecto
  ON proyecto_actualizaciones(proyecto_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_pact_empresa
  ON proyecto_actualizaciones(empresa_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_pact_usuario
  ON proyecto_actualizaciones(usuario_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_pact_bloqueo
  ON proyecto_actualizaciones(empresa_id, nivel_bloqueo)
  WHERE nivel_bloqueo IN ('medio', 'critico');

-- ── 4. Trigger updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_proyecto_actualizaciones_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pact_updated_at ON proyecto_actualizaciones;
CREATE TRIGGER trg_pact_updated_at
  BEFORE UPDATE ON proyecto_actualizaciones
  FOR EACH ROW EXECUTE FUNCTION update_proyecto_actualizaciones_updated_at();

-- ── 5. RLS ──────────────────────────────────────────────────
ALTER TABLE proyecto_actualizaciones ENABLE ROW LEVEL SECURITY;

-- Lectura: todos los miembros de la empresa pueden leer
DROP POLICY IF EXISTS "pact_select" ON proyecto_actualizaciones;
CREATE POLICY "pact_select" ON proyecto_actualizaciones
  FOR SELECT USING (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios
      WHERE usuario_id = auth.uid()
    )
  );

-- Insertar: cualquier miembro de la empresa
DROP POLICY IF EXISTS "pact_insert" ON proyecto_actualizaciones;
CREATE POLICY "pact_insert" ON proyecto_actualizaciones
  FOR INSERT WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios
      WHERE usuario_id = auth.uid()
    )
    AND usuario_id = auth.uid()
  );

-- Actualizar: solo el autor de la entrada
DROP POLICY IF EXISTS "pact_update" ON proyecto_actualizaciones;
CREATE POLICY "pact_update" ON proyecto_actualizaciones
  FOR UPDATE USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Eliminar: solo el autor de la entrada
DROP POLICY IF EXISTS "pact_delete" ON proyecto_actualizaciones;
CREATE POLICY "pact_delete" ON proyecto_actualizaciones
  FOR DELETE USING (usuario_id = auth.uid());

-- ── 6. RPC: resumen de avance por proyecto ─────────────────
CREATE OR REPLACE FUNCTION get_resumen_bitacora(p_empresa_id UUID)
RETURNS TABLE (
  proyecto_id        UUID,
  proyecto_nombre    TEXT,
  tipo_proyecto      TEXT,
  ultima_fecha       DATE,
  ultimo_pct         INTEGER,
  total_entradas     BIGINT,
  entradas_hoy       BIGINT,
  tiene_bloqueo      BOOLEAN,
  nivel_bloqueo_max  TEXT,
  ultimo_usuario     TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id                                              AS proyecto_id,
    p.nombre                                          AS proyecto_nombre,
    p.tipo_proyecto                                   AS tipo_proyecto,
    MAX(pa.fecha)                                     AS ultima_fecha,
    -- Porcentaje de la actualización más reciente
    (SELECT pa2.porcentaje_avance
     FROM proyecto_actualizaciones pa2
     WHERE pa2.proyecto_id = p.id
     ORDER BY pa2.fecha DESC, pa2.created_at DESC
     LIMIT 1)                                        AS ultimo_pct,
    COUNT(pa.id)                                     AS total_entradas,
    COUNT(pa.id) FILTER (WHERE pa.fecha = CURRENT_DATE) AS entradas_hoy,
    BOOL_OR(pa.nivel_bloqueo IN ('medio','critico')) AS tiene_bloqueo,
    -- El nivel más alto activo hoy o en la última fecha
    (SELECT pa3.nivel_bloqueo
     FROM proyecto_actualizaciones pa3
     WHERE pa3.proyecto_id = p.id
       AND pa3.nivel_bloqueo IN ('medio','critico')
     ORDER BY
       CASE pa3.nivel_bloqueo WHEN 'critico' THEN 0 ELSE 1 END,
       pa3.fecha DESC
     LIMIT 1)                                        AS nivel_bloqueo_max,
    (SELECT u.nombre
     FROM proyecto_actualizaciones pa4
     JOIN usuarios u ON u.id = pa4.usuario_id
     WHERE pa4.proyecto_id = p.id
     ORDER BY pa4.fecha DESC, pa4.created_at DESC
     LIMIT 1)                                        AS ultimo_usuario
  FROM proyectos p
  LEFT JOIN proyecto_actualizaciones pa ON pa.proyecto_id = p.id
  WHERE p.empresa_id = p_empresa_id
    AND p.deleted_at IS NULL
  GROUP BY p.id, p.nombre, p.tipo_proyecto
  ORDER BY MAX(pa.fecha) DESC NULLS LAST, p.nombre;
END;
$$;

-- ── 7. RPC: timeline de un proyecto ────────────────────────
CREATE OR REPLACE FUNCTION get_bitacora_proyecto(
  p_proyecto_id UUID,
  p_limit       INT DEFAULT 50,
  p_offset      INT DEFAULT 0
)
RETURNS TABLE (
  id                UUID,
  fecha             DATE,
  usuario_id        UUID,
  usuario_nombre    TEXT,
  ayer              TEXT,
  hoy               TEXT,
  bloqueos          TEXT,
  nivel_bloqueo     TEXT,
  novedades         TEXT,
  porcentaje_avance INTEGER,
  created_at        TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.id,
    pa.fecha,
    pa.usuario_id,
    COALESCE(u.nombre, 'Usuario')   AS usuario_nombre,
    pa.ayer,
    pa.hoy,
    pa.bloqueos,
    pa.nivel_bloqueo,
    pa.novedades,
    pa.porcentaje_avance,
    pa.created_at
  FROM proyecto_actualizaciones pa
  LEFT JOIN usuarios u ON u.id = pa.usuario_id
  WHERE pa.proyecto_id = p_proyecto_id
  ORDER BY pa.fecha DESC, pa.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
