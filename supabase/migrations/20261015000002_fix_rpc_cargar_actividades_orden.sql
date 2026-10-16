-- =============================================================================
-- Fix: rpc_cargar_actividades_protocolo usa ps.orden pero la columna se llama ps.numero
-- Migrations 20260930000001 y 20260930000002 introdujeron ORDER BY ps.orden por error.
-- protocolo_secciones tiene la columna "numero" (no "orden").
-- =============================================================================
SET statement_timeout = 0;

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
    SELECT ps.id, ps.numero, ps.titulo, ps.intervalo_meses
    FROM public.protocolo_secciones ps
    WHERE ps.protocolo_id = p_protocolo_id
      AND (
        ps.intervalo_meses IS NULL
        OR (p_meses_acumulados % ps.intervalo_meses = 0)
      )
    ORDER BY ps.numero        -- FIX: era ps.orden, la columna se llama ps.numero
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
