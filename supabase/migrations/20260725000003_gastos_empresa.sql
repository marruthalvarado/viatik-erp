-- ─── P4: Módulo Gastos de Empresa ────────────────────────────────────────────
-- Gastos operativos de la empresa (no vinculados a rendiciones de viaje).
-- Ejemplos: servicios, alquiler, suministros, nómina parcial, publicidad, etc.

CREATE TABLE IF NOT EXISTS gastos_empresa (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID         NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  fecha            DATE         NOT NULL,
  categoria_id     UUID         NULL REFERENCES categorias_gasto(id) ON DELETE SET NULL,
  proveedor_id     UUID         NULL REFERENCES proveedores(id)      ON DELETE SET NULL,
  descripcion      TEXT         NOT NULL,
  subtotal         NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva              NUMERIC(14,2) NOT NULL DEFAULT 0,
  total            NUMERIC(14,2) NOT NULL DEFAULT 0,
  clave_acceso     VARCHAR(49)  NULL,     -- clave de acceso SRI (XML/PDF)
  comprobante_url  TEXT         NULL,     -- URL Storage (PDF/XML adjunto)
  responsable      TEXT         NULL,     -- nombre libre del responsable interno
  proyecto_id      UUID         NULL REFERENCES proyectos(id)        ON DELETE SET NULL,
  es_deducible     BOOLEAN      NOT NULL DEFAULT TRUE,
  xml_content      TEXT         NULL,     -- XML SRI original (si aplica)
  observacion      TEXT         NULL,
  created_by       UUID         NULL REFERENCES auth.users(id)       ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ  NULL
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_gastos_empresa_empresa_fecha
  ON gastos_empresa(empresa_id, fecha)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gastos_empresa_categoria
  ON gastos_empresa(categoria_id)
  WHERE deleted_at IS NULL;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_gastos_empresa_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_gastos_empresa_updated_at ON gastos_empresa;
CREATE TRIGGER trg_gastos_empresa_updated_at
  BEFORE UPDATE ON gastos_empresa
  FOR EACH ROW EXECUTE FUNCTION set_gastos_empresa_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE gastos_empresa ENABLE ROW LEVEL SECURITY;

-- Leer: miembros activos de la empresa
CREATE POLICY "ge_select" ON gastos_empresa
  FOR SELECT USING (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios
      WHERE usuario_id = auth.uid() AND activo = TRUE
    )
  );

-- Insertar: miembros activos
CREATE POLICY "ge_insert" ON gastos_empresa
  FOR INSERT WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios
      WHERE usuario_id = auth.uid() AND activo = TRUE
    )
  );

-- Actualizar: miembros activos (incluye soft-delete)
CREATE POLICY "ge_update" ON gastos_empresa
  FOR UPDATE USING (
    empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios
      WHERE usuario_id = auth.uid() AND activo = TRUE
    )
  );
