-- ============================================================
-- Migración: fecha_vencimiento en facturas_emitidas
-- Permite registrar la fecha estimada de cobro (crédito a X días).
-- La vista facturas_con_saldo se extiende con dias_atraso para
-- indicar cuántos días lleva vencida una factura no cobrada.
-- ============================================================

-- 1. Agregar columna
ALTER TABLE public.facturas_emitidas
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

-- 2. Recrear vista (DROP obligatorio: f.* cambia al agregar la columna)
DROP VIEW IF EXISTS public.facturas_con_saldo;
CREATE VIEW public.facturas_con_saldo AS
SELECT
  f.*,
  -- Valor neto a cobrar (retenciones redondeadas al centavo)
  ROUND(
    f.total
    - ROUND(f.iva      * f.retencion_iva_pct / 100, 2)
    - ROUND(f.subtotal * f.retencion_ir_pct  / 100, 2),
    2
  )                                                             AS valor_neto,
  -- Monto ya cobrado
  COALESCE(c.monto_cobrado, 0)                                 AS monto_cobrado,
  -- Saldo pendiente
  ROUND(
    f.total
    - ROUND(f.iva      * f.retencion_iva_pct / 100, 2)
    - ROUND(f.subtotal * f.retencion_ir_pct  / 100, 2)
    - COALESCE(c.monto_cobrado, 0),
    2
  )                                                             AS saldo_pendiente,
  -- Estado de cobro
  CASE
    WHEN COALESCE(c.monto_cobrado, 0) <= 0 THEN 'pendiente'
    WHEN ROUND(
      f.total
      - ROUND(f.iva      * f.retencion_iva_pct / 100, 2)
      - ROUND(f.subtotal * f.retencion_ir_pct  / 100, 2)
      - COALESCE(c.monto_cobrado, 0),
      2
    ) <= 0 THEN 'cobrado'
    ELSE 'parcial'
  END                                                           AS estado_cobro,
  -- Días de atraso (NULL si no hay vencimiento o ya está cobrada)
  CASE
    WHEN f.fecha_vencimiento IS NOT NULL
      AND ROUND(
        f.total
        - ROUND(f.iva      * f.retencion_iva_pct / 100, 2)
        - ROUND(f.subtotal * f.retencion_ir_pct  / 100, 2)
        - COALESCE(c.monto_cobrado, 0),
        2
      ) > 0
      AND CURRENT_DATE > f.fecha_vencimiento
    THEN (CURRENT_DATE - f.fecha_vencimiento)
    ELSE NULL
  END                                                           AS dias_atraso
FROM public.facturas_emitidas f
LEFT JOIN (
  SELECT factura_id, SUM(monto) AS monto_cobrado
  FROM public.cobros
  GROUP BY factura_id
) c ON c.factura_id = f.id;
