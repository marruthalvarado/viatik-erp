-- ============================================================
-- Migración: tabla cobros (pagos recibidos por factura emitida)
-- ============================================================

-- 1. Tabla principal
CREATE TABLE IF NOT EXISTS public.cobros (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID          NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  factura_id    UUID          NOT NULL REFERENCES public.facturas_emitidas(id) ON DELETE CASCADE,
  fecha_cobro   DATE          NOT NULL,
  monto         NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  observacion   TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by    UUID          REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS cobros_factura_id_idx  ON public.cobros(factura_id);
CREATE INDEX IF NOT EXISTS cobros_empresa_id_idx  ON public.cobros(empresa_id);

-- 2. RLS
ALTER TABLE public.cobros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cobros_empresa_select" ON public.cobros;
CREATE POLICY "cobros_empresa_select" ON public.cobros
  FOR SELECT USING (
    empresa_id IN (
      SELECT empresa_id FROM public.empresas_usuarios
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "cobros_empresa_insert" ON public.cobros;
CREATE POLICY "cobros_empresa_insert" ON public.cobros
  FOR INSERT WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM public.empresas_usuarios
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "cobros_empresa_update" ON public.cobros;
CREATE POLICY "cobros_empresa_update" ON public.cobros
  FOR UPDATE USING (
    empresa_id IN (
      SELECT empresa_id FROM public.empresas_usuarios
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "cobros_empresa_delete" ON public.cobros;
CREATE POLICY "cobros_empresa_delete" ON public.cobros
  FOR DELETE USING (
    empresa_id IN (
      SELECT empresa_id FROM public.empresas_usuarios
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- 3. Vista: facturas con saldo pendiente
CREATE OR REPLACE VIEW public.facturas_con_saldo AS
SELECT
  f.*,
  COALESCE(c.monto_cobrado, 0)                     AS monto_cobrado,
  f.total - COALESCE(c.monto_cobrado, 0)            AS saldo_pendiente,
  CASE
    WHEN COALESCE(c.monto_cobrado, 0) <= 0               THEN 'pendiente'
    WHEN COALESCE(c.monto_cobrado, 0) >= f.total          THEN 'cobrado'
    ELSE 'parcial'
  END                                               AS estado_cobro
FROM public.facturas_emitidas f
LEFT JOIN (
  SELECT factura_id, SUM(monto) AS monto_cobrado
  FROM public.cobros
  GROUP BY factura_id
) c ON c.factura_id = f.id;

-- La vista hereda RLS de facturas_emitidas y cobros.
-- No se aplica RLS directamente a views en Supabase.
