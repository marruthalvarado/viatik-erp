-- Segundo ingeniero en OS
ALTER TABLE public.ordenes_servicio
  ADD COLUMN IF NOT EXISTS tecnico2_id       UUID REFERENCES public.usuarios(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS firma_tecnico2_url TEXT DEFAULT NULL;
