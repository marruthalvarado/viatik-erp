-- ============================================================
-- Fix admin role checks: incluir roles adicionales y super_admin
-- Problema: _assert_admin_empresa y es_admin_empresa solo revisaban
-- el rol primario (eu.rol_id) e ignoraban eu.roles_adicionales.
-- Además no reconocían "super_admin" / "super_administrador" como admin.
-- ============================================================

-- Códigos que se consideran de nivel administrador
-- (la lista se evalúa en minúsculas con lower())
-- Incluye: 'admin', 'administrador', 'super_admin', 'super_administrador'

-- ─── 1. _assert_admin_empresa: primario + adicionales ────────────────────────

CREATE OR REPLACE FUNCTION public._assert_admin_empresa(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Acepta si el rol PRIMARIO o cualquier rol ADICIONAL tiene código de admin
  IF NOT EXISTS (
    SELECT 1
    FROM empresas_usuarios eu
    WHERE eu.empresa_id = p_empresa_id
      AND eu.usuario_id = auth.uid()
      AND eu.activo = true
      AND (
        -- Rol primario
        EXISTS (
          SELECT 1 FROM roles r
          WHERE r.id = eu.rol_id
            AND lower(r.codigo) = ANY(ARRAY['admin','administrador','super_admin','super_administrador'])
        )
        OR
        -- Roles adicionales (array de UUIDs)
        EXISTS (
          SELECT 1 FROM roles r
          WHERE r.id = ANY(COALESCE(eu.roles_adicionales, '{}'::uuid[]))
            AND lower(r.codigo) = ANY(ARRAY['admin','administrador','super_admin','super_administrador'])
        )
      )
  ) THEN
    RAISE EXCEPTION 'Se requiere rol Administrador';
  END IF;
END;
$$;

-- ─── 2. es_admin_empresa: primario + adicionales ──────────────────────────────

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
    WHERE eu.empresa_id = p_empresa_id
      AND eu.usuario_id = auth.uid()
      AND eu.activo = true
      AND (
        -- Rol primario
        EXISTS (
          SELECT 1 FROM roles r
          WHERE r.id = eu.rol_id
            AND lower(r.codigo) = ANY(ARRAY['admin','administrador','super_admin','super_administrador'])
        )
        OR
        -- Roles adicionales
        EXISTS (
          SELECT 1 FROM roles r
          WHERE r.id = ANY(COALESCE(eu.roles_adicionales, '{}'::uuid[]))
            AND lower(r.codigo) = ANY(ARRAY['admin','administrador','super_admin','super_administrador'])
        )
      )
  );
END;
$$;
