-- =============================================================================
-- MIGRATION: total_facturado incluye vehiculo propio y filtro de politica
-- Actualiza fn_actualizar_totales_rendicion para calcular:
--   total_facturado = gastos_filtrados_por_politica
--                   + km_vehiculo_propio (distancia_km * 2 * valor_km)
--                   + km_ciudad (dias * km_ciudad_por_dia * valor_km)
-- Agrega trigger en tabla viajes para recalcular al cambiar trayectos.
-- Incluye backfill de todos los registros existentes.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_actualizar_totales_rendicion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id               uuid;
  v_empresa_id       uuid;
  v_politica_id      uuid;
  v_valor_km         numeric := 0;
  v_km_ciudad        numeric := 0;
  v_paga_combustible boolean;
  v_paga_peajes      boolean;
  v_dias             integer := 0;
  v_total_gastos     numeric := 0;
  v_total_km_propio  numeric := 0;
  v_km_ciudad_total  numeric := 0;
  v_total_facturado  numeric := 0;
BEGIN
  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.rendicion_id ELSE NEW.rendicion_id END;
  IF v_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Obtener empresa y politica de la rendicion
  SELECT empresa_id, politica_id
  INTO v_empresa_id, v_politica_id
  FROM rendiciones
  WHERE id = v_id;

  -- Obtener parametros de la politica
  IF v_politica_id IS NOT NULL THEN
    SELECT COALESCE(valor_km, 0), COALESCE(km_ciudad_por_dia, 0),
           paga_combustible, paga_peajes
    INTO v_valor_km, v_km_ciudad, v_paga_combustible, v_paga_peajes
    FROM politicas
    WHERE id = v_politica_id;
  ELSE
    SELECT COALESCE(valor_km, 0), COALESCE(km_ciudad_por_dia, 0),
           paga_combustible, paga_peajes
    INTO v_valor_km, v_km_ciudad, v_paga_combustible, v_paga_peajes
    FROM politicas
    WHERE empresa_id = v_empresa_id
    ORDER BY created_at
    LIMIT 1;
  END IF;

  -- Sumar gastos filtrados por politica (combustible/peajes zerizados si corresponde)
  SELECT COALESCE(SUM(
    CASE
      WHEN v_paga_combustible = false AND LOWER(cg.nombre) = 'combustible' THEN 0
      WHEN v_paga_peajes = false AND LOWER(cg.nombre) = 'peaje' THEN 0
      ELSE g.valor_factura
    END
  ), 0)
  INTO v_total_gastos
  FROM gastos g
  LEFT JOIN categorias_gasto cg ON cg.id = g.categoria_gasto_id
  WHERE g.rendicion_id = v_id AND g.deleted_at IS NULL;

  -- Sumar km vehiculo propio: distancia_km * 2 (ida y vuelta) * valor_km
  SELECT COALESCE(SUM(v.distancia_km * 2 * v_valor_km), 0)
  INTO v_total_km_propio
  FROM viajes v
  WHERE v.rendicion_id = v_id
    AND v.vehiculo_propio = true
    AND COALESCE(v.distancia_km, 0) > 0;

  -- Calcular dias del primer viaje en vehiculo propio (para km ciudad)
  v_dias := 0;
  SELECT GREATEST(0, (v.fecha_fin::date - v.fecha_inicio::date) + 1)
  INTO v_dias
  FROM viajes v
  WHERE v.rendicion_id = v_id
    AND v.vehiculo_propio = true
    AND v.fecha_inicio IS NOT NULL
    AND v.fecha_fin IS NOT NULL
  ORDER BY v.fecha_inicio
  LIMIT 1;

  -- Km ciudad: dias * km_ciudad_por_dia * valor_km
  v_km_ciudad_total := CASE
    WHEN COALESCE(v_dias, 0) > 0 AND v_km_ciudad > 0
    THEN v_dias * v_km_ciudad * v_valor_km
    ELSE 0
  END;

  v_total_facturado := v_total_gastos + v_total_km_propio + v_km_ciudad_total;

  UPDATE rendiciones
  SET
    total_facturado    = v_total_facturado,
    total_reembolsable = COALESCE((
      SELECT SUM(g.valor_reembolsable)
      FROM   gastos g
      WHERE  g.rendicion_id = v_id AND g.deleted_at IS NULL
    ), 0),
    saldo = v_total_facturado
          - COALESCE(anticipo_efectivo, 0)
          - COALESCE(anticipo_credito, 0)
  WHERE id = v_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger existente en gastos (recrear para aplicar la funcion actualizada)
DROP TRIGGER IF EXISTS trg_totales_rendicion ON gastos;
CREATE TRIGGER trg_totales_rendicion
AFTER INSERT OR UPDATE OR DELETE ON gastos
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_totales_rendicion();

-- Nuevo trigger en viajes (recalcular cuando cambian trayectos/distancias)
DROP TRIGGER IF EXISTS trg_totales_rendicion_viajes ON viajes;
CREATE TRIGGER trg_totales_rendicion_viajes
AFTER INSERT OR UPDATE OR DELETE ON viajes
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_totales_rendicion();

-- =============================================================================
-- BACKFILL: recalcular total_facturado de todos los rendiciones existentes
-- =============================================================================
DO $$
DECLARE
  r_id               uuid;
  v_empresa_id       uuid;
  v_politica_id      uuid;
  v_valor_km         numeric;
  v_km_ciudad        numeric;
  v_paga_combustible boolean;
  v_paga_peajes      boolean;
  v_dias             integer;
  v_total_gastos     numeric;
  v_total_km_propio  numeric;
  v_km_ciudad_total  numeric;
  v_total_facturado  numeric;
BEGIN
  FOR r_id IN
    SELECT id FROM rendiciones WHERE deleted_at IS NULL
  LOOP
    -- Inicializar variables
    v_valor_km := 0; v_km_ciudad := 0; v_paga_combustible := null; v_paga_peajes := null;
    v_dias := 0; v_total_gastos := 0; v_total_km_propio := 0;
    v_km_ciudad_total := 0; v_total_facturado := 0;

    SELECT empresa_id, politica_id INTO v_empresa_id, v_politica_id
    FROM rendiciones WHERE id = r_id;

    IF v_politica_id IS NOT NULL THEN
      SELECT COALESCE(valor_km, 0), COALESCE(km_ciudad_por_dia, 0),
             paga_combustible, paga_peajes
      INTO v_valor_km, v_km_ciudad, v_paga_combustible, v_paga_peajes
      FROM politicas WHERE id = v_politica_id;
    ELSE
      SELECT COALESCE(valor_km, 0), COALESCE(km_ciudad_por_dia, 0),
             paga_combustible, paga_peajes
      INTO v_valor_km, v_km_ciudad, v_paga_combustible, v_paga_peajes
      FROM politicas WHERE empresa_id = v_empresa_id ORDER BY created_at LIMIT 1;
    END IF;

    SELECT COALESCE(SUM(
      CASE
        WHEN v_paga_combustible = false AND LOWER(cg.nombre) = 'combustible' THEN 0
        WHEN v_paga_peajes = false AND LOWER(cg.nombre) = 'peaje' THEN 0
        ELSE g.valor_factura
      END
    ), 0)
    INTO v_total_gastos
    FROM gastos g
    LEFT JOIN categorias_gasto cg ON cg.id = g.categoria_gasto_id
    WHERE g.rendicion_id = r_id AND g.deleted_at IS NULL;

    SELECT COALESCE(SUM(v.distancia_km * 2 * v_valor_km), 0)
    INTO v_total_km_propio
    FROM viajes v
    WHERE v.rendicion_id = r_id
      AND v.vehiculo_propio = true
      AND COALESCE(v.distancia_km, 0) > 0;

    SELECT GREATEST(0, (v.fecha_fin::date - v.fecha_inicio::date) + 1)
    INTO v_dias
    FROM viajes v
    WHERE v.rendicion_id = r_id
      AND v.vehiculo_propio = true
      AND v.fecha_inicio IS NOT NULL AND v.fecha_fin IS NOT NULL
    ORDER BY v.fecha_inicio LIMIT 1;

    v_km_ciudad_total := CASE
      WHEN COALESCE(v_dias, 0) > 0 AND v_km_ciudad > 0
      THEN v_dias * v_km_ciudad * v_valor_km
      ELSE 0
    END;

    v_total_facturado := v_total_gastos + v_total_km_propio + v_km_ciudad_total;

    UPDATE rendiciones
    SET
      total_facturado    = v_total_facturado,
      total_reembolsable = COALESCE((
        SELECT SUM(g.valor_reembolsable)
        FROM gastos g WHERE g.rendicion_id = r_id AND g.deleted_at IS NULL
      ), 0),
      total_anticipos    = COALESCE(anticipo_efectivo, 0) + COALESCE(anticipo_credito, 0),
      saldo              = v_total_facturado
                         - COALESCE(anticipo_efectivo, 0)
                         - COALESCE(anticipo_credito, 0)
    WHERE id = r_id;
  END LOOP;
END;
$$;
