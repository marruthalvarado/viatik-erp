-- =============================================================================
-- Migration: Aprobador predeterminado en política + rol Aprobador
-- =============================================================================

-- 1. Columna aprobador_id en politicas
ALTER TABLE politicas
  ADD COLUMN IF NOT EXISTS aprobador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Seed rol 'aprobador'
INSERT INTO roles (codigo, nombre, descripcion)
VALUES ('aprobador', 'Aprobador', 'Aprueba y gestiona liquidaciones de viáticos')
ON CONFLICT (codigo) DO NOTHING;
