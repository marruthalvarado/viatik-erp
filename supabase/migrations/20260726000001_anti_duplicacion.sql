-- ─────────────────────────────────────────────────────────────────────────────
-- Sistema anti-duplicación de facturas (4 capas)
-- Evita que la misma factura sea contada dos veces: en gastos_empresa y
-- en los gastos de una rendición de un empleado.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Nuevas columnas en gastos_empresa (numero_documento ya se extraía del XML)
ALTER TABLE gastos_empresa
  ADD COLUMN IF NOT EXISTS numero_documento VARCHAR(50) NULL;

CREATE INDEX IF NOT EXISTS idx_ge_numero_doc
  ON gastos_empresa(empresa_id, numero_documento)
  WHERE numero_documento IS NOT NULL AND deleted_at IS NULL;

-- 2. Nuevas columnas en gastos (rendición)
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS clave_acceso      VARCHAR(49) NULL,
  ADD COLUMN IF NOT EXISTS es_reembolso      BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gasto_empresa_id  UUID        REFERENCES gastos_empresa(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gastos_clave_acceso
  ON gastos(empresa_id, clave_acceso)
  WHERE clave_acceso IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gastos_numero_doc
  ON gastos(empresa_id, numero_documento)
  WHERE numero_documento IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gastos_reembolso
  ON gastos(rendicion_id, es_reembolso)
  WHERE es_reembolso = TRUE;

-- ─── Capa 1: trigger BEFORE en gastos ────────────────────────────────────────
-- Detecta si el gasto que se está insertando/actualizando corresponde a una
-- factura ya registrada en gastos_empresa, y lo marca como reembolso.
CREATE OR REPLACE FUNCTION fn_detectar_reembolso()
RETURNS TRIGGER AS $$
DECLARE
  match_id UUID;
BEGIN
  -- Resetear estado
  NEW.es_reembolso    := FALSE;
  NEW.gasto_empresa_id := NULL;

  -- 1a: match por clave_acceso (49 dígitos SRI – único y preciso)
  IF NEW.clave_acceso IS NOT NULL AND NEW.clave_acceso <> '' THEN
    SELECT id INTO match_id
    FROM gastos_empresa
    WHERE empresa_id  = NEW.empresa_id
      AND clave_acceso = NEW.clave_acceso
      AND deleted_at   IS NULL
    LIMIT 1;

    IF FOUND THEN
      NEW.es_reembolso    := TRUE;
      NEW.gasto_empresa_id := match_id;
      RETURN NEW;
    END IF;
  END IF;

  -- 1b: match por numero_documento + RUC del proveedor
  IF NEW.numero_documento IS NOT NULL AND NEW.numero_documento <> '' THEN
    SELECT ge.id INTO match_id
    FROM gastos_empresa ge
    WHERE ge.empresa_id       = NEW.empresa_id
      AND ge.numero_documento  = NEW.numero_documento
      AND ge.deleted_at        IS NULL
      AND (
        -- Sin RUC en gastos_empresa → match solo por número
        ge.ruc_emisor IS NULL
        -- Sin proveedor en el gasto → match solo por número
        OR NEW.proveedor_id IS NULL
        -- Con ambos: verificar que el RUC del proveedor coincide
        OR EXISTS (
          SELECT 1 FROM proveedores p
          WHERE p.id  = NEW.proveedor_id
            AND p.identificacion = ge.ruc_emisor
        )
      )
    LIMIT 1;

    IF FOUND THEN
      NEW.es_reembolso    := TRUE;
      NEW.gasto_empresa_id := match_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_detectar_reembolso ON gastos;
CREATE TRIGGER trg_detectar_reembolso
  BEFORE INSERT OR UPDATE OF clave_acceso, numero_documento, proveedor_id
  ON gastos
  FOR EACH ROW
  EXECUTE FUNCTION fn_detectar_reembolso();

-- ─── Capa 1 (reverso): trigger AFTER en gastos_empresa ───────────────────────
-- Cuando se registra un gasto de empresa, marca retroactivamente los gastos de
-- rendiciones ya existentes que corresponden a la misma factura.
CREATE OR REPLACE FUNCTION fn_marcar_reembolsos_desde_empresa()
RETURNS TRIGGER AS $$
BEGIN
  -- Por clave_acceso
  IF NEW.clave_acceso IS NOT NULL THEN
    UPDATE gastos
    SET es_reembolso    = TRUE,
        gasto_empresa_id = NEW.id
    WHERE empresa_id   = NEW.empresa_id
      AND clave_acceso  = NEW.clave_acceso
      AND deleted_at    IS NULL
      AND es_reembolso  = FALSE;
  END IF;

  -- Por numero_documento + ruc_emisor
  IF NEW.numero_documento IS NOT NULL THEN
    UPDATE gastos g
    SET es_reembolso    = TRUE,
        gasto_empresa_id = NEW.id
    WHERE g.empresa_id      = NEW.empresa_id
      AND g.numero_documento = NEW.numero_documento
      AND g.deleted_at       IS NULL
      AND g.es_reembolso     = FALSE
      AND (
        NEW.ruc_emisor IS NULL
        OR g.proveedor_id IS NULL
        OR EXISTS (
          SELECT 1 FROM proveedores p
          WHERE p.id  = g.proveedor_id
            AND p.identificacion = NEW.ruc_emisor
        )
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_marcar_reembolsos_empresa ON gastos_empresa;
CREATE TRIGGER trg_marcar_reembolsos_empresa
  AFTER INSERT OR UPDATE OF clave_acceso, numero_documento, ruc_emisor
  ON gastos_empresa
  FOR EACH ROW
  EXECUTE FUNCTION fn_marcar_reembolsos_desde_empresa();
