-- ─────────────────────────────────────────────────────────────────────────────
-- Trabajo correctivo en OS preventivas
-- Añade toggle "incluye trabajo correctivo" y campo de descripción
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ordenes_servicio
  ADD COLUMN IF NOT EXISTS incluye_correctivo     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS descripcion_correctivo TEXT    DEFAULT NULL;
