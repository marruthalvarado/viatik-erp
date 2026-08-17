-- Migración: proveedores internacionales
-- Agrega el campo es_internacional a la tabla proveedores para distinguir
-- proveedores del exterior (fabricantes/importadores) de los locales.

ALTER TABLE public.proveedores
  ADD COLUMN IF NOT EXISTS es_internacional BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para filtrado eficiente en dropdowns
CREATE INDEX IF NOT EXISTS idx_proveedores_internacional
  ON public.proveedores (empresa_id, es_internacional)
  WHERE es_internacional = TRUE;

COMMENT ON COLUMN public.proveedores.es_internacional IS
  'TRUE = proveedor del exterior (fabricante/distribuidor internacional). FALSE = proveedor local.';
