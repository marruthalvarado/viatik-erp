-- =============================================================
-- ST-C: OS Actividades — checklist de protocolo por OS
-- =============================================================
SET statement_timeout = 0;

-- ─── Tabla: os_actividades ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.os_actividades (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id             uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  orden_id               uuid NOT NULL REFERENCES public.ordenes_servicio(id) ON DELETE CASCADE,
  protocolo_actividad_id uuid REFERENCES public.protocolo_actividades(id) ON DELETE SET NULL,
  seccion_titulo         text,                      -- copia snapshot
  numero_paso            text,
  descripcion            text NOT NULL,
  tipo_campo             text NOT NULL DEFAULT 'check3',
  -- Resultados
  resultado              text,                      -- 'ok' | 'no_ok' | 'na'
  valor_medido           numeric,
  valor_min              numeric,
  valor_max              numeric,
  unidad                 text,
  texto_respuesta        text,
  es_critico             boolean NOT NULL DEFAULT false,
  notas_resultado        text,
  -- Meta
  orden                  integer NOT NULL DEFAULT 0,
  completado_en          timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_os_actividades_orden ON public.os_actividades(orden_id);
CREATE INDEX IF NOT EXISTS idx_os_actividades_empresa ON public.os_actividades(empresa_id);

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.os_actividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "os_actividades_empresa" ON public.os_actividades
  USING (empresa_id IN (
    SELECT eu.empresa_id FROM public.empresas_usuarios eu
    WHERE eu.usuario_id = auth.uid()
  ));

-- ─── RPC: rpc_cargar_actividades_protocolo ────────────────────
-- Carga las actividades de un protocolo en una OS según secciones
-- que aplican para el número de visita y frecuencia del contrato.
-- intervalo_meses NULL = aplica siempre; 6 = semestral; etc.
-- Lógica de acumulación: si es visita 4 semestral (24 meses acumulados),
-- aplican secciones con intervalo NULL, 6, 12 y 24.
CREATE OR REPLACE FUNCTION public.rpc_cargar_actividades_protocolo(
  p_orden_id    uuid,
  p_protocolo_id uuid,
  p_meses_acumulados integer DEFAULT 6  -- meses desde inicio del contrato
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_count      integer := 0;
  v_orden      integer;
  r_sec        RECORD;
  r_act        RECORD;
BEGIN
  -- Obtener empresa_id desde la OS
  SELECT empresa_id INTO v_empresa_id
  FROM public.ordenes_servicio WHERE id = p_orden_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Orden no encontrada: %', p_orden_id;
  END IF;

  -- Limpiar actividades previas de la misma OS (para re-carga)
  DELETE FROM public.os_actividades WHERE orden_id = p_orden_id;

  v_orden := 0;

  -- Iterar secciones del protocolo que aplican según meses acumulados
  FOR r_sec IN
    SELECT ps.id, ps.numero, ps.titulo, ps.intervalo_meses
    FROM public.protocolo_secciones ps
    WHERE ps.protocolo_id = p_protocolo_id
      AND (
        ps.intervalo_meses IS NULL                         -- siempre aplica
        OR (p_meses_acumulados % ps.intervalo_meses = 0)  -- aplica en este múltiplo
      )
    ORDER BY ps.numero
  LOOP
    -- Insertar actividades de esa sección
    FOR r_act IN
      SELECT *
      FROM public.protocolo_actividades pa
      WHERE pa.seccion_id = r_sec.id
      ORDER BY pa.orden
    LOOP
      INSERT INTO public.os_actividades (
        empresa_id, orden_id, protocolo_actividad_id,
        seccion_titulo, numero_paso, descripcion, tipo_campo,
        valor_min, valor_max, unidad, es_critico, orden
      ) VALUES (
        v_empresa_id, p_orden_id, r_act.id,
        r_sec.titulo, r_act.numero_paso, r_act.descripcion, r_act.tipo_campo,
        r_act.valor_min, r_act.valor_max, r_act.unidad, r_act.es_critico,
        v_orden
      );
      v_orden := v_orden + 1;
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ─── RPC: rpc_actualizar_os_actividad ────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_actualizar_os_actividad(
  p_id              uuid,
  p_resultado       text        DEFAULT NULL,
  p_valor_medido    numeric     DEFAULT NULL,
  p_texto_respuesta text        DEFAULT NULL,
  p_notas_resultado text        DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.os_actividades SET
    resultado       = COALESCE(p_resultado,       resultado),
    valor_medido    = COALESCE(p_valor_medido,    valor_medido),
    texto_respuesta = COALESCE(p_texto_respuesta, texto_respuesta),
    notas_resultado = COALESCE(p_notas_resultado, notas_resultado),
    completado_en   = CASE
      WHEN p_resultado IS NOT NULL THEN now()
      ELSE completado_en
    END
  WHERE id = p_id;
END;
$$;

-- ─── RPC: rpc_resumen_os_actividades ─────────────────────────
-- Retorna estadísticas de progreso del checklist
CREATE OR REPLACE FUNCTION public.rpc_resumen_os_actividades(p_orden_id uuid)
RETURNS json
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total',      COUNT(*),
    'completadas', COUNT(*) FILTER (WHERE resultado IS NOT NULL),
    'ok',          COUNT(*) FILTER (WHERE resultado = 'ok'),
    'no_ok',       COUNT(*) FILTER (WHERE resultado = 'no_ok'),
    'na',          COUNT(*) FILTER (WHERE resultado = 'na'),
    'criticas_no_ok', COUNT(*) FILTER (WHERE resultado = 'no_ok' AND es_critico)
  )
  FROM public.os_actividades
  WHERE orden_id = p_orden_id;
$$;
