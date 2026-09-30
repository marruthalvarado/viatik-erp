-- =============================================================
-- ST-C fix: fabricante_id FK en modelos_equipo → proveedores
-- Elimina el campo texto libre y ata el fabricante al catálogo
-- de proveedores internacionales, igual que equipos_instalados.
-- =============================================================
SET statement_timeout = 0;

-- 1. Agregar FK fabricante_id
ALTER TABLE public.modelos_equipo
  ADD COLUMN IF NOT EXISTS fabricante_id uuid
    REFERENCES public.proveedores(id) ON DELETE SET NULL;

-- 2. Actualizar RPC crear (agrega p_fabricante_id, mantiene p_fabricante por compatibilidad)
CREATE OR REPLACE FUNCTION public.rpc_crear_modelo_equipo(
  p_empresa_id    uuid,
  p_modalidad_id  uuid,
  p_nombre        text,
  p_fabricante_id uuid    DEFAULT NULL,
  p_fabricante    text    DEFAULT NULL,
  p_descripcion   text    DEFAULT NULL
)
RETURNS public.modelos_equipo
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.modelos_equipo;
BEGIN
  INSERT INTO public.modelos_equipo (
    empresa_id, modalidad_id, nombre,
    fabricante_id, fabricante, descripcion
  ) VALUES (
    p_empresa_id, p_modalidad_id, trim(p_nombre),
    p_fabricante_id, p_fabricante, p_descripcion
  )
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- 3. Actualizar RPC editar
CREATE OR REPLACE FUNCTION public.rpc_actualizar_modelo_equipo(
  p_id            uuid,
  p_nombre        text    DEFAULT NULL,
  p_fabricante_id uuid    DEFAULT NULL,
  p_fabricante    text    DEFAULT NULL,
  p_descripcion   text    DEFAULT NULL,
  p_activo        boolean DEFAULT NULL
)
RETURNS public.modelos_equipo
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.modelos_equipo;
BEGIN
  UPDATE public.modelos_equipo SET
    nombre        = COALESCE(trim(p_nombre),   nombre),
    fabricante_id = CASE WHEN p_fabricante_id IS NOT NULL THEN p_fabricante_id ELSE fabricante_id END,
    fabricante    = COALESCE(p_fabricante,     fabricante),
    descripcion   = COALESCE(p_descripcion,    descripcion),
    activo        = COALESCE(p_activo,         activo)
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
