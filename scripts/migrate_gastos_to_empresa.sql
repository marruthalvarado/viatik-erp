-- =============================================================================
-- SCRIPT MANUAL: Migrar gastos de rendiciones → gastos_empresa
--
-- PROPÓSITO: Copia todos los gastos activos de la tabla `gastos` (vinculados
-- a rendiciones de viaje) a la tabla `gastos_empresa` y luego los elimina
-- con soft-delete (deleted_at) de la tabla original.
--
-- USO: Ejecutar desde Supabase Dashboard → SQL Editor
--      https://supabase.com/dashboard/project/<project-id>/sql
--
-- IMPORTANTE: Esta operación es irreversible. Antes de ejecutar:
--   1. Verifica que los gastos a migrar son correctos con el SELECT previo
--   2. Haz un backup si lo necesitas
--
-- NOTAS de mapeo:
--   gastos.valor_factura   → gastos_empresa.total (y subtotal; sin desglose IVA)
--   gastos.numero_documento → gastos_empresa.clave_acceso
--   gastos.observaciones   → gastos_empresa.observacion (con nota de la rendición origen)
--   categoria.es_deducible → gastos_empresa.es_deducible (heredado de la categoría)
--   rendicion.proyecto_id  → gastos_empresa.proyecto_id
-- =============================================================================


-- ─── PASO 0: Verificación previa (ejecuta esto primero para revisar) ─────────

SELECT
  COUNT(*)                                   AS total_gastos_a_migrar,
  SUM(COALESCE(g.valor_factura, 0))          AS total_importe,
  COUNT(DISTINCT g.empresa_id)               AS empresas_afectadas
FROM gastos g
WHERE g.deleted_at IS NULL;


-- ─── PASO 1: Copiar a gastos_empresa ─────────────────────────────────────────
-- Descomenta y ejecuta cuando estés listo.

/*
INSERT INTO gastos_empresa (
  empresa_id,
  fecha,
  categoria_id,
  proveedor_id,
  descripcion,
  subtotal,
  iva,
  total,
  clave_acceso,
  observacion,
  proyecto_id,
  es_deducible,
  created_at
)
SELECT
  g.empresa_id,
  COALESCE(g.fecha::date, CURRENT_DATE),
  g.categoria_gasto_id,
  g.proveedor_id,
  COALESCE(g.descripcion, 'Gasto importado'),
  COALESCE(g.valor_factura, 0),   -- subtotal = total (sin desglose de IVA disponible)
  0,                               -- IVA desconocido; ajusta manualmente si es necesario
  COALESCE(g.valor_factura, 0),
  g.numero_documento,
  CASE
    WHEN g.observaciones IS NOT NULL
      THEN g.observaciones || ' [Rendición: ' || COALESCE(r.numero::text, g.rendicion_id::text) || ']'
    ELSE '[Rendición: ' || COALESCE(r.numero::text, g.rendicion_id::text) || ']'
  END,
  r.proyecto_id,
  COALESCE(cg.es_deducible, TRUE),
  COALESCE(g.created_at::timestamptz, now())
FROM gastos g
LEFT JOIN rendiciones      r  ON r.id  = g.rendicion_id
LEFT JOIN categorias_gasto cg ON cg.id = g.categoria_gasto_id
WHERE g.deleted_at IS NULL;
*/


-- ─── PASO 2: Verificar que se copiaron correctamente ─────────────────────────
-- Ejecuta esto después del INSERT para confirmar los conteos.

/*
SELECT
  (SELECT COUNT(*) FROM gastos_empresa WHERE deleted_at IS NULL)  AS total_en_gastos_empresa,
  (SELECT COUNT(*) FROM gastos       WHERE deleted_at IS NULL)     AS total_en_gastos_originales;
*/


-- ─── PASO 3: Soft-delete de los gastos originales ─────────────────────────────
-- Solo ejecutar si el PASO 2 confirma que la copia fue exitosa.

/*
UPDATE gastos
SET deleted_at = now()
WHERE deleted_at IS NULL;
*/


-- ─── PASO 4: Verificación final ───────────────────────────────────────────────

/*
SELECT
  (SELECT COUNT(*) FROM gastos_empresa WHERE deleted_at IS NULL)  AS gastos_empresa_activos,
  (SELECT COUNT(*) FROM gastos       WHERE deleted_at IS NULL)     AS gastos_originales_activos;
-- Esperado: gastos_empresa_activos > 0, gastos_originales_activos = 0
*/
