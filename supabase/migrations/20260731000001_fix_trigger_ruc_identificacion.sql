-- Fix: p.ruc → p.identificacion en triggers anti-duplicación
-- La columna del RUC en la tabla proveedores se llama "identificacion", no "ruc".
-- Ambas funciones hacían referencia a p.ruc causando "column p.ruc does not exist"
-- al insertar gastos (gastos_empresa y gastos).

-- ─── fn_detectar_reembolso ────────────────────────────────────────────────────
-- Trigger BEFORE en tabla "gastos" — detecta si el gasto ya está en gastos_empresa
CREATE OR REPLACE FUNCTION fn_detectar_reembolso()
RETURNS TRIGGER AS $$
DECLARE
  match_id UUID;
BEGIN
  NEW.es_reembolso     := FALSE;
  NEW.gasto_empresa_id := NULL;

  -- 1a: match por clave_acceso
  IF NEW.clave_acceso IS NOT NULL AND NEW.clave_acceso <> '' THEN
    SELECT id INTO match_id
    FROM gastos_empresa
    WHERE empresa_id   = NEW.empresa_id
      AND clave_acceso = NEW.clave_acceso
      AND deleted_at   IS NULL
    LIMIT 1;

    IF FOUND THEN
      NEW.es_reembolso     := TRUE;
      NEW.gasto_empresa_id := match_id;
      RETURN NEW;
    END IF;
  END IF;

  -- 1b: match por numero_documento + RUC del proveedor
  IF NEW.numero_documento IS NOT NULL AND NEW.numero_documento <> '' THEN
    SELECT ge.id INTO match_id
    FROM gastos_empresa ge
    WHERE ge.empresa_id      = NEW.empresa_id
      AND ge.numero_documento = NEW.numero_documento
      AND ge.deleted_at       IS NULL
      AND (
        ge.ruc_emisor IS NULL
        OR NEW.proveedor_id IS NULL
        OR EXISTS (
          SELECT 1 FROM proveedores p
          WHERE p.id             = NEW.proveedor_id
            AND p.identificacion = ge.ruc_emisor   -- FIX: p.identificacion en vez de p.ruc
        )
      )
    LIMIT 1;

    IF FOUND THEN
      NEW.es_reembolso     := TRUE;
      NEW.gasto_empresa_id := match_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── fn_marcar_reembolsos_desde_empresa ──────────────────────────────────────
-- Trigger AFTER en tabla "gastos_empresa" — marca retroactivamente los gastos
-- de rendiciones que coinciden con el gasto de empresa recién insertado.
CREATE OR REPLACE FUNCTION fn_marcar_reembolsos_desde_empresa()
RETURNS TRIGGER AS $$
BEGIN
  -- Por clave_acceso
  IF NEW.clave_acceso IS NOT NULL THEN
    UPDATE gastos
    SET es_reembolso     = TRUE,
        gasto_empresa_id = NEW.id
    WHERE empresa_id    = NEW.empresa_id
      AND clave_acceso  = NEW.clave_acceso
      AND deleted_at    IS NULL
      AND es_reembolso  = FALSE;
  END IF;

  -- Por numero_documento + ruc_emisor
  IF NEW.numero_documento IS NOT NULL THEN
    UPDATE gastos g
    SET es_reembolso     = TRUE,
        gasto_empresa_id = NEW.id
    WHERE g.empresa_id       = NEW.empresa_id
      AND g.numero_documento  = NEW.numero_documento
      AND g.deleted_at        IS NULL
      AND g.es_reembolso      = FALSE
      AND (
        NEW.ruc_emisor IS NULL
        OR g.proveedor_id IS NULL
        OR EXISTS (
          SELECT 1 FROM proveedores p
          WHERE p.id             = g.proveedor_id
            AND p.identificacion = NEW.ruc_emisor   -- FIX: p.identificacion en vez de p.ruc
        )
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
