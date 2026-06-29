-- 20240707000000_documentos_rendicion_nullable.sql
--
-- Objetivo: Permitir documentos sin rendición asignada.
-- La columna rendicion_id era NOT NULL, lo que impedía subir facturas
-- desde el wizard IA sin seleccionar una rendición primero.
--
-- Impacto: ninguno en datos existentes. Los documentos ya vinculados
-- conservan su rendicion_id. Solo se elimina la restricción NOT NULL.

ALTER TABLE documentos
  ALTER COLUMN rendicion_id DROP NOT NULL;
