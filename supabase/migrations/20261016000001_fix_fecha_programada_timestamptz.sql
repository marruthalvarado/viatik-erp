-- =============================================================================
-- Fix: actualizar_orden_servicio — fecha_programada debe castearse a
-- ::timestamptz, NO a ::date.
-- El cast a ::date trunca la hora, almacenando medianoche UTC, que en UTC-5
-- aparece como el día anterior a las 19:00.
-- Regression introducida en 20261015000004; este migration la corrige.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.actualizar_orden_servicio(
  p_id        uuid,
  p_datos     jsonb,
  p_repuestos jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rep jsonb;
BEGIN
  UPDATE public.ordenes_servicio SET
    tipo                 = COALESCE(p_datos->>'tipo',                tipo),
    estado               = COALESCE(p_datos->>'estado',              estado),
    modalidad_cobro      = COALESCE(p_datos->>'modalidad_cobro',     modalidad_cobro),
    equipo_id            = COALESCE((p_datos->>'equipo_id')::uuid,   equipo_id),
    -- Usar COALESCE para evitar borrar accidentalmente con payloads parciales
    cliente_id           = COALESCE((p_datos->>'cliente_id')::uuid,  cliente_id),
    proyecto_id          = COALESCE((p_datos->>'proyecto_id')::uuid, proyecto_id),
    contrato_id          = COALESCE((p_datos->>'contrato_id')::uuid, contrato_id),
    tecnico_id           = COALESCE((p_datos->>'tecnico_id')::uuid,  tecnico_id),
    tecnico2_id          = COALESCE((p_datos->>'tecnico2_id')::uuid, tecnico2_id),
    fecha_programada     = COALESCE((p_datos->>'fecha_programada')::timestamptz, fecha_programada),
    fecha_inicio         = COALESCE((p_datos->>'fecha_inicio')::timestamptz,  fecha_inicio),
    fecha_cierre         = COALESCE((p_datos->>'fecha_cierre')::timestamptz,  fecha_cierre),
    descripcion_problema = COALESCE(p_datos->>'descripcion_problema', descripcion_problema),
    diagnostico          = COALESCE(p_datos->>'diagnostico',          diagnostico),
    trabajos_realizados  = COALESCE(p_datos->>'trabajos_realizados',  trabajos_realizados),
    observaciones        = COALESCE(p_datos->>'observaciones',        observaciones),
    firma_tecnico_url    = COALESCE(p_datos->>'firma_tecnico_url',    firma_tecnico_url),
    firma_cliente_url    = COALESCE(p_datos->>'firma_cliente_url',    firma_cliente_url),
    cotizacion_id        = COALESCE((p_datos->>'cotizacion_id')::uuid, cotizacion_id),
    factura_id           = COALESCE((p_datos->>'factura_id')::uuid,   factura_id),
    costo_mano_obra      = COALESCE((p_datos->>'costo_mano_obra')::numeric, costo_mano_obra),
    updated_at           = now()
  WHERE id = p_id
    AND es_miembro_empresa_st(empresa_id)
    AND deleted_at IS NULL;

  -- Si se pasan repuestos, reemplazar
  IF p_repuestos IS NOT NULL THEN
    DELETE FROM public.os_repuestos WHERE orden_id = p_id;
    FOR v_rep IN SELECT * FROM jsonb_array_elements(p_repuestos) LOOP
      INSERT INTO public.os_repuestos (
        orden_id, catalogo_id, descripcion, cantidad, precio_unitario, notas
      ) VALUES (
        p_id,
        (v_rep->>'catalogo_id')::uuid,
        v_rep->>'descripcion',
        COALESCE((v_rep->>'cantidad')::numeric, 1),
        COALESCE((v_rep->>'precio_unitario')::numeric, 0),
        v_rep->>'notas'
      );
    END LOOP;
  END IF;
END;
$$;
