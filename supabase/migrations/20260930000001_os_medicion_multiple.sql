-- ─────────────────────────────────────────────────────────────────────────────
-- Soporte para medición múltiple en actividades de OS
--
-- Problema: algunas actividades del protocolo requieren registrar varios
-- valores medidos con etiqueta propia (ej: 4 voltajes del detector HD3).
--
-- Solución:
--   • protocolo_actividades.etiquetas_medicion TEXT[]
--     Define las sub-etiquetas de cada valor (ej. 'HD3C +5.15V').
--     NULL = medición simple (comportamiento actual).
--
--   • os_actividades.etiquetas_medicion TEXT[]
--     Copiado desde protocolo al cargar actividades.
--
--   • os_actividades.valores_medidos NUMERIC[]
--     Array paralelo a etiquetas_medicion con los valores reales medidos.
--
-- UI: cuando etiquetas_medicion no es NULL, se muestran N campos de entrada.
-- Resultado 'ok' se asigna automáticamente si todos los valores están en rango.
-- ─────────────────────────────────────────────────────────────────────────────
SET statement_timeout = 0;

-- 1. Columnas nuevas en protocolo_actividades
ALTER TABLE public.protocolo_actividades
  ADD COLUMN IF NOT EXISTS etiquetas_medicion TEXT[] DEFAULT NULL;

-- 2. Columnas nuevas en os_actividades
ALTER TABLE public.os_actividades
  ADD COLUMN IF NOT EXISTS etiquetas_medicion TEXT[]    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valores_medidos    NUMERIC[] DEFAULT NULL;

-- 3. RPC: rpc_cargar_actividades_protocolo — copiar etiquetas_medicion
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

  -- Limpiar actividades previas de esta OS
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
        etiquetas_medicion
      ) VALUES (
        v_empresa_id, p_orden_id, r_act.id,
        r_sec.titulo, r_act.numero_paso, r_act.descripcion, r_act.tipo_campo,
        r_act.valor_min, r_act.valor_max, r_act.unidad, r_act.es_critico,
        v_orden,
        r_act.etiquetas_medicion   -- nuevo: copia el array de etiquetas
      );
      v_orden := v_orden + 1;
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 4. RPC: rpc_actualizar_os_actividad — agrega p_valores_medidos
CREATE OR REPLACE FUNCTION public.rpc_actualizar_os_actividad(
  p_id              uuid,
  p_resultado       text      DEFAULT NULL,
  p_valor_medido    numeric   DEFAULT NULL,
  p_valores_medidos numeric[] DEFAULT NULL,
  p_texto_respuesta text      DEFAULT NULL,
  p_notas_resultado text      DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.os_actividades SET
    resultado        = COALESCE(p_resultado,        resultado),
    valor_medido     = COALESCE(p_valor_medido,     valor_medido),
    valores_medidos  = COALESCE(p_valores_medidos,  valores_medidos),
    texto_respuesta  = COALESCE(p_texto_respuesta,  texto_respuesta),
    notas_resultado  = COALESCE(p_notas_resultado,  notas_resultado),
    completado_en    = CASE
      WHEN p_resultado IS NOT NULL THEN now()
      ELSE completado_en
    END
  WHERE id = p_id;
END;
$$;

-- ─── Nota para el operador ───────────────────────────────────────────────────
-- Para configurar medición múltiple en una actividad existente del protocolo:
--
--   UPDATE protocolo_actividades
--   SET etiquetas_medicion = ARRAY['HD3(C) +5.15V','HD3(C) -5.20V','HD3(C) +20.0V','HD3(C) -20.0V']
--   WHERE descripcion ILIKE '%Verificación de voltajes%';
--
-- Las OS ya creadas deben re-cargarse con el botón "Cargar protocolo".
-- ─────────────────────────────────────────────────────────────────────────────
