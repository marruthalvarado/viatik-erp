-- ─── Índice único parcial: clave_acceso por empresa ──────────────────────────
--
-- Garantiza que no se pueda registrar dos veces la misma factura (misma
-- clave_acceso SRI) dentro de la misma empresa. Las filas con clave_acceso
-- NULL o soft-deleted quedan excluidas del índice.
--
-- Esto actúa como última línea de defensa en la BD, por si el frontend falla
-- o si se intenta insertar desde otra ruta (API, script, etc.).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS uq_gastos_empresa_clave_acceso
  ON gastos_empresa (empresa_id, clave_acceso)
  WHERE clave_acceso IS NOT NULL
    AND deleted_at IS NULL;
