-- =============================================================================
-- VISTAS: vw_dashboard_*
-- Problema: las 5 vistas del Dashboard Ejecutivo están referenciadas en
--   database.ts y en src/services/dashboard.ts pero NUNCA fueron creadas
--   en ninguna migración → todos los KPIs devuelven null/vacío.
--
-- Diseño:
--   · Cada vista agrega datos por empresa.
--   · Se usan LEFT JOIN para no perder empresas sin movimiento.
--   · RLS en las tablas base (gastos, rendiciones, etc.) protege el acceso.
--   · Las vistas heredan RLS de las tablas base (SECURITY INVOKER por defecto).
--   · El filtro empresa_id en el SELECT del cliente garantiza el scoping.
-- =============================================================================

-- DROP previo necesario: CREATE OR REPLACE VIEW no puede renombrar columnas.
-- Las vistas son recreadas desde cero; CASCADE elimina dependencias en cadena.
DROP VIEW IF EXISTS vw_dashboard_ia CASCADE;
DROP VIEW IF EXISTS vw_dashboard_proveedores CASCADE;
DROP VIEW IF EXISTS vw_dashboard_clientes CASCADE;
DROP VIEW IF EXISTS vw_dashboard_proyectos CASCADE;
DROP VIEW IF EXISTS vw_dashboard_ejecutivo CASCADE;

-- =============================================================================
-- vw_dashboard_ejecutivo
-- KPIs globales de la empresa: totales de gastos, rendiciones, anticipos,
-- proyectos activos y viajeros con movimiento.
-- Columnas según database.ts:
--   empresa_id, total_anticipos, total_gastado, total_proyectos_con_movimiento,
--   total_reembolsable, total_rendiciones, total_usuarios_con_movimiento
-- =============================================================================
CREATE OR REPLACE VIEW vw_dashboard_ejecutivo AS
SELECT
  r.empresa_id,
  COALESCE(SUM(r.total_facturado)    FILTER (WHERE r.deleted_at IS NULL), 0)   AS total_gastado,
  COALESCE(SUM(r.total_reembolsable) FILTER (WHERE r.deleted_at IS NULL), 0)   AS total_reembolsable,
  COUNT(r.id)                        FILTER (WHERE r.deleted_at IS NULL)        AS total_rendiciones,
  COUNT(DISTINCT r.proyecto_id)      FILTER (WHERE r.deleted_at IS NULL
                                              AND r.proyecto_id IS NOT NULL)    AS total_proyectos_con_movimiento,
  COUNT(DISTINCT r.usuario_id)       FILTER (WHERE r.deleted_at IS NULL)        AS total_usuarios_con_movimiento,
  COALESCE((
    SELECT SUM(a.valor)
    FROM   anticipos a
    WHERE  a.empresa_id = r.empresa_id
  ), 0)                                                                          AS total_anticipos
FROM rendiciones r
GROUP BY r.empresa_id;

-- =============================================================================
-- vw_dashboard_proyectos
-- Resumen financiero por proyecto: presupuesto vs. gasto real.
-- Columnas: empresa_id, proyecto_id, nombre, presupuesto, gasto_real,
--           saldo_presupuesto, margen_estimado, valor_contrato
-- =============================================================================
CREATE OR REPLACE VIEW vw_dashboard_proyectos AS
SELECT
  p.empresa_id,
  p.id                                                            AS proyecto_id,
  p.nombre,
  COALESCE(p.presupuesto, 0)                                      AS presupuesto,
  COALESCE(p.valor_contrato, 0)                                   AS valor_contrato,
  COALESCE(SUM(g.valor_factura) FILTER (WHERE g.deleted_at IS NULL), 0)
                                                                  AS gasto_real,
  COALESCE(p.presupuesto, 0)
    - COALESCE(SUM(g.valor_factura) FILTER (WHERE g.deleted_at IS NULL), 0)
                                                                  AS saldo_presupuesto,
  CASE
    WHEN COALESCE(p.valor_contrato, 0) > 0
    THEN ROUND(
      (COALESCE(p.valor_contrato, 0)
       - COALESCE(SUM(g.valor_factura) FILTER (WHERE g.deleted_at IS NULL), 0)
      ) / p.valor_contrato * 100, 2)
    ELSE NULL
  END                                                             AS margen_estimado
FROM proyectos p
LEFT JOIN gastos g ON g.empresa_id = p.empresa_id
                   AND g.rendicion_id IN (
                     SELECT id FROM rendiciones r
                     WHERE r.proyecto_id = p.id
                       AND r.deleted_at  IS NULL
                   )
WHERE p.deleted_at IS NULL
GROUP BY p.empresa_id, p.id, p.nombre, p.presupuesto, p.valor_contrato;

-- =============================================================================
-- vw_dashboard_clientes
-- Totales de gasto, rendiciones y proyectos por cliente.
-- Columnas: empresa_id, cliente_id, cliente, total_gastado,
--           total_rendiciones, total_proyectos
-- =============================================================================
CREATE OR REPLACE VIEW vw_dashboard_clientes AS
SELECT
  p.empresa_id,
  c.id                                                         AS cliente_id,
  c.nombre                                                     AS cliente,
  COALESCE(SUM(g.valor_factura) FILTER (WHERE g.deleted_at IS NULL), 0)
                                                               AS total_gastado,
  COUNT(DISTINCT r.id)   FILTER (WHERE r.deleted_at IS NULL)  AS total_rendiciones,
  COUNT(DISTINCT p.id)                                         AS total_proyectos
FROM clientes c
JOIN proyectos p   ON p.cliente_id = c.id AND p.deleted_at IS NULL
LEFT JOIN rendiciones r ON r.proyecto_id = p.id
LEFT JOIN gastos g      ON g.rendicion_id = r.id
WHERE c.deleted_at IS NULL
GROUP BY p.empresa_id, c.id, c.nombre;

-- =============================================================================
-- vw_dashboard_proveedores
-- Totales de gasto y cantidad de gastos por proveedor.
-- Columnas: empresa_id, id, nombre, total_gastado, cantidad_gastos
-- =============================================================================
CREATE OR REPLACE VIEW vw_dashboard_proveedores AS
SELECT
  pv.empresa_id,
  pv.id,
  pv.nombre,
  COALESCE(SUM(g.valor_factura) FILTER (WHERE g.deleted_at IS NULL), 0) AS total_gastado,
  COUNT(g.id)             FILTER (WHERE g.deleted_at IS NULL)            AS cantidad_gastos
FROM proveedores pv
LEFT JOIN gastos g ON g.proveedor_id = pv.id
                   AND g.empresa_id  = pv.empresa_id
WHERE pv.deleted_at IS NULL
GROUP BY pv.empresa_id, pv.id, pv.nombre;

-- =============================================================================
-- vw_dashboard_ia
-- Score promedio y total de auditorías IA por empresa.
-- Columnas: empresa_id, score_promedio, total_auditorias
-- =============================================================================
CREATE OR REPLACE VIEW vw_dashboard_ia AS
SELECT
  ai.empresa_id,
  ROUND(AVG(ai.score)::numeric, 1) AS score_promedio,
  COUNT(ai.id)                      AS total_auditorias
FROM auditorias_ia ai
GROUP BY ai.empresa_id;
