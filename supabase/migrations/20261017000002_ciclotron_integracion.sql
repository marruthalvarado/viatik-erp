-- ============================================================
-- CIC-INT: Integración Ciclotrones ↔ Base Instalada ↔ OS
-- ============================================================
-- 1. equipo_id en ciclotrones  → vincula al equipo físico en base instalada
-- 2. ciclo_produccion_id en ordenes_servicio → trazabilidad batch → OS correctiva
-- ============================================================

-- 1. Vincular ciclotrón con equipo de base instalada
ALTER TABLE public.ciclotrones
  ADD COLUMN IF NOT EXISTS equipo_id uuid REFERENCES public.equipos_instalados(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ciclotrones_equipo ON public.ciclotrones(equipo_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ciclotrones_equipo_unique
  ON public.ciclotrones(equipo_id) WHERE equipo_id IS NOT NULL;

-- 2. Vincular OS con batch de producción que la originó
ALTER TABLE public.ordenes_servicio
  ADD COLUMN IF NOT EXISTS ciclo_produccion_id uuid REFERENCES public.ciclo_producciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_os_ciclo_produccion ON public.ordenes_servicio(ciclo_produccion_id);

-- 3. Vista enriquecida: ciclotrón con datos del equipo, cliente y modelo
CREATE OR REPLACE VIEW public.ciclotrones_con_equipo AS
SELECT
  c.id,
  c.empresa_id,
  c.nombre,
  c.sitio,
  c.modelo,
  c.activo,
  c.notas,
  c.parametros,
  c.equipo_id,
  c.created_at,
  c.updated_at,
  -- datos del equipo vinculado
  e.numero_serie,
  e.ubicacion_instalacion AS equipo_ubicacion,
  e.fecha_instalacion,
  e.garantia_hasta,
  e.proximo_mantenimiento,
  e.estado             AS equipo_estado,
  -- cliente
  cl.id                AS cliente_id,
  cl.nombre            AS cliente_nombre,
  -- modelo
  m.id                 AS modelo_id,
  m.nombre             AS modelo_nombre,
  m.fabricante_nombre
FROM public.ciclotrones c
LEFT JOIN public.equipos_instalados e  ON e.id = c.equipo_id
LEFT JOIN public.clientes cl           ON cl.id = e.cliente_id
LEFT JOIN public.modelos_equipo m      ON m.id = e.modelo_id;

-- RLS: la vista hereda RLS de ciclotrones (row-level)
-- Pero necesitamos protegerla explícitamente vía función de acceso
GRANT SELECT ON public.ciclotrones_con_equipo TO authenticated;

-- 4. RPC: obtener ciclotrones con datos del equipo para una empresa
CREATE OR REPLACE FUNCTION public.get_ciclotrones_con_equipo(p_empresa_id uuid)
RETURNS SETOF public.ciclotrones_con_equipo
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.ciclotrones_con_equipo
  WHERE empresa_id = p_empresa_id
  ORDER BY nombre;
$$;

-- 5. RPC: OS originadas desde un batch específico
CREATE OR REPLACE FUNCTION public.get_os_de_batch(p_ciclo_produccion_id uuid)
RETURNS TABLE (
  os_id       uuid,
  numero      text,
  tipo        text,
  estado      text,
  fecha_programada date,
  descripcion_problema text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id,
    numero,
    tipo,
    estado,
    fecha_programada,
    descripcion_problema
  FROM public.ordenes_servicio
  WHERE ciclo_produccion_id = p_ciclo_produccion_id
  ORDER BY created_at DESC;
$$;
