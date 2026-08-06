-- =============================================================================
-- Multi-rol por usuario en empresa
-- =============================================================================
-- Problema: un usuario solo puede tener UN rol en empresas_usuarios. En empresas
-- pequeñas (ej. Protonmedical) la misma persona necesita actuar como Aprobador
-- y como Financiero en el workflow de rendiciones.
--
-- Solución: agregar columna roles_adicionales uuid[] en empresas_usuarios.
-- Los checks de rol en los RPCs de workflow (wf_mis_pendientes,
-- wf_registrar_accion) y liquidación (rendir_liquidar) pasan a considerar
-- tanto rol_id (primario) como roles_adicionales.
-- =============================================================================

-- ─── 1. Columna roles_adicionales ─────────────────────────────────────────────

ALTER TABLE empresas_usuarios
  ADD COLUMN IF NOT EXISTS roles_adicionales uuid[] DEFAULT ARRAY[]::uuid[];

-- ─── 2. RPC admin para actualizar roles adicionales ──────────────────────────

CREATE OR REPLACE FUNCTION admin_set_roles_adicionales(
  p_eu_id uuid,
  p_roles uuid[]     -- array de rol_ids adicionales (puede ser vacío)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  -- Obtener empresa del registro eu
  SELECT empresa_id INTO v_empresa_id FROM empresas_usuarios WHERE id = p_eu_id;
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Registro de usuario-empresa no encontrado'; END IF;

  -- Verificar que el caller es admin de esa empresa
  IF NOT EXISTS (
    SELECT 1 FROM empresas_usuarios eu
    JOIN roles r ON r.id = eu.rol_id
    WHERE eu.empresa_id = v_empresa_id
      AND eu.usuario_id = auth.uid()
      AND eu.activo = true
      AND r.codigo = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo el administrador puede modificar roles';
  END IF;

  -- Limpiar duplicados y quitar el rol primario del array si está incluido
  UPDATE empresas_usuarios SET
    roles_adicionales = (
      SELECT COALESCE(array_agg(DISTINCT r_id), ARRAY[]::uuid[])
      FROM unnest(COALESCE(p_roles, ARRAY[]::uuid[])) AS r_id
      WHERE r_id <> empresas_usuarios.rol_id
    )
  WHERE id = p_eu_id;
END;
$$;

REVOKE ALL ON FUNCTION admin_set_roles_adicionales(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_set_roles_adicionales(uuid, uuid[]) TO authenticated;

-- ─── 3. wf_mis_pendientes — reconoce roles adicionales ───────────────────────

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
  v_uid       uuid;
  v_roles_ids uuid[];
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  -- Todos los roles del usuario: primario + adicionales
  SELECT ARRAY[eu.rol_id] || COALESCE(eu.roles_adicionales, ARRAY[]::uuid[])
    INTO v_roles_ids
    FROM empresas_usuarios eu
   WHERE eu.usuario_id = v_uid
     AND eu.empresa_id = p_empresa_id
     AND eu.activo     = true
   LIMIT 1;

  IF v_roles_ids IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id                                                    AS rendicion_id,
    r.numero                                                AS numero,
    r.descripcion                                           AS descripcion,
    r.proyecto_id                                           AS proyecto_id,
    r.total_facturado                                       AS total_facturado,
    r.total_reembolsable                                    AS total_reembolsable,
    r.fecha_rendicion::date                                 AS fecha_rendicion,
    r.fecha_envio                                           AS fecha_envio,
    er.codigo                                               AS estado_codigo,
    er.nombre                                               AS estado_nombre,
    wp.nombre::text                                         AS paso_nombre,
    wp.orden                                                AS paso_orden,
    TRIM(u.nombres || ' ' || COALESCE(u.apellidos, ''))    AS usuario_nombre,
    wp.id                                                   AS workflow_paso_id
  FROM rendiciones r
  JOIN estados_rendicion er   ON er.id = r.estado_rendicion_id
  JOIN usuarios u             ON u.id  = r.usuario_id
  JOIN workflow_pasos wp      ON wp.workflow_id = r.workflow_id
  JOIN workflows_aprobacion wa ON wa.id = r.workflow_id AND wa.activo = true
  WHERE r.empresa_id = p_empresa_id
    AND er.codigo IN ('enviada', 'en_revision')
    -- El paso requiere uno de los roles del usuario
    AND wp.rol_id = ANY(v_roles_ids)
    -- El usuario no es el propietario de la rendición
    AND r.usuario_id <> v_uid
    -- Este paso aún no fue aprobado
    AND NOT EXISTS (
      SELECT 1
        FROM aprobaciones a
        JOIN acciones_aprobacion aa ON aa.id = a.accion_id
       WHERE a.rendicion_id     = r.id
         AND a.workflow_paso_id = wp.id
         AND aa.codigo          = 'aprobar'
    )
    -- Los pasos anteriores ya fueron aprobados (no saltar pasos)
    AND NOT EXISTS (
      SELECT 1
        FROM workflow_pasos wp2
       WHERE wp2.workflow_id = r.workflow_id
         AND wp2.orden < wp.orden
         AND NOT EXISTS (
           SELECT 1
             FROM aprobaciones a2
             JOIN acciones_aprobacion aa2 ON aa2.id = a2.accion_id
            WHERE a2.rendicion_id     = r.id
              AND a2.workflow_paso_id = wp2.id
              AND aa2.codigo          = 'aprobar'
         )
    )
  ORDER BY r.fecha_envio;
END;
$$;

GRANT EXECUTE ON FUNCTION wf_mis_pendientes(uuid, uuid) TO authenticated;

-- ─── 4. wf_registrar_accion — reconoce roles adicionales ─────────────────────

CREATE OR REPLACE FUNCTION wf_registrar_accion(
  p_rendicion_id      uuid,
  p_workflow_paso_id  uuid,
  p_accion_codigo     text,
  p_comentario        text,
  p_usuario_id        uuid,
  p_empresa_id        uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rendicion         rendiciones%ROWTYPE;
  v_estado_actual     text;
  v_paso              workflow_pasos%ROWTYPE;
  v_accion_id         uuid;
  v_nuevo_estado_id   uuid;
  v_nuevo_estado_cod  text;
  v_total_pasos       integer;
  v_pasos_aprobados   integer;
  v_detalle           text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autenticado');
  END IF;
  IF auth.uid() <> p_usuario_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Identidad no coincide con el usuario autenticado');
  END IF;

  IF p_accion_codigo NOT IN ('aprobar', 'rechazar', 'devolver') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acción no reconocida: ' || p_accion_codigo);
  END IF;

  SELECT * INTO v_rendicion
    FROM rendiciones
   WHERE id = p_rendicion_id AND empresa_id = p_empresa_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rendición no encontrada');
  END IF;

  IF v_rendicion.usuario_id = p_usuario_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El propietario de la rendición no puede actuar como aprobador');
  END IF;

  SELECT er.codigo INTO v_estado_actual
    FROM estados_rendicion er
   WHERE er.id = v_rendicion.estado_rendicion_id;

  IF v_estado_actual NOT IN ('enviada', 'en_revision') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La rendición no está en estado de revisión');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM workflows_aprobacion
     WHERE id = v_rendicion.workflow_id AND activo = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El workflow de esta rendición ya no está activo');
  END IF;

  SELECT * INTO v_paso
    FROM workflow_pasos
   WHERE id = p_workflow_paso_id AND workflow_id = v_rendicion.workflow_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Paso de workflow no válido para esta rendición');
  END IF;

  IF EXISTS (
    SELECT 1
      FROM aprobaciones a
      JOIN acciones_aprobacion aa ON aa.id = a.accion_id
     WHERE a.rendicion_id     = p_rendicion_id
       AND a.workflow_paso_id = p_workflow_paso_id
       AND aa.codigo IN ('aprobar', 'rechazar')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este paso ya fue procesado');
  END IF;

  IF EXISTS (
    SELECT 1
      FROM workflow_pasos wp_prev
     WHERE wp_prev.workflow_id = v_rendicion.workflow_id
       AND wp_prev.orden < v_paso.orden
       AND NOT EXISTS (
         SELECT 1
           FROM aprobaciones a2
           JOIN acciones_aprobacion aa2 ON aa2.id = a2.accion_id
          WHERE a2.rendicion_id     = p_rendicion_id
            AND a2.workflow_paso_id = wp_prev.id
            AND aa2.codigo          = 'aprobar'
       )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Existen pasos previos pendientes de aprobación');
  END IF;

  -- Verificar rol: primario O adicional debe coincidir con el paso
  IF NOT EXISTS (
    SELECT 1 FROM empresas_usuarios eu
     WHERE eu.usuario_id = p_usuario_id
       AND eu.empresa_id = p_empresa_id
       AND eu.activo     = true
       AND (
         eu.rol_id = v_paso.rol_id
         OR v_paso.rol_id = ANY(COALESCE(eu.roles_adicionales, ARRAY[]::uuid[]))
       )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No tienes permisos para actuar en este paso');
  END IF;

  SELECT id INTO v_accion_id FROM acciones_aprobacion WHERE codigo = p_accion_codigo LIMIT 1;
  IF v_accion_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acción no configurada en la BD');
  END IF;

  INSERT INTO aprobaciones (rendicion_id, workflow_paso_id, usuario_id, accion_id, comentario, created_at)
  VALUES (p_rendicion_id, p_workflow_paso_id, p_usuario_id, v_accion_id, NULLIF(TRIM(COALESCE(p_comentario, '')), ''), NOW());

  IF p_accion_codigo = 'rechazar' THEN
    SELECT id INTO v_nuevo_estado_id FROM estados_rendicion WHERE codigo = 'rechazada';
    v_nuevo_estado_cod := 'rechazada';
    v_detalle := 'Estado: ' || v_estado_actual || ' → rechazada. Paso ' || v_paso.orden::text
              || CASE WHEN p_comentario IS NOT NULL AND TRIM(p_comentario) <> '' THEN '. Motivo: ' || TRIM(p_comentario) ELSE '' END;

  ELSIF p_accion_codigo = 'devolver' THEN
    SELECT id INTO v_nuevo_estado_id FROM estados_rendicion WHERE codigo = 'devuelta';
    v_nuevo_estado_cod := 'devuelta';
    v_detalle := 'Estado: ' || v_estado_actual || ' → devuelta. Paso ' || v_paso.orden::text
              || CASE WHEN p_comentario IS NOT NULL AND TRIM(p_comentario) <> '' THEN '. Motivo: ' || TRIM(p_comentario) ELSE '' END;

  ELSE  -- aprobar
    SELECT COUNT(*) INTO v_total_pasos
      FROM workflow_pasos WHERE workflow_id = v_rendicion.workflow_id;

    SELECT COUNT(*) INTO v_pasos_aprobados
      FROM aprobaciones ap2
      JOIN acciones_aprobacion aa3 ON aa3.id = ap2.accion_id
     WHERE ap2.rendicion_id = p_rendicion_id AND aa3.codigo = 'aprobar';

    IF v_pasos_aprobados >= v_total_pasos THEN
      SELECT id INTO v_nuevo_estado_id FROM estados_rendicion WHERE codigo = 'aprobada';
      v_nuevo_estado_cod := 'aprobada';
    ELSE
      SELECT id INTO v_nuevo_estado_id FROM estados_rendicion WHERE codigo = 'en_revision';
      v_nuevo_estado_cod := 'en_revision';
    END IF;

    v_detalle := 'Estado: ' || v_estado_actual || ' → ' || v_nuevo_estado_cod
              || '. Paso ' || v_paso.orden::text || ' aprobado (' || v_pasos_aprobados::text
              || '/' || v_total_pasos::text || ' completados).';

    -- Notificar aprobadores del siguiente paso
    IF v_nuevo_estado_cod = 'en_revision' THEN
      INSERT INTO notificaciones (empresa_id, usuario_id, titulo, mensaje, leida, created_at)
      SELECT
        p_empresa_id,
        eu2.usuario_id,
        'Rendición pendiente de aprobación',
        'La rendición ' || v_rendicion.numero || ' requiere tu aprobación en: '
          || (SELECT nombre FROM workflow_pasos WHERE workflow_id = v_rendicion.workflow_id AND orden = v_paso.orden + 1 LIMIT 1),
        false,
        NOW()
      FROM empresas_usuarios eu2
      WHERE eu2.empresa_id = p_empresa_id
        AND eu2.activo     = true
        AND eu2.usuario_id <> p_usuario_id
        AND (
          eu2.rol_id = (SELECT rol_id FROM workflow_pasos WHERE workflow_id = v_rendicion.workflow_id AND orden = v_paso.orden + 1 LIMIT 1)
          OR (SELECT rol_id FROM workflow_pasos WHERE workflow_id = v_rendicion.workflow_id AND orden = v_paso.orden + 1 LIMIT 1)
             = ANY(COALESCE(eu2.roles_adicionales, ARRAY[]::uuid[]))
        );
    END IF;
  END IF;

  UPDATE rendiciones SET
    estado_rendicion_id = v_nuevo_estado_id,
    updated_at          = NOW()
  WHERE id = p_rendicion_id;

  INSERT INTO historial_workflow (empresa_id, rendicion_id, usuario_id, evento, detalle, created_at)
  VALUES (p_empresa_id, p_rendicion_id, p_usuario_id, p_accion_codigo, v_detalle, NOW());

  RETURN jsonb_build_object(
    'ok',           true,
    'nuevo_estado', v_nuevo_estado_cod,
    'detalle',      v_detalle
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Error interno: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION wf_registrar_accion(uuid, uuid, text, text, uuid, uuid) TO authenticated;

-- ─── 5. rendir_liquidar — reconoce roles adicionales ─────────────────────────

CREATE OR REPLACE FUNCTION public.rendir_liquidar(p_rendicion_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_empresa_id    uuid;
  v_estado_actual text;
  v_estado_id     uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT r.empresa_id, er.codigo
    INTO v_empresa_id, v_estado_actual
    FROM rendiciones r
    LEFT JOIN estados_rendicion er ON er.id = r.estado_rendicion_id
   WHERE r.id = p_rendicion_id AND r.deleted_at IS NULL
   FOR UPDATE;

  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Rendición no encontrada'; END IF;

  IF v_estado_actual <> 'aprobada' THEN
    RAISE EXCEPTION 'La rendición debe estar aprobada para liquidar (estado actual: %)', v_estado_actual;
  END IF;

  -- Verificar rol financiero o admin (primario o adicional)
  IF NOT EXISTS (
    SELECT 1 FROM empresas_usuarios eu
    JOIN roles r ON r.id = eu.rol_id
    WHERE eu.empresa_id = v_empresa_id
      AND eu.usuario_id = auth.uid()
      AND eu.activo = true
      AND r.codigo IN ('financiero', 'admin')
    UNION ALL
    SELECT 1 FROM empresas_usuarios eu
    JOIN roles r ON r.id = ANY(COALESCE(eu.roles_adicionales, ARRAY[]::uuid[]))
    WHERE eu.empresa_id = v_empresa_id
      AND eu.usuario_id = auth.uid()
      AND eu.activo = true
      AND r.codigo IN ('financiero', 'admin')
  ) THEN
    RAISE EXCEPTION 'Solo el rol financiero o administrador puede liquidar rendiciones';
  END IF;

  SELECT id INTO v_estado_id FROM estados_rendicion WHERE codigo = 'liquidada' LIMIT 1;

  UPDATE rendiciones SET
    estado_rendicion_id = v_estado_id,
    liquidado_por       = auth.uid(),
    fecha_liquidacion   = now(),
    updated_at          = now()
  WHERE id = p_rendicion_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rendir_liquidar(UUID) TO authenticated;

-- ─── 6. wf_enviar_aprobacion — notifica usuarios con rol adicional ────────────

CREATE OR REPLACE FUNCTION wf_enviar_aprobacion(
  p_rendicion_id  uuid,
  p_usuario_id    uuid,
  p_empresa_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rendicion         rendiciones%ROWTYPE;
  v_estado_actual     text;
  v_workflow_id       uuid;
  v_estado_enviada_id uuid;
  v_paso1             workflow_pasos%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autenticado');
  END IF;
  IF auth.uid() <> p_usuario_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Identidad no coincide con el usuario autenticado');
  END IF;

  SELECT * INTO v_rendicion
    FROM rendiciones
   WHERE id = p_rendicion_id AND empresa_id = p_empresa_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rendición no encontrada');
  END IF;

  IF v_rendicion.usuario_id <> p_usuario_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo el propietario puede enviar la rendición a aprobación');
  END IF;

  SELECT er.codigo INTO v_estado_actual
    FROM estados_rendicion er
   WHERE er.id = v_rendicion.estado_rendicion_id;

  IF v_estado_actual NOT IN ('borrador', 'devuelta', 'registrada') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La rendición debe estar en borrador, registrada o devuelta para enviarse');
  END IF;

  v_workflow_id := v_rendicion.workflow_id;

  IF v_workflow_id IS NULL THEN
    SELECT id INTO v_workflow_id
      FROM workflows_aprobacion
     WHERE empresa_id = p_empresa_id AND activo = true
     ORDER BY created_at ASC
     LIMIT 1;

    IF v_workflow_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'No existe un workflow activo configurado para esta empresa');
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM workflows_aprobacion
       WHERE id = v_workflow_id AND activo = true
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'El workflow asignado a esta rendición ya no está activo');
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM workflow_pasos WHERE workflow_id = v_workflow_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El workflow no tiene pasos configurados');
  END IF;

  SELECT id INTO v_estado_enviada_id FROM estados_rendicion WHERE codigo = 'enviada';

  UPDATE rendiciones SET
    estado_rendicion_id = v_estado_enviada_id,
    fecha_envio         = NOW(),
    workflow_id         = v_workflow_id,
    updated_at          = NOW()
  WHERE id = p_rendicion_id;

  INSERT INTO historial_workflow (empresa_id, rendicion_id, usuario_id, evento, detalle, created_at)
  VALUES (
    p_empresa_id,
    p_rendicion_id,
    p_usuario_id,
    'enviada',
    'Estado: ' || v_estado_actual || ' → enviada. Rendición enviada a aprobación.',
    NOW()
  );

  SELECT * INTO v_paso1
    FROM workflow_pasos
   WHERE workflow_id = v_workflow_id
   ORDER BY orden ASC
   LIMIT 1;

  -- Notificar usuarios con rol_id del paso1 O roles_adicionales que lo incluyen
  INSERT INTO notificaciones (empresa_id, usuario_id, titulo, mensaje, leida, created_at)
  SELECT DISTINCT
    p_empresa_id,
    eu.usuario_id,
    'Rendición pendiente de aprobación',
    'La rendición ' || v_rendicion.numero || ' requiere tu aprobación en: '
      || COALESCE(v_paso1.nombre, 'Paso ' || v_paso1.orden::text),
    false,
    NOW()
  FROM empresas_usuarios eu
  WHERE eu.empresa_id = p_empresa_id
    AND eu.activo     = true
    AND eu.usuario_id <> p_usuario_id
    AND (
      eu.rol_id = v_paso1.rol_id
      OR v_paso1.rol_id = ANY(COALESCE(eu.roles_adicionales, ARRAY[]::uuid[]))
    );

  RETURN jsonb_build_object(
    'ok',           true,
    'nuevo_estado', 'enviada',
    'workflow_id',  v_workflow_id::text
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Error interno: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION wf_enviar_aprobacion(uuid, uuid, uuid) TO authenticated;

-- ─── 7. Actualizar vw_empresa_usuarios para exponer roles_adicionales ─────────

CREATE OR REPLACE VIEW vw_empresa_usuarios AS
SELECT
  eu.id,
  eu.empresa_id,
  eu.usuario_id,
  eu.rol_id,
  eu.activo,
  eu.fecha_inicio,
  eu.fecha_fin,
  eu.roles_adicionales,
  u.nombres,
  u.apellidos,
  u.cargo,
  u.estado,
  r.codigo  AS rol_codigo,
  r.nombre  AS rol_nombre
FROM empresas_usuarios eu
JOIN usuarios u ON u.id = eu.usuario_id
JOIN roles    r ON r.id = eu.rol_id;
