-- Fix: las funciones 3-param de crear/actualizar_orden_servicio casteaban fecha_programada a ::date,
-- eliminando la hora. La migración 003 creó overloads 2-param con ::timestamptz, pero el frontend
-- siempre llama a la versión 3-param (pasa p_repuestos), por lo que seguía usando el cast ::date.
-- Solución: reemplazar ambas funciones 3-param con ::timestamptz correcto.

-- Fix crear_orden_servicio (3-param)
DROP FUNCTION IF EXISTS public.crear_orden_servicio(uuid, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.crear_orden_servicio(
  p_empresa_id uuid,
  p_datos      jsonb,
  p_repuestos  jsonb DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id     uuid;
  v_seq    bigint;
  v_numero text;
  v_rep    jsonb;
BEGIN
  v_seq    := nextval('public.seq_ordenes_servicio');
  v_numero := 'OS-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO public.ordenes_servicio (
    empresa_id, numero, tipo, estado, modalidad_cobro,
    equipo_id, cliente_id, proyecto_id, contrato_id, tecnico_id,
    fecha_programada, descripcion_problema, diagnostico,
    trabajos_realizados, observaciones,
    costo_mano_obra, created_by
  ) VALUES (
    p_empresa_id, v_numero,
    p_datos->>'tipo',
    COALESCE(p_datos->>'estado', 'pendiente'),
    COALESCE(p_datos->>'modalidad_cobro', 'por_visita'),
    (p_datos->>'equipo_id')::uuid,
    (p_datos->>'cliente_id')::uuid,
    (p_datos->>'proyecto_id')::uuid,
    (p_datos->>'contrato_id')::uuid,
    (p_datos->>'tecnico_id')::uuid,
    -- FIX: era ::date (eliminaba la hora). Ahora ::timestamptz preserva la hora.
    (p_datos->>'fecha_programada')::timestamptz,
    p_datos->>'descripcion_problema',
    p_datos->>'diagnostico',
    p_datos->>'trabajos_realizados',
    p_datos->>'observaciones',
    COALESCE((p_datos->>'costo_mano_obra')::numeric, 0),
    auth.uid()
  )
  RETURNING id INTO v_id;

  FOR v_rep IN SELECT * FROM jsonb_array_elements(p_repuestos) LOOP
    INSERT INTO public.os_repuestos (
      orden_id, catalogo_id, descripcion, cantidad, precio_unitario, notas
    ) VALUES (
      v_id,
      (v_rep->>'catalogo_id')::uuid,
      v_rep->>'descripcion',
      COALESCE((v_rep->>'cantidad')::numeric, 1),
      COALESCE((v_rep->>'precio_unitario')::numeric, 0),
      v_rep->>'notas'
    );
  END LOOP;

  RETURN jsonb_build_object('id', v_id, 'numero', v_numero);
END;
$$;

-- Fix actualizar_orden_servicio (3-param)
DROP FUNCTION IF EXISTS public.actualizar_orden_servicio(uuid, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.actualizar_orden_servicio(
  p_id        uuid,
  p_datos     jsonb,
  p_repuestos jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rep jsonb;
BEGIN
  UPDATE public.ordenes_servicio SET
    tipo                  = COALESCE(p_datos->>'tipo', tipo),
    estado                = COALESCE(p_datos->>'estado', estado),
    modalidad_cobro       = COALESCE(p_datos->>'modalidad_cobro', modalidad_cobro),
    equipo_id             = COALESCE((p_datos->>'equipo_id')::uuid, equipo_id),
    cliente_id            = (p_datos->>'cliente_id')::uuid,
    proyecto_id           = (p_datos->>'proyecto_id')::uuid,
    contrato_id           = (p_datos->>'contrato_id')::uuid,
    tecnico_id            = (p_datos->>'tecnico_id')::uuid,
    tecnico2_id           = (p_datos->>'tecnico2_id')::uuid,
    -- FIX: era ::date (eliminaba la hora). Ahora ::timestamptz preserva la hora.
    fecha_programada      = (p_datos->>'fecha_programada')::timestamptz,
    fecha_inicio          = (p_datos->>'fecha_inicio')::timestamptz,
    fecha_cierre          = (p_datos->>'fecha_cierre')::timestamptz,
    descripcion_problema  = p_datos->>'descripcion_problema',
    diagnostico           = p_datos->>'diagnostico',
    trabajos_realizados   = p_datos->>'trabajos_realizados',
    observaciones         = p_datos->>'observaciones',
    firma_tecnico_url     = COALESCE(p_datos->>'firma_tecnico_url', firma_tecnico_url),
    firma_tecnico2_url    = COALESCE(p_datos->>'firma_tecnico2_url', firma_tecnico2_url),
    firma_cliente_url     = COALESCE(p_datos->>'firma_cliente_url', firma_cliente_url),
    cotizacion_id         = (p_datos->>'cotizacion_id')::uuid,
    factura_id            = (p_datos->>'factura_id')::uuid,
    costo_mano_obra       = COALESCE((p_datos->>'costo_mano_obra')::numeric, costo_mano_obra),
    incluye_correctivo    = COALESCE((p_datos->>'incluye_correctivo')::boolean, incluye_correctivo),
    descripcion_correctivo = p_datos->>'descripcion_correctivo',
    updated_at            = now()
  WHERE id = p_id;

  -- Actualizar repuestos si se proporcionaron
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
