-- Inserta el parámetro iva_pct_default (15%) para todas las empresas existentes.
-- Si ya existe para alguna empresa, no hace nada.
-- El admin puede modificarlo desde Configuración > Parámetros sin tocar código.
INSERT INTO parametros_sistema (empresa_id, clave, valor, descripcion)
SELECT
  e.id,
  'iva_pct_default',
  '15',
  'Porcentaje de IVA por defecto para nuevas facturas (editable según tarifa vigente)'
FROM empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM parametros_sistema p
  WHERE p.empresa_id = e.id AND p.clave = 'iva_pct_default'
);
