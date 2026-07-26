-- ─── Columna ruc_emisor en gastos_empresa ─────────────────────────────────────
-- Guarda el RUC del emisor al importar desde TXT SRI.
-- Permite consultar el historial de asignaciones por proveedor (RUC)
-- para sugerir automáticamente categoría y proyecto en futuras importaciones.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE gastos_empresa
  ADD COLUMN IF NOT EXISTS ruc_emisor VARCHAR(13) NULL;

CREATE INDEX IF NOT EXISTS idx_gastos_empresa_ruc_emisor
  ON gastos_empresa(empresa_id, ruc_emisor)
  WHERE ruc_emisor IS NOT NULL AND deleted_at IS NULL;
