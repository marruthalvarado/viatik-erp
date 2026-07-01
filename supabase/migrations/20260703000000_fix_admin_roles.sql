-- ============================================================
-- Fix admin role checks (case-insensitive) + RPC crear empresa
-- ============================================================

-- ─── 1. Corregir _assert_admin_empresa: insensible a mayúsculas ───────────────

CREATE OR REPLACE FUNCTION public._assert_admin_empresa(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rol text;
BEGIN
  SELECT lower(r.codigo) INTO v_rol
  FROM empresas_usuarios eu
  JOIN roles r ON r.id = eu.rol_id
  WHERE eu.empresa_id = p_empresa_id
    AND eu.usuario_id = auth.uid()
    AND eu.activo = true;
  IF v_rol IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Se requiere rol Administrador';
  END IF;
END;
$$;

-- ─── 2. Corregir es_admin_empresa: insensible a mayúsculas ───────────────────

CREATE OR REPLACE FUNCTION public.es_admin_empresa(p_empresa_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM empresas_usuarios eu
    JOIN roles r ON r.id = eu.rol_id
    WHERE eu.empresa_id = p_empresa_id
      AND eu.usuario_id = auth.uid()
      AND eu.activo = true
      AND lower(r.codigo) = 'admin'
  );
END;
$$;

-- ─── 3. Corregir unirse_empresa_por_codigo: buscar rol admin insensible ───────

CREATE OR REPLACE FUNCTION public.unirse_empresa_por_codigo(p_codigo text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id  uuid;
  v_empresa_nom text;
  v_rol_id      uuid;
  v_eu_id       uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT id, nombre INTO v_empresa_id, v_empresa_nom
  FROM empresas
  WHERE upper(trim(codigo)) = upper(trim(p_codigo))
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'No existe ninguna empresa con el código "%"', p_codigo;
  END IF;

  -- Rol "usuario" (case-insensitive)
  SELECT id INTO v_rol_id FROM roles WHERE lower(codigo) = 'usuario' LIMIT 1;
  IF v_rol_id IS NULL THEN
    SELECT id INTO v_rol_id FROM roles ORDER BY created_at LIMIT 1;
  END IF;

  -- Asegurar fila en public.usuarios
  INSERT INTO public.usuarios (id, nombres, estado, created_at)
  SELECT auth.uid(),
         split_part((SELECT email FROM auth.users WHERE id = auth.uid()), '@', 1),
         'activo', now()
  WHERE NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid());

  SELECT id INTO v_eu_id
  FROM empresas_usuarios
  WHERE empresa_id = v_empresa_id AND usuario_id = auth.uid();

  IF v_eu_id IS NOT NULL THEN
    UPDATE empresas_usuarios SET activo = true WHERE id = v_eu_id;
    RETURN json_build_object('ok', true, 'empresa', v_empresa_nom, 'ya_miembro', true);
  END IF;

  INSERT INTO empresas_usuarios (empresa_id, usuario_id, rol_id, activo, fecha_inicio)
  VALUES (v_empresa_id, auth.uid(), v_rol_id, true, now());

  RETURN json_build_object('ok', true, 'empresa', v_empresa_nom, 'ya_miembro', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unirse_empresa_por_codigo(text) TO authenticated;

-- ─── 4. Corregir admin_invitar_usuario_por_email: usa _assert_admin ────────────

CREATE OR REPLACE FUNCTION public.admin_invitar_usuario_por_email(
  p_email     text,
  p_empresa_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target_uid uuid;
  v_rol_id     uuid;
  v_eu_id      uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  PERFORM public._assert_admin_empresa(p_empresa_id);

  SELECT id INTO v_target_uid
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_target_uid IS NULL THEN
    RAISE EXCEPTION 'No existe ninguna cuenta con el correo "%". El usuario debe registrarse primero.', p_email;
  END IF;

  INSERT INTO public.usuarios (id, nombres, estado, created_at)
  VALUES (v_target_uid, split_part(trim(p_email), '@', 1), 'activo', now())
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_rol_id FROM roles WHERE lower(codigo) = 'usuario' LIMIT 1;

  SELECT id INTO v_eu_id
  FROM empresas_usuarios
  WHERE empresa_id = p_empresa_id AND usuario_id = v_target_uid;

  IF v_eu_id IS NOT NULL THEN
    UPDATE empresas_usuarios SET activo = true WHERE id = v_eu_id;
    RETURN json_build_object('ok', true, 'ya_miembro', true);
  END IF;

  INSERT INTO empresas_usuarios (empresa_id, usuario_id, rol_id, activo, fecha_inicio)
  VALUES (p_empresa_id, v_target_uid, v_rol_id, true, now());

  RETURN json_build_object('ok', true, 'ya_miembro', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_invitar_usuario_por_email(text, uuid) TO authenticated;

-- ─── 5. Nueva RPC: crear empresa y unirse como admin ─────────────────────────

CREATE OR REPLACE FUNCTION public.crear_empresa_y_unirse(
  p_nombre text,
  p_codigo text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id  uuid;
  v_codigo_final text;
  v_admin_rol_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF trim(p_nombre) = '' THEN RAISE EXCEPTION 'El nombre de la empresa es requerido'; END IF;

  -- Generar código si no se proporcionó
  v_codigo_final := CASE
    WHEN p_codigo IS NOT NULL AND trim(p_codigo) <> ''
    THEN upper(trim(p_codigo))
    ELSE upper(substring(regexp_replace(trim(p_nombre), '[^A-Za-z0-9]', '', 'g'), 1, 8))
  END;

  -- Si el código ya existe, agregar sufijo numérico
  IF EXISTS (SELECT 1 FROM empresas WHERE codigo = v_codigo_final AND deleted_at IS NULL) THEN
    v_codigo_final := v_codigo_final || to_char(extract(epoch from now())::int % 1000, 'FM000');
  END IF;

  -- Asegurar fila en public.usuarios
  INSERT INTO public.usuarios (id, nombres, estado, created_at)
  SELECT auth.uid(),
         split_part((SELECT email FROM auth.users WHERE id = auth.uid()), '@', 1),
         'activo', now()
  WHERE NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid());

  -- Crear empresa
  INSERT INTO empresas (nombre, codigo, estado, created_at)
  VALUES (trim(p_nombre), v_codigo_final, 'activo', now())
  RETURNING id INTO v_empresa_id;

  -- Rol admin (case-insensitive)
  SELECT id INTO v_admin_rol_id FROM roles WHERE lower(codigo) = 'admin' LIMIT 1;
  IF v_admin_rol_id IS NULL THEN
    SELECT id INTO v_admin_rol_id FROM roles ORDER BY created_at LIMIT 1;
  END IF;

  -- Unirse como admin
  INSERT INTO empresas_usuarios (empresa_id, usuario_id, rol_id, activo, fecha_inicio)
  VALUES (v_empresa_id, auth.uid(), v_admin_rol_id, true, now());

  RETURN json_build_object(
    'ok', true,
    'empresa_id', v_empresa_id,
    'empresa', trim(p_nombre),
    'codigo', v_codigo_final
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_empresa_y_unirse(text, text) TO authenticated;
