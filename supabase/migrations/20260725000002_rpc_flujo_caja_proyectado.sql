-- ─── P3: RPC flujo_caja_proyectado ────────────────────────────────────────────
-- Agrupa facturas emitidas activas por mes de fecha_vencimiento.
-- Devuelve: mes, monto_esperado, monto_cobrado, monto_pendiente,
--           saldo_proyectado (acumulado de pendiente, de más antiguo a más nuevo).
-- Excluye: deleted, ANULADA, y facturas sin fecha_vencimiento.

CREATE OR REPLACE FUNCTION flujo_caja_proyectado(p_empresa_id UUID, p_anio INT DEFAULT NULL)
RETURNS TABLE (
  mes              TEXT,     -- 'YYYY-MM'
  monto_esperado   NUMERIC,
  monto_cobrado    NUMERIC,
  monto_pendiente  NUMERIC,
  saldo_proyectado NUMERIC   -- suma acumulada de monto_pendiente (oldest → newest)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cobros_por_factura AS (
    SELECT
      factura_id,
      COALESCE(SUM(monto), 0) AS total_cobrado
    FROM cobros
    WHERE empresa_id = p_empresa_id
    GROUP BY factura_id
  ),
  facturas_base AS (
    SELECT
      to_char(f.fecha_vencimiento::date, 'YYYY-MM') AS mes,
      f.total                                         AS monto_esperado,
      COALESCE(c.total_cobrado, 0)                    AS monto_cobrado,
      GREATEST(f.total - COALESCE(c.total_cobrado, 0), 0) AS monto_pendiente
    FROM facturas_emitidas f
    LEFT JOIN cobros_por_factura c ON c.factura_id = f.id
    WHERE f.empresa_id      = p_empresa_id
      AND f.deleted_at      IS NULL
      AND (f.estado_sri IS NULL OR f.estado_sri <> 'ANULADA')
      AND f.fecha_vencimiento IS NOT NULL
      AND (p_anio IS NULL OR EXTRACT(YEAR FROM f.fecha_vencimiento::date) = p_anio)
  ),
  por_mes AS (
    SELECT
      mes,
      SUM(monto_esperado)  AS monto_esperado,
      SUM(monto_cobrado)   AS monto_cobrado,
      SUM(monto_pendiente) AS monto_pendiente
    FROM facturas_base
    GROUP BY mes
  )
  SELECT
    mes,
    ROUND(monto_esperado,  2) AS monto_esperado,
    ROUND(monto_cobrado,   2) AS monto_cobrado,
    ROUND(monto_pendiente, 2) AS monto_pendiente,
    ROUND(SUM(monto_pendiente) OVER (ORDER BY mes ASC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 2) AS saldo_proyectado
  FROM por_mes
  ORDER BY mes ASC;
$$;

-- Permisos: solo usuarios autenticados (RLS garantiza empresa_id correcto)
GRANT EXECUTE ON FUNCTION flujo_caja_proyectado(UUID, INT) TO authenticated;
