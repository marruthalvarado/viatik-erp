-- Fix: generar_asiento_gasto usaba v_gasto.proveedor_nombre que no existe.
-- gastos_empresa tiene proveedor_id → se hace JOIN con proveedores para obtener el nombre.

CREATE OR REPLACE FUNCTION public.generar_asiento_gasto(
  p_gasto_id   UUID,
  p_empresa_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gasto        RECORD;
  v_lineas       JSONB := '[]'::JSONB;
  v_cxp          UUID;
  v_iva_c        UUID;
  v_gasto_cuenta UUID;
  v_subtotal     NUMERIC;
  v_iva          NUMERIC;
  v_total        NUMERIC;
  v_prov_nombre  TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = p_empresa_id AND usuario_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Acceso denegado'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.asientos_contables
    WHERE empresa_id = p_empresa_id
      AND referencia_tipo = 'gasto'
      AND referencia_id = p_gasto_id
  ) THEN RAISE EXCEPTION 'Ya existe un asiento para este gasto'; END IF;

  -- JOIN con proveedores para obtener el nombre
  SELECT g.*, c.codigo_contable AS cat_codigo, p.nombre AS proveedor_nombre
  INTO v_gasto
  FROM public.gastos_empresa g
  LEFT JOIN public.categorias_gasto c ON c.id = g.categoria_id
  LEFT JOIN public.proveedores p ON p.id = g.proveedor_id
  WHERE g.id = p_gasto_id AND g.empresa_id = p_empresa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gasto no encontrado'; END IF;

  v_prov_nombre := COALESCE(v_gasto.proveedor_nombre, '');

  v_cxp   := public._cuenta_config(p_empresa_id, 'cxp');
  v_iva_c := public._cuenta_config(p_empresa_id, 'iva_compras');

  IF v_cxp IS NULL THEN
    RAISE EXCEPTION 'Configure las cuentas contables (CxP Proveedores)';
  END IF;

  -- Buscar cuenta de gasto por código contable de categoría
  IF v_gasto.cat_codigo IS NOT NULL THEN
    SELECT id INTO v_gasto_cuenta
    FROM public.plan_cuentas
    WHERE (empresa_id = p_empresa_id OR empresa_id IS NULL)
      AND codigo = v_gasto.cat_codigo
    ORDER BY empresa_id NULLS LAST
    LIMIT 1;
  END IF;

  -- Fallback: cuenta genérica de gastos
  IF v_gasto_cuenta IS NULL THEN
    SELECT id INTO v_gasto_cuenta
    FROM public.plan_cuentas
    WHERE (empresa_id = p_empresa_id OR empresa_id IS NULL)
      AND codigo = '6.1.06'
    ORDER BY empresa_id NULLS LAST
    LIMIT 1;
  END IF;

  v_subtotal := COALESCE(v_gasto.subtotal, v_gasto.total, 0);
  v_iva      := COALESCE(v_gasto.iva, 0);
  v_total    := COALESCE(v_gasto.total, 0);

  -- Línea gasto
  IF v_gasto_cuenta IS NOT NULL THEN
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_gasto_cuenta, 'descripcion', COALESCE(v_gasto.descripcion, 'Gasto'),
      'debe', v_subtotal, 'haber', 0, 'orden', 1
    ));
  END IF;

  -- IVA en compras
  IF v_iva > 0 AND v_iva_c IS NOT NULL THEN
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_iva_c, 'descripcion', 'IVA en compras',
      'debe', v_iva, 'haber', 0, 'orden', 2
    ));
  END IF;

  -- CxP Proveedor
  v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
    'cuenta_id', v_cxp, 'descripcion', 'Por pagar ' || v_prov_nombre,
    'debe', 0, 'haber', v_total, 'orden', 3
  ));

  RETURN public.crear_asiento(
    p_empresa_id,
    COALESCE(v_gasto.fecha, CURRENT_DATE),
    'Gasto – ' || COALESCE(v_gasto.descripcion, '') || CASE WHEN v_prov_nombre <> '' THEN ' (' || v_prov_nombre || ')' ELSE '' END,
    v_lineas, 'gasto', p_gasto_id, true
  );
END;
$$;
