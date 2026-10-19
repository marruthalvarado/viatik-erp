-- ============================================================
-- Agrega config_sitio a ciclotrones
-- Almacena los datos estables del sitio a nivel de equipo,
-- independiente de las evaluaciones.
-- ============================================================

ALTER TABLE ciclotrones
  ADD COLUMN IF NOT EXISTS config_sitio JSONB DEFAULT NULL;

COMMENT ON COLUMN ciclotrones.config_sitio IS
  'Datos estables del sitio (cliente, dirección, serial, versión SW, targets, etc.) '
  'Se actualiza automáticamente al guardar el Step 2 de una evaluación.';
