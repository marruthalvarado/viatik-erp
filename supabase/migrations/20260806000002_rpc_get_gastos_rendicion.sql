-- =============================================================================
-- RPC: fn_get_gastos_rendicion
-- =============================================================================
-- PROBLEMA: SELECT en la tabla gastos retorna 0 filas desde el frontend,
-- aunque los gastos existen (fn_actualizar_totales_rendicion los ve y actualiza
-- total_facturado correctamente).
--
-- CAUSA: RLS en gastos bloquea el SELECT. auth_es_miembro_activo() puede estar
-- fallando silenciosamente por alguna inconsistencia en empresas_usuarios.
--
-- SOLUCIÓN: Igual que fn_actualizar_totales_rendicion, crear una función
-- SECURITY DEFINER que bypasea RLS. La función verifica permisos internamente:
-- el llamador debe ser propietario de la rendición, su aprobador, o miembro
-- activo de la empresa. Si ninguna condición se cumple devuelve vacío.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_get_gastos_rendicion(p_rendicion_id uuid)
RETURNS SETOF json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT row_to_json(t)
  FROM (
    SELECT
      g.*,
      to_jsonb(cg) AS categorias_gasto
    FROM gastos g
    LEFT JOIN categorias_gasto cg ON cg.id = g.categoria_gasto_id
    WHERE g.rendicion_id = p_rendicion_id
      AND g.deleted_at   IS NULL
      AND (
        -- Ruta 1: miembro activo de la empresa
        auth_es_miembro_activo(g.empresa_id)
        OR
        -- Ruta 2: propietario o aprobador de la rendición
        EXISTS (
          SELECT 1
          FROM rendiciones r
          WHERE r.id = p_rendicion_id
            AND (r.usuario_id = auth.uid() OR r.aprobador_id = auth.uid())
        )
      )
    ORDER BY g.fecha
  ) t;
$$;

-- Revocar acceso público y otorgar solo a authenticated
REVOKE ALL ON FUNCTION fn_get_gastos_rendicion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_get_gastos_rendicion(uuid) TO authenticated;
