-- =============================================================================
-- Migration: Fix wf_registrar_accion
-- 1. Asegurar que el INSERT a aprobaciones incluye empresa_id = p_empresa_id
-- 2. Soportar multi-rol: el check de permiso revisa rol_id + roles_adicionales
-- =============================================================================

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
  v_tiene_rol         boolean := false;
  v_accion_id         uuid;
  v_nuevo_estado_id   uuid;
  v_nuevo_estado_cod  text;
  v_total_pasos       integer;
  v_pasos_aprobados   integer;
  v_detalle           text;
BEGIN
  -- [SEC-1] Verificar identidad
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autenticado');
  END IF;
  IF auth.uid() <> p_usuario_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Identidad no coincide con el usuario autenticado');
  END IF;

  -- [SEC-4] Whitelist de acciones permitidas
  IF p_accion_codigo NOT IN ('aprobar', 'rechazar', 'devolver') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acción no reconocida: ' || p_accion_codigo);
  END IF;

  -- [CONC-1] Bloquear la fila de la rendición para serializar concurrencia
  SELECT * INTO v_rendicion
    FROM rendiciones
   WHERE id = p_rendicion_id AND empresa_id = p_empresa_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rendición no encontrada');
  END IF;

  -- [SEC-3] El propietario no puede actuar sobre su propia rendición
  IF v_rendicion.usuario_id = p_usuario_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El propietario de la rendición no puede actuar como aprobador');
  END IF;

  -- Validar estado de la rendición
  SELECT er.codigo INTO v_estado_actual
    FROM estados_rendicion er
   WHERE er.id = v_rendicion.estado_rendicion_id;

  IF v_estado_actual NOT IN ('enviada', 'en_revision') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La rendición no está en estado de revisión');
  END IF;

  -- [SEC-5] Verificar que el workflow sigue activo
  IF NOT EXISTS (
    SELECT 1 FROM workflows_aprobacion
     WHERE id = v_rendicion.workflow_id AND activo = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El workflow de esta rendición ya no está activo');
  END IF;

  -- Obtener el paso solicitado
  SELECT * INTO v_paso
    FROM workflow_pasos
   WHERE id = p_workflow_paso_id AND workflow_id = v_rendicion.workflow_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Paso de workflow no válido para esta rendición');
  END IF;

  -- [SEC-2a] Este paso no ha sido procesado con aprobar/rechazar
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

  -- [SEC-2b] Todos los pasos anteriores están aprobados
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

  -- [SEC-ROL] Validar que el usuario tiene el rol requerido por este paso.
  -- Soporta multi-rol: revisa rol_id (primario) y roles_adicionales (UUID[]).
  SELECT true INTO v_tiene_rol
    FROM empresas_usuarios eu
   WHERE eu.usuario_id = p_usuario_id
     AND eu.empresa_id = p_empresa_id
     AND eu.activo     = true
     AND (
       eu.rol_id = v_paso.rol_id
       OR v_paso.rol_id = ANY(COALESCE(eu.roles_adicionales, ARRAY[]::uuid[]))
     )
   LIMIT 1;

  IF NOT FOUND OR NOT v_tiene_rol THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No tienes permisos para actuar en este paso');
  END IF;

  -- Obtener accion_id
  SELECT id INTO v_accion_id
    FROM acciones_aprobacion
   WHERE codigo = p_accion_codigo;

  -- Insertar aprobación (registro inmutable) — empresa_id siempre explícito
  INSERT INTO aprobaciones (
    empresa_id, rendicion_id, workflow_paso_id,
    usuario_id, accion_id, comentario, fecha_accion, created_at
  )
  VALUES (
    p_empresa_id, p_rendicion_id, p_workflow_paso_id,
    p_usuario_id, v_accion_id, p_comentario, NOW(), NOW()
  );

  -- Determinar nuevo estado de la rendición
  IF p_accion_codigo = 'rechazar' THEN
    v_nuevo_estado_cod := 'rechazada';
    v_detalle := 'Estado: ' || v_estado_actual || ' → rechazada. Paso ' || v_paso.orden::text
      || CASE WHEN p_comentario IS NOT NULL AND p_comentario <> ''
              THEN '. Motivo: ' || p_comentario ELSE '' END;

  ELSIF p_accion_codigo = 'devolver' THEN
    v_nuevo_estado_cod := 'devuelta';
    v_detalle := 'Estado: ' || v_estado_actual || ' → devuelta. Paso ' || v_paso.orden::text
      || CASE WHEN p_comentario IS NOT NULL AND p_comentario <> ''
              THEN '. Motivo: ' || p_comentario ELSE '' END;

  ELSIF p_accion_codigo = 'aprobar' THEN
    SELECT COUNT(*) INTO v_total_pasos
      FROM workflow_pasos
     WHERE workflow_id = v_rendicion.workflow_id;

    SELECT COUNT(*) INTO v_pasos_aprobados
      FROM aprobaciones a
      JOIN acciones_aprobacion aa ON aa.id = a.accion_id
      JOIN workflow_pasos wp       ON wp.id = a.workflow_paso_id
     WHERE a.rendicion_id  = p_rendicion_id
       AND wp.workflow_id  = v_rendicion.workflow_id
       AND aa.codigo       = 'aprobar';

    IF v_pasos_aprobados >= v_total_pasos THEN
      v_nuevo_estado_cod := 'aprobada';
      v_detalle := 'Estado: ' || v_estado_actual || ' → aprobada. Todos los pasos (' || v_total_pasos::text || ') aprobados.';

      UPDATE rendiciones SET
        fecha_aprobacion = NOW(),
        updated_at       = NOW()
      WHERE id = p_rendicion_id;
    ELSE
      v_nuevo_estado_cod := 'en_revision';
      v_detalle := 'Estado: ' || v_estado_actual || ' → en_revision. Paso '
        || v_paso.orden::text || ' aprobado (' || v_pasos_aprobados::text
        || '/' || v_total_pasos::text || ' completados).';
    END IF;
  END IF;

  -- Actualizar estado de la rendición
  SELECT id INTO v_nuevo_estado_id
    FROM estados_rendicion WHERE codigo = v_nuevo_estado_cod;

  UPDATE rendiciones SET
    estado_rendicion_id = v_nuevo_estado_id,
    updated_at          = NOW()
  WHERE id = p_rendicion_id;

  -- [QUAL-1] Historial con transición de estado
  INSERT INTO historial_workflow (
    empresa_id, rendicion_id, workflow_paso_id, usuario_id, evento, detalle, created_at
  )
  VALUES (
    p_empresa_id, p_rendicion_id, p_workflow_paso_id,
    p_usuario_id, p_accion_codigo, v_detalle, NOW()
  );

  -- Notificar propietario si fue rechazada o devuelta
  IF p_accion_codigo IN ('rechazar', 'devolver') THEN
    INSERT INTO notificaciones (empresa_id, usuario_id, titulo, mensaje, leida, created_at)
    VALUES (
      p_empresa_id,
      v_rendicion.usuario_id,
      CASE p_accion_codigo
        WHEN 'rechazar' THEN 'Rendición rechazada'
        WHEN 'devolver' THEN 'Rendición devuelta para corrección'
      END,
      v_detalle,
      false,
      NOW()
    );
  END IF;

  -- Notificar aprobadores del siguiente paso si quedan pasos
  IF p_accion_codigo = 'aprobar' AND v_nuevo_estado_cod = 'en_revision' THEN
    INSERT INTO notificaciones (empresa_id, usuario_id, titulo, mensaje, leida, created_at)
    SELECT
      p_empresa_id,
      eu.usuario_id,
      'Rendición pendiente de aprobación',
      'La rendición ' || v_rendicion.numero || ' requiere tu aprobación (paso '
        || (v_paso.orden + 1)::text || ')',
      false,
      NOW()
    FROM workflow_pasos wp_next
    JOIN empresas_usuarios eu
      ON (eu.rol_id = wp_next.rol_id OR wp_next.rol_id = ANY(COALESCE(eu.roles_adicionales, ARRAY[]::uuid[])))
     AND eu.empresa_id = p_empresa_id
     AND eu.activo = true
    WHERE wp_next.workflow_id = v_rendicion.workflow_id
      AND wp_next.orden       = v_paso.orden + 1
      AND eu.usuario_id      <> p_usuario_id;
  END IF;

  RETURN jsonb_build_object(
    'ok',           true,
    'nuevo_estado', v_nuevo_estado_cod,
    'accion',       p_accion_codigo
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Error interno: ' || SQLERRM);
END;
$$;
