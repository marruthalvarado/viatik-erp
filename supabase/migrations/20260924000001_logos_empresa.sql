-- =============================================================================
-- Storage bucket público para logos de empresa
-- Aplicar en: Supabase Dashboard → SQL Editor → Run
-- =============================================================================

-- 1. Bucket público (las imágenes de logo son públicas)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos-empresa',
  'logos-empresa',
  true,
  2097152,  -- 2 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

-- 2. RLS: miembros de la empresa pueden subir/actualizar su logo
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'logo_empresa_upload'
  ) THEN
    CREATE POLICY "logo_empresa_upload" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'logos-empresa'
        AND (storage.foldername(name))[1] IN (
          SELECT eu.empresa_id::text
          FROM public.empresas_usuarios eu
          WHERE eu.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'logo_empresa_update'
  ) THEN
    CREATE POLICY "logo_empresa_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'logos-empresa'
        AND (storage.foldername(name))[1] IN (
          SELECT eu.empresa_id::text
          FROM public.empresas_usuarios eu
          WHERE eu.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'logo_empresa_public_read'
  ) THEN
    CREATE POLICY "logo_empresa_public_read" ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'logos-empresa');
  END IF;
END $$;
