-- =============================================================================
-- Fix: rendir_aprobadores_disponibles — u.email no existe en public.usuarios
--
-- public.usuarios no tiene columna email; el SELECT u.email falla en runtime
-- y devuelve un error (array vacío en el frontend).
--
-- Fix: LEFT JOIN auth.users para obtener email desde la tabla de auth.
-- Se ajusta search_path para incluir auth.
-- =============================================================================

CREATE OR REPLACE FUNCTION rendir_aprobadores_disponibles()
RETURNS TABLE (
  usuario_id UUID,
  nombres    TEXT,
  apellidos  TEXT,
  email      TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  -- Obtener empresa activa del usuario actual
  SELECT eu.empresa_id INTO v_empresa_id
  FROM empresas_usuarios eu
  WHERE eu.usuario_id = auth.uid()
    AND eu.activo = TRUE
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    eu.usuario_id,
    COALESCE(u.nombres, split_part(au.email, '@', 1)) AS nombres,
    u.apellidos,
    au.email
  FROM empresas_usuarios eu
  LEFT JOIN public.usuarios u ON u.id = eu.usuario_id
  LEFT JOIN auth.users     au ON au.id = eu.usuario_id
  WHERE eu.empresa_id = v_empresa_id
    AND eu.activo = TRUE
    AND eu.usuario_id <> auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION rendir_aprobadores_disponibles() TO authenticated;
