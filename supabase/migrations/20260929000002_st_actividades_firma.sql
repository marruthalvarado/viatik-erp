-- =============================================================================
-- ST-A: Actividades de mantenimiento + firma digital + fabricante proveedor
-- =============================================================================
SET statement_timeout = 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. fabricante_id en equipos_instalados → FK a proveedores
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.equipos_instalados
  ADD COLUMN IF NOT EXISTS fabricante_id uuid REFERENCES public.proveedores(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Plantillas de actividades (para contratos / tipos de equipo)
--    Cada plantilla define UNA actividad recurrente con su periodicidad.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plantillas_actividad (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  nombre        text NOT NULL,
  descripcion   text,

  -- Periodicidad: mensual=30, trimestral=90, semestral=180, anual=365
  -- NULL = aplica siempre (en cada visita)
  periodicidad_dias integer,

  -- Filtros opcionales para que la plantilla se aplique automáticamente
  aplica_tipo_os  text CHECK (aplica_tipo_os IN ('preventivo','correctivo','instalacion','actualizacion','repuesto')),
  fabricante_id   uuid REFERENCES public.proveedores(id) ON DELETE SET NULL,

  activa      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plantillas_actividad_empresa ON public.plantillas_actividad(empresa_id);

-- RLS
ALTER TABLE public.plantillas_actividad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plantillas_actividad_empresa" ON public.plantillas_actividad
  FOR ALL TO authenticated
  USING (
    empresa_id IN (
      SELECT eu.empresa_id FROM public.empresas_usuarios eu
      WHERE eu.usuario_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Actividades por orden de servicio (checklist)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orden_actividades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id        uuid NOT NULL REFERENCES public.ordenes_servicio(id) ON DELETE CASCADE,

  -- Referencia a plantilla (nullable = actividad ad-hoc)
  plantilla_id    uuid REFERENCES public.plantillas_actividad(id) ON DELETE SET NULL,

  nombre          text NOT NULL,
  descripcion     text,

  -- Resultado del técnico
  completada      boolean NOT NULL DEFAULT false,
  observacion     text,          -- notas del técnico sobre esta actividad
  completada_en   timestamptz,   -- timestamp cuando marcó como completada

  orden_display   integer NOT NULL DEFAULT 0,   -- para ordenar en el reporte
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orden_actividades_orden ON public.orden_actividades(orden_id);

-- RLS a través de ordenes_servicio → empresa_id
ALTER TABLE public.orden_actividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orden_actividades_empresa" ON public.orden_actividades
  FOR ALL TO authenticated
  USING (
    orden_id IN (
      SELECT os.id FROM public.ordenes_servicio os
      WHERE os.empresa_id IN (
        SELECT eu.empresa_id FROM public.empresas_usuarios eu
        WHERE eu.usuario_id = auth.uid()
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Firma y datos de cierre extendidos en ordenes_servicio
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.ordenes_servicio
  ADD COLUMN IF NOT EXISTS firma_cliente_nombre text,     -- nombre de quien firmó
  ADD COLUMN IF NOT EXISTS firma_cliente_cargo  text,     -- cargo del firmante
  ADD COLUMN IF NOT EXISTS firma_cliente_data   text;     -- base64 de la firma (SVG/PNG)

-- firma_tecnico_data (el técnico también puede firmar en el mismo flujo)
ALTER TABLE public.ordenes_servicio
  ADD COLUMN IF NOT EXISTS firma_tecnico_data text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: obtener actividades de una orden con datos de plantilla
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_orden_actividades(p_orden_id uuid)
RETURNS TABLE (
  id              uuid,
  plantilla_id    uuid,
  nombre          text,
  descripcion     text,
  completada      boolean,
  observacion     text,
  completada_en   timestamptz,
  orden_display   integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    oa.id,
    oa.plantilla_id,
    oa.nombre,
    oa.descripcion,
    oa.completada,
    oa.observacion,
    oa.completada_en,
    oa.orden_display
  FROM public.orden_actividades oa
  JOIN public.ordenes_servicio os ON os.id = oa.orden_id
  WHERE oa.orden_id = p_orden_id
    AND os.empresa_id IN (
      SELECT eu.empresa_id FROM public.empresas_usuarios eu
      WHERE eu.usuario_id = auth.uid()
    )
  ORDER BY oa.orden_display, oa.created_at;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC: auto-insertar actividades desde plantillas al crear una OS preventiva
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.poblar_actividades_orden(
  p_orden_id    uuid,
  p_empresa_id  uuid,
  p_tipo_os     text,
  p_fabricante_id uuid DEFAULT NULL
)
RETURNS integer   -- cantidad de actividades insertadas
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO public.orden_actividades (orden_id, plantilla_id, nombre, descripcion, orden_display)
  SELECT
    p_orden_id,
    pa.id,
    pa.nombre,
    pa.descripcion,
    ROW_NUMBER() OVER (ORDER BY pa.periodicidad_dias NULLS LAST, pa.nombre)::integer
  FROM public.plantillas_actividad pa
  WHERE pa.empresa_id = p_empresa_id
    AND pa.activa = true
    AND (pa.aplica_tipo_os IS NULL OR pa.aplica_tipo_os = p_tipo_os)
    AND (pa.fabricante_id IS NULL OR pa.fabricante_id = p_fabricante_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
