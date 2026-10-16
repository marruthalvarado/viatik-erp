-- =============================================================================
-- Fix: agregar modelo_id y fabricante_id a las RPCs crear/actualizar_equipo_instalado
-- =============================================================================
SET statement_timeout = 0;

-- La columna modelo_id ya existe (migración 20260929000003).
-- La columna fabricante_id ya existe (migración 20260929000002).
-- Solo hace falta corregir las RPCs para que las lean y escriban.

-- ─── crear_equipo_instalado (reescritura completa) ────────────────────────────
CREATE OR REPLACE FUNCTION public.crear_equipo_instalado(
  p_empresa_id  uuid,
  p_datos       jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id    uuid;
  v_nombre text;
BEGIN
  IF NOT es_miembro_empresa_st(p_empresa_id) THEN
    RAISE EXCEPTION 'Sin acceso';
  END IF;

  v_nombre := p_datos->>'nombre';
  IF v_nombre IS NULL OR trim(v_nombre) = '' THEN
    RAISE EXCEPTION 'nombre requerido';
  END IF;

  INSERT INTO public.equipos_instalados (
    empresa_id, inventario_unidad_id, catalogo_id, cotizacion_id, factura_id,
    cliente_id, proyecto_id, tecnico_instalador_id,
    modelo_id, fabricante_id,
    nombre, fabricante, modelo, numero_serie, numero_parte,
    ubicacion_instalacion, fecha_venta, fecha_instalacion,
    garantia_meses, estado, requiere_mantenimiento,
    frecuencia_mantenimiento_dias, proximo_mantenimiento,
    foto_url, acta_entrega_url, notas, created_by
  ) VALUES (
    p_empresa_id,
    (p_datos->>'inventario_unidad_id')::uuid,
    (p_datos->>'catalogo_id')::uuid,
    (p_datos->>'cotizacion_id')::uuid,
    (p_datos->>'factura_id')::uuid,
    (p_datos->>'cliente_id')::uuid,
    (p_datos->>'proyecto_id')::uuid,
    (p_datos->>'tecnico_instalador_id')::uuid,
    (p_datos->>'modelo_id')::uuid,
    (p_datos->>'fabricante_id')::uuid,
    trim(v_nombre),
    p_datos->>'fabricante',
    p_datos->>'modelo',
    p_datos->>'numero_serie',
    p_datos->>'numero_parte',
    p_datos->>'ubicacion_instalacion',
    (p_datos->>'fecha_venta')::date,
    (p_datos->>'fecha_instalacion')::date,
    COALESCE((p_datos->>'garantia_meses')::integer, 0),
    COALESCE(p_datos->>'estado', 'activo'),
    COALESCE((p_datos->>'requiere_mantenimiento')::boolean, false),
    (p_datos->>'frecuencia_mantenimiento_dias')::integer,
    (p_datos->>'proximo_mantenimiento')::date,
    p_datos->>'foto_url',
    p_datos->>'acta_entrega_url',
    p_datos->>'notas',
    auth.uid()
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

-- ─── actualizar_equipo_instalado (reescritura completa) ───────────────────────
CREATE OR REPLACE FUNCTION public.actualizar_equipo_instalado(
  p_id    uuid,
  p_datos jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.equipos_instalados SET
    inventario_unidad_id         = COALESCE((p_datos->>'inventario_unidad_id')::uuid, inventario_unidad_id),
    catalogo_id                  = (p_datos->>'catalogo_id')::uuid,
    cotizacion_id                = (p_datos->>'cotizacion_id')::uuid,
    factura_id                   = (p_datos->>'factura_id')::uuid,
    cliente_id                   = (p_datos->>'cliente_id')::uuid,
    proyecto_id                  = (p_datos->>'proyecto_id')::uuid,
    tecnico_instalador_id        = (p_datos->>'tecnico_instalador_id')::uuid,
    modelo_id                    = (p_datos->>'modelo_id')::uuid,
    fabricante_id                = (p_datos->>'fabricante_id')::uuid,
    nombre                       = COALESCE(p_datos->>'nombre', nombre),
    fabricante                   = p_datos->>'fabricante',
    modelo                       = p_datos->>'modelo',
    numero_serie                 = p_datos->>'numero_serie',
    numero_parte                 = p_datos->>'numero_parte',
    ubicacion_instalacion        = p_datos->>'ubicacion_instalacion',
    fecha_venta                  = COALESCE((p_datos->>'fecha_venta')::date, fecha_venta),
    fecha_instalacion            = (p_datos->>'fecha_instalacion')::date,
    garantia_meses               = COALESCE((p_datos->>'garantia_meses')::integer, garantia_meses),
    estado                       = COALESCE(p_datos->>'estado', estado),
    requiere_mantenimiento       = COALESCE((p_datos->>'requiere_mantenimiento')::boolean, requiere_mantenimiento),
    frecuencia_mantenimiento_dias= (p_datos->>'frecuencia_mantenimiento_dias')::integer,
    proximo_mantenimiento        = (p_datos->>'proximo_mantenimiento')::date,
    foto_url                     = COALESCE(p_datos->>'foto_url', foto_url),
    acta_entrega_url             = COALESCE(p_datos->>'acta_entrega_url', acta_entrega_url),
    notas                        = p_datos->>'notas',
    updated_at                   = now()
  WHERE id = p_id
    AND es_miembro_empresa_st(empresa_id)
    AND deleted_at IS NULL;
END;
$$;
