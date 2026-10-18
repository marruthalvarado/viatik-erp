-- ─────────────────────────────────────────────────────────────────────────────
-- CICLO_EVALUACIONES  — Protocolo de Evaluación GE PETtrace 800
-- DOC1604037 rev9 — New Upgrade Assessment Protocol
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tabla principal ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ciclo_evaluaciones (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  ciclotrón_id    UUID        NOT NULL REFERENCES ciclotrones(id) ON DELETE CASCADE,
  equipo_id       UUID        REFERENCES equipos_instalados(id) ON DELETE SET NULL,

  -- Cabecera
  numero          TEXT        NOT NULL,           -- ej. EVAL-2026-001
  fecha           DATE        NOT NULL DEFAULT CURRENT_DATE,
  tipo_evaluacion TEXT        NOT NULL DEFAULT 'assessment'
                              CHECK (tipo_evaluacion IN ('assessment','upgrade_eval','eosss','10yr_refurbish')),
  ingeniero_nombre TEXT,
  estado          TEXT        NOT NULL DEFAULT 'borrador'
                              CHECK (estado IN ('borrador','en_progreso','completado')),
  resultado_general TEXT      CHECK (resultado_general IN ('pass','fail','pendiente')),

  -- Configuración del equipo para esta evaluación
  tiene_deuterio  BOOLEAN     NOT NULL DEFAULT false,
  modelo_pt       TEXT,                           -- PT840 / PT860 / PT880
  version_sw      TEXT,                           -- ej. 3.6.3

  -- Datos por sección (JSONB — estructura definida en tipos TS)
  datos_sitio         JSONB   DEFAULT '{}',       -- Hojas 1-5
  datos_performance   JSONB   DEFAULT '{}',       -- Hoja 6 (9 sub-tests)
  datos_evaluacion    JSONB   DEFAULT '{}',       -- Hoja 7 (10 producciones)

  observaciones   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Secuencia de número ────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS ciclo_eval_seq START 1;

-- ── Trigger updated_at ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_ciclo_evaluaciones_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ciclo_evaluaciones_updated_at ON ciclo_evaluaciones;
CREATE TRIGGER trg_ciclo_evaluaciones_updated_at
  BEFORE UPDATE ON ciclo_evaluaciones
  FOR EACH ROW EXECUTE FUNCTION update_ciclo_evaluaciones_updated_at();

-- ── Índices ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ciclo_eval_empresa    ON ciclo_evaluaciones(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ciclo_eval_ciclotrón  ON ciclo_evaluaciones(ciclotrón_id);
CREATE INDEX IF NOT EXISTS idx_ciclo_eval_fecha      ON ciclo_evaluaciones(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ciclo_eval_estado     ON ciclo_evaluaciones(estado);

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE ciclo_evaluaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ciclo_eval_empresa" ON ciclo_evaluaciones;
CREATE POLICY "ciclo_eval_empresa" ON ciclo_evaluaciones
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios
      WHERE usuario_id = auth.uid()
    )
  );

-- ── RPC: crear evaluación con auto-número ──────────────────────────────────────
CREATE OR REPLACE FUNCTION crear_ciclo_evaluacion(
  p_empresa_id      UUID,
  p_ciclotrón_id    UUID,
  p_equipo_id       UUID,
  p_tipo            TEXT,
  p_ingeniero       TEXT,
  p_tiene_deuterio  BOOLEAN,
  p_modelo_pt       TEXT,
  p_version_sw      TEXT
) RETURNS ciclo_evaluaciones LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_num  TEXT;
  v_row  ciclo_evaluaciones;
BEGIN
  v_num := 'EVAL-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
           LPAD(nextval('ciclo_eval_seq')::TEXT, 3, '0');

  INSERT INTO ciclo_evaluaciones (
    empresa_id, ciclotrón_id, equipo_id,
    numero, tipo_evaluacion, ingeniero_nombre,
    tiene_deuterio, modelo_pt, version_sw,
    estado, resultado_general
  ) VALUES (
    p_empresa_id, p_ciclotrón_id, p_equipo_id,
    v_num, p_tipo, p_ingeniero,
    p_tiene_deuterio, p_modelo_pt, p_version_sw,
    'borrador', 'pendiente'
  ) RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ── RPC: guardar sección de datos ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION guardar_ciclo_eval_seccion(
  p_eval_id UUID,
  p_seccion TEXT,   -- 'sitio' | 'performance' | 'evaluacion'
  p_datos   JSONB
) RETURNS ciclo_evaluaciones LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row ciclo_evaluaciones;
BEGIN
  IF p_seccion = 'sitio' THEN
    UPDATE ciclo_evaluaciones SET datos_sitio = p_datos
    WHERE id = p_eval_id RETURNING * INTO v_row;
  ELSIF p_seccion = 'performance' THEN
    UPDATE ciclo_evaluaciones SET datos_performance = p_datos
    WHERE id = p_eval_id RETURNING * INTO v_row;
  ELSIF p_seccion = 'evaluacion' THEN
    UPDATE ciclo_evaluaciones SET datos_evaluacion = p_datos
    WHERE id = p_eval_id RETURNING * INTO v_row;
  END IF;
  RETURN v_row;
END;
$$;

-- ── RPC: cerrar evaluación ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION completar_ciclo_evaluacion(
  p_eval_id         UUID,
  p_resultado       TEXT,
  p_observaciones   TEXT
) RETURNS ciclo_evaluaciones LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row ciclo_evaluaciones;
BEGIN
  UPDATE ciclo_evaluaciones
  SET estado = 'completado',
      resultado_general = p_resultado,
      observaciones = p_observaciones
  WHERE id = p_eval_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
