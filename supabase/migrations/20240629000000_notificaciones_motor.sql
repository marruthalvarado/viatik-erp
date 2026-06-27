-- =============================================================================
-- FASE 9B — Motor de Generación de Notificaciones
--
-- Decisión de arquitectura:
--   TODOS los eventos se capturan con triggers PostgreSQL para garantizar
--   atomicidad: la notificación se crea en la misma transacción que el evento.
--   Ningún trigger usa RAISE EXCEPTION — si falla el INSERT de notificación,
--   se emite un WARNING y la operación principal continúa normalmente.
--
-- Eventos cubiertos:
--   [WORKFLOW]    rendicion enviada / aprobada / rechazada / devuelta
--   [WORKFLOW]    comentario nuevo en rendicion
--   [PRESUPUESTO] ejecución supera 90% o 100% del presupuesto del proyecto
--   [POLITICA]    gasto supera el tope de la categoría en la política vigente
--   [OCR]         extracción OCR finaliza (INSERT en ocr_extracciones)
--   [SISTEMA]     nuevo usuario agregado a empresa
--   [SISTEMA]     cambio de rol de usuario en empresa
--   [SISTEMA]     política modificada (notifica a todos en la empresa)
--
-- Aplicar: Supabase Dashboard > SQL Editor > Run
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: insertar una notificación sin propagar errores
-- Signature interna, no expuesta vía RLS.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _notif_insertar(
  p_empresa_id   uuid,
  p_usuario_id   uuid,
  p_tipo         text,
  p_prioridad    text,
  p_titulo       text,
  p_mensaje      text,
  p_url_destino  text DEFAULT NULL,
  p_metadata     jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notificaciones (
    empresa_id, usuario_id, tipo, prioridad,
    titulo, mensaje, url_destino, metadata,
    leida, created_at
  ) VALUES (
    p_empresa_id, p_usuario_id, p_tipo, p_prioridad,
    p_titulo, p_mensaje, p_url_destino, p_metadata,
    false, now()
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[notificaciones] Error al insertar: %', SQLERRM;
END;
$$;

-- =============================================================================
-- BLOQUE 1 — WORKFLOW: estado de rendición
-- Trigger: AFTER UPDATE en rendiciones cuando cambia estado_rendicion_id
-- Notifica al dueño de la rendición.
-- =============================================================================
CREATE OR REPLACE FUNCTION trg_fn_notif_rendicion_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado_nuevo  text;
  v_estado_viejo  text;
  v_numero        text;
  v_titulo        text;
  v_mensaje       text;
  v_prioridad     text;
  v_url           text;
BEGIN
  -- Solo actuar si el estado cambió
  IF NEW.estado_rendicion_id IS NOT DISTINCT FROM OLD.estado_rendicion_id THEN
    RETURN NEW;
  END IF;

  SELECT codigo INTO v_estado_nuevo
    FROM estados_rendicion WHERE id = NEW.estado_rendicion_id;

  SELECT codigo INTO v_estado_viejo
    FROM estados_rendicion WHERE id = OLD.estado_rendicion_id;

  v_numero := NEW.numero;
  v_url    := '/rendiciones/' || NEW.id::text;

  CASE v_estado_nuevo
    WHEN 'enviada' THEN
      v_titulo    := 'Rendición enviada a aprobación';
      v_mensaje   := 'La rendición ' || v_numero || ' fue enviada al flujo de aprobación.';
      v_prioridad := 'media';
    WHEN 'aprobada' THEN
      v_titulo    := 'Rendición aprobada';
      v_mensaje   := 'Tu rendición ' || v_numero || ' fue aprobada.';
      v_prioridad := 'alta';
    WHEN 'rechazada' THEN
      v_titulo    := 'Rendición rechazada';
      v_mensaje   := 'Tu rendición ' || v_numero || ' fue rechazada. Revisa los comentarios.';
      v_prioridad := 'alta';
    WHEN 'devuelta' THEN
      v_titulo    := 'Rendición devuelta para corrección';
      v_mensaje   := 'Tu rendición ' || v_numero || ' requiere correcciones antes de continuar.';
      v_prioridad := 'alta';
    ELSE
      RETURN NEW;
  END CASE;

  PERFORM _notif_insertar(
    NEW.empresa_id,
    NEW.usuario_id,
    'workflow',
    v_prioridad,
    v_titulo,
    v_mensaje,
    v_url,
    jsonb_build_object(
      'rendicion_id', NEW.id,
      'numero', v_numero,
      'estado_anterior', v_estado_viejo,
      'estado_nuevo', v_estado_nuevo
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[trg_notif_rendicion_estado] %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_rendicion_estado ON rendiciones;
CREATE TRIGGER trg_notif_rendicion_estado
  AFTER UPDATE OF estado_rendicion_id ON rendiciones
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_notif_rendicion_estado();

-- =============================================================================
-- BLOQUE 2 — WORKFLOW: comentario nuevo en rendición
-- Trigger: AFTER INSERT en comentarios
-- Notifica al dueño de la rendición si el comentador es otra persona.
-- =============================================================================
CREATE OR REPLACE FUNCTION trg_fn_notif_comentario_nuevo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rendicion  rendiciones%ROWTYPE;
  v_numero     text;
BEGIN
  SELECT * INTO v_rendicion
    FROM rendiciones
   WHERE id = NEW.rendicion_id;

  -- No notificar si el comentador es el mismo dueño de la rendición
  IF v_rendicion.usuario_id = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  v_numero := v_rendicion.numero;

  PERFORM _notif_insertar(
    NEW.empresa_id,
    v_rendicion.usuario_id,
    'workflow',
    'baja',
    'Nuevo comentario en tu rendición',
    'Se agregó un comentario en la rendición ' || v_numero || '.',
    '/rendiciones/' || NEW.rendicion_id::text,
    jsonb_build_object(
      'rendicion_id', NEW.rendicion_id,
      'numero', v_numero,
      'comentario_id', NEW.id,
      'comentador_id', NEW.usuario_id
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[trg_notif_comentario_nuevo] %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_comentario_nuevo ON comentarios;
CREATE TRIGGER trg_notif_comentario_nuevo
  AFTER INSERT ON comentarios
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_notif_comentario_nuevo();

-- =============================================================================
-- BLOQUE 3 — PRESUPUESTO: alerta de ejecución al 90% y 100%
-- Trigger: AFTER INSERT OR UPDATE en gastos
-- Compara total gastado vs. valor_total del presupuesto activo del proyecto.
-- Notifica al dueño de la rendición.
-- =============================================================================
CREATE OR REPLACE FUNCTION trg_fn_notif_presupuesto_ejecucion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rendicion       rendiciones%ROWTYPE;
  v_presupuesto_id  uuid;
  v_valor_total     numeric;
  v_ejecutado       numeric;
  v_porcentaje      numeric;
  v_umbral_viejo    numeric;
  v_umbral_nuevo    numeric;
BEGIN
  -- Solo actuar sobre gastos con valor
  IF NEW.valor_factura IS NULL OR NEW.valor_factura <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_rendicion
    FROM rendiciones WHERE id = NEW.rendicion_id;

  IF v_rendicion IS NULL OR v_rendicion.proyecto_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar presupuesto activo del proyecto en el año actual
  SELECT id, valor_total
    INTO v_presupuesto_id, v_valor_total
    FROM presupuestos
   WHERE proyecto_id = v_rendicion.proyecto_id
     AND empresa_id  = NEW.empresa_id
     AND activo = true
     AND anio = EXTRACT(YEAR FROM now())::integer
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_presupuesto_id IS NULL OR v_valor_total IS NULL OR v_valor_total <= 0 THEN
    RETURN NEW;
  END IF;

  -- Total ejecutado en este proyecto/empresa
  SELECT COALESCE(SUM(g.valor_factura), 0)
    INTO v_ejecutado
    FROM gastos g
    JOIN rendiciones r ON r.id = g.rendicion_id
   WHERE r.proyecto_id = v_rendicion.proyecto_id
     AND g.empresa_id  = NEW.empresa_id
     AND g.deleted_at IS NULL;

  v_porcentaje := ROUND((v_ejecutado / v_valor_total) * 100, 1);

  -- Calcular umbral antes y después del gasto actual para evitar spam
  v_umbral_nuevo := CASE
    WHEN v_porcentaje >= 100 THEN 100
    WHEN v_porcentaje >= 90  THEN 90
    ELSE 0
  END;

  IF OLD IS NOT NULL THEN
    DECLARE v_ejecutado_viejo numeric;
    BEGIN
      SELECT COALESCE(SUM(g.valor_factura), 0) - NEW.valor_factura + COALESCE(OLD.valor_factura, 0)
        INTO v_ejecutado_viejo
        FROM gastos g
        JOIN rendiciones r ON r.id = g.rendicion_id
       WHERE r.proyecto_id = v_rendicion.proyecto_id
         AND g.empresa_id  = NEW.empresa_id
         AND g.deleted_at IS NULL;

      v_umbral_viejo := CASE
        WHEN v_ejecutado_viejo / v_valor_total * 100 >= 100 THEN 100
        WHEN v_ejecutado_viejo / v_valor_total * 100 >= 90  THEN 90
        ELSE 0
      END;
    END;
  ELSE
    v_umbral_viejo := 0;
  END IF;

  -- Solo notificar si cruzamos un umbral nuevo
  IF v_umbral_nuevo > v_umbral_viejo THEN
    PERFORM _notif_insertar(
      NEW.empresa_id,
      v_rendicion.usuario_id,
      'presupuesto',
      CASE WHEN v_umbral_nuevo >= 100 THEN 'alta' ELSE 'media' END,
      CASE WHEN v_umbral_nuevo >= 100
           THEN 'Presupuesto agotado al 100%'
           ELSE 'Presupuesto al 90% de ejecución'
      END,
      'El proyecto ha ejecutado el ' || v_porcentaje::text || '% del presupuesto.',
      '/presupuestos',
      jsonb_build_object(
        'presupuesto_id',  v_presupuesto_id,
        'proyecto_id',     v_rendicion.proyecto_id,
        'porcentaje',      v_porcentaje,
        'ejecutado',       v_ejecutado,
        'valor_total',     v_valor_total
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[trg_notif_presupuesto_ejecucion] %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_presupuesto_ejecucion ON gastos;
CREATE TRIGGER trg_notif_presupuesto_ejecucion
  AFTER INSERT OR UPDATE OF valor_factura ON gastos
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_notif_presupuesto_ejecucion();

-- =============================================================================
-- BLOQUE 4 — POLÍTICA: gasto supera el tope de la categoría
-- Trigger: AFTER INSERT OR UPDATE en gastos
-- Compara valor_factura vs. topes definidos en la política de la rendición.
-- Usa la categoría del gasto para identificar el tope aplicable.
-- =============================================================================
CREATE OR REPLACE FUNCTION trg_fn_notif_gasto_politica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rendicion   rendiciones%ROWTYPE;
  v_politica    politicas%ROWTYPE;
  v_categoria   text;
  v_tope        numeric;
BEGIN
  IF NEW.valor_factura IS NULL OR NEW.valor_factura <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_rendicion
    FROM rendiciones WHERE id = NEW.rendicion_id;

  IF v_rendicion.politica_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_politica
    FROM politicas WHERE id = v_rendicion.politica_id;

  IF v_politica IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener código de categoría del gasto
  SELECT nombre INTO v_categoria
    FROM categorias_gasto WHERE id = NEW.categoria_gasto_id;

  -- Determinar tope aplicable según nombre de categoría (normalizado)
  v_tope := CASE lower(COALESCE(v_categoria, ''))
    WHEN 'almuerzo'    THEN v_politica.tope_almuerzo
    WHEN 'desayuno'    THEN v_politica.tope_desayuno
    WHEN 'cena'        THEN v_politica.tope_cena
    WHEN 'hospedaje'   THEN v_politica.tope_hospedaje
    WHEN 'alojamiento' THEN v_politica.tope_hospedaje
    WHEN 'misceláneos' THEN v_politica.tope_miscelaneo
    WHEN 'miscelaneo'  THEN v_politica.tope_miscelaneo
    ELSE NULL
  END;

  -- Si hay tope definido y lo supera, notificar
  IF v_tope IS NOT NULL AND NEW.valor_factura > v_tope THEN
    PERFORM _notif_insertar(
      NEW.empresa_id,
      v_rendicion.usuario_id,
      'politica',
      'alta',
      'Gasto fuera de política',
      'El gasto de ' || v_categoria || ' supera el tope permitido de ' || v_tope::text || '.',
      '/rendiciones/' || NEW.rendicion_id::text,
      jsonb_build_object(
        'gasto_id',     NEW.id,
        'rendicion_id', NEW.rendicion_id,
        'categoria',    v_categoria,
        'valor',        NEW.valor_factura,
        'tope',         v_tope,
        'politica_id',  v_rendicion.politica_id
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[trg_notif_gasto_politica] %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_gasto_politica ON gastos;
CREATE TRIGGER trg_notif_gasto_politica
  AFTER INSERT OR UPDATE OF valor_factura, categoria_gasto_id ON gastos
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_notif_gasto_politica();

-- =============================================================================
-- BLOQUE 5 — OCR: extracción finalizada
-- Trigger: AFTER INSERT en ocr_extracciones
-- Notifica al dueño de la rendición asociada al documento.
-- =============================================================================
CREATE OR REPLACE FUNCTION trg_fn_notif_ocr_extraccion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rendicion  rendiciones%ROWTYPE;
  v_nombre     text;
BEGIN
  SELECT r.*
    INTO v_rendicion
    FROM rendiciones r
    JOIN documentos d ON d.rendicion_id = r.id
   WHERE d.id = NEW.documento_id
   LIMIT 1;

  IF v_rendicion IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nombre_archivo INTO v_nombre
    FROM documentos WHERE id = NEW.documento_id;

  PERFORM _notif_insertar(
    v_rendicion.empresa_id,
    v_rendicion.usuario_id,
    'ocr',
    'baja',
    'OCR completado',
    'El documento ' || COALESCE(v_nombre, 'sin nombre') || ' fue procesado por OCR.',
    '/documentos',
    jsonb_build_object(
      'documento_id',  NEW.documento_id,
      'rendicion_id',  v_rendicion.id,
      'confianza',     NEW.confianza
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[trg_notif_ocr_extraccion] %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_ocr_extraccion ON ocr_extracciones;
CREATE TRIGGER trg_notif_ocr_extraccion
  AFTER INSERT ON ocr_extracciones
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_notif_ocr_extraccion();

-- =============================================================================
-- BLOQUE 6 — SISTEMA: nuevo usuario agregado a empresa
-- Trigger: AFTER INSERT en empresas_usuarios
-- Notifica al nuevo usuario.
-- =============================================================================
CREATE OR REPLACE FUNCTION trg_fn_notif_usuario_nuevo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_nombre text;
  v_rol_nombre     text;
BEGIN
  SELECT nombre INTO v_empresa_nombre
    FROM empresas WHERE id = NEW.empresa_id;

  SELECT nombre INTO v_rol_nombre
    FROM roles WHERE id = NEW.rol_id;

  PERFORM _notif_insertar(
    NEW.empresa_id,
    NEW.usuario_id,
    'sistema',
    'media',
    'Bienvenido a ' || COALESCE(v_empresa_nombre, 'la empresa'),
    'Se te asignó el rol ' || COALESCE(v_rol_nombre, 'Usuario') || ' en ' || COALESCE(v_empresa_nombre, 'la empresa') || '.',
    '/dashboard',
    jsonb_build_object(
      'empresa_id', NEW.empresa_id,
      'rol_id',     NEW.rol_id,
      'rol_nombre', v_rol_nombre
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[trg_notif_usuario_nuevo] %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_usuario_nuevo ON empresas_usuarios;
CREATE TRIGGER trg_notif_usuario_nuevo
  AFTER INSERT ON empresas_usuarios
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_notif_usuario_nuevo();

-- =============================================================================
-- BLOQUE 7 — SISTEMA: cambio de rol en empresa
-- Trigger: AFTER UPDATE en empresas_usuarios cuando cambia rol_id
-- =============================================================================
CREATE OR REPLACE FUNCTION trg_fn_notif_rol_cambio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol_nuevo  text;
  v_rol_viejo  text;
BEGIN
  IF NEW.rol_id IS NOT DISTINCT FROM OLD.rol_id THEN
    RETURN NEW;
  END IF;

  SELECT nombre INTO v_rol_nuevo FROM roles WHERE id = NEW.rol_id;
  SELECT nombre INTO v_rol_viejo FROM roles WHERE id = OLD.rol_id;

  PERFORM _notif_insertar(
    NEW.empresa_id,
    NEW.usuario_id,
    'sistema',
    'media',
    'Tu rol fue actualizado',
    'Tu rol cambió de ' || COALESCE(v_rol_viejo, '—') || ' a ' || COALESCE(v_rol_nuevo, '—') || '.',
    '/dashboard',
    jsonb_build_object(
      'empresa_id',  NEW.empresa_id,
      'rol_anterior', OLD.rol_id,
      'rol_nuevo',    NEW.rol_id,
      'rol_nombre',   v_rol_nuevo
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[trg_notif_rol_cambio] %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_rol_cambio ON empresas_usuarios;
CREATE TRIGGER trg_notif_rol_cambio
  AFTER UPDATE OF rol_id ON empresas_usuarios
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_notif_rol_cambio();

-- =============================================================================
-- BLOQUE 8 — SISTEMA: política modificada
-- Trigger: AFTER UPDATE en politicas
-- Notifica a todos los usuarios activos de la empresa.
-- =============================================================================
CREATE OR REPLACE FUNCTION trg_fn_notif_politica_cambio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario record;
BEGIN
  -- Solo si cambia algún tope relevante o el nombre
  IF NEW.nombre IS NOT DISTINCT FROM OLD.nombre
     AND NEW.tope_almuerzo IS NOT DISTINCT FROM OLD.tope_almuerzo
     AND NEW.tope_cena IS NOT DISTINCT FROM OLD.tope_cena
     AND NEW.tope_desayuno IS NOT DISTINCT FROM OLD.tope_desayuno
     AND NEW.tope_hospedaje IS NOT DISTINCT FROM OLD.tope_hospedaje
     AND NEW.tope_miscelaneo IS NOT DISTINCT FROM OLD.tope_miscelaneo
  THEN
    RETURN NEW;
  END IF;

  FOR v_usuario IN
    SELECT DISTINCT eu.usuario_id
      FROM empresas_usuarios eu
     WHERE eu.empresa_id = NEW.empresa_id
       AND eu.activo = true
  LOOP
    PERFORM _notif_insertar(
      NEW.empresa_id,
      v_usuario.usuario_id,
      'politica',
      'media',
      'Política actualizada: ' || NEW.nombre,
      'Los topes de la política "' || NEW.nombre || '" fueron actualizados.',
      '/administracion',
      jsonb_build_object(
        'politica_id',   NEW.id,
        'politica_nombre', NEW.nombre
      )
    );
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[trg_notif_politica_cambio] %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_politica_cambio ON politicas;
CREATE TRIGGER trg_notif_politica_cambio
  AFTER UPDATE ON politicas
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_notif_politica_cambio();

-- =============================================================================
-- Permisos: _notif_insertar solo ejecutable por service_role / triggers
-- =============================================================================
REVOKE ALL ON FUNCTION _notif_insertar(uuid,uuid,text,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _notif_insertar(uuid,uuid,text,text,text,text,text,jsonb) TO service_role;
