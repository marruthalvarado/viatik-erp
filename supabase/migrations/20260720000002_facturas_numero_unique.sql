-- Unique constraint por número de factura (dentro de la misma empresa, no eliminada).
-- Complementa el índice existente en clave_acceso IS NOT NULL.
-- Evita duplicados cuando se mezclan cargas XML y PDF (distintas fuentes pueden tener
-- clave_acceso nula o distinta, pero el número siempre identifica la factura).

CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_emitidas_numero
  ON facturas_emitidas(empresa_id, numero)
  WHERE deleted_at IS NULL;
