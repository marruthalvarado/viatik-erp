-- =============================================================================
-- TRIGGER: actualizar total_facturado / total_reembolsable / saldo en rendiciones
-- Se dispara en INSERT/UPDATE/DELETE sobre gastos.
-- También mantiene total_anticipos = anticipo_efectivo + anticipo_credito.
-- =============================================================================

-- ─── 1. Función: recalcular totales de gastos ─────────────────────────────────
CREATE OR REPLACE FUNCTION fn_actualizar_totales_rendicion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.rendicion_id ELSE NEW.rendicion_id END;
  IF v_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE rendiciones
  SET
    total_facturado    = COALESCE((
      SELECT SUM(g.valor_factura)
      FROM   gastos g
      WHERE  g.rendicion_id = v_id AND g.deleted_at IS NULL
    ), 0),
    total_reembolsable = COALESCE((
      SELECT SUM(g.valor_reembolsable)
      FROM   gastos g
      WHERE  g.rendicion_id = v_id AND g.deleted_at IS NULL
    ), 0),
    saldo = COALESCE((
      SELECT SUM(g.valor_factura)
      FROM   gastos g
      WHERE  g.rendicion_id = v_id AND g.deleted_at IS NULL
    ), 0)
    - COALESCE(anticipo_efectivo, 0)
    - COALESCE(anticipo_credito, 0)
  WHERE id = v_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_totales_rendicion ON gastos;
CREATE TRIGGER trg_totales_rendicion
AFTER INSERT OR UPDATE OR DELETE ON gastos
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_totales_rendicion();

-- ─── 2. Función: recalcular anticipos + saldo cuando cambian los anticipos ──
CREATE OR REPLACE FUNCTION fn_actualizar_anticipos_rendicion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.total_anticipos :=
    COALESCE(NEW.anticipo_efectivo, 0) + COALESCE(NEW.anticipo_credito, 0);
  NEW.saldo :=
    COALESCE(NEW.total_facturado, 0) - NEW.total_anticipos;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anticipos_rendicion ON rendiciones;
CREATE TRIGGER trg_anticipos_rendicion
BEFORE INSERT OR UPDATE OF anticipo_efectivo, anticipo_credito ON rendiciones
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_anticipos_rendicion();

-- ─── 3. Backfill: recalcular todas las rendiciones existentes ─────────────────
UPDATE rendiciones r
SET
  total_facturado    = COALESCE((
    SELECT SUM(g.valor_factura)
    FROM   gastos g
    WHERE  g.rendicion_id = r.id AND g.deleted_at IS NULL
  ), 0),
  total_reembolsable = COALESCE((
    SELECT SUM(g.valor_reembolsable)
    FROM   gastos g
    WHERE  g.rendicion_id = r.id AND g.deleted_at IS NULL
  ), 0),
  total_anticipos    = COALESCE(r.anticipo_efectivo, 0) + COALESCE(r.anticipo_credito, 0),
  saldo              = COALESCE((
    SELECT SUM(g.valor_factura)
    FROM   gastos g
    WHERE  g.rendicion_id = r.id AND g.deleted_at IS NULL
  ), 0)
  - COALESCE(r.anticipo_efectivo, 0)
  - COALESCE(r.anticipo_credito, 0)
WHERE r.deleted_at IS NULL;
