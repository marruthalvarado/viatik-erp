-- Migration: agregar sitio_web a la tabla empresas
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS sitio_web TEXT;
