-- Migration: agregar campo es_opcion a cotizacion_items
-- Permite marcar explícitamente un ítem como "opción" en vez de inferirlo del descuento

ALTER TABLE cotizacion_items
  ADD COLUMN IF NOT EXISTS es_opcion BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN cotizacion_items.es_opcion IS
  'Marca el ítem como opción alternativa (aparece en sección Opciones de la propuesta, no en la lista principal).';
