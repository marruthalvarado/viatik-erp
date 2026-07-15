-- ============================================================
-- Migración: campos de retención en facturas_emitidas
-- Agrega retencion_iva_pct y retencion_ir_pct para calcular
-- el valor neto a cobrar cuando el cliente es agente de retención.
--
-- Fórmula: valor_neto = total - (iva * ret_iva_pct/100) - (subtotal * ret_ir_pct/100)
-- ============================================================

-- 1. Agregar columnas a facturas_emitidas
ALTER TABLE public.facturas_emitidas
  ADD COLUMN IF NOT EXISTS retencion_iva_pct NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (retencion_iva_pct >= 0 AND retencion_iva_pct <= 100),
  ADD COLUMN IF NOT EXISTS retencion_ir_pct  NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (retencion_ir_pct  >= 0 AND retencion_ir_pct  <= 100);

-- 2. Vista actualizada: facturas_con_saldo
-- DROP primero: CREATE OR REPLACE no puede reordenar columnas cuando f.*
-- se expande con los nuevos campos de retención recién agregados.
DROP VIEW IF EXISTS public.facturas_con_saldo;
CREATE VIEW public.facturas_con_saldo AS
SELECT
  f.*,
  -- Valor neto a cobrar (descontando retenciones fiscales)
  ROUND(
    f.total
    - (f.iva      * f.retencion_iva_pct / 100)
    - (f.subtotal * f.retencion_ir_pct  / 100),
    2
  )                                                             AS valor_neto,
  -- Monto ya cobrado (suma de cobros registrados)
  COALESCE(c.monto_cobrado, 0)                                 AS monto_cobrado,
  -- Saldo pendiente = valor_neto - cobrado
  ROUND(
    f.total
    - (f.iva      * f.retencion_iva_pct / 100)
    - (f.subtotal * f.retencion_ir_pct  / 100)
    - COALESCE(c.monto_cobrado, 0),
    2
  )                                                             AS saldo_pendiente,
  CASE
    WHEN COALESCE(c.monto_cobrado, 0) <= 0 THEN 'pendiente'
    WHEN ROUND(
      f.total
      - (f.iva      * f.retencion_iva_pct / 100)
      - (f.subtotal * f.retencion_ir_pct  / 100)
      - COALESCE(c.monto_cobrado, 0),
      2
    ) <= 0 THEN 'cobrado'
    ELSE 'parcial'
  END                                                           AS estado_cobro
FROM public.facturas_emitidas f
LEFT JOIN (
  SELECT factura_id, SUM(monto) AS monto_cobrado
  FROM public.cobros
  GROUP BY factura_id
) c ON c.factura_id = f.id;
