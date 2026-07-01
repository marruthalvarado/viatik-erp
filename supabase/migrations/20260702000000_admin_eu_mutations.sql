-- ============================================================
-- Admin mutations para empresas_usuarios via SECURITY DEFINER
-- Necesario porque la política RLS bloquea UPDATE/INSERT directo
-- en empresas_usuarios para el rol 'authenticated'.
-- ============================================================

-- ─── Helper: verificar que el caller es admin activo de la empresa ────────────

CREATE OR REPLACE FUNCTION public._assert_admin_empresa(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rol text;
BEGIN
  SELECT r.codigo INTO v_rol
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

-- ─── 1. Cambiar rol de un miembro ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_cambiar_rol_usuario(
  p_eu_id  uuid,
  p_rol_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_empresa_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT empresa_id INTO v_empresa_id FROM empresas_usuarios WHERE id = p_eu_id;
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Miembro no encontrado'; END IF;

  PERFORM public._assert_admin_empresa(v_empresa_id);

  UPDATE empresas_usuarios SET rol_id = p_rol_id WHERE id = p_eu_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_cambiar_rol_usuario(uuid, uuid) TO authenticated;

-- ─── 2. Desactivar un miembro ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_desactivar_usuario(p_eu_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_empresa_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT empresa_id INTO v_empresa_id FROM empresas_usuarios WHERE id = p_eu_id;
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Miembro no encontrado'; END IF;

  PERFORM public._assert_admin_empresa(v_empresa_id);

  UPDATE empresas_usuarios SET activo = false WHERE id = p_eu_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_desactivar_usuario(uuid) TO authenticated;

-- ─── 3. Reactivar un miembro ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_reactivar_usuario(p_eu_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_empresa_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT empresa_id INTO v_empresa_id FROM empresas_usuarios WHERE id = p_eu_id;
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Miembro no encontrado'; END IF;

  PERFORM public._assert_admin_empresa(v_empresa_id);

  UPDATE empresas_usuarios SET activo = true WHERE id = p_eu_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reactivar_usuario(uuid) TO authenticated;
