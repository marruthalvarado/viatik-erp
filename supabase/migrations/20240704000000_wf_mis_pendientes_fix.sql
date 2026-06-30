-- =============================================================================
-- FIX: wf_mis_pendientes — "structure of query does not match function result type"
-- Causa: la función en la BD fue modificada manualmente (Dashboard) y su
--   RETURNS TABLE quedó inconsistente con el SELECT interno.
-- Solución: DROP + CREATE para forzar la sincronización del tipo de retorno.
--   CREATE OR REPLACE no puede cambiar el RETURNS TABLE de una función existente.
-- =============================================================================

DROP FUNCTION IF EXISTS wf_mis_pendientes(uuid, uuid);

CREATE OR REPLACE FUNCTION wf_mis_pendientes(
  p_usuario_id  uuid,
  p_empresa_id  uuid
)
RETURNS TABLE(
  rendicion_id        uuid,
  numero              text,
  descripcion         text,
  proyecto_id         uuid,
  total_facturado     numeric,
  total_reembolsable  numeric,
  fecha_rendicion     date,
  fecha_envio         timestamptz,
  estado_codigo       text,
  estado_nombre       text,
  paso_nombre         text,
  paso_orden          integer,
  usuario_nombre      text,
  workflow_paso_id    uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid;
  v_rol_id uuid;
BEGIN
  -- [SEC-1] Identidad real del caller
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Obtener rol del usuario autenticado en la empresa
  -- (p_usuario_id se mantiene por compatibilidad de firma pero se ignora)
  SELECT eu.rol_id
    INTO v_rol_id
    FROM empresas_usuarios eu
   WHERE eu.usuario_id = v_uid
     AND eu.empresa_id = p_empresa_id
     AND eu.activo     = true
   LIMIT 1;

  IF v_rol_id IS NULL THEN
    RETURN;  -- sin rol en esta empresa → bandeja vacía
  END IF;

  RETURN QUERY
  SELECT
    r.id                                                           AS rendicion_id,
    r.numero::text                                                 AS numero,
    r.descripcion                                                  AS descripcion,
    r.proyecto_id                                                  AS proyecto_id,
    r.total_facturado                                              AS total_facturado,
    r.total_reembolsable                                           AS total_reembolsable,
    r.fecha_rendicion::date                                        AS fecha_rendicion,
    r.fecha_envio                                                  AS fecha_envio,
    er.codigo::text                                                AS estado_codigo,
    er.nombre::text                                                AS estado_nombre,
    wp.nombre::text                                                AS paso_nombre,
    wp.orden                                                       AS paso_orden,
    TRIM(u.nombres::text || ' ' || COALESCE(u.apellidos::text, '')) AS usuario_nombre,
    wp.id                                                          AS workflow_paso_id
  FROM rendiciones r
  JOIN estados_rendicion er    ON er.id = r.estado_rendicion_id
  JOIN usuarios u              ON u.id  = r.usuario_id
  JOIN workflow_pasos wp       ON wp.workflow_id = r.workflow_id
  JOIN workflows_aprobacion wa ON wa.id = r.workflow_id AND wa.activo = true
  WHERE r.empresa_id = p_empresa_id
    AND er.codigo IN ('enviada', 'en_revision')
    AND wp.rol_id   = v_rol_id
    -- Este paso aún no fue aprobado
    AND NOT EXISTS (
      SELECT 1
        FROM aprobaciones a
        JOIN acciones_aprobacion aa ON aa.id = a.accion_id
       WHERE a.rendicion_id     = r.id
         AND a.workflow_paso_id = wp.id
         AND aa.codigo          = 'aprobar'
    )
    -- Todos los pasos anteriores están aprobados
    AND NOT EXISTS (
      SELECT 1
        FROM workflow_pasos wp_prev
       WHERE wp_prev.workflow_id = r.workflow_id
         AND wp_prev.orden < wp.orden
         AND NOT EXISTS (
           SELECT 1
             FROM aprobaciones a2
             JOIN acciones_aprobacion aa2 ON aa2.id = a2.accion_id
            WHERE a2.rendicion_id     = r.id
              AND a2.workflow_paso_id = wp_prev.id
              AND aa2.codigo          = 'aprobar'
         )
    )
  ORDER BY r.fecha_envio ASC NULLS LAST;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'wf_mis_pendientes error: %', SQLERRM;
END;
$$;
