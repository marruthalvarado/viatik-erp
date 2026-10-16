-- =============================================================================
-- Fix: usr_select usa EXISTS sobre empresas_usuarios que tiene su propio RLS
-- (eu_select_own solo muestra las filas del usuario activo). Al evaluar
-- eu2.usuario_id = <otro_usuario>, RLS bloquea eu2 y el JOIN retorna vacío.
--
-- Solución: función SECURITY DEFINER que lee empresas_usuarios sin RLS y
-- verifica que dos usuarios pertenezcan a la misma empresa activa.
-- =============================================================================

-- 1. Función helper (SECURITY DEFINER = ignora RLS al leer empresas_usuarios)
CREATE OR REPLACE FUNCTION public.misma_empresa(p_uid1 uuid, p_uid2 uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.empresas_usuarios eu1
    JOIN   public.empresas_usuarios eu2 ON eu2.empresa_id = eu1.empresa_id
    WHERE  eu1.usuario_id = p_uid1
      AND  eu1.activo     = true
      AND  eu2.usuario_id = p_uid2
      AND  eu2.activo     = true
  );
$$;

-- 2. Reemplazar la policy usr_select con la versión que usa la función
DROP POLICY IF EXISTS "usr_select" ON public.usuarios;

CREATE POLICY "usr_select" ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.misma_empresa(auth.uid(), id)
  );
