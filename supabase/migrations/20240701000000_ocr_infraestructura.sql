-- =============================================================================
-- IA-1 — Infraestructura OCR
-- Objetivo: Storage bucket para documentos + ampliar ocr_extracciones
--           con columnas de metadatos de procesamiento OCR.
--
-- No duplica estructuras existentes. Extiende:
--   - Tabla documentos (ya existe): usa storage_path y procesado
--   - Tabla ocr_extracciones (ya existe): agrega ocr_proveedor, estado,
--     tiempo_procesamiento_ms
-- =============================================================================

-- =============================================================================
-- 1. Storage Bucket "documentos"
--    Organización: {empresa_id}/{rendicion_id}/{documento_id}_{nombre_archivo}
--    Tipos aceptados: image/jpeg, image/png, application/pdf
-- =============================================================================

-- Crear bucket si no existe (idempotente)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos',
  'documentos',
  false,                                              -- privado, acceso vía signed URL
  20971520,                                           -- 20 MB por archivo
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================================================
-- 2. RLS de Storage — solo el usuario autenticado que pertenece a la empresa
-- =============================================================================

-- DROP previo para evitar duplicados en re-runs
DROP POLICY IF EXISTS "storage_documentos_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_documentos_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_documentos_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_documentos_delete" ON storage.objects;

-- El path es: {empresa_id}/{rendicion_id}/{filename}
-- Validamos que el segmento empresa_id del path pertenece al usuario.
CREATE POLICY "storage_documentos_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documentos'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.empresas_usuarios eu
      WHERE eu.usuario_id = auth.uid()
        AND eu.empresa_id = (string_to_array(name, '/'))[1]::uuid
        AND eu.activo = true
    )
  );

CREATE POLICY "storage_documentos_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documentos'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.empresas_usuarios eu
      WHERE eu.usuario_id = auth.uid()
        AND eu.empresa_id = (string_to_array(name, '/'))[1]::uuid
        AND eu.activo = true
    )
  );

CREATE POLICY "storage_documentos_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'documentos'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.empresas_usuarios eu
      WHERE eu.usuario_id = auth.uid()
        AND eu.empresa_id = (string_to_array(name, '/'))[1]::uuid
        AND eu.activo = true
    )
  );

CREATE POLICY "storage_documentos_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documentos'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.empresas_usuarios eu
      WHERE eu.usuario_id = auth.uid()
        AND eu.empresa_id = (string_to_array(name, '/'))[1]::uuid
        AND eu.activo = true
    )
  );

-- =============================================================================
-- 3. Ampliar ocr_extracciones con columnas de metadatos OCR
--    Existentes (no tocar): documento_id, texto_extraido, confianza, json_ocr,
--    proveedor_detectado, fecha_detectada, numero_documento_detectado,
--    total_detectado, subtotal_detectado, impuesto_detectado, moneda_detectada
-- =============================================================================

-- Proveedor OCR que generó la extracción (ej: 'tesseract_5', 'google_vision_v1')
ALTER TABLE ocr_extracciones
  ADD COLUMN IF NOT EXISTS ocr_proveedor text NOT NULL DEFAULT 'tesseract_5';

-- Estado del procesamiento
ALTER TABLE ocr_extracciones
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'completado'
  CHECK (estado IN ('pendiente', 'procesando', 'completado', 'error', 'requiere_backend'));

-- Tiempo de procesamiento en milisegundos
ALTER TABLE ocr_extracciones
  ADD COLUMN IF NOT EXISTS tiempo_procesamiento_ms integer;

-- Mensaje de error cuando estado = 'error'
ALTER TABLE ocr_extracciones
  ADD COLUMN IF NOT EXISTS error_mensaje text;

-- Índice para consultas por estado
CREATE INDEX IF NOT EXISTS idx_ocr_extracciones_estado
  ON ocr_extracciones(estado);

CREATE INDEX IF NOT EXISTS idx_ocr_extracciones_proveedor
  ON ocr_extracciones(ocr_proveedor);

-- =============================================================================
-- 4. RLS para ocr_extracciones
--    El usuario solo puede ver/insertar/actualizar OCR de documentos
--    de sus propias empresas.
-- =============================================================================
ALTER TABLE ocr_extracciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ocr_extracciones_select" ON ocr_extracciones;
DROP POLICY IF EXISTS "ocr_extracciones_insert" ON ocr_extracciones;
DROP POLICY IF EXISTS "ocr_extracciones_update" ON ocr_extracciones;

CREATE POLICY "ocr_extracciones_select"
  ON ocr_extracciones FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM documentos d
      JOIN empresas_usuarios eu ON eu.empresa_id = d.empresa_id
      WHERE d.id = ocr_extracciones.documento_id
        AND eu.usuario_id = auth.uid()
        AND eu.activo = true
    )
  );

CREATE POLICY "ocr_extracciones_insert"
  ON ocr_extracciones FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM documentos d
      JOIN empresas_usuarios eu ON eu.empresa_id = d.empresa_id
      WHERE d.id = ocr_extracciones.documento_id
        AND eu.usuario_id = auth.uid()
        AND eu.activo = true
    )
  );

CREATE POLICY "ocr_extracciones_update"
  ON ocr_extracciones FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM documentos d
      JOIN empresas_usuarios eu ON eu.empresa_id = d.empresa_id
      WHERE d.id = ocr_extracciones.documento_id
        AND eu.usuario_id = auth.uid()
        AND eu.activo = true
    )
  );
