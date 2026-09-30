-- ─────────────────────────────────────────────────────────────────────────────
-- Soporte para variantes de modelo y rangos de medición en actividades de OS
--
-- Objetivo: cuando una actividad aplica a múltiples modelos de detector con
-- valores de referencia distintos (ej: HD3(C) vs HD3R), el técnico puede
-- seleccionar el modelo específico del equipo y el sistema valida
-- automáticamente si cada medición está dentro del rango esperado.
--
-- Estructura de variantes_modelo (JSONB):
-- [
--   {
--     "modelo": "HD3(C)",
--     "etiquetas": ["HD3(C) +5.15V", "HD3(C) -5.20V", ...],
--     "rangos": [
--       {"ref": "+5.15V", "min": 4.90, "max": 5.40},
--       {"ref": "-5.20V", "min": -5.50, "max": -4.90},
--       ...
--     ]
--   },
--   { "modelo": "HD3R", ... }
-- ]
--
-- Estructura de rangos_medicion (JSONB, array paralelo a valores_medidos):
-- [{"ref": "+5.15V", "min": 4.90, "max": 5.40}, ...]
-- ─────────────────────────────────────────────────────────────────────────────
SET statement_timeout = 0;

-- 1. protocolo_actividades: definición de variantes de modelo
ALTER TABLE public.protocolo_actividades
  ADD COLUMN IF NOT EXISTS variantes_modelo JSONB DEFAULT NULL;

-- 2. os_actividades: variante activa + rangos derivados
ALTER TABLE public.os_actividades
  ADD COLUMN IF NOT EXISTS variantes_modelo    JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS modelo_seleccionado TEXT  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rangos_medicion     JSONB DEFAULT NULL;

-- 3. RPC: rpc_cargar_actividades_protocolo — copia variantes_modelo
CREATE OR REPLACE FUNCTION public.rpc_cargar_actividades_protocolo(
  p_orden_id         uuid,
  p_protocolo_id     uuid,
  p_meses_acumulados integer DEFAULT 6
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
  SELECT empresa_id INTO v_empresa_id
  FROM public.ordenes_servicio WHERE id = p_orden_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Orden no encontrada: %', p_orden_id;
  END IF;

  DELETE FROM public.os_actividades WHERE orden_id = p_orden_id;

  v_orden := 1;

  FOR r_sec IN
    SELECT ps.id, ps.titulo, ps.intervalo_meses
    FROM public.protocolo_secciones ps
    WHERE ps.protocolo_id = p_protocolo_id
      AND (ps.intervalo_meses IS NULL OR ps.intervalo_meses <= p_meses_acumulados)
    ORDER BY ps.orden
  LOOP
    FOR r_act IN
      SELECT *
      FROM public.protocolo_actividades pa
      WHERE pa.seccion_id = r_sec.id
      ORDER BY pa.orden
    LOOP
      INSERT INTO public.os_actividades (
        empresa_id, orden_id, protocolo_actividad_id,
        seccion_titulo, numero_paso, descripcion, tipo_campo,
        valor_min, valor_max, unidad, es_critico, orden,
        etiquetas_medicion,
        variantes_modelo
      ) VALUES (
        v_empresa_id, p_orden_id, r_act.id,
        r_sec.titulo, r_act.numero_paso, r_act.descripcion, r_act.tipo_campo,
        r_act.valor_min, r_act.valor_max, r_act.unidad, r_act.es_critico,
        v_orden,
        r_act.etiquetas_medicion,
        r_act.variantes_modelo
      );
      v_orden := v_orden + 1;
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 4. RPC: rpc_actualizar_os_actividad — agrega modelo_seleccionado, rangos_medicion, etiquetas_medicion
CREATE OR REPLACE FUNCTION public.rpc_actualizar_os_actividad(
  p_id                 uuid,
  p_resultado          text      DEFAULT NULL,
  p_valor_medido       numeric   DEFAULT NULL,
  p_valores_medidos    numeric[] DEFAULT NULL,
  p_texto_respuesta    text      DEFAULT NULL,
  p_notas_resultado    text      DEFAULT NULL,
  p_modelo_seleccionado text     DEFAULT NULL,
  p_rangos_medicion    jsonb     DEFAULT NULL,
  p_etiquetas_medicion text[]    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.os_actividades SET
    resultado            = COALESCE(p_resultado,            resultado),
    valor_medido         = COALESCE(p_valor_medido,         valor_medido),
    valores_medidos      = COALESCE(p_valores_medidos,      valores_medidos),
    texto_respuesta      = COALESCE(p_texto_respuesta,      texto_respuesta),
    notas_resultado      = COALESCE(p_notas_resultado,      notas_resultado),
    modelo_seleccionado  = COALESCE(p_modelo_seleccionado,  modelo_seleccionado),
    rangos_medicion      = COALESCE(p_rangos_medicion,      rangos_medicion),
    etiquetas_medicion   = COALESCE(p_etiquetas_medicion,   etiquetas_medicion),
    completado_en        = CASE
      WHEN p_resultado IS NOT NULL THEN now()
      ELSE completado_en
    END
  WHERE id = p_id;
END;
$$;

-- ─── Nota para el operador ───────────────────────────────────────────────────
-- Para configurar variantes en la actividad 2.1.5 (voltajes detectores):
--
-- UPDATE protocolo_actividades
-- SET variantes_modelo = '[
--   {"modelo":"HD3(C)","etiquetas":["HD3(C) +5.15V","HD3(C) -5.20V","HD3(C) +20.0V","HD3(C) -20.0V"],
--    "rangos":[{"ref":"+5.15V","min":4.90,"max":5.40},{"ref":"-5.20V","min":-5.50,"max":-4.90},
--              {"ref":"+20.0V","min":19.0,"max":21.0},{"ref":"-20.0V","min":-21.0,"max":-19.0}]},
--   {"modelo":"HD3R","etiquetas":["HD3R +5.20V","HD3R -5.20V","HD3R +12.0V","HD3R -12.0V"],
--    "rangos":[{"ref":"+5.20V","min":4.90,"max":5.50},{"ref":"-5.20V","min":-5.50,"max":-4.90},
--              {"ref":"+12.0V","min":11.0,"max":13.0},{"ref":"-12.0V","min":-13.0,"max":-11.0}]}
-- ]'::jsonb
-- WHERE descripcion ILIKE '%Verificación de voltajes%';
-- ─────────────────────────────────────────────────────────────────────────────
