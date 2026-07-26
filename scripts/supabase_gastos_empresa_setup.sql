-- ═══════════════════════════════════════════════════════════════════════════════
-- SETUP COMPLETO: Módulo Gastos de Empresa
-- Pegar y ejecutar completo en Supabase Dashboard → SQL Editor
-- Es seguro ejecutarlo múltiples veces (idempotente).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Tabla principal ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gastos_empresa (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  fecha            DATE          NOT NULL,
  categoria_id     UUID          NULL REFERENCES categorias_gasto(id) ON DELETE SET NULL,
  proveedor_id     UUID          NULL REFERENCES proveedores(id)      ON DELETE SET NULL,
  descripcion      TEXT          NOT NULL,
  subtotal         NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva              NUMERIC(14,2) NOT NULL DEFAULT 0,
  total            NUMERIC(14,2) NOT NULL DEFAULT 0,
  clave_acceso     VARCHAR(49)   NULL,
  comprobante_url  TEXT          NULL,
  responsable      TEXT          NULL,
  proyecto_id      UUID          NULL REFERENCES proyectos(id) ON DELETE SET NULL,
  es_deducible     BOOLEAN       NOT NULL DEFAULT TRUE,
  xml_content      TEXT          NULL,
  observacion      TEXT          NULL,
  ruc_emisor       VARCHAR(13)   NULL,        -- RUC del emisor (para sugerencias automáticas)
  created_by       UUID          NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ   NULL
);

-- ─── 2. Columna ruc_emisor (por si la tabla ya existía sin ella) ──────────────

ALTER TABLE gastos_empresa
  ADD COLUMN IF NOT EXISTS ruc_emisor VARCHAR(13) NULL;

-- ─── 3. Índices ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_gastos_empresa_empresa_fecha
  ON gastos_empresa(empresa_id, fecha)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gastos_empresa_categoria
  ON gastos_empresa(categoria_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gastos_empresa_ruc_emisor
  ON gastos_empresa(empresa_id, ruc_emisor)
  WHERE ruc_emisor IS NOT NULL AND deleted_at IS NULL;

-- Índice único: evita duplicar la misma factura (clave_acceso) por empresa
CREATE UNIQUE INDEX IF NOT EXISTS uq_gastos_empresa_clave_acceso
  ON gastos_empresa(empresa_id, clave_acceso)
  WHERE clave_acceso IS NOT NULL AND deleted_at IS NULL;

-- ─── 4. Trigger updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_gastos_empresa_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_gastos_empresa_updated_at ON gastos_empresa;
CREATE TRIGGER trg_gastos_empresa_updated_at
  BEFORE UPDATE ON gastos_empresa
  FOR EACH ROW EXECUTE FUNCTION set_gastos_empresa_updated_at();

-- ─── 5. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE gastos_empresa ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gastos_empresa' AND policyname = 'ge_select'
  ) THEN
    CREATE POLICY "ge_select" ON gastos_empresa
      FOR SELECT USING (
        empresa_id IN (
          SELECT empresa_id FROM empresas_usuarios
          WHERE usuario_id = auth.uid() AND activo = TRUE
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gastos_empresa' AND policyname = 'ge_insert'
  ) THEN
    CREATE POLICY "ge_insert" ON gastos_empresa
      FOR INSERT WITH CHECK (
        empresa_id IN (
          SELECT empresa_id FROM empresas_usuarios
          WHERE usuario_id = auth.uid() AND activo = TRUE
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gastos_empresa' AND policyname = 'ge_update'
  ) THEN
    CREATE POLICY "ge_update" ON gastos_empresa
      FOR UPDATE USING (
        empresa_id IN (
          SELECT empresa_id FROM empresas_usuarios
          WHERE usuario_id = auth.uid() AND activo = TRUE
        )
      );
  END IF;
END $$;

-- ─── Verificación final ───────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'gastos_empresa') AS columnas,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'gastos_empresa') AS indices,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'gastos_empresa') AS politicas;
