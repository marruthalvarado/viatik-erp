-- ============================================================
-- Fase 3 Importaciones: RPC actualizar costo catálogo
-- ============================================================

-- Propaga el costo_unitario_calculado de cada línea de embarque
-- al precio_costo del producto en productos_catalogo.
-- Solo actualiza productos que existen en el catálogo y tienen
-- costo_unitario_calculado calculado (no nulo).

CREATE OR REPLACE FUNCTION public.actualizar_costo_catalogo_desde_embarque(
  p_embarque_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_updated    int := 0;
BEGIN
  -- Verificar que el embarque pertenece a la empresa del usuario
  SELECT empresa_id INTO v_empresa_id
  FROM importaciones
  WHERE id = p_embarque_id
    AND empresa_id IN (
      SELECT empresa_id FROM empresas_usuarios
      WHERE usuario_id = auth.uid()
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque no encontrado o sin permisos';
  END IF;

  -- Actualizar precio_costo en productos_catalogo para cada línea
  UPDATE productos_catalogo pc
  SET
    precio_costo   = il.costo_unitario_calculado,
    updated_at     = now()
  FROM importacion_lineas il
  WHERE il.importacion_id = p_embarque_id
    AND il.producto_id    = pc.id
    AND il.costo_unitario_calculado IS NOT NULL
    AND pc.empresa_id = v_empresa_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok',           true,
    'actualizados', v_updated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_costo_catalogo_desde_embarque(uuid)
  TO authenticated;
