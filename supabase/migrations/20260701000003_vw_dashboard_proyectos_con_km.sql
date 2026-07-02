-- =============================================================================
-- MIGRATION: actualizar vw_dashboard_proyectos para usar rendiciones.total_facturado
-- gasto_real ahora incluye km vehiculo propio y filtro de politica
-- (consistente con fn_actualizar_totales_rendicion actualizada en 20260701000000)
-- =============================================================================

CREATE OR REPLACE VIEW vw_dashboard_proyectos AS
SELECT
  p.empresa_id,
  p.id                              AS proyecto_id,
  p.nombre,
  COALESCE(p.presupuesto, 0)        AS presupuesto,
  COALESCE(p.valor_contrato, 0)     AS valor_contrato,
  COALESCE(SUM(r.total_facturado) FILTER (WHERE r.deleted_at IS NULL), 0)
                                    AS gasto_real,
  COALESCE(p.presupuesto, 0)
    - COALESCE(SUM(r.total_facturado) FILTER (WHERE r.deleted_at IS NULL), 0)
                                    AS saldo_presupuesto,
  CASE
    WHEN COALESCE(p.valor_contrato, 0) > 0
    THEN ROUND(
      (COALESCE(p.valor_contrato, 0)
       - COALESCE(SUM(r.total_facturado) FILTER (WHERE r.deleted_at IS NULL), 0)
      ) / p.valor_contrato * 100, 2)
    ELSE NULL
  END                               AS margen_estimado
FROM proyectos p
LEFT JOIN rendiciones r ON r.proyecto_id = p.id
                       AND r.empresa_id  = p.empresa_id
GROUP BY p.empresa_id, p.id, p.nombre, p.presupuesto, p.valor_contrato;
