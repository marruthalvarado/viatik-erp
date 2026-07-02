-- ============================================================
-- User Onboarding: auto-crear perfil + unirse a empresa
-- ============================================================

-- ─── 1. Trigger: crear fila en public.usuarios al registrarse ─────────────────
-- Supabase no crea el perfil automáticamente; este trigger lo hace.
-- El email del auth.users se usa como nombre provisional hasta que
-- el usuario complete su perfil.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, nombres, estado, created_at)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    'activo',
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ─── 2. RPC: usuario se une a empresa por código ─────────────────────────────
-- Llamada por el propio usuario autenticado tras registrarse.
-- No requiere ser admin; cualquier usuario autenticado puede unirse.

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

  -- Buscar empresa (insensible a mayúsculas y espacios)
  SELECT id, nombre INTO v_empresa_id, v_empresa_nom
  FROM empresas
  WHERE upper(trim(codigo)) = upper(trim(p_codigo))
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'No existe ninguna empresa con el código "%"', p_codigo;
  END IF;

  -- Rol por defecto: "usuario"
  SELECT id INTO v_rol_id FROM roles WHERE codigo = 'usuario' LIMIT 1;
  IF v_rol_id IS NULL THEN
    SELECT id INTO v_rol_id FROM roles ORDER BY created_at LIMIT 1;
  END IF;

  -- Asegurar fila en public.usuarios (por si el trigger no corrió aún)
  INSERT INTO public.usuarios (id, nombres, estado, created_at)
  SELECT auth.uid(),
         split_part((SELECT email FROM auth.users WHERE id = auth.uid()), '@', 1),
         'activo',
         now()
  WHERE NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid());

  -- ¿Ya es miembro?
  SELECT id INTO v_eu_id
  FROM empresas_usuarios
  WHERE empresa_id = v_empresa_id AND usuario_id = auth.uid();

  IF v_eu_id IS NOT NULL THEN
    -- Reactivar si estaba inactivo
    UPDATE empresas_usuarios SET activo = true WHERE id = v_eu_id;
    RETURN json_build_object('ok', true, 'empresa', v_empresa_nom, 'ya_miembro', true);
  END IF;

  -- Agregar membresía
  INSERT INTO empresas_usuarios (empresa_id, usuario_id, rol_id, activo, fecha_inicio)
  VALUES (v_empresa_id, auth.uid(), v_rol_id, true, now());

  RETURN json_build_object('ok', true, 'empresa', v_empresa_nom, 'ya_miembro', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unirse_empresa_por_codigo(text) TO authenticated;

-- ─── 3. RPC: admin agrega usuario a su empresa por email ──────────────────────
-- Solo puede llamarla un admin activo de la empresa destino.
-- Busca al usuario en auth.users por email (accesible desde SECURITY DEFINER).

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
  v_caller_rol    text;
  v_target_uid    uuid;
  v_rol_id        uuid;
  v_eu_id         uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Verificar que el caller es admin activo de la empresa
  SELECT r.codigo INTO v_caller_rol
  FROM empresas_usuarios eu
  JOIN roles r ON r.id = eu.rol_id
  WHERE eu.empresa_id = p_empresa_id
    AND eu.usuario_id = auth.uid()
    AND eu.activo = true;

  IF v_caller_rol IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'No tienes permisos de administrador en esta empresa';
  END IF;

  -- Buscar en auth.users por email
  SELECT id INTO v_target_uid
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_target_uid IS NULL THEN
    RAISE EXCEPTION 'No existe ninguna cuenta con el correo "%". El usuario debe registrarse primero.', p_email;
  END IF;

  -- Asegurar fila en public.usuarios
  INSERT INTO public.usuarios (id, nombres, estado, created_at)
  VALUES (v_target_uid, split_part(trim(p_email), '@', 1), 'activo', now())
  ON CONFLICT (id) DO NOTHING;

  -- Rol por defecto: "usuario"
  SELECT id INTO v_rol_id FROM roles WHERE codigo = 'usuario' LIMIT 1;

  -- ¿Ya es miembro?
  SELECT id INTO v_eu_id
  FROM empresas_usuarios
  WHERE empresa_id = p_empresa_id AND usuario_id = v_target_uid;

  IF v_eu_id IS NOT NULL THEN
    UPDATE empresas_usuarios SET activo = true WHERE id = v_eu_id;
    RETURN json_build_object('ok', true, 'ya_miembro', true);
  END IF;

  -- Agregar
  INSERT INTO empresas_usuarios (empresa_id, usuario_id, rol_id, activo, fecha_inicio)
  VALUES (p_empresa_id, v_target_uid, v_rol_id, true, now());

  RETURN json_build_object('ok', true, 'ya_miembro', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_invitar_usuario_por_email(text, uuid) TO authenticated;
