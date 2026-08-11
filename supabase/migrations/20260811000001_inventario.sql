-- ============================================================
-- MÓDULO INVENTARIO — VIATiQ
-- Tablas: productos_catalogo, importaciones, importacion_lineas,
--         inventario_unidades, inventario_movimientos
-- ============================================================

-- ─── 1. CATÁLOGO DE PRODUCTOS ────────────────────────────────────────────────
-- Maestro de modelos/referencias (PROD-XXX).
-- tipo_seguimiento = 'unidad' → un UNIT-XXXX por unidad física
-- tipo_seguimiento = 'lote'   → un LOT-XXXX por caja/lote con cantidad

CREATE TABLE IF NOT EXISTS public.productos_catalogo (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo            text        UNIQUE,                        -- PROD-001, PROD-002…
  nombre            text        NOT NULL,
  descripcion       text,
  tipo_seguimiento  text        NOT NULL DEFAULT 'unidad'
                    CHECK (tipo_seguimiento IN ('unidad', 'lote')),
  unidad_medida     text        NOT NULL DEFAULT 'unidad',    -- unidad, caja, kg…
  categoria_id      uuid        REFERENCES public.categorias_gasto(id),
  especificaciones  jsonb,                                     -- marca, modelo, potencia…
  estado            text        NOT NULL DEFAULT 'activo'
                    CHECK (estado IN ('activo', 'descontinuado')),
  created_by        uuid        REFERENCES public.usuarios(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

-- Secuencia para códigos PROD-XXX
CREATE SEQUENCE IF NOT EXISTS public.seq_producto_codigo START 1;

CREATE OR REPLACE FUNCTION public.generar_codigo_producto()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.codigo IS NULL THEN
    NEW.codigo := 'PROD-' || LPAD(nextval('public.seq_producto_codigo')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_codigo_producto ON public.productos_catalogo;
CREATE TRIGGER trg_codigo_producto
  BEFORE INSERT ON public.productos_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.generar_codigo_producto();

-- ─── 2. IMPORTACIONES (cabecera DAI) ─────────────────────────────────────────
-- Una fila por liquidación aduanera.
-- Enlaza con gastos_empresa para el costo contabilizado.

CREATE TABLE IF NOT EXISTS public.importaciones (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero_liquidacion  text,                                   -- número DAI / liquidación
  referencia_dai      text,                                   -- referencia interna
  fecha               date        NOT NULL,
  proveedor_id        uuid        REFERENCES public.proveedores(id),
  gasto_empresa_id    uuid        REFERENCES public.gastos_empresa(id),  -- costo contabilizado
  bodega_destino_id   uuid        REFERENCES public.sucursales(id),       -- bodega de recepción
  pais_origen         text,
  -- Valores de la liquidación aduanera (USD)
  fob_total           numeric(14,2) NOT NULL DEFAULT 0,
  seguro              numeric(14,2) NOT NULL DEFAULT 0,
  flete               numeric(14,2) NOT NULL DEFAULT 0,
  ajustes             numeric(14,2) NOT NULL DEFAULT 0,
  valor_aduanas       numeric(14,2) NOT NULL DEFAULT 0,       -- FOB + seguro + flete + ajustes
  arancel             numeric(14,2) NOT NULL DEFAULT 0,
  fodinfa             numeric(14,2) NOT NULL DEFAULT 0,
  iva_importacion     numeric(14,2) NOT NULL DEFAULT 0,
  total_liquidado     numeric(14,2) NOT NULL DEFAULT 0,       -- costo aterrizaje total
  estado              text        NOT NULL DEFAULT 'En tránsito'
                      CHECK (estado IN ('En tránsito', 'Recibida', 'Parcial')),
  observacion         text,
  comprobante_url     text,                                   -- PDF de la liquidación
  created_by          uuid        REFERENCES public.usuarios(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

-- ─── 3. LÍNEAS DE IMPORTACIÓN ────────────────────────────────────────────────
-- Una fila por producto/descripción dentro de la liquidación.
-- Almacena el costo prorrateado calculado.
-- Fórmula: costo_unitario = (fob_linea / fob_total) × total_liquidado / cantidad

CREATE TABLE IF NOT EXISTS public.importacion_lineas (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  importacion_id          uuid        NOT NULL REFERENCES public.importaciones(id) ON DELETE CASCADE,
  producto_id             uuid        REFERENCES public.productos_catalogo(id),
  descripcion_original    text        NOT NULL,               -- texto crudo del DAI
  fob_linea               numeric(14,2) NOT NULL DEFAULT 0,
  cantidad                numeric(14,4) NOT NULL DEFAULT 1,
  unidad_medida           text,
  peso_kg                 numeric(14,4),
  pais_origen             text,
  costo_unitario_calculado numeric(14,4),                     -- resultado de proration
  observacion             text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ─── 4. UNIDADES DE INVENTARIO ───────────────────────────────────────────────
-- Para tipo_seguimiento='unidad': una fila por unidad física (UNIT-XXXX)
-- Para tipo_seguimiento='lote':  una fila por caja/lote   (LOT-XXXX), con cantidad > 1

CREATE TABLE IF NOT EXISTS public.inventario_unidades (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo                text        UNIQUE,                   -- UNIT-0001 o LOT-0001
  producto_id           uuid        NOT NULL REFERENCES public.productos_catalogo(id),
  importacion_linea_id  uuid        REFERENCES public.importacion_lineas(id),
  -- Cantidades (siempre 1 para 'unidad', N para 'lote')
  cantidad_original     numeric(14,4) NOT NULL DEFAULT 1,
  cantidad_actual       numeric(14,4) NOT NULL DEFAULT 1,     -- decrece al consumir lote
  -- Ubicación y estado
  bodega_id             uuid        REFERENCES public.sucursales(id),
  estado                text        NOT NULL DEFAULT 'En bodega'
                        CHECK (estado IN ('En tránsito','En bodega','Asignado','Instalado','Vendido','Dañado','Baja')),
  -- Asignaciones
  proyecto_id           uuid        REFERENCES public.proyectos(id),
  cliente_id            uuid        REFERENCES public.clientes(id),
  factura_emitida_id    uuid        REFERENCES public.facturas_emitidas(id),
  -- Costos
  costo_unitario        numeric(14,4),                        -- viene de importacion_lineas
  -- Trazabilidad
  serial                text,                                  -- número de serie del fabricante
  fecha_ingreso         date,
  fecha_salida          date,
  observacion           text,
  created_by            uuid        REFERENCES public.usuarios(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

-- Secuencias para UNIT-XXXX y LOT-XXXX
CREATE SEQUENCE IF NOT EXISTS public.seq_unidad_codigo START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_lote_codigo   START 1;

CREATE OR REPLACE FUNCTION public.generar_codigo_unidad()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_tipo text;
BEGIN
  IF NEW.codigo IS NULL THEN
    SELECT pc.tipo_seguimiento INTO v_tipo
    FROM public.productos_catalogo pc
    WHERE pc.id = NEW.producto_id;

    IF v_tipo = 'lote' THEN
      NEW.codigo := 'LOT-' || LPAD(nextval('public.seq_lote_codigo')::text, 4, '0');
    ELSE
      NEW.codigo := 'UNIT-' || LPAD(nextval('public.seq_unidad_codigo')::text, 4, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_codigo_unidad ON public.inventario_unidades;
CREATE TRIGGER trg_codigo_unidad
  BEFORE INSERT ON public.inventario_unidades
  FOR EACH ROW EXECUTE FUNCTION public.generar_codigo_unidad();

-- ─── 5. MOVIMIENTOS DE INVENTARIO ────────────────────────────────────────────
-- Log de auditoría de cada cambio de estado/ubicación.

CREATE TABLE IF NOT EXISTS public.inventario_movimientos (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidad_id           uuid        NOT NULL REFERENCES public.inventario_unidades(id) ON DELETE CASCADE,
  tipo                text        NOT NULL
                      CHECK (tipo IN ('Ingreso','Asignación','Transferencia','Venta','Consumo','Devolución','Baja')),
  fecha               date        NOT NULL DEFAULT CURRENT_DATE,
  cantidad            numeric(14,4) NOT NULL DEFAULT 1,       -- relevante para lotes
  bodega_origen_id    uuid        REFERENCES public.sucursales(id),
  bodega_destino_id   uuid        REFERENCES public.sucursales(id),
  proyecto_id         uuid        REFERENCES public.proyectos(id),
  cliente_id          uuid        REFERENCES public.clientes(id),
  factura_id          uuid        REFERENCES public.facturas_emitidas(id),
  usuario_id          uuid        REFERENCES public.usuarios(id),
  observacion         text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─── 6. ÍNDICES ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_productos_empresa   ON public.productos_catalogo(empresa_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_importaciones_emp   ON public.importaciones(empresa_id)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_imp_lineas_imp      ON public.importacion_lineas(importacion_id);
CREATE INDEX IF NOT EXISTS idx_imp_lineas_prod     ON public.importacion_lineas(producto_id);
CREATE INDEX IF NOT EXISTS idx_inv_unidades_emp    ON public.inventario_unidades(empresa_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inv_unidades_prod   ON public.inventario_unidades(producto_id);
CREATE INDEX IF NOT EXISTS idx_inv_unidades_estado ON public.inventario_unidades(estado);
CREATE INDEX IF NOT EXISTS idx_inv_movimientos_uni ON public.inventario_movimientos(unidad_id);
CREATE INDEX IF NOT EXISTS idx_inv_movimientos_emp ON public.inventario_movimientos(empresa_id);

-- ─── 7. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.productos_catalogo      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importaciones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacion_lineas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_unidades     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_movimientos  ENABLE ROW LEVEL SECURITY;

-- productos_catalogo
DROP POLICY IF EXISTS "inv_productos_empresa" ON public.productos_catalogo;
CREATE POLICY "inv_productos_empresa" ON public.productos_catalogo
  USING (empresa_id IN (
    SELECT eu.empresa_id FROM public.empresas_usuarios eu
    WHERE eu.usuario_id = auth.uid() AND eu.activo = true
  ));

-- importaciones
DROP POLICY IF EXISTS "inv_importaciones_empresa" ON public.importaciones;
CREATE POLICY "inv_importaciones_empresa" ON public.importaciones
  USING (empresa_id IN (
    SELECT eu.empresa_id FROM public.empresas_usuarios eu
    WHERE eu.usuario_id = auth.uid() AND eu.activo = true
  ));

-- importacion_lineas (acceso via importacion)
DROP POLICY IF EXISTS "inv_imp_lineas_empresa" ON public.importacion_lineas;
CREATE POLICY "inv_imp_lineas_empresa" ON public.importacion_lineas
  USING (importacion_id IN (
    SELECT i.id FROM public.importaciones i
    JOIN public.empresas_usuarios eu ON eu.empresa_id = i.empresa_id
    WHERE eu.usuario_id = auth.uid() AND eu.activo = true
  ));

-- inventario_unidades
DROP POLICY IF EXISTS "inv_unidades_empresa" ON public.inventario_unidades;
CREATE POLICY "inv_unidades_empresa" ON public.inventario_unidades
  USING (empresa_id IN (
    SELECT eu.empresa_id FROM public.empresas_usuarios eu
    WHERE eu.usuario_id = auth.uid() AND eu.activo = true
  ));

-- inventario_movimientos
DROP POLICY IF EXISTS "inv_movimientos_empresa" ON public.inventario_movimientos;
CREATE POLICY "inv_movimientos_empresa" ON public.inventario_movimientos
  USING (empresa_id IN (
    SELECT eu.empresa_id FROM public.empresas_usuarios eu
    WHERE eu.usuario_id = auth.uid() AND eu.activo = true
  ));

-- ─── 8. RPC: calcular prorrateo de costos ────────────────────────────────────
-- Recalcula costo_unitario_calculado para todas las líneas de una importación.
-- costo_unitario = (fob_linea / fob_total) × total_liquidado / cantidad

CREATE OR REPLACE FUNCTION public.inv_calcular_prorrateo(p_importacion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fob_total     numeric;
  v_total_liq     numeric;
BEGIN
  SELECT fob_total, total_liquidado
  INTO v_fob_total, v_total_liq
  FROM public.importaciones
  WHERE id = p_importacion_id;

  IF v_fob_total IS NULL OR v_fob_total = 0 THEN
    RETURN;
  END IF;

  UPDATE public.importacion_lineas
  SET costo_unitario_calculado =
    CASE
      WHEN cantidad > 0 THEN
        ROUND((fob_linea / v_fob_total) * v_total_liq / cantidad, 4)
      ELSE 0
    END
  WHERE importacion_id = p_importacion_id;
END;
$$;

-- ─── 9. RPC: generar unidades desde líneas de importación ────────────────────
-- Crea un registro en inventario_unidades por cada unidad de cada línea.
-- Para 'unidad': cantidad registros de qty=1.
-- Para 'lote':   un registro con qty=cantidad.

CREATE OR REPLACE FUNCTION public.inv_generar_unidades(p_importacion_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linea         record;
  v_tipo          text;
  v_empresa_id    uuid;
  v_bodega_id     uuid;
  v_created_by    uuid;
  v_count         integer := 0;
  v_i             integer;
BEGIN
  v_created_by := auth.uid();

  SELECT empresa_id, bodega_destino_id
  INTO v_empresa_id, v_bodega_id
  FROM public.importaciones
  WHERE id = p_importacion_id;

  FOR v_linea IN
    SELECT il.*, pc.tipo_seguimiento
    FROM public.importacion_lineas il
    JOIN public.productos_catalogo pc ON pc.id = il.producto_id
    WHERE il.importacion_id = p_importacion_id
      AND il.producto_id IS NOT NULL
  LOOP
    IF v_linea.tipo_seguimiento = 'lote' THEN
      -- Un solo registro por lote
      INSERT INTO public.inventario_unidades (
        empresa_id, producto_id, importacion_linea_id,
        cantidad_original, cantidad_actual,
        bodega_id, estado, costo_unitario,
        fecha_ingreso, created_by
      ) VALUES (
        v_empresa_id, v_linea.producto_id, v_linea.id,
        v_linea.cantidad, v_linea.cantidad,
        v_bodega_id, 'En bodega', v_linea.costo_unitario_calculado,
        CURRENT_DATE, v_created_by
      );
      v_count := v_count + 1;
    ELSE
      -- Un registro por unidad individual
      FOR v_i IN 1..GREATEST(1, FLOOR(v_linea.cantidad)::integer) LOOP
        INSERT INTO public.inventario_unidades (
          empresa_id, producto_id, importacion_linea_id,
          cantidad_original, cantidad_actual,
          bodega_id, estado, costo_unitario,
          fecha_ingreso, created_by
        ) VALUES (
          v_empresa_id, v_linea.producto_id, v_linea.id,
          1, 1,
          v_bodega_id, 'En bodega', v_linea.costo_unitario_calculado,
          CURRENT_DATE, v_created_by
        );
        v_count := v_count + 1;
      END LOOP;
    END IF;
  END LOOP;

  -- Marcar importación como Recibida
  UPDATE public.importaciones
  SET estado = 'Recibida', updated_at = now()
  WHERE id = p_importacion_id;

  RETURN v_count;
END;
$$;
