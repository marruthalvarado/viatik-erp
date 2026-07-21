-- El constraint "facturas_emitidas_empresa_clave_unique" es un UNIQUE simple
-- (sin WHERE deleted_at IS NULL) que impide re-insertar una factura con la misma
-- clave_acceso después de hacer soft-delete.
-- La protección correcta ya existe en el índice parcial:
--   idx_facturas_emitidas_clave (empresa_id, clave_acceso)
--   WHERE clave_acceso IS NOT NULL AND deleted_at IS NULL
-- Por eso eliminamos el constraint no parcial.

ALTER TABLE facturas_emitidas
  DROP CONSTRAINT IF EXISTS facturas_emitidas_empresa_clave_unique;
