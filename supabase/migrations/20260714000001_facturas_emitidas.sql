-- =============================================================================
-- Módulo Facturación Emitida
-- Almacena facturas electrónicas emitidas por la empresa,
-- parseadas desde XML SRI Ecuador o ingresadas manualmente.
-- Asociadas a proyectos para tracking financiero.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabla facturas_emitidas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facturas_emitidas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  proyecto_id      UUID REFERENCES proyectos(id) ON DELETE SET NULL,

  -- Datos de la factura
  numero           TEXT NOT NULL,                          -- ej: 001-001-000000042
  fecha            DATE NOT NULL,
  tipo             TEXT NOT NULL DEFAULT 'factura',        -- 'factura' | 'nota_credito'

  -- Datos del cliente (receptor)
  ruc_cliente      TEXT,
  razon_social     TEXT NOT NULL,

  -- Montos
  subtotal         NUMERIC(14,2) NOT NULL DEFAULT 0,
  descuento        NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva              NUMERIC(14,2) NOT NULL DEFAULT 0,
  total            NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- SRI
  clave_acceso     TEXT,
  estado_sri       TEXT DEFAULT 'AUTORIZADO',

  -- XML completo (para auditoría)
  xml_content      TEXT,

  -- Notas
  observacion      TEXT,

  -- Auditoría
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_facturas_emitidas_empresa    ON facturas_emitidas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_facturas_emitidas_proyecto   ON facturas_emitidas(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_facturas_emitidas_fecha      ON facturas_emitidas(fecha);
CREATE INDEX IF NOT EXISTS idx_facturas_emitidas_deleted    ON facturas_emitidas(deleted_at) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_emitidas_clave
  ON facturas_emitidas(empresa_id, clave_acceso)
  WHERE clave_acceso IS NOT NULL AND deleted_at IS NULL;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION _update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_facturas_emitidas_updated_at'
  ) THEN
    CREATE TRIGGER trg_facturas_emitidas_updated_at
      BEFORE UPDATE ON facturas_emitidas
      FOR EACH ROW EXECUTE FUNCTION _update_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE facturas_emitidas ENABLE ROW LEVEL SECURITY;

-- SELECT: miembros activos de la empresa (admin ve todo, otros también)
DROP POLICY IF EXISTS "fact_emit_select" ON facturas_emitidas;
CREATE POLICY "fact_emit_select" ON facturas_emitidas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM empresas_usuarios eu
      WHERE eu.usuario_id = auth.uid()
        AND eu.empresa_id = facturas_emitidas.empresa_id
        AND eu.activo = true
    )
  );

-- INSERT: miembros activos
DROP POLICY IF EXISTS "fact_emit_insert" ON facturas_emitidas;
CREATE POLICY "fact_emit_insert" ON facturas_emitidas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM empresas_usuarios eu
      WHERE eu.usuario_id = auth.uid()
        AND eu.empresa_id = facturas_emitidas.empresa_id
        AND eu.activo = true
    )
  );

-- UPDATE: admin o el creador
DROP POLICY IF EXISTS "fact_emit_update" ON facturas_emitidas;
CREATE POLICY "fact_emit_update" ON facturas_emitidas
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM empresas_usuarios eu
      JOIN roles r ON r.id = eu.rol_id
      WHERE eu.usuario_id = auth.uid()
        AND eu.empresa_id = facturas_emitidas.empresa_id
        AND eu.activo = true
        AND lower(r.codigo) IN ('admin', 'administrador')
    )
  );

-- DELETE: solo admin (soft-delete via updated_at)
DROP POLICY IF EXISTS "fact_emit_delete" ON facturas_emitidas;
CREATE POLICY "fact_emit_delete" ON facturas_emitidas
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM empresas_usuarios eu
      JOIN roles r ON r.id = eu.rol_id
      WHERE eu.usuario_id = auth.uid()
        AND eu.empresa_id = facturas_emitidas.empresa_id
        AND eu.activo = true
        AND lower(r.codigo) IN ('admin', 'administrador')
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Vista resumen mensual de facturación
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_facturacion_mensual AS
SELECT
  empresa_id,
  date_trunc('month', fecha)::date        AS mes,
  to_char(fecha, 'YYYY-MM')              AS mes_label,
  SUM(total)                             AS total_facturado,
  SUM(subtotal)                          AS total_subtotal,
  SUM(iva)                               AS total_iva,
  COUNT(*)                               AS num_facturas
FROM facturas_emitidas
WHERE deleted_at IS NULL
GROUP BY empresa_id, date_trunc('month', fecha)::date, to_char(fecha, 'YYYY-MM');
