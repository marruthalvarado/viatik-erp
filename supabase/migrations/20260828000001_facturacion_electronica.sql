-- =============================================================================
-- Facturación Electrónica SRI Ecuador
-- Tablas: empresa_facturacion_config + comprobantes_electronicos
-- Storage: bucket privado certificados-sri
-- Aplicar en: Supabase Dashboard → SQL Editor → Run
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabla configuración por empresa
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.empresa_facturacion_config (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id               UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- Datos del emisor
  ruc                      TEXT        NOT NULL,
  razon_social             TEXT        NOT NULL,
  nombre_comercial         TEXT,
  dir_matriz               TEXT        NOT NULL,
  dir_establecimiento      TEXT,
  obligado_contabilidad    BOOLEAN     NOT NULL DEFAULT TRUE,
  contribuyente_especial   TEXT,
  -- Serie
  establecimiento          TEXT        NOT NULL DEFAULT '001',
  punto_emision            TEXT        NOT NULL DEFAULT '001',
  -- Ambiente SRI
  ambiente                 TEXT        NOT NULL DEFAULT 'pruebas'
                             CHECK (ambiente IN ('pruebas', 'produccion')),
  -- Certificado .p12
  cert_storage_path        TEXT,
  cert_clave               TEXT,
  cert_vigencia            DATE,
  -- Secuenciales por tipo de comprobante
  sec_factura              INTEGER     NOT NULL DEFAULT 0,
  sec_nota_credito         INTEGER     NOT NULL DEFAULT 0,
  sec_nota_debito          INTEGER     NOT NULL DEFAULT 0,
  sec_retencion            INTEGER     NOT NULL DEFAULT 0,
  sec_guia_remision        INTEGER     NOT NULL DEFAULT 0,
  -- Control
  activo                   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_emp_fac_config_empresa
  ON public.empresa_facturacion_config (empresa_id);

-- RLS
ALTER TABLE public.empresa_facturacion_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'empresa_facturacion_config' AND policyname = 'fac_config_empresa_member'
  ) THEN
    CREATE POLICY "fac_config_empresa_member" ON public.empresa_facturacion_config
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.empresas_usuarios eu
          WHERE eu.empresa_id = empresa_facturacion_config.empresa_id
            AND eu.usuario_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Tabla comprobantes electrónicos emitidos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comprobantes_electronicos (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo                 TEXT        NOT NULL
                         CHECK (tipo IN ('factura','nota_credito','nota_debito','retencion','guia_remision')),
  numero               TEXT        NOT NULL,        -- 001-001-000000001
  clave_acceso         TEXT        UNIQUE,           -- 49 chars
  estado               TEXT        NOT NULL DEFAULT 'pendiente'
                         CHECK (estado IN ('pendiente','enviado','autorizado','rechazado','anulado')),
  fecha_emision        DATE        NOT NULL,
  -- XML
  xml_sin_firma        TEXT,
  xml_firmado          TEXT,
  xml_autorizado       TEXT,
  -- Respuesta SRI
  numero_autorizacion  TEXT,
  fecha_autorizacion   TIMESTAMPTZ,
  mensaje_sri          TEXT,
  -- Referencia al documento origen
  referencia_tipo      TEXT        DEFAULT 'factura_emitida',
  referencia_id        UUID,
  -- Control
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comp_elec_empresa_estado
  ON public.comprobantes_electronicos (empresa_id, estado);
CREATE INDEX IF NOT EXISTS idx_comp_elec_clave
  ON public.comprobantes_electronicos (clave_acceso);
CREATE INDEX IF NOT EXISTS idx_comp_elec_ref
  ON public.comprobantes_electronicos (referencia_tipo, referencia_id);

-- RLS
ALTER TABLE public.comprobantes_electronicos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'comprobantes_electronicos' AND policyname = 'comp_elec_empresa_member'
  ) THEN
    CREATE POLICY "comp_elec_empresa_member" ON public.comprobantes_electronicos
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.empresas_usuarios eu
          WHERE eu.empresa_id = comprobantes_electronicos.empresa_id
            AND eu.usuario_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. RPC: sri_siguiente_secuencial — incremento atómico del secuencial
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sri_siguiente_secuencial(
  p_empresa_id UUID,
  p_tipo       TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_col  TEXT;
  v_seq  INTEGER;
BEGIN
  v_col := CASE p_tipo
    WHEN 'factura'       THEN 'sec_factura'
    WHEN 'nota_credito'  THEN 'sec_nota_credito'
    WHEN 'nota_debito'   THEN 'sec_nota_debito'
    WHEN 'retencion'     THEN 'sec_retencion'
    WHEN 'guia_remision' THEN 'sec_guia_remision'
    ELSE NULL
  END;
  IF v_col IS NULL THEN
    RAISE EXCEPTION 'Tipo de comprobante desconocido: %', p_tipo;
  END IF;

  EXECUTE format(
    'UPDATE public.empresa_facturacion_config
        SET %I = %I + 1, updated_at = now()
      WHERE empresa_id = $1
      RETURNING %I',
    v_col, v_col, v_col
  ) INTO v_seq USING p_empresa_id;

  IF v_seq IS NULL THEN
    RAISE EXCEPTION 'No se encontró configuración de facturación para la empresa';
  END IF;
  RETURN v_seq;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Storage bucket privado para certificados .p12
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificados-sri',
  'certificados-sri',
  FALSE,
  524288,       -- 512 KB
  ARRAY['application/x-pkcs12','application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- RLS storage: solo Edge Functions con service_role pueden acceder
-- (no se crean políticas públicas para este bucket)
