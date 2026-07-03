-- =============================================================================
-- RPC: rendir_aprobadores_disponibles
-- Retorna todos los usuarios activos de la empresa del usuario actual,
-- excluyendose a si mismo. SECURITY DEFINER para bypassear RLS de
-- empresas_usuarios (que solo permite ver el propio registro).
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
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  -- Obtener empresa activa del usuario actual via su primera empresa activa
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
    u.nombres,
    u.apellidos,
    u.email
  FROM empresas_usuarios eu
  JOIN usuarios u ON u.id = eu.usuario_id
  WHERE eu.empresa_id = v_empresa_id
    AND eu.activo = TRUE
    AND eu.usuario_id <> auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION rendir_aprobadores_disponibles() TO authenticated;
