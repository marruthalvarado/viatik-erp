SET statement_timeout = 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- Módulo Contabilidad / NIIF — Fase D
-- Tablas: plan_cuentas, asientos_contables, asiento_lineas, config_contable
-- RPCs:   crear_asiento, confirmar_asiento, reversar_asiento,
--         generar_asiento_factura, generar_asiento_gasto, generar_asiento_cobro,
--         get_saldos_cuentas, get_libro_mayor
-- Seed:   Plan de Cuentas Ecuador NIIF (empresa_id = NULL → sistema)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Plan de Cuentas ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plan_cuentas (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID        REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo          VARCHAR(20) NOT NULL,
  nombre          TEXT        NOT NULL,
  tipo            TEXT        NOT NULL CHECK (tipo IN ('activo','pasivo','patrimonio','ingreso','costo','gasto')),
  naturaleza      TEXT        NOT NULL CHECK (naturaleza IN ('deudora','acreedora')),
  parent_id       UUID        REFERENCES public.plan_cuentas(id),
  nivel           INT         NOT NULL DEFAULT 1,
  acepta_movimientos BOOLEAN  NOT NULL DEFAULT false,
  activa          BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Índices únicos: sistema (empresa_id IS NULL) vs empresa
CREATE UNIQUE INDEX IF NOT EXISTS plan_cuentas_sistema_uk
  ON public.plan_cuentas(codigo) WHERE empresa_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS plan_cuentas_empresa_uk
  ON public.plan_cuentas(empresa_id, codigo) WHERE empresa_id IS NOT NULL;

ALTER TABLE public.plan_cuentas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plan_cuentas_all ON public.plan_cuentas;
CREATE POLICY plan_cuentas_all ON public.plan_cuentas
  USING (
    empresa_id IS NULL   -- cuentas del sistema (visibles a todos)
    OR empresa_id IN (
      SELECT empresa_id FROM public.empresas_usuarios
      WHERE usuario_id = auth.uid()
    )
  );

-- ── 2. Configuración Contable por Empresa ────────────────────────────────────
-- Mapea rol-de-cuenta → cuenta_id (e.g. 'banco' → cuenta efectivo)
CREATE TABLE IF NOT EXISTS public.config_contable (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  clave       TEXT NOT NULL,   -- 'banco','cxc','iva_ventas','ventas','iva_compras','cxp','ret_iva','ret_ir'
  cuenta_id   UUID REFERENCES public.plan_cuentas(id),
  UNIQUE(empresa_id, clave)
);

ALTER TABLE public.config_contable ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS config_contable_empresa_all ON public.config_contable;
CREATE POLICY config_contable_empresa_all ON public.config_contable
  USING (empresa_id IN (
    SELECT empresa_id FROM public.empresas_usuarios WHERE usuario_id = auth.uid()
  ));

-- ── 3. Asientos Contables (cabecera) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.asientos_contables (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero          TEXT        NOT NULL,
  fecha           DATE        NOT NULL,
  descripcion     TEXT        NOT NULL,
  estado          TEXT        NOT NULL DEFAULT 'borrador'
                              CHECK (estado IN ('borrador','definitivo','reversado')),
  referencia_tipo TEXT        CHECK (referencia_tipo IN ('manual','factura','gasto','cobro','conciliacion')),
  referencia_id   UUID,
  asiento_origen_id UUID      REFERENCES public.asientos_contables(id),
  created_by      UUID        REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(empresa_id, numero)
);

ALTER TABLE public.asientos_contables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asientos_empresa_all ON public.asientos_contables;
CREATE POLICY asientos_empresa_all ON public.asientos_contables
  USING (empresa_id IN (
    SELECT empresa_id FROM public.empresas_usuarios WHERE usuario_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_asientos_empresa_fecha
  ON public.asientos_contables(empresa_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_asientos_referencia
  ON public.asientos_contables(referencia_tipo, referencia_id)
  WHERE referencia_id IS NOT NULL;

-- ── 4. Líneas de Asiento ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.asiento_lineas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asiento_id  UUID        NOT NULL REFERENCES public.asientos_contables(id) ON DELETE CASCADE,
  empresa_id  UUID        NOT NULL REFERENCES public.empresas(id),
  cuenta_id   UUID        NOT NULL REFERENCES public.plan_cuentas(id),
  descripcion TEXT,
  debe        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debe >= 0),
  haber       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (haber >= 0),
  orden       INT         NOT NULL DEFAULT 0
);

ALTER TABLE public.asiento_lineas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asiento_lineas_empresa_all ON public.asiento_lineas;
CREATE POLICY asiento_lineas_empresa_all ON public.asiento_lineas
  USING (empresa_id IN (
    SELECT empresa_id FROM public.empresas_usuarios WHERE usuario_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_asiento_lineas_asiento
  ON public.asiento_lineas(asiento_id);
CREATE INDEX IF NOT EXISTS idx_asiento_lineas_cuenta
  ON public.asiento_lineas(cuenta_id, empresa_id);

-- ── 5. RPCs ──────────────────────────────────────────────────────────────────

-- 5a. Crear Asiento (con líneas en JSONB)
CREATE OR REPLACE FUNCTION public.crear_asiento(
  p_empresa_id     UUID,
  p_fecha          DATE,
  p_descripcion    TEXT,
  p_lineas         JSONB,
  p_ref_tipo       TEXT DEFAULT 'manual',
  p_ref_id         UUID DEFAULT NULL,
  p_confirmar      BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero   TEXT;
  v_anio     INT;
  v_seq      INT;
  v_asiento  UUID;
  v_linea    JSONB;
  v_debe     NUMERIC := 0;
  v_haber    NUMERIC := 0;
BEGIN
  -- Verificar acceso a la empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = p_empresa_id AND usuario_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  -- Calcular totales y validar cuadre
  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    v_debe  := v_debe  + COALESCE((v_linea->>'debe')::NUMERIC, 0);
    v_haber := v_haber + COALESCE((v_linea->>'haber')::NUMERIC, 0);
  END LOOP;

  IF ROUND(v_debe, 2) <> ROUND(v_haber, 2) THEN
    RAISE EXCEPTION 'El asiento no cuadra: Debe=% Haber=%', v_debe, v_haber;
  END IF;

  IF v_debe = 0 THEN
    RAISE EXCEPTION 'El asiento no puede tener saldo cero';
  END IF;

  -- Auto-número por empresa y año
  v_anio := EXTRACT(YEAR FROM p_fecha)::INT;
  SELECT COALESCE(MAX(
    (SPLIT_PART(numero, '-', 3))::INT
  ), 0) + 1
  INTO v_seq
  FROM public.asientos_contables
  WHERE empresa_id = p_empresa_id
    AND numero LIKE 'A-' || v_anio || '-%';

  v_numero := 'A-' || v_anio || '-' || LPAD(v_seq::TEXT, 4, '0');

  -- Insertar cabecera
  INSERT INTO public.asientos_contables(
    empresa_id, numero, fecha, descripcion, estado,
    referencia_tipo, referencia_id
  ) VALUES (
    p_empresa_id, v_numero, p_fecha, p_descripcion,
    CASE WHEN p_confirmar THEN 'definitivo' ELSE 'borrador' END,
    p_ref_tipo, p_ref_id
  ) RETURNING id INTO v_asiento;

  -- Insertar líneas
  FOR v_linea IN SELECT * FROM jsonb_array_elements(p_lineas)
  LOOP
    INSERT INTO public.asiento_lineas(
      asiento_id, empresa_id, cuenta_id, descripcion, debe, haber, orden
    ) VALUES (
      v_asiento,
      p_empresa_id,
      (v_linea->>'cuenta_id')::UUID,
      v_linea->>'descripcion',
      COALESCE((v_linea->>'debe')::NUMERIC, 0),
      COALESCE((v_linea->>'haber')::NUMERIC, 0),
      COALESCE((v_linea->>'orden')::INT, 0)
    );
  END LOOP;

  RETURN v_asiento;
END;
$$;

-- 5b. Confirmar asiento (borrador → definitivo)
CREATE OR REPLACE FUNCTION public.confirmar_asiento(p_asiento_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.asientos_contables
  SET estado = 'definitivo'
  WHERE id = p_asiento_id
    AND estado = 'borrador'
    AND empresa_id IN (
      SELECT empresa_id FROM public.empresas_usuarios WHERE usuario_id = auth.uid()
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo confirmar el asiento';
  END IF;
END;
$$;

-- 5c. Reversar asiento (crea contra-asiento)
CREATE OR REPLACE FUNCTION public.reversar_asiento(
  p_asiento_id UUID,
  p_fecha      DATE DEFAULT CURRENT_DATE,
  p_descripcion TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origen   public.asientos_contables%ROWTYPE;
  v_lineas   JSONB;
  v_nuevo    UUID;
BEGIN
  SELECT * INTO v_origen
  FROM public.asientos_contables
  WHERE id = p_asiento_id
    AND empresa_id IN (
      SELECT empresa_id FROM public.empresas_usuarios WHERE usuario_id = auth.uid()
    );

  IF NOT FOUND THEN RAISE EXCEPTION 'Asiento no encontrado'; END IF;
  IF v_origen.estado <> 'definitivo' THEN
    RAISE EXCEPTION 'Solo se pueden reversar asientos definitivos';
  END IF;

  -- Construir líneas invertidas (debe ↔ haber)
  SELECT jsonb_agg(jsonb_build_object(
    'cuenta_id',   cuenta_id,
    'descripcion', 'Reverso: ' || COALESCE(descripcion, ''),
    'debe',        haber,
    'haber',       debe,
    'orden',       orden
  ))
  INTO v_lineas
  FROM public.asiento_lineas
  WHERE asiento_id = p_asiento_id;

  v_nuevo := public.crear_asiento(
    v_origen.empresa_id,
    p_fecha,
    COALESCE(p_descripcion, 'Reverso de ' || v_origen.numero || ': ' || v_origen.descripcion),
    v_lineas,
    'manual',
    NULL,
    true
  );

  -- Marcar origen como reversado
  UPDATE public.asientos_contables
  SET estado = 'reversado', asiento_origen_id = p_asiento_id
  WHERE id = v_nuevo;

  UPDATE public.asientos_contables
  SET estado = 'reversado'
  WHERE id = p_asiento_id;

  RETURN v_nuevo;
END;
$$;

-- 5d. Helper: obtener cuenta por clave de config o por código
CREATE OR REPLACE FUNCTION public._cuenta_config(
  p_empresa_id UUID,
  p_clave      TEXT
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cuenta_id FROM public.config_contable
  WHERE empresa_id = p_empresa_id AND clave = p_clave
  LIMIT 1;
$$;

-- 5e. Generar asiento desde Factura Emitida
CREATE OR REPLACE FUNCTION public.generar_asiento_factura(
  p_factura_id UUID,
  p_empresa_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fac    RECORD;
  v_lineas JSONB := '[]'::JSONB;
  v_cxc    UUID;
  v_ventas UUID;
  v_iva_v  UUID;
  v_ret_ir UUID;
  v_ret_iva UUID;
  v_subtotal   NUMERIC;
  v_iva        NUMERIC;
  v_total      NUMERIC;
  v_ret_ir_monto  NUMERIC := 0;
  v_ret_iva_monto NUMERIC := 0;
  v_cxc_neto   NUMERIC;
BEGIN
  -- Verificar acceso
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = p_empresa_id AND usuario_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Acceso denegado'; END IF;

  -- Ya existe asiento para esta factura?
  IF EXISTS (
    SELECT 1 FROM public.asientos_contables
    WHERE empresa_id = p_empresa_id
      AND referencia_tipo = 'factura'
      AND referencia_id = p_factura_id
  ) THEN RAISE EXCEPTION 'Ya existe un asiento para esta factura'; END IF;

  SELECT * INTO v_fac FROM public.facturas_emitidas
  WHERE id = p_factura_id AND empresa_id = p_empresa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factura no encontrada'; END IF;

  -- Cuentas de configuración
  v_cxc    := public._cuenta_config(p_empresa_id, 'cxc');
  v_ventas := public._cuenta_config(p_empresa_id, 'ventas');
  v_iva_v  := public._cuenta_config(p_empresa_id, 'iva_ventas');
  v_ret_ir := public._cuenta_config(p_empresa_id, 'ret_ir');
  v_ret_iva:= public._cuenta_config(p_empresa_id, 'ret_iva');

  IF v_cxc IS NULL OR v_ventas IS NULL THEN
    RAISE EXCEPTION 'Configure las cuentas contables en Configuración → Contabilidad';
  END IF;

  v_subtotal := COALESCE(v_fac.subtotal, v_fac.total, 0);
  v_iva      := COALESCE(v_fac.iva, 0);
  v_total    := COALESCE(v_fac.total, 0);

  -- Calcular retenciones
  IF COALESCE(v_fac.retencion_ir_pct, 0) > 0 THEN
    v_ret_ir_monto := ROUND(v_subtotal * v_fac.retencion_ir_pct / 100.0, 2);
  END IF;
  IF COALESCE(v_fac.retencion_iva_pct, 0) > 0 THEN
    v_ret_iva_monto := ROUND(v_iva * v_fac.retencion_iva_pct / 100.0, 2);
  END IF;

  v_cxc_neto := v_total - v_ret_ir_monto - v_ret_iva_monto;

  -- Línea CxC (neto)
  v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
    'cuenta_id', v_cxc, 'descripcion', 'CxC Factura ' || COALESCE(v_fac.numero_factura,''),
    'debe', v_cxc_neto, 'haber', 0, 'orden', 1
  ));

  -- Retención IR (si aplica)
  IF v_ret_ir_monto > 0 AND v_ret_ir IS NOT NULL THEN
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_ret_ir, 'descripcion', 'Ret. IR ' || v_fac.retencion_ir_pct || '%',
      'debe', v_ret_ir_monto, 'haber', 0, 'orden', 2
    ));
  END IF;

  -- Retención IVA (si aplica)
  IF v_ret_iva_monto > 0 AND v_ret_iva IS NOT NULL THEN
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_ret_iva, 'descripcion', 'Ret. IVA ' || v_fac.retencion_iva_pct || '%',
      'debe', v_ret_iva_monto, 'haber', 0, 'orden', 3
    ));
  END IF;

  -- Venta (subtotal)
  v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
    'cuenta_id', v_ventas, 'descripcion', 'Venta factura ' || COALESCE(v_fac.numero_factura,''),
    'debe', 0, 'haber', v_subtotal, 'orden', 4
  ));

  -- IVA en ventas (si aplica)
  IF v_iva > 0 AND v_iva_v IS NOT NULL THEN
    v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_iva_v, 'descripcion', 'IVA en ventas',
      'debe', 0, 'haber', v_iva, 'orden', 5
    ));
  END IF;

  RETURN public.crear_asiento(
    p_empresa_id,
    COALESCE(v_fac.fecha_emision, CURRENT_DATE),
    'Venta – ' || COALESCE(v_fac.cliente_nombre, '') || ' Fac. ' || COALESCE(v_fac.numero_factura,''),
    v_lineas, 'factura', p_factura_id, true
  );
END;
$$;

-- 5f. Generar asiento desde Gasto Empresa
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
  v_gasto  RECORD;
  v_lineas JSONB := '[]'::JSONB;
  v_cxp    UUID;
  v_iva_c  UUID;
  v_gasto_cuenta UUID;
  v_subtotal NUMERIC;
  v_iva      NUMERIC;
  v_total    NUMERIC;
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

  SELECT g.*, c.codigo_contable AS cat_codigo
  INTO v_gasto
  FROM public.gastos_empresa g
  LEFT JOIN public.categorias_gasto c ON c.id = g.categoria_id
  WHERE g.id = p_gasto_id AND g.empresa_id = p_empresa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gasto no encontrado'; END IF;

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
      AND codigo = '6.1.06'   -- Suministros y materiales (default)
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
    'cuenta_id', v_cxp, 'descripcion', 'Por pagar ' || COALESCE(v_gasto.proveedor_nombre, ''),
    'debe', 0, 'haber', v_total, 'orden', 3
  ));

  RETURN public.crear_asiento(
    p_empresa_id,
    COALESCE(v_gasto.fecha, CURRENT_DATE),
    'Gasto – ' || COALESCE(v_gasto.descripcion, ''),
    v_lineas, 'gasto', p_gasto_id, true
  );
END;
$$;

-- 5g. Generar asiento desde Cobro
CREATE OR REPLACE FUNCTION public.generar_asiento_cobro(
  p_cobro_id   UUID,
  p_empresa_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cobro  RECORD;
  v_lineas JSONB := '[]'::JSONB;
  v_banco  UUID;
  v_cxc    UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = p_empresa_id AND usuario_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Acceso denegado'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.asientos_contables
    WHERE empresa_id = p_empresa_id
      AND referencia_tipo = 'cobro'
      AND referencia_id = p_cobro_id
  ) THEN RAISE EXCEPTION 'Ya existe un asiento para este cobro'; END IF;

  SELECT c.*, f.cliente_nombre, f.numero_factura
  INTO v_cobro
  FROM public.cobros c
  JOIN public.facturas_emitidas f ON f.id = c.factura_id
  WHERE c.id = p_cobro_id AND c.empresa_id = p_empresa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobro no encontrado'; END IF;

  v_banco := public._cuenta_config(p_empresa_id, 'banco');
  v_cxc   := public._cuenta_config(p_empresa_id, 'cxc');

  IF v_banco IS NULL OR v_cxc IS NULL THEN
    RAISE EXCEPTION 'Configure las cuentas contables (Banco y CxC)';
  END IF;

  v_lineas := jsonb_build_array(
    jsonb_build_object(
      'cuenta_id', v_banco, 'descripcion', 'Cobro Fac. ' || COALESCE(v_cobro.numero_factura,''),
      'debe', v_cobro.monto, 'haber', 0, 'orden', 1
    ),
    jsonb_build_object(
      'cuenta_id', v_cxc, 'descripcion', 'Cobro cliente ' || COALESCE(v_cobro.cliente_nombre,''),
      'debe', 0, 'haber', v_cobro.monto, 'orden', 2
    )
  );

  RETURN public.crear_asiento(
    p_empresa_id,
    COALESCE(v_cobro.fecha_cobro, CURRENT_DATE),
    'Cobro – ' || COALESCE(v_cobro.cliente_nombre,'') || ' Fac. ' || COALESCE(v_cobro.numero_factura,''),
    v_lineas, 'cobro', p_cobro_id, true
  );
END;
$$;

-- 5h. Saldos de cuentas (para Balance General y Estado de Resultados)
CREATE OR REPLACE FUNCTION public.get_saldos_cuentas(
  p_empresa_id UUID,
  p_desde      DATE DEFAULT NULL,
  p_hasta      DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  cuenta_id    UUID,
  codigo       TEXT,
  nombre       TEXT,
  tipo         TEXT,
  naturaleza   TEXT,
  nivel        INT,
  parent_id    UUID,
  acepta_movimientos BOOLEAN,
  total_debe   NUMERIC,
  total_haber  NUMERIC,
  saldo        NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pc.id          AS cuenta_id,
    pc.codigo,
    pc.nombre,
    pc.tipo,
    pc.naturaleza,
    pc.nivel,
    pc.parent_id,
    pc.acepta_movimientos,
    COALESCE(SUM(al.debe), 0)   AS total_debe,
    COALESCE(SUM(al.haber), 0)  AS total_haber,
    CASE
      WHEN pc.naturaleza = 'deudora'   THEN COALESCE(SUM(al.debe), 0) - COALESCE(SUM(al.haber), 0)
      WHEN pc.naturaleza = 'acreedora' THEN COALESCE(SUM(al.haber), 0) - COALESCE(SUM(al.debe), 0)
    END AS saldo
  FROM public.plan_cuentas pc
  LEFT JOIN public.asiento_lineas al ON al.cuenta_id = pc.id
    AND al.empresa_id = p_empresa_id
  LEFT JOIN public.asientos_contables ac ON ac.id = al.asiento_id
    AND ac.estado = 'definitivo'
    AND ac.fecha <= p_hasta
    AND (p_desde IS NULL OR ac.fecha >= p_desde)
  WHERE (pc.empresa_id = p_empresa_id OR pc.empresa_id IS NULL)
    AND pc.activa = true
  GROUP BY pc.id, pc.codigo, pc.nombre, pc.tipo, pc.naturaleza,
           pc.nivel, pc.parent_id, pc.acepta_movimientos
  ORDER BY pc.codigo;
$$;

-- 5i. Libro Mayor (movimientos de una cuenta)
CREATE OR REPLACE FUNCTION public.get_libro_mayor(
  p_empresa_id UUID,
  p_cuenta_id  UUID,
  p_desde      DATE DEFAULT NULL,
  p_hasta      DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  asiento_id   UUID,
  numero       TEXT,
  fecha        DATE,
  descripcion  TEXT,
  linea_desc   TEXT,
  debe         NUMERIC,
  haber        NUMERIC,
  saldo_acum   NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ac.id,
    ac.numero,
    ac.fecha,
    ac.descripcion,
    al.descripcion,
    al.debe,
    al.haber,
    SUM(al.debe - al.haber) OVER (ORDER BY ac.fecha, ac.numero, al.orden) AS saldo_acum
  FROM public.asiento_lineas al
  JOIN public.asientos_contables ac ON ac.id = al.asiento_id
  WHERE al.cuenta_id = p_cuenta_id
    AND al.empresa_id = p_empresa_id
    AND ac.estado = 'definitivo'
    AND ac.fecha <= p_hasta
    AND (p_desde IS NULL OR ac.fecha >= p_desde)
  ORDER BY ac.fecha, ac.numero, al.orden;
$$;

-- ── 6. Seed: Plan de Cuentas Ecuador NIIF ────────────────────────────────────
-- empresa_id = NULL → cuentas del sistema (visibles a todas las empresas)

DO $$
DECLARE
  -- Nivel 1
  id_1 UUID; id_2 UUID; id_3 UUID; id_4 UUID; id_5 UUID; id_6 UUID;
  -- Nivel 2 — Activos
  id_11 UUID; id_12 UUID;
  -- Nivel 2 — Pasivos
  id_21 UUID; id_22 UUID;
  -- Nivel 2 — Patrimonio / Ingresos / Costos / Gastos
  id_31 UUID; id_41 UUID; id_51 UUID; id_61 UUID;
BEGIN
  -- Nivel 1: grupos principales
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,acepta_movimientos)
    VALUES('1','ACTIVOS','activo','deudora',1,false) ON CONFLICT DO NOTHING RETURNING id INTO id_1;
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,acepta_movimientos)
    VALUES('2','PASIVOS','pasivo','acreedora',1,false) ON CONFLICT DO NOTHING RETURNING id INTO id_2;
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,acepta_movimientos)
    VALUES('3','PATRIMONIO','patrimonio','acreedora',1,false) ON CONFLICT DO NOTHING RETURNING id INTO id_3;
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,acepta_movimientos)
    VALUES('4','INGRESOS','ingreso','acreedora',1,false) ON CONFLICT DO NOTHING RETURNING id INTO id_4;
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,acepta_movimientos)
    VALUES('5','COSTOS','costo','deudora',1,false) ON CONFLICT DO NOTHING RETURNING id INTO id_5;
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,acepta_movimientos)
    VALUES('6','GASTOS','gasto','deudora',1,false) ON CONFLICT DO NOTHING RETURNING id INTO id_6;

  -- Re-leer IDs en caso de ON CONFLICT
  SELECT id INTO id_1 FROM public.plan_cuentas WHERE codigo='1' AND empresa_id IS NULL;
  SELECT id INTO id_2 FROM public.plan_cuentas WHERE codigo='2' AND empresa_id IS NULL;
  SELECT id INTO id_3 FROM public.plan_cuentas WHERE codigo='3' AND empresa_id IS NULL;
  SELECT id INTO id_4 FROM public.plan_cuentas WHERE codigo='4' AND empresa_id IS NULL;
  SELECT id INTO id_5 FROM public.plan_cuentas WHERE codigo='5' AND empresa_id IS NULL;
  SELECT id INTO id_6 FROM public.plan_cuentas WHERE codigo='6' AND empresa_id IS NULL;

  -- Nivel 2: sub-grupos
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,parent_id,acepta_movimientos)
    VALUES('1.1','ACTIVOS CORRIENTES','activo','deudora',2,id_1,false) ON CONFLICT DO NOTHING RETURNING id INTO id_11;
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,parent_id,acepta_movimientos)
    VALUES('1.2','ACTIVOS NO CORRIENTES','activo','deudora',2,id_1,false) ON CONFLICT DO NOTHING RETURNING id INTO id_12;
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,parent_id,acepta_movimientos)
    VALUES('2.1','PASIVOS CORRIENTES','pasivo','acreedora',2,id_2,false) ON CONFLICT DO NOTHING RETURNING id INTO id_21;
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,parent_id,acepta_movimientos)
    VALUES('2.2','PASIVOS NO CORRIENTES','pasivo','acreedora',2,id_2,false) ON CONFLICT DO NOTHING RETURNING id INTO id_22;
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,parent_id,acepta_movimientos)
    VALUES('3.1','CAPITAL Y RESERVAS','patrimonio','acreedora',2,id_3,false) ON CONFLICT DO NOTHING RETURNING id INTO id_31;
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,parent_id,acepta_movimientos)
    VALUES('4.1','INGRESOS OPERATIVOS','ingreso','acreedora',2,id_4,false) ON CONFLICT DO NOTHING RETURNING id INTO id_41;
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,parent_id,acepta_movimientos)
    VALUES('5.1','COSTO DE VENTAS Y SERVICIOS','costo','deudora',2,id_5,false) ON CONFLICT DO NOTHING RETURNING id INTO id_51;
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,parent_id,acepta_movimientos)
    VALUES('6.1','GASTOS OPERATIVOS','gasto','deudora',2,id_6,false) ON CONFLICT DO NOTHING RETURNING id INTO id_61;

  -- Re-leer IDs nivel 2
  SELECT id INTO id_11 FROM public.plan_cuentas WHERE codigo='1.1' AND empresa_id IS NULL;
  SELECT id INTO id_12 FROM public.plan_cuentas WHERE codigo='1.2' AND empresa_id IS NULL;
  SELECT id INTO id_21 FROM public.plan_cuentas WHERE codigo='2.1' AND empresa_id IS NULL;
  SELECT id INTO id_22 FROM public.plan_cuentas WHERE codigo='2.2' AND empresa_id IS NULL;
  SELECT id INTO id_31 FROM public.plan_cuentas WHERE codigo='3.1' AND empresa_id IS NULL;
  SELECT id INTO id_41 FROM public.plan_cuentas WHERE codigo='4.1' AND empresa_id IS NULL;
  SELECT id INTO id_51 FROM public.plan_cuentas WHERE codigo='5.1' AND empresa_id IS NULL;
  SELECT id INTO id_61 FROM public.plan_cuentas WHERE codigo='6.1' AND empresa_id IS NULL;

  -- Nivel 3: cuentas de detalle — ACTIVOS CORRIENTES
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,parent_id,acepta_movimientos) VALUES
    ('1.1.01','Efectivo y equivalentes de efectivo','activo','deudora',3,id_11,true),
    ('1.1.02','Cuentas por cobrar clientes','activo','deudora',3,id_11,true),
    ('1.1.03','(-) Provisión cuentas incobrables','activo','acreedora',3,id_11,true),
    ('1.1.04','IVA en compras (crédito tributario)','activo','deudora',3,id_11,true),
    ('1.1.05','Retención IR anticipada','activo','deudora',3,id_11,true),
    ('1.1.06','Retención IVA anticipada','activo','deudora',3,id_11,true),
    ('1.1.07','Inventarios','activo','deudora',3,id_11,true),
    ('1.1.08','Pagos anticipados y prepagados','activo','deudora',3,id_11,true),
    ('1.1.09','Otras cuentas por cobrar','activo','deudora',3,id_11,true)
  ON CONFLICT DO NOTHING;

  -- ACTIVOS NO CORRIENTES
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,parent_id,acepta_movimientos) VALUES
    ('1.2.01','Propiedad, planta y equipo','activo','deudora',3,id_12,true),
    ('1.2.02','(-) Depreciación acumulada PPE','activo','acreedora',3,id_12,true),
    ('1.2.03','Activos intangibles','activo','deudora',3,id_12,true),
    ('1.2.04','(-) Amortización acumulada','activo','acreedora',3,id_12,true),
    ('1.2.05','Inversiones a largo plazo','activo','deudora',3,id_12,true)
  ON CONFLICT DO NOTHING;

  -- PASIVOS CORRIENTES
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,parent_id,acepta_movimientos) VALUES
    ('2.1.01','Cuentas por pagar proveedores','pasivo','acreedora',3,id_21,true),
    ('2.1.02','Obligaciones con empleados','pasivo','acreedora',3,id_21,true),
    ('2.1.03','IESS por pagar','pasivo','acreedora',3,id_21,true),
    ('2.1.04','Participación trabajadores 15%','pasivo','acreedora',3,id_21,true),
    ('2.1.05','Impuesto a la renta por pagar','pasivo','acreedora',3,id_21,true),
    ('2.1.06','IVA en ventas por pagar','pasivo','acreedora',3,id_21,true),
    ('2.1.07','Retenciones IVA por pagar al SRI','pasivo','acreedora',3,id_21,true),
    ('2.1.08','Retenciones IR por pagar al SRI','pasivo','acreedora',3,id_21,true),
    ('2.1.09','Anticipos de clientes','pasivo','acreedora',3,id_21,true),
    ('2.1.10','Porción corriente deuda financiera','pasivo','acreedora',3,id_21,true)
  ON CONFLICT DO NOTHING;

  -- PASIVOS NO CORRIENTES
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,parent_id,acepta_movimientos) VALUES
    ('2.2.01','Deuda financiera largo plazo','pasivo','acreedora',3,id_22,true),
    ('2.2.02','Provisión jubilación patronal','pasivo','acreedora',3,id_22,true)
  ON CONFLICT DO NOTHING;

  -- PATRIMONIO
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,parent_id,acepta_movimientos) VALUES
    ('3.1.01','Capital social suscrito y pagado','patrimonio','acreedora',3,id_31,true),
    ('3.1.02','Reserva legal','patrimonio','acreedora',3,id_31,true),
    ('3.1.03','Reservas facultativas','patrimonio','acreedora',3,id_31,true),
    ('3.1.04','Resultados acumulados','patrimonio','acreedora',3,id_31,true),
    ('3.1.05','Resultado del ejercicio','patrimonio','acreedora',3,id_31,true)
  ON CONFLICT DO NOTHING;

  -- INGRESOS
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,parent_id,acepta_movimientos) VALUES
    ('4.1.01','Ventas de bienes y servicios','ingreso','acreedora',3,id_41,true),
    ('4.1.02','Descuentos y devoluciones en ventas','ingreso','deudora',3,id_41,true),
    ('4.1.03','Otros ingresos operativos','ingreso','acreedora',3,id_41,true),
    ('4.1.04','Ingresos financieros','ingreso','acreedora',3,id_41,true),
    ('4.1.05','Otros ingresos no operativos','ingreso','acreedora',3,id_41,true)
  ON CONFLICT DO NOTHING;

  -- COSTOS
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,parent_id,acepta_movimientos) VALUES
    ('5.1.01','Costo de mercancías vendidas','costo','deudora',3,id_51,true),
    ('5.1.02','Costo de servicios prestados','costo','deudora',3,id_51,true),
    ('5.1.03','Costo de producción','costo','deudora',3,id_51,true)
  ON CONFLICT DO NOTHING;

  -- GASTOS OPERATIVOS
  INSERT INTO public.plan_cuentas(codigo,nombre,tipo,naturaleza,nivel,parent_id,acepta_movimientos) VALUES
    ('6.1.01','Sueldos y salarios','gasto','deudora',3,id_61,true),
    ('6.1.02','Beneficios sociales (décimos, vacaciones)','gasto','deudora',3,id_61,true),
    ('6.1.03','Aporte patronal IESS','gasto','deudora',3,id_61,true),
    ('6.1.04','Honorarios profesionales y dietas','gasto','deudora',3,id_61,true),
    ('6.1.05','Arrendamiento de inmuebles','gasto','deudora',3,id_61,true),
    ('6.1.06','Suministros y materiales de oficina','gasto','deudora',3,id_61,true),
    ('6.1.07','Servicios básicos (agua, luz, internet)','gasto','deudora',3,id_61,true),
    ('6.1.08','Mantenimiento y reparaciones','gasto','deudora',3,id_61,true),
    ('6.1.09','Depreciación de activos fijos','gasto','deudora',3,id_61,true),
    ('6.1.10','Amortización de intangibles','gasto','deudora',3,id_61,true),
    ('6.1.11','Comunicaciones y telefonía','gasto','deudora',3,id_61,true),
    ('6.1.12','Combustibles y lubricantes','gasto','deudora',3,id_61,true),
    ('6.1.13','Transporte y viáticos','gasto','deudora',3,id_61,true),
    ('6.1.14','Publicidad y marketing','gasto','deudora',3,id_61,true),
    ('6.1.15','Seguros y primas','gasto','deudora',3,id_61,true),
    ('6.1.16','Gastos de gestión y representación','gasto','deudora',3,id_61,true),
    ('6.1.17','Gastos financieros e intereses','gasto','deudora',3,id_61,true),
    ('6.1.18','Comisiones bancarias','gasto','deudora',3,id_61,true),
    ('6.1.19','Impuestos y contribuciones','gasto','deudora',3,id_61,true),
    ('6.1.20','Otros gastos operativos','gasto','deudora',3,id_61,true)
  ON CONFLICT DO NOTHING;

END $$;
