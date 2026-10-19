-- ============================================================
-- Módulo: Error Logs de Ciclotrón
-- Almacena logs de errores del GE PETtrace parseados y
-- clasificados (info / warning / fault) con su análisis
-- de patrones y correlación con batches de producción.
-- ============================================================

CREATE TABLE IF NOT EXISTS ciclo_error_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  "ciclotrón_id"    UUID        NOT NULL REFERENCES ciclotrones(id) ON DELETE CASCADE,
  archivo_nombre    TEXT        NOT NULL,
  fecha_inicio      TIMESTAMPTZ,
  fecha_fin         TIMESTAMPTZ,
  total_eventos     INTEGER     NOT NULL DEFAULT 0,
  total_faults      INTEGER     NOT NULL DEFAULT 0,
  total_warnings    INTEGER     NOT NULL DEFAULT 0,
  total_info        INTEGER     NOT NULL DEFAULT 0,
  -- Array JSONB de EventoLog: {ts, tipo, subsistema, mensaje, codigo, clave}
  eventos           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_ciclo_error_logs_empresa
  ON ciclo_error_logs (empresa_id);

CREATE INDEX IF NOT EXISTS idx_ciclo_error_logs_ciclotrón
  ON ciclo_error_logs ("ciclotrón_id");

CREATE INDEX IF NOT EXISTS idx_ciclo_error_logs_fechas
  ON ciclo_error_logs (fecha_inicio, fecha_fin);

-- Índice GIN para búsquedas dentro del JSONB de eventos
CREATE INDEX IF NOT EXISTS idx_ciclo_error_logs_eventos
  ON ciclo_error_logs USING GIN (eventos);

-- RLS
ALTER TABLE ciclo_error_logs ENABLE ROW LEVEL SECURITY;

-- Solo miembros de la empresa pueden ver sus logs
CREATE POLICY "ciclo_error_logs_select" ON ciclo_error_logs
  FOR SELECT USING (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios
      WHERE usuario_id = auth.uid()
    )
  );

CREATE POLICY "ciclo_error_logs_insert" ON ciclo_error_logs
  FOR INSERT WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios
      WHERE usuario_id = auth.uid()
    )
  );

CREATE POLICY "ciclo_error_logs_delete" ON ciclo_error_logs
  FOR DELETE USING (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios
      WHERE usuario_id = auth.uid()
    )
  );

-- RPC: obtener historial de un fault_key específico en un ciclotrón
-- Devuelve ocurrencias anteriores con fecha y total, útil para "memoria"
CREATE OR REPLACE FUNCTION ciclo_fault_historial(
  p_ciclotrón_id UUID,
  p_clave        TEXT,
  p_limite       INTEGER DEFAULT 50
)
RETURNS TABLE (
  log_id      UUID,
  archivo     TEXT,
  fecha_ts    TIMESTAMPTZ,
  mensaje     TEXT,
  codigo      INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    l.id                                  AS log_id,
    l.archivo_nombre                      AS archivo,
    (e->>'ts')::TIMESTAMPTZ              AS fecha_ts,
    e->>'mensaje'                         AS mensaje,
    (e->>'codigo')::INTEGER              AS codigo
  FROM ciclo_error_logs l,
       jsonb_array_elements(l.eventos) AS e
  WHERE l."ciclotrón_id" = p_ciclotrón_id
    AND e->>'clave' = p_clave
    AND e->>'tipo' IN ('fault', 'warning')
  ORDER BY (e->>'ts')::TIMESTAMPTZ DESC
  LIMIT p_limite;
$$;

-- RPC: resumen de faults por clave (para detección de tendencias)
CREATE OR REPLACE FUNCTION ciclo_fault_resumen(
  p_ciclotrón_id UUID,
  p_dias_atras   INTEGER DEFAULT 90
)
RETURNS TABLE (
  clave         TEXT,
  subsistema    TEXT,
  tipo          TEXT,
  total         BIGINT,
  primera_vez   TIMESTAMPTZ,
  ultima_vez    TIMESTAMPTZ,
  mensaje_ref   TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    e->>'clave'                           AS clave,
    e->>'subsistema'                      AS subsistema,
    e->>'tipo'                            AS tipo,
    COUNT(*)                              AS total,
    MIN((e->>'ts')::TIMESTAMPTZ)         AS primera_vez,
    MAX((e->>'ts')::TIMESTAMPTZ)         AS ultima_vez,
    MAX(e->>'mensaje')                    AS mensaje_ref
  FROM ciclo_error_logs l,
       jsonb_array_elements(l.eventos) AS e
  WHERE l."ciclotrón_id" = p_ciclotrón_id
    AND e->>'tipo' IN ('fault', 'warning')
    AND (e->>'ts')::TIMESTAMPTZ >= NOW() - (p_dias_atras || ' days')::INTERVAL
  GROUP BY e->>'clave', e->>'subsistema', e->>'tipo'
  ORDER BY total DESC;
$$;

COMMENT ON TABLE ciclo_error_logs IS
  'Logs de errores del GE PETtrace 800 parseados y clasificados. '
  'Cada registro corresponde a un archivo .txt subido por el técnico. '
  'Los eventos se almacenan como JSONB con tipo (info/warning/fault), '
  'subsistema, clave normalizada y timestamp.';
