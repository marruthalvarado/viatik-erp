-- Cambiar fecha_programada de date a timestamptz para soportar hora.
ALTER TABLE ordenes_servicio
  ALTER COLUMN fecha_programada TYPE timestamptz
  USING fecha_programada::timestamptz;

-- Actualizar RPC crear_orden_servicio — castear a timestamptz
CREATE OR REPLACE FUNCTION public.crear_orden_servicio(
  p_empresa_id  uuid,
  p_datos       jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO ordenes_servicio (
    empresa_id, tipo, modalidad_cobro,
    equipo_id, cliente_id, proyecto_id, contrato_id,
    tecnico_id, fecha_programada,
    descripcion_problema, diagnostico,
    estado, costo_mano_obra, created_by
  )
  VALUES (
    p_empresa_id,
    p_datos->>'tipo',
    COALESCE(p_datos->>'modalidad_cobro', 'por_visita'),
    (p_datos->>'equipo_id')::uuid,
    (p_datos->>'cliente_id')::uuid,
    (p_datos->>'proyecto_id')::uuid,
    (p_datos->>'contrato_id')::uuid,
    (p_datos->>'tecnico_id')::uuid,
    (p_datos->>'fecha_programada')::timestamptz,
    p_datos->>'descripcion_problema',
    p_datos->>'diagnostico',
    COALESCE(p_datos->>'estado', 'pendiente'),
    (p_datos->>'costo_mano_obra')::numeric,
    auth.uid()
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Actualizar RPC actualizar_orden_servicio — castear a timestamptz
CREATE OR REPLACE FUNCTION public.actualizar_orden_servicio(
  p_id     uuid,
  p_datos  jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ordenes_servicio SET
    tipo                  = COALESCE(p_datos->>'tipo', tipo),
    modalidad_cobro       = COALESCE(p_datos->>'modalidad_cobro', modalidad_cobro),
    equipo_id             = COALESCE((p_datos->>'equipo_id')::uuid, equipo_id),
    cliente_id            = (p_datos->>'cliente_id')::uuid,
    proyecto_id           = (p_datos->>'proyecto_id')::uuid,
    contrato_id           = (p_datos->>'contrato_id')::uuid,
    tecnico_id            = (p_datos->>'tecnico_id')::uuid,
    fecha_programada      = (p_datos->>'fecha_programada')::timestamptz,
    descripcion_problema  = p_datos->>'descripcion_problema',
    diagnostico           = p_datos->>'diagnostico',
    estado                = COALESCE(p_datos->>'estado', estado),
    costo_mano_obra       = (p_datos->>'costo_mano_obra')::numeric,
    trabajos_realizados   = p_datos->>'trabajos_realizados',
    observaciones         = p_datos->>'observaciones',
    tecnico2_id           = (p_datos->>'tecnico2_id')::uuid,
    incluye_correctivo    = COALESCE((p_datos->>'incluye_correctivo')::boolean, incluye_correctivo),
    descripcion_correctivo = p_datos->>'descripcion_correctivo'
  WHERE id = p_id;
END;
$$;
