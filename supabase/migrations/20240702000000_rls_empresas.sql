-- =============================================================================
-- RLS: empresas + empresas_usuarios
-- Problema: ambas tablas tienen RLS habilitado pero cero políticas →
--   todo SELECT de rol 'authenticated' devuelve [] (deny-by-default).
--
-- Diseño:
--   • empresas_usuarios → un usuario solo ve sus propias filas
--   • empresas           → un usuario solo ve las empresas a las que pertenece
--   • Mutaciones en empresas: cualquier miembro activo puede actualizar
--     su empresa (empresa-section.tsx lo hace vía supabase.from("empresas").update)
--   • Mutaciones en empresas_usuarios: denegadas para 'authenticated';
--     solo service_role (Dashboard / RPCs SECURITY DEFINER)
--   • service_role siempre ignora RLS — no requiere políticas propias
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FUNCIÓN AUXILIAR: verifica membresía activa sin tocar RLS
-- Usada en la política SELECT de 'empresas' para evitar recursión potencial.
-- SECURITY DEFINER → lee empresas_usuarios sin aplicar sus propias políticas.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_es_miembro_activo(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   empresas_usuarios eu
    WHERE  eu.empresa_id = p_empresa_id
      AND  eu.usuario_id = auth.uid()
      AND  eu.activo     = true
  );
$$;

-- =============================================================================
-- TABLA: empresas_usuarios
-- =============================================================================

-- SELECT: solo las filas donde el propio usuario es el miembro
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='empresas_usuarios' AND policyname='eu_select_own') THEN
    CREATE POLICY "eu_select_own"
      ON empresas_usuarios FOR SELECT TO authenticated
      USING (usuario_id = auth.uid());
  END IF;
END $$;

-- INSERT / UPDATE / DELETE: denegado para 'authenticated'.
-- Las altas/bajas/cambios de membresía solo se hacen desde el Dashboard
-- (service_role) o futuras RPCs SECURITY DEFINER.
-- (Sin políticas FOR INSERT/UPDATE/DELETE → deny-by-default de PostgreSQL)

-- =============================================================================
-- TABLA: empresas
-- =============================================================================

-- SELECT: solo empresas donde el usuario tiene membresía activa.
-- Usa la función SECURITY DEFINER para evitar cruce con la política de
-- empresas_usuarios al evaluar el EXISTS.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='empresas' AND policyname='empresas_select_member') THEN
    CREATE POLICY "empresas_select_member"
      ON empresas FOR SELECT TO authenticated
      USING (auth_es_miembro_activo(id));
  END IF;
END $$;

-- UPDATE: cualquier miembro activo puede modificar los datos de su empresa.
-- Cubre el caso de empresa-section.tsx (actualizar nombre, logo, moneda, etc.).
-- La USING verifica que el usuario pertenece a la empresa antes de mostrársela;
-- el WITH CHECK confirma que no puede trasladarse a otra empresa.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='empresas' AND policyname='empresas_update_member') THEN
    CREATE POLICY "empresas_update_member"
      ON empresas FOR UPDATE TO authenticated
      USING  (auth_es_miembro_activo(id))
      WITH CHECK (auth_es_miembro_activo(id));
  END IF;
END $$;

-- INSERT / DELETE: denegado para 'authenticated'.
-- La creación de empresas y el soft-delete se hacen desde el Dashboard
-- (service_role) o scripts de onboarding.
-- (Sin políticas FOR INSERT/DELETE → deny-by-default)
