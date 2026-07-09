-- =============================================================================
-- Migration: Workflow cascade setup
-- - Seed acciones_aprobacion
-- - Crear workflow predeterminado (2 pasos: Aprobador → Financiero) por empresa
-- - Parchear wf_enviar_aprobacion para aceptar estado 'registrada'
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Seed acciones_aprobacion (idempotente)
-- ---------------------------------------------------------------------------
INSERT INTO acciones_aprobacion (codigo, nombre)
VALUES
  ('aprobar',  'Aprobar'),
  ('rechazar', 'Rechazar'),
  ('devolver', 'Devolver para corrección')
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Crear workflow predeterminado para cada empresa sin workflow activo
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_empresa_id     uuid;
  v_workflow_id    uuid;
  v_rol_aprobador  uuid;
  v_rol_financiero uuid;
BEGIN
  SELECT id INTO v_rol_aprobador  FROM roles WHERE codigo = 'aprobador'  LIMIT 1;
  SELECT id INTO v_rol_financiero FROM roles WHERE codigo = 'financiero' LIMIT 1;

  IF v_rol_aprobador IS NULL OR v_rol_financiero IS NULL THEN
    RAISE NOTICE 'Roles aprobador o financiero no encontrados — seed de workflow omitido';
    RETURN;
  END IF;

  FOR v_empresa_id IN SELECT id FROM empresas LOOP
    IF EXISTS (
      SELECT 1 FROM workflows_aprobacion
       WHERE empresa_id = v_empresa_id AND activo = true
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO workflows_aprobacion (empresa_id, nombre, activo, created_at)
    VALUES (v_empresa_id, 'Flujo de Aprobación de Viáticos', true, NOW())
    RETURNING id INTO v_workflow_id;

    INSERT INTO workflow_pasos (workflow_id, nombre, orden, rol_id)
    VALUES
      (v_workflow_id, 'Aprobación de Supervisor',  1, v_rol_aprobador),
      (v_workflow_id, 'Confirmación Financiera',   2, v_rol_financiero);

    RAISE NOTICE 'Workflow creado para empresa %', v_empresa_id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Parchear wf_enviar_aprobacion: aceptar estado 'registrada'
-- ---------------------------------------------------------------------------
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
  -- [SEC-1] Verificar identidad
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autenticado');
  END IF;
  IF auth.uid() <> p_usuario_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Identidad no coincide con el usuario autenticado');
  END IF;

  -- [CONC-1] Bloquear la fila para serializar llamadas concurrentes
  SELECT * INTO v_rendicion
    FROM rendiciones
   WHERE id = p_rendicion_id AND empresa_id = p_empresa_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rendición no encontrada');
  END IF;

  -- [SEC] Validar propietario
  IF v_rendicion.usuario_id <> p_usuario_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo el propietario puede enviar la rendición a aprobación');
  END IF;

  -- Validar estado actual (acepta borrador, devuelta y registrada)
  SELECT er.codigo INTO v_estado_actual
    FROM estados_rendicion er
   WHERE er.id = v_rendicion.estado_rendicion_id;

  IF v_estado_actual NOT IN ('borrador', 'devuelta', 'registrada') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La rendición debe estar en borrador, registrada o devuelta para enviarse');
  END IF;

  -- Resolver workflow
  v_workflow_id := v_rendicion.workflow_id;

  IF v_workflow_id IS NULL THEN
    -- Auto-asignación: primer workflow activo de la empresa
    SELECT id INTO v_workflow_id
      FROM workflows_aprobacion
     WHERE empresa_id = p_empresa_id AND activo = true
     ORDER BY created_at ASC
     LIMIT 1;

    IF v_workflow_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'No existe un workflow activo configurado para esta empresa');
    END IF;
  ELSE
    -- [SEC-5] Verificar que el workflow ya asignado siga activo
    IF NOT EXISTS (
      SELECT 1 FROM workflows_aprobacion
       WHERE id = v_workflow_id AND activo = true
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'El workflow asignado a esta rendición ya no está activo');
    END IF;
  END IF;

  -- Validar que el workflow tiene pasos
  IF NOT EXISTS (SELECT 1 FROM workflow_pasos WHERE workflow_id = v_workflow_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El workflow no tiene pasos configurados');
  END IF;

  -- Obtener ID del estado 'enviada'
  SELECT id INTO v_estado_enviada_id
    FROM estados_rendicion WHERE codigo = 'enviada';

  -- Actualizar rendición
  UPDATE rendiciones SET
    estado_rendicion_id = v_estado_enviada_id,
    fecha_envio         = NOW(),
    workflow_id         = v_workflow_id,
    updated_at          = NOW()
  WHERE id = p_rendicion_id;

  -- [QUAL-1] Historial con transición de estado
  INSERT INTO historial_workflow (empresa_id, rendicion_id, usuario_id, evento, detalle, created_at)
  VALUES (
    p_empresa_id,
    p_rendicion_id,
    p_usuario_id,
    'enviada',
    'Estado: ' || v_estado_actual || ' → enviada. Rendición enviada a aprobación.',
    NOW()
  );

  -- Notificar aprobadores del paso 1
  SELECT * INTO v_paso1
    FROM workflow_pasos
   WHERE workflow_id = v_workflow_id
   ORDER BY orden ASC
   LIMIT 1;

  INSERT INTO notificaciones (empresa_id, usuario_id, titulo, mensaje, leida, created_at)
  SELECT
    p_empresa_id,
    eu.usuario_id,
    'Rendición pendiente de aprobación',
    'La rendición ' || v_rendicion.numero || ' requiere tu aprobación en: '
      || COALESCE(v_paso1.nombre, 'Paso ' || v_paso1.orden::text),
    false,
    NOW()
  FROM empresas_usuarios eu
  WHERE eu.empresa_id = p_empresa_id
    AND eu.rol_id     = v_paso1.rol_id
    AND eu.activo     = true
    AND eu.usuario_id <> p_usuario_id;

  RETURN jsonb_build_object(
    'ok',           true,
    'nuevo_estado', 'enviada',
    'workflow_id',  v_workflow_id::text
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Error interno: ' || SQLERRM);
END;
$$;
