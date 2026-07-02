-- Permite a un usuario actualizar su propio perfil (nombres, apellidos, cargo)
-- y al administrador actualizar el perfil de cualquier miembro de la empresa.

-- 1. Usuario actualiza su propio perfil
CREATE OR REPLACE FUNCTION actualizar_perfil_propio(
  p_nombres   text,
  p_apellidos text DEFAULT NULL,
  p_cargo     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE usuarios
  SET nombres   = COALESCE(NULLIF(TRIM(p_nombres), ''), nombres),
      apellidos = TRIM(p_apellidos),
      cargo     = TRIM(p_cargo),
      updated_at = now()
  WHERE id = auth.uid();
END;
$$;

-- 2. Admin actualiza perfil de cualquier usuario de su empresa
CREATE OR REPLACE FUNCTION admin_actualizar_perfil_usuario(
  p_usuario_id uuid,
  p_nombres    text,
  p_apellidos  text DEFAULT NULL,
  p_cargo      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar que el caller es admin de alguna empresa en comun con el usuario
  IF NOT EXISTS (
    SELECT 1 FROM empresas_usuarios eu_admin
    JOIN empresas_usuarios eu_target ON eu_target.empresa_id = eu_admin.empresa_id
    JOIN roles r ON r.id = eu_admin.rol_id AND LOWER(r.codigo) = 'admin'
    WHERE eu_admin.usuario_id = auth.uid()
      AND eu_target.usuario_id = p_usuario_id
      AND eu_admin.activo = true
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para editar este perfil';
  END IF;

  UPDATE usuarios
  SET nombres   = COALESCE(NULLIF(TRIM(p_nombres), ''), nombres),
      apellidos = TRIM(p_apellidos),
      cargo     = TRIM(p_cargo),
      updated_at = now()
  WHERE id = p_usuario_id;
END;
$$;
