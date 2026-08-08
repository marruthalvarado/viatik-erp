-- 20260807000001_admin_create_user.sql
-- Creación de usuarios por el administrador con cambio de clave obligatorio en primer login

-- ─── 1. Columna debe_cambiar_clave en usuarios ───────────────────────────────

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS debe_cambiar_clave boolean NOT NULL DEFAULT false;

-- ─── 2. RPC que el propio usuario llama al cambiar su clave ──────────────────
-- SECURITY DEFINER para evitar depender de políticas RLS en UPDATE.

CREATE OR REPLACE FUNCTION public.marcar_clave_cambiada()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.usuarios
  SET debe_cambiar_clave = false
  WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.marcar_clave_cambiada() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_clave_cambiada() TO authenticated;
