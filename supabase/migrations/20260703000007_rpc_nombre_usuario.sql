-- =============================================================================
-- RPC: rendir_nombre_usuario
--
-- Devuelve el nombre completo de un usuario dado su ID, siempre que el
-- solicitante y el objetivo esten en la misma empresa.
-- Necesario porque la politica usr_select no puede resolver nombres de
-- otros usuarios debido al RLS en cadena de empresas_usuarios.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rendir_nombre_usuario(p_usuario_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre     TEXT;
  v_empresa_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  -- Caso: el usuario pide su propio nombre
  IF p_usuario_id = auth.uid() THEN
    SELECT trim(nombres || ' ' || COALESCE(apellidos, ''))
    INTO v_nombre
    FROM usuarios
    WHERE id = p_usuario_id;
    RETURN COALESCE(v_nombre, p_usuario_id::TEXT);
  END IF;

  -- Obtener empresa del solicitante
  SELECT eu.empresa_id INTO v_empresa_id
  FROM empresas_usuarios eu
  WHERE eu.usuario_id = auth.uid()
    AND eu.activo = TRUE
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RETURN p_usuario_id::TEXT;
  END IF;

  -- Obtener nombre del objetivo si esta en la misma empresa
  SELECT trim(u.nombres || ' ' || COALESCE(u.apellidos, ''))
  INTO v_nombre
  FROM usuarios u
  JOIN empresas_usuarios eu ON eu.usuario_id = u.id
  WHERE u.id       = p_usuario_id
    AND eu.empresa_id = v_empresa_id
    AND eu.activo  = TRUE;

  RETURN COALESCE(v_nombre, p_usuario_id::TEXT);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rendir_nombre_usuario(UUID) TO authenticated;
