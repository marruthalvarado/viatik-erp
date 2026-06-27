-- =============================================================================
-- FASE 7 — Workflow de Aprobaciones (HARDENED v2)
-- Revisión de seguridad y concurrencia — producción-ready
--
-- Cambios vs v1:
--   [SEC-1] auth.uid() validado contra p_usuario_id en RPCs mutantes:
--           un caller autenticado no puede suplantar a otro usuario.
--   [SEC-2] wf_registrar_accion valida que p_workflow_paso_id sea el paso
--           ACTUAL (todos los anteriores aprobados, este aún no procesado).
--   [SEC-3] El propietario de la rendición no puede aprobar/rechazar/devolver
--           su propia rendición (doble check: frontend + RPC).
--   [SEC-4] Whitelist explícito de p_accion_codigo al inicio de wf_registrar_accion.
--   [SEC-5] wf_enviar_aprobacion y wf_registrar_accion verifican que el workflow
--           asignado siga activo antes de actuar.
--   [CONC-1] SELECT ... FOR UPDATE en la rendición al inicio de wf_enviar_aprobacion
--            y wf_registrar_accion para serializar transacciones concurrentes.
--   [QUAL-1] historial.detalle incluye estado_anterior → estado_nuevo.
--   [QUAL-2] EXCEPTION blocks en las 4 funciones para capturar errores inesperados.
--
-- Aplicar: Supabase Dashboard > SQL Editor > Run
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Seed: estado 'devuelta' (idempotente)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM estados_rendicion WHERE codigo = 'devuelta') THEN
    INSERT INTO estados_rendicion (codigo, nombre) VALUES ('devuelta', 'Devuelta para corrección');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Seed: acciones de aprobación (idempotente)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM acciones_aprobacion WHERE codigo = 'aprobar') THEN
    INSERT INTO acciones_aprobacion (codigo, nombre) VALUES ('aprobar', 'Aprobar');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM acciones_aprobacion WHERE codigo = 'rechazar') THEN
    INSERT INTO acciones_aprobacion (codigo, nombre) VALUES ('rechazar', 'Rechazar');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM acciones_aprobacion WHERE codigo = 'devolver') THEN
    INSERT INTO acciones_aprobacion (codigo, nombre) VALUES ('devolver', 'Devolver para corrección');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. RPC: wf_paso_actual
-- Devuelve el paso activo actual de una rendición (solo lectura).
-- Acceso: usuario autenticado (auth.uid() NOT NULL).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wf_paso_actual(p_rendicion_id uuid)
RETURNS TABLE(
  paso_id   uuid,
  nombre    text,
  orden     integer,
  rol_id    uuid,
  es_ultimo boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workflow_id uuid;
  v_max_orden   integer;
BEGIN
  -- [SEC] Rechazar llamadas no autenticadas
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT r.workflow_id
    INTO v_workflow_id
    FROM rendiciones r
   WHERE r.id = p_rendicion_id;

  IF v_workflow_id IS NULL THEN
    RETURN;
  END IF;

  SELECT MAX(wp.orden)
    INTO v_max_orden
    FROM workflow_pasos wp
   WHERE wp.workflow_id = v_workflow_id;

  RETURN QUERY
  SELECT
    wp.id                    AS paso_id,
    wp.nombre::text          AS nombre,
    wp.orden                 AS orden,
    wp.rol_id                AS rol_id,
    (wp.orden = v_max_orden) AS es_ultimo
  FROM workflow_pasos wp
  WHERE wp.workflow_id = v_workflow_id
    AND NOT EXISTS (
      SELECT 1
        FROM aprobaciones a
        JOIN acciones_aprobacion aa ON aa.id = a.accion_id
       WHERE a.rendicion_id      = p_rendicion_id
         AND a.workflow_paso_id  = wp.id
         AND aa.codigo           = 'aprobar'
    )
  ORDER BY wp.orden ASC
  LIMIT 1;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'wf_paso_actual error: %', SQLERRM;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. RPC: wf_mis_pendientes
-- Devuelve rendiciones donde el usuario autenticado es aprobador del paso actual.
-- [SEC-1] Ignora p_usuario_id del caller; usa auth.uid() internamente.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wf_mis_pendientes(
  p_usuario_id  uuid,   -- mantenido por compatibilidad de firma; ignorado internamente
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

  -- Obtener rol del usuario autenticado en la empresa (no del p_usuario_id del caller)
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
  -- [SEC-5] Solo workflows activos
  JOIN workflows_aprobacion wa ON wa.id = r.workflow_id AND wa.activo = true
  WHERE r.empresa_id = p_empresa_id
    AND er.codigo IN ('enviada', 'en_revision')
    AND wp.rol_id   = v_rol_id
    -- Este paso aún no aprobado
    AND NOT EXISTS (
      SELECT 1
        FROM aprobaciones a
        JOIN acciones_aprobacion aa ON aa.id = a.accion_id
       WHERE a.rendicion_id     = r.id
         AND a.workflow_paso_id = wp.id
         AND aa.codigo          = 'aprobar'
    )
    -- Todos los pasos anteriores aprobados
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

-- ---------------------------------------------------------------------------
-- 5. RPC: wf_enviar_aprobacion
-- Transición atómica: borrador/devuelta → enviada
-- [SEC-1] Valida auth.uid() == p_usuario_id
-- [SEC-5] Verifica que el workflow (nuevo o ya asignado) esté activo
-- [CONC-1] FOR UPDATE bloquea la fila para serializar envíos concurrentes
-- [QUAL-1] historial.detalle incluye estado_anterior → enviada
-- [QUAL-2] EXCEPTION block
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

  -- Validar estado actual
  SELECT er.codigo INTO v_estado_actual
    FROM estados_rendicion er
   WHERE er.id = v_rendicion.estado_rendicion_id;

  IF v_estado_actual NOT IN ('borrador', 'devuelta') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La rendición debe estar en borrador o devuelta para enviarse');
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

-- ---------------------------------------------------------------------------
-- 6. RPC: wf_registrar_accion
-- Transición atómica: aprobar / rechazar / devolver
-- [SEC-1] Valida auth.uid() == p_usuario_id
-- [SEC-2] Valida que p_workflow_paso_id sea el paso actual (no saltar pasos)
-- [SEC-3] El propietario no puede actuar sobre su propia rendición
-- [SEC-4] Whitelist explícito de p_accion_codigo
-- [SEC-5] Verifica que el workflow asignado siga activo
-- [CONC-1] FOR UPDATE bloquea la fila para serializar aprobaciones concurrentes
-- [QUAL-1] historial.detalle incluye estado_anterior → estado_nuevo
-- [QUAL-2] EXCEPTION block
-- ---------------------------------------------------------------------------
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
  v_rol_usuario       uuid;
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

  -- [SEC-4] Whitelist de acciones permitidas (antes de cualquier I/O)
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

  -- [SEC-2] Validar que p_workflow_paso_id es el paso ACTUAL:
  --   a) Este paso no ha sido procesado con aprobar/rechazar
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

  --   b) Todos los pasos anteriores están aprobados (no se puede saltar pasos)
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

  -- Validar rol del usuario autenticado en la empresa
  SELECT eu.rol_id INTO v_rol_usuario
    FROM empresas_usuarios eu
   WHERE eu.usuario_id = p_usuario_id
     AND eu.empresa_id = p_empresa_id
     AND eu.activo     = true
   LIMIT 1;

  IF v_rol_usuario IS NULL OR v_rol_usuario <> v_paso.rol_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No tienes permisos para actuar en este paso');
  END IF;

  -- Obtener accion_id (whitelist ya garantiza que existe)
  SELECT id INTO v_accion_id
    FROM acciones_aprobacion
   WHERE codigo = p_accion_codigo;

  -- Insertar aprobación (registro inmutable)
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

  -- [QUAL-1] Historial con transición de estado explícita
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
      ON eu.rol_id = wp_next.rol_id
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
