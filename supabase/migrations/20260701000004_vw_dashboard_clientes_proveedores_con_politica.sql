-- =============================================================================
-- MIGRATION: aplicar filtro de política en vw_dashboard_clientes y
-- vw_dashboard_proveedores, igual que fn_actualizar_totales_rendicion.
--
-- vw_dashboard_clientes  → usa SUM(r.total_facturado) por cliente
--   (rendicion.total_facturado ya incluye: gastos filtrados + km propio + km ciudad)
--
-- vw_dashboard_proveedores → aplica CASE combustible/peajes por gasto,
--   usando la política de la rendición (o la primera política de la empresa
--   como fallback, igual que el trigger).
-- =============================================================================

-- ─── 1. vw_dashboard_clientes ─────────────────────────────────────────────────
-- Usa total_facturado de rendiciones en lugar de SUM(gastos.valor_factura)
-- para que incluya km vehículo propio y el filtro de política.
CREATE OR REPLACE VIEW vw_dashboard_clientes AS
SELECT
  p.empresa_id,
  c.id                                                          AS cliente_id,
  c.nombre                                                      AS cliente,
  COALESCE(SUM(r.total_facturado) FILTER (WHERE r.deleted_at IS NULL), 0)
                                                                AS total_gastado,
  COUNT(DISTINCT r.id)  FILTER (WHERE r.deleted_at IS NULL)    AS total_rendiciones,
  COUNT(DISTINCT p.id)                                          AS total_proyectos
FROM clientes c
JOIN proyectos p       ON p.cliente_id = c.id AND p.deleted_at IS NULL
LEFT JOIN rendiciones r ON r.proyecto_id = p.id
WHERE c.deleted_at IS NULL
GROUP BY p.empresa_id, c.id, c.nombre;

-- ─── 2. vw_dashboard_proveedores ──────────────────────────────────────────────
-- Aplica la misma lógica de política que fn_actualizar_totales_rendicion:
--   - paga_combustible = false  →  valor 0 para gastos de categoría Combustible
--   - paga_peajes = false       →  valor 0 para gastos de categoría Peaje
-- Usa la política de la rendición; si no tiene, la primera política de la empresa.
CREATE OR REPLACE VIEW vw_dashboard_proveedores AS
WITH empresa_politica AS (
  -- Política por defecto de cada empresa (la más antigua, igual que el trigger)
  SELECT DISTINCT ON (empresa_id)
    empresa_id,
    paga_combustible,
    paga_peajes
  FROM politicas
  WHERE deleted_at IS NULL
  ORDER BY empresa_id, created_at
),
gasto_politica AS (
  -- Resolver la política efectiva de cada gasto
  SELECT
    g.id            AS gasto_id,
    g.proveedor_id,
    g.empresa_id,
    g.deleted_at,
    COALESCE(cg.nombre, '') AS categoria_nombre,
    CASE
      WHEN g.deleted_at IS NOT NULL THEN 0
      WHEN COALESCE(pol_r.paga_combustible, ep.paga_combustible) = false
           AND LOWER(COALESCE(cg.nombre, '')) = 'combustible' THEN 0
      WHEN COALESCE(pol_r.paga_peajes, ep.paga_peajes) = false
           AND LOWER(COALESCE(cg.nombre, '')) = 'peaje' THEN 0
      ELSE COALESCE(g.valor_factura, 0)
    END AS valor_efectivo
  FROM gastos g
  LEFT JOIN rendiciones r         ON r.id = g.rendicion_id
  LEFT JOIN politicas pol_r       ON pol_r.id = r.politica_id
  LEFT JOIN empresa_politica ep   ON ep.empresa_id = g.empresa_id
  LEFT JOIN categorias_gasto cg   ON cg.id = g.categoria_gasto_id
)
SELECT
  pv.empresa_id,
  pv.id,
  pv.nombre,
  COALESCE(SUM(gp.valor_efectivo), 0)             AS total_gastado,
  COUNT(gp.gasto_id) FILTER (WHERE gp.deleted_at IS NULL) AS cantidad_gastos
FROM proveedores pv
LEFT JOIN gasto_politica gp ON gp.proveedor_id = pv.id
                            AND gp.empresa_id  = pv.empresa_id
WHERE pv.deleted_at IS NULL
GROUP BY pv.empresa_id, pv.id, pv.nombre;
