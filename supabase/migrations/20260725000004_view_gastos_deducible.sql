-- =============================================================================
-- Migración: extender vw_rpt_gastos_detalle con campos de deducibilidad
-- y código contable de la categoría.
-- =============================================================================

CREATE OR REPLACE VIEW vw_rpt_gastos_detalle AS
SELECT
  g.id,
  g.fecha,
  g.rendicion_id,
  r.numero                                                          AS rendicion_numero,
  r.proyecto_id,
  p.nombre                                                          AS proyecto_nombre,
  cg.nombre                                                         AS categoria_nombre,
  cg.id                                                             AS categoria_gasto_id,
  cg.es_deducible                                                   AS categoria_es_deducible,
  cg.codigo_contable                                                AS categoria_codigo_contable,
  pv.nombre                                                         AS proveedor_nombre,
  pv.id                                                             AS proveedor_id,
  g.valor_factura,
  g.valor_reembolsable,
  g.valor_moneda_base,
  g.valor_moneda_origen,
  g.moneda_codigo,
  g.tipo_cambio,
  g.numero_documento,
  g.es_manual,
  eg.codigo                                                         AS estado_codigo,
  og.nombre                                                         AS origen_nombre,
  g.empresa_id,
  g.created_at,
  g.observaciones
FROM gastos g
LEFT JOIN rendiciones      r  ON r.id  = g.rendicion_id
LEFT JOIN proyectos        p  ON p.id  = r.proyecto_id
LEFT JOIN categorias_gasto cg ON cg.id = g.categoria_gasto_id
LEFT JOIN proveedores      pv ON pv.id = g.proveedor_id
LEFT JOIN estados_gasto    eg ON eg.id = g.estado_gasto_id
LEFT JOIN origenes_gasto   og ON og.id = g.origen_gasto_id
WHERE g.deleted_at IS NULL;

ALTER VIEW vw_rpt_gastos_detalle OWNER TO postgres;
