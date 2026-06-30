-- 20240708000000_storage_allow_xml.sql
--
-- Agrega application/xml y text/xml a los MIME types permitidos
-- en el bucket "documentos" para soportar facturas electronicas XML (CFDI, UBL).

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/xml',
  'text/xml'
]
WHERE id = 'documentos';
