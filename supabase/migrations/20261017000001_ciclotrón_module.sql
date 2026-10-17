-- ============================================================
-- MÓDULO CICLOTRONES — Análisis de logs de producción PETtrace 800
-- ============================================================

-- ── Tabla principal: perfiles de ciclotrón ──────────────────────────────────
CREATE TABLE IF NOT EXISTS ciclotrones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre      text NOT NULL,                  -- Ej: "GE PETtrace 800 — SOLCA Guayaquil"
  sitio       text,                            -- Ubicación física
  modelo      text NOT NULL DEFAULT 'GE PETtrace 800',
  activo      boolean NOT NULL DEFAULT true,
  notas       text,

  -- Perfil de parámetros esperados (configurable por equipo/calibración)
  -- Cada parámetro: { setpoint?, min?, max?, tolerancia?, alertar: boolean }
  parametros  jsonb NOT NULL DEFAULT '{
    "gas_flow":    { "setpoint": 5.0, "min": 4.5, "max": 5.5, "alertar": true },
    "magnet_i":    { "setpoint": 426.7, "min": 423.7, "max": 429.7, "alertar": true },
    "dee1_kv":     { "setpoint": 36.8, "min": 34.5, "max": 39.0, "alertar": true },
    "dee2_kv":     { "setpoint": 40.8, "min": 38.5, "max": 43.0, "alertar": true },
    "target_i_spike_ua": 10,
    "coll_max_pct": 12,
    "vacuum_p_max": 0.000019,
    "target_p_min": 350,
    "target_p_max": 500,
    "target_p_end_max": 100,
    "he_cool_p_min": 40,
    "he_cool_p_max": 70,
    "arc_i_min": 100,
    "arc_i_max": 1000,
    "arc_v_min": 250,
    "arc_v_max": 900
  }'::jsonb,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_ciclotrones_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_ciclotrones_updated_at
  BEFORE UPDATE ON ciclotrones
  FOR EACH ROW EXECUTE FUNCTION update_ciclotrones_updated_at();

-- ── Tabla de producciones (batches) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ciclo_producciones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclotrón_id        uuid NOT NULL REFERENCES ciclotrones(id) ON DELETE CASCADE,
  empresa_id          uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Metadata del batch (leída del header del archivo)
  numero_batch        integer,
  tracer              text,                    -- Ej: "18F-FDG"
  sitio               text,
  fecha               date,

  -- Archivo original
  archivo_path        text,                    -- Path en Supabase Storage
  archivo_nombre      text,
  archivo_tipo        text CHECK (archivo_tipo IN ('log', 'ods', 'xlsx')),

  -- Resultados del análisis
  duracion_segundos   integer,
  target_i_setpoint   numeric,                 -- µA objetivo leído del log
  total_filas         integer,
  anomalias_count     integer NOT NULL DEFAULT 0,
  anomalias           jsonb,                   -- Array de { tiempo, parametro, valor, limite, hint }
  estado              text NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente', 'normal', 'con_alertas', 'critico')),
  notas               text,

  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ciclotrones_empresa
  ON ciclotrones (empresa_id);

CREATE INDEX IF NOT EXISTS idx_ciclo_producciones_ciclotrón
  ON ciclo_producciones (ciclotrón_id);

CREATE INDEX IF NOT EXISTS idx_ciclo_producciones_empresa
  ON ciclo_producciones (empresa_id);

CREATE INDEX IF NOT EXISTS idx_ciclo_producciones_fecha
  ON ciclo_producciones (fecha DESC);

-- ── Storage bucket ───────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ciclo-producciones',
  'ciclo-producciones',
  false,
  52428800,  -- 50 MB
  ARRAY['text/plain', 'text/tab-separated-values', 'application/vnd.oasis.opendocument.spreadsheet',
        'application/octet-stream', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE ciclotrones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ciclo_producciones ENABLE ROW LEVEL SECURITY;

-- ciclotrones — usuarios de la empresa
CREATE POLICY "ciclotrones_empresa_select" ON ciclotrones
  FOR SELECT USING (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios WHERE usuario_id = auth.uid()
    )
  );

CREATE POLICY "ciclotrones_empresa_insert" ON ciclotrones
  FOR INSERT WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios WHERE usuario_id = auth.uid()
    )
  );

CREATE POLICY "ciclotrones_empresa_update" ON ciclotrones
  FOR UPDATE USING (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios WHERE usuario_id = auth.uid()
    )
  );

CREATE POLICY "ciclotrones_empresa_delete" ON ciclotrones
  FOR DELETE USING (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios WHERE usuario_id = auth.uid()
    )
  );

-- ciclo_producciones
CREATE POLICY "ciclo_prod_empresa_select" ON ciclo_producciones
  FOR SELECT USING (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios WHERE usuario_id = auth.uid()
    )
  );

CREATE POLICY "ciclo_prod_empresa_insert" ON ciclo_producciones
  FOR INSERT WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios WHERE usuario_id = auth.uid()
    )
  );

CREATE POLICY "ciclo_prod_empresa_update" ON ciclo_producciones
  FOR UPDATE USING (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios WHERE usuario_id = auth.uid()
    )
  );

CREATE POLICY "ciclo_prod_empresa_delete" ON ciclo_producciones
  FOR DELETE USING (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios WHERE usuario_id = auth.uid()
    )
  );

-- Storage RLS
CREATE POLICY "ciclo_prod_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'ciclo-producciones' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "ciclo_prod_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'ciclo-producciones' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "ciclo_prod_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'ciclo-producciones' AND
    auth.uid() IS NOT NULL
  );
