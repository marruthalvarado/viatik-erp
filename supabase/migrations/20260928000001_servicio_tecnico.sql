-- =============================================================================
-- MÓDULO: SERVICIO TÉCNICO POST-VENTA
-- Tablas: equipos_instalados, contratos_mantenimiento, contrato_equipos,
--         ordenes_servicio, os_repuestos, os_fotos
-- =============================================================================
SET statement_timeout = 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EQUIPOS INSTALADOS (Base Instalada)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.equipos_instalados (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- Vínculo con unidad de inventario (nullable → equipos históricos o de terceros)
  inventario_unidad_id  uuid REFERENCES public.inventario_unidades(id) ON DELETE SET NULL,

  -- Vínculo con catálogo (nullable → equipo de marca no representada)
  catalogo_id           uuid REFERENCES public.productos_catalogo(id) ON DELETE SET NULL,

  -- Vínculo comercial origen (nullable)
  cotizacion_id         uuid REFERENCES public.cotizaciones(id) ON DELETE SET NULL,
  factura_id            uuid REFERENCES public.facturas_emitidas(id) ON DELETE SET NULL,

  -- Relaciones operativas
  cliente_id            uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  proyecto_id           uuid REFERENCES public.proyectos(id) ON DELETE SET NULL,
  tecnico_instalador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,

  -- Datos del equipo (libres — permiten equipos no en catálogo)
  nombre                text NOT NULL,
  fabricante            text,
  modelo                text,
  numero_serie          text,
  numero_parte          text,

  -- Ubicación e instalación
  ubicacion_instalacion text,
  fecha_venta           date,
  fecha_instalacion     date,
  garantia_meses        integer DEFAULT 0,
  garantia_hasta        date GENERATED ALWAYS AS (
    CASE WHEN fecha_instalacion IS NOT NULL AND garantia_meses > 0
      THEN fecha_instalacion + (garantia_meses || ' months')::interval
      ELSE NULL
    END
  ) STORED,

  -- Estado operativo
  estado                text NOT NULL DEFAULT 'activo'
                        CHECK (estado IN ('activo','en_mantenimiento','fuera_servicio','baja')),
  requiere_mantenimiento boolean NOT NULL DEFAULT false,

  -- Mantenimiento preventivo programado
  frecuencia_mantenimiento_dias integer,       -- cada cuántos días se hace preventivo
  proximo_mantenimiento         date,          -- calculado o manual

  -- Archivos
  foto_url              text,
  acta_entrega_url      text,

  notas                 text,
  created_by            uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

CREATE INDEX IF NOT EXISTS idx_equipos_instalados_empresa   ON public.equipos_instalados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_equipos_instalados_cliente   ON public.equipos_instalados(cliente_id);
CREATE INDEX IF NOT EXISTS idx_equipos_instalados_proyecto  ON public.equipos_instalados(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_equipos_instalados_unidad    ON public.equipos_instalados(inventario_unidad_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CONTRATOS DE MANTENIMIENTO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.seq_contratos_mantenimiento START 1;

CREATE TABLE IF NOT EXISTS public.contratos_mantenimiento (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero                text NOT NULL,
  cliente_id            uuid NOT NULL REFERENCES public.clientes(id),
  proyecto_id           uuid REFERENCES public.proyectos(id) ON DELETE SET NULL,

  -- Cobertura
  incluye_preventivos   boolean NOT NULL DEFAULT true,
  incluye_correctivos   boolean NOT NULL DEFAULT false,
  visitas_incluidas     integer,             -- null = ilimitado

  -- Vigencia y facturación
  periodicidad_meses    integer NOT NULL DEFAULT 12,
  fecha_inicio          date NOT NULL,
  fecha_fin             date NOT NULL,
  valor_contrato        numeric(12,2) NOT NULL DEFAULT 0,
  factura_id            uuid REFERENCES public.facturas_emitidas(id) ON DELETE SET NULL,

  estado                text NOT NULL DEFAULT 'activo'
                        CHECK (estado IN ('borrador','activo','vencido','cancelado')),
  observaciones         text,
  created_by            uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz,

  UNIQUE (empresa_id, numero)
);

-- Equipos cubiertos por el contrato (many-to-many)
CREATE TABLE IF NOT EXISTS public.contrato_equipos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id      uuid NOT NULL REFERENCES public.contratos_mantenimiento(id) ON DELETE CASCADE,
  equipo_id        uuid NOT NULL REFERENCES public.equipos_instalados(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, equipo_id)
);

CREATE INDEX IF NOT EXISTS idx_contratos_empresa  ON public.contratos_mantenimiento(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contratos_cliente  ON public.contratos_mantenimiento(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contrato_equipos_contrato ON public.contrato_equipos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_equipos_equipo   ON public.contrato_equipos(equipo_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ÓRDENES DE SERVICIO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.seq_ordenes_servicio START 1;

CREATE TABLE IF NOT EXISTS public.ordenes_servicio (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero                text NOT NULL,

  -- Tipo y estado
  tipo                  text NOT NULL
                        CHECK (tipo IN ('preventivo','correctivo','instalacion','actualizacion','repuesto')),
  estado                text NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','programada','en_proceso','completada','cancelada')),
  modalidad_cobro       text NOT NULL DEFAULT 'por_visita'
                        CHECK (modalidad_cobro IN ('garantia','contrato','por_visita','sin_costo')),

  -- Relaciones
  equipo_id             uuid NOT NULL REFERENCES public.equipos_instalados(id),
  cliente_id            uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  proyecto_id           uuid REFERENCES public.proyectos(id) ON DELETE SET NULL,
  contrato_id           uuid REFERENCES public.contratos_mantenimiento(id) ON DELETE SET NULL,
  tecnico_id            uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,

  -- Origen comercial (resultado)
  cotizacion_id         uuid REFERENCES public.cotizaciones(id) ON DELETE SET NULL,
  factura_id            uuid REFERENCES public.facturas_emitidas(id) ON DELETE SET NULL,

  -- Fechas
  fecha_programada      date,
  fecha_inicio          timestamptz,
  fecha_cierre          timestamptz,

  -- Contenido técnico
  descripcion_problema  text,
  diagnostico           text,
  trabajos_realizados   text,
  observaciones         text,

  -- Firmas (URLs en Storage)
  firma_tecnico_url     text,
  firma_cliente_url     text,

  -- Costos (calculados al cerrar)
  costo_repuestos       numeric(12,2) DEFAULT 0,
  costo_mano_obra       numeric(12,2) DEFAULT 0,

  created_by            uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz,

  UNIQUE (empresa_id, numero)
);

-- Repuestos / materiales usados en la OS
CREATE TABLE IF NOT EXISTS public.os_repuestos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id          uuid NOT NULL REFERENCES public.ordenes_servicio(id) ON DELETE CASCADE,
  catalogo_id       uuid REFERENCES public.productos_catalogo(id) ON DELETE SET NULL,

  descripcion       text NOT NULL,
  cantidad          numeric(10,3) NOT NULL DEFAULT 1,
  precio_unitario   numeric(12,2) NOT NULL DEFAULT 0,
  precio_total      numeric(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,

  -- Si se descuenta de inventario, apunta a la unidad usada
  inventario_unidad_id uuid REFERENCES public.inventario_unidades(id) ON DELETE SET NULL,

  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Fotos de la OS
CREATE TABLE IF NOT EXISTS public.os_fotos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id    uuid NOT NULL REFERENCES public.ordenes_servicio(id) ON DELETE CASCADE,
  momento     text NOT NULL CHECK (momento IN ('antes','durante','despues')),
  url         text NOT NULL,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_os_empresa   ON public.ordenes_servicio(empresa_id);
CREATE INDEX IF NOT EXISTS idx_os_equipo    ON public.ordenes_servicio(equipo_id);
CREATE INDEX IF NOT EXISTS idx_os_cliente   ON public.ordenes_servicio(cliente_id);
CREATE INDEX IF NOT EXISTS idx_os_tecnico   ON public.ordenes_servicio(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_os_estado    ON public.ordenes_servicio(estado);
CREATE INDEX IF NOT EXISTS idx_os_repuestos ON public.os_repuestos(orden_id);
CREATE INDEX IF NOT EXISTS idx_os_fotos     ON public.os_fotos(orden_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. STORAGE BUCKET para fotos de OS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('os-fotos', 'os-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.equipos_instalados      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_mantenimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_equipos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_servicio        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_repuestos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_fotos               ENABLE ROW LEVEL SECURITY;

-- Helper: verifica membresía en empresa
CREATE OR REPLACE FUNCTION public.es_miembro_empresa_st(eid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE empresa_id = eid AND usuario_id = auth.uid()
  );
$$;

-- equipos_instalados
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='equipos_instalados' AND policyname='ei_select') THEN
    CREATE POLICY ei_select ON public.equipos_instalados FOR SELECT USING (es_miembro_empresa_st(empresa_id) AND deleted_at IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='equipos_instalados' AND policyname='ei_insert') THEN
    CREATE POLICY ei_insert ON public.equipos_instalados FOR INSERT WITH CHECK (es_miembro_empresa_st(empresa_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='equipos_instalados' AND policyname='ei_update') THEN
    CREATE POLICY ei_update ON public.equipos_instalados FOR UPDATE USING (es_miembro_empresa_st(empresa_id));
  END IF;
END $$;

-- contratos_mantenimiento
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_mantenimiento' AND policyname='cm_select') THEN
    CREATE POLICY cm_select ON public.contratos_mantenimiento FOR SELECT USING (es_miembro_empresa_st(empresa_id) AND deleted_at IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_mantenimiento' AND policyname='cm_insert') THEN
    CREATE POLICY cm_insert ON public.contratos_mantenimiento FOR INSERT WITH CHECK (es_miembro_empresa_st(empresa_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contratos_mantenimiento' AND policyname='cm_update') THEN
    CREATE POLICY cm_update ON public.contratos_mantenimiento FOR UPDATE USING (es_miembro_empresa_st(empresa_id));
  END IF;
END $$;

-- contrato_equipos (acceso via contrato de la empresa)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contrato_equipos' AND policyname='ce_select') THEN
    CREATE POLICY ce_select ON public.contrato_equipos FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.contratos_mantenimiento c WHERE c.id = contrato_id AND es_miembro_empresa_st(c.empresa_id))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contrato_equipos' AND policyname='ce_insert') THEN
    CREATE POLICY ce_insert ON public.contrato_equipos FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.contratos_mantenimiento c WHERE c.id = contrato_id AND es_miembro_empresa_st(c.empresa_id))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contrato_equipos' AND policyname='ce_delete') THEN
    CREATE POLICY ce_delete ON public.contrato_equipos FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.contratos_mantenimiento c WHERE c.id = contrato_id AND es_miembro_empresa_st(c.empresa_id))
    );
  END IF;
END $$;

-- ordenes_servicio
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ordenes_servicio' AND policyname='os_select') THEN
    CREATE POLICY os_select ON public.ordenes_servicio FOR SELECT USING (es_miembro_empresa_st(empresa_id) AND deleted_at IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ordenes_servicio' AND policyname='os_insert') THEN
    CREATE POLICY os_insert ON public.ordenes_servicio FOR INSERT WITH CHECK (es_miembro_empresa_st(empresa_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ordenes_servicio' AND policyname='os_update') THEN
    CREATE POLICY os_update ON public.ordenes_servicio FOR UPDATE USING (es_miembro_empresa_st(empresa_id));
  END IF;
END $$;

-- os_repuestos y os_fotos (acceso via orden de la empresa)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='os_repuestos' AND policyname='osr_select') THEN
    CREATE POLICY osr_select ON public.os_repuestos FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.ordenes_servicio o WHERE o.id = orden_id AND es_miembro_empresa_st(o.empresa_id))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='os_repuestos' AND policyname='osr_insert') THEN
    CREATE POLICY osr_insert ON public.os_repuestos FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.ordenes_servicio o WHERE o.id = orden_id AND es_miembro_empresa_st(o.empresa_id))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='os_repuestos' AND policyname='osr_update') THEN
    CREATE POLICY osr_update ON public.os_repuestos FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.ordenes_servicio o WHERE o.id = orden_id AND es_miembro_empresa_st(o.empresa_id))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='os_repuestos' AND policyname='osr_delete') THEN
    CREATE POLICY osr_delete ON public.os_repuestos FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.ordenes_servicio o WHERE o.id = orden_id AND es_miembro_empresa_st(o.empresa_id))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='os_fotos' AND policyname='osf_select') THEN
    CREATE POLICY osf_select ON public.os_fotos FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.ordenes_servicio o WHERE o.id = orden_id AND es_miembro_empresa_st(o.empresa_id))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='os_fotos' AND policyname='osf_insert') THEN
    CREATE POLICY osf_insert ON public.os_fotos FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.ordenes_servicio o WHERE o.id = orden_id AND es_miembro_empresa_st(o.empresa_id))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='os_fotos' AND policyname='osf_delete') THEN
    CREATE POLICY osf_delete ON public.os_fotos FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.ordenes_servicio o WHERE o.id = orden_id AND es_miembro_empresa_st(o.empresa_id))
    );
  END IF;
END $$;

-- Storage policies para os-fotos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='os_fotos_select') THEN
    CREATE POLICY os_fotos_select ON storage.objects FOR SELECT USING (bucket_id = 'os-fotos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='os_fotos_insert') THEN
    CREATE POLICY os_fotos_insert ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'os-fotos' AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='os_fotos_delete') THEN
    CREATE POLICY os_fotos_delete ON storage.objects FOR DELETE USING (bucket_id = 'os-fotos' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPCs
-- ─────────────────────────────────────────────────────────────────────────────

-- 6a. Crear equipo instalado (genera número automático)
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
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

-- 6b. Actualizar equipo instalado
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

-- 6c. Crear orden de servicio
CREATE OR REPLACE FUNCTION public.crear_orden_servicio(
  p_empresa_id uuid,
  p_datos      jsonb,
  p_repuestos  jsonb DEFAULT '[]'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id     uuid;
  v_numero text;
  v_seq    bigint;
  v_rep    jsonb;
BEGIN
  IF NOT es_miembro_empresa_st(p_empresa_id) THEN
    RAISE EXCEPTION 'Sin acceso';
  END IF;

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
    (p_datos->>'fecha_programada')::date,
    p_datos->>'descripcion_problema',
    p_datos->>'diagnostico',
    p_datos->>'trabajos_realizados',
    p_datos->>'observaciones',
    COALESCE((p_datos->>'costo_mano_obra')::numeric, 0),
    auth.uid()
  )
  RETURNING id INTO v_id;

  -- Insertar repuestos
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

-- 6d. Actualizar orden de servicio (datos + repuestos)
CREATE OR REPLACE FUNCTION public.actualizar_orden_servicio(
  p_id        uuid,
  p_datos     jsonb,
  p_repuestos jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rep jsonb;
BEGIN
  UPDATE public.ordenes_servicio SET
    tipo                 = COALESCE(p_datos->>'tipo', tipo),
    estado               = COALESCE(p_datos->>'estado', estado),
    modalidad_cobro      = COALESCE(p_datos->>'modalidad_cobro', modalidad_cobro),
    equipo_id            = COALESCE((p_datos->>'equipo_id')::uuid, equipo_id),
    cliente_id           = (p_datos->>'cliente_id')::uuid,
    proyecto_id          = (p_datos->>'proyecto_id')::uuid,
    contrato_id          = (p_datos->>'contrato_id')::uuid,
    tecnico_id           = (p_datos->>'tecnico_id')::uuid,
    fecha_programada     = (p_datos->>'fecha_programada')::date,
    fecha_inicio         = (p_datos->>'fecha_inicio')::timestamptz,
    fecha_cierre         = (p_datos->>'fecha_cierre')::timestamptz,
    descripcion_problema = p_datos->>'descripcion_problema',
    diagnostico          = p_datos->>'diagnostico',
    trabajos_realizados  = p_datos->>'trabajos_realizados',
    observaciones        = p_datos->>'observaciones',
    firma_tecnico_url    = COALESCE(p_datos->>'firma_tecnico_url', firma_tecnico_url),
    firma_cliente_url    = COALESCE(p_datos->>'firma_cliente_url', firma_cliente_url),
    cotizacion_id        = (p_datos->>'cotizacion_id')::uuid,
    factura_id           = (p_datos->>'factura_id')::uuid,
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

-- 6e. Cerrar orden de servicio (descuenta inventario automáticamente)
CREATE OR REPLACE FUNCTION public.cerrar_orden_servicio(
  p_id                 uuid,
  p_trabajos_realizados text,
  p_observaciones       text DEFAULT NULL,
  p_costo_mano_obra     numeric DEFAULT 0
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa_id  uuid;
  v_rep         RECORD;
  v_unidad_id   uuid;
  v_total_rep   numeric;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM public.ordenes_servicio
  WHERE id = p_id AND deleted_at IS NULL;

  IF NOT es_miembro_empresa_st(v_empresa_id) THEN
    RAISE EXCEPTION 'Sin acceso';
  END IF;

  -- Descontar inventario por cada repuesto con catalogo_id
  FOR v_rep IN
    SELECT r.id, r.catalogo_id, r.cantidad, r.precio_unitario
    FROM public.os_repuestos r
    WHERE r.orden_id = p_id AND r.catalogo_id IS NOT NULL
  LOOP
    -- Buscar una unidad disponible en bodega para ese producto
    SELECT u.id INTO v_unidad_id
    FROM public.inventario_unidades u
    WHERE u.producto_id = v_rep.catalogo_id
      AND u.estado = 'En bodega'
      AND u.cantidad_actual >= v_rep.cantidad
      AND u.empresa_id = v_empresa_id
    ORDER BY u.fecha_ingreso ASC
    LIMIT 1;

    IF v_unidad_id IS NOT NULL THEN
      -- Descontar del inventario
      UPDATE public.inventario_unidades
      SET cantidad_actual = cantidad_actual - v_rep.cantidad,
          updated_at = now()
      WHERE id = v_unidad_id;

      -- Registrar movimiento
      INSERT INTO public.inventario_movimientos (
        unidad_id, tipo, cantidad, fecha,
        observacion, usuario_id, empresa_id
      ) VALUES (
        v_unidad_id, 'Consumo OS', v_rep.cantidad, now(),
        'Consumo en Orden de Servicio ' || (SELECT numero FROM public.ordenes_servicio WHERE id = p_id),
        auth.uid(), v_empresa_id
      );

      -- Actualizar el repuesto con la unidad usada
      UPDATE public.os_repuestos
      SET inventario_unidad_id = v_unidad_id
      WHERE id = v_rep.id;
    END IF;
  END LOOP;

  -- Calcular total de repuestos
  SELECT COALESCE(SUM(precio_total), 0) INTO v_total_rep
  FROM public.os_repuestos WHERE orden_id = p_id;

  -- Cerrar la OS
  UPDATE public.ordenes_servicio SET
    estado              = 'completada',
    fecha_cierre        = now(),
    trabajos_realizados = COALESCE(p_trabajos_realizados, trabajos_realizados),
    observaciones       = COALESCE(p_observaciones, observaciones),
    costo_repuestos     = v_total_rep,
    costo_mano_obra     = COALESCE(p_costo_mano_obra, costo_mano_obra),
    updated_at          = now()
  WHERE id = p_id;

  -- Actualizar estado del equipo
  UPDATE public.equipos_instalados
  SET estado = 'activo', updated_at = now()
  WHERE id = (SELECT equipo_id FROM public.ordenes_servicio WHERE id = p_id);

  -- Notificación
  INSERT INTO public.notificaciones (
    empresa_id, usuario_id, tipo, prioridad, titulo, mensaje, url_destino
  )
  SELECT
    v_empresa_id, auth.uid(), 'servicio_tecnico', 'media',
    'OS Completada: ' || o.numero,
    'La orden de servicio ' || o.numero || ' ha sido cerrada.',
    '/servicio-tecnico/ordenes'
  FROM public.ordenes_servicio o WHERE o.id = p_id;
END;
$$;

-- 6f. Generar órdenes preventivas (llamar manualmente o desde cron)
CREATE OR REPLACE FUNCTION public.generar_ordenes_preventivas(
  p_empresa_id    uuid,
  p_dias_horizonte integer DEFAULT 7
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_equipo  RECORD;
  v_id      uuid;
  v_numero  text;
  v_seq     bigint;
  v_count   integer := 0;
BEGIN
  IF NOT es_miembro_empresa_st(p_empresa_id) THEN
    RAISE EXCEPTION 'Sin acceso';
  END IF;

  FOR v_equipo IN
    SELECT e.*
    FROM public.equipos_instalados e
    WHERE e.empresa_id = p_empresa_id
      AND e.deleted_at IS NULL
      AND e.requiere_mantenimiento = true
      AND e.frecuencia_mantenimiento_dias IS NOT NULL
      AND e.estado = 'activo'
      AND (
        e.proximo_mantenimiento IS NULL
        OR e.proximo_mantenimiento <= CURRENT_DATE + p_dias_horizonte
      )
      -- No generar si ya hay una OS preventiva pendiente para ese equipo
      AND NOT EXISTS (
        SELECT 1 FROM public.ordenes_servicio os
        WHERE os.equipo_id = e.id
          AND os.tipo = 'preventivo'
          AND os.estado IN ('pendiente','programada','en_proceso')
          AND os.deleted_at IS NULL
      )
  LOOP
    v_seq    := nextval('public.seq_ordenes_servicio');
    v_numero := 'OS-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 4, '0');

    INSERT INTO public.ordenes_servicio (
      empresa_id, numero, tipo, estado, modalidad_cobro,
      equipo_id, cliente_id, proyecto_id,
      fecha_programada, descripcion_problema, created_by
    ) VALUES (
      p_empresa_id, v_numero, 'preventivo', 'pendiente', 'contrato',
      v_equipo.id, v_equipo.cliente_id, v_equipo.proyecto_id,
      COALESCE(v_equipo.proximo_mantenimiento, CURRENT_DATE + p_dias_horizonte),
      'Mantenimiento preventivo programado automáticamente.',
      auth.uid()
    )
    RETURNING id INTO v_id;

    -- Actualizar próximo mantenimiento
    UPDATE public.equipos_instalados
    SET proximo_mantenimiento = CURRENT_DATE + (v_equipo.frecuencia_mantenimiento_dias || ' days')::interval,
        updated_at = now()
    WHERE id = v_equipo.id;

    -- Notificar al técnico si está asignado en el equipo
    IF v_equipo.tecnico_instalador_id IS NOT NULL THEN
      INSERT INTO public.notificaciones (
        empresa_id, usuario_id, tipo, prioridad, titulo, mensaje, url_destino
      ) VALUES (
        p_empresa_id, v_equipo.tecnico_instalador_id,
        'servicio_tecnico', 'alta',
        'Preventivo programado: ' || v_equipo.nombre,
        'Se generó la OS ' || v_numero || ' para el equipo ' || v_equipo.nombre || '.',
        '/servicio-tecnico/ordenes'
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 6g. Crear contrato de mantenimiento
CREATE OR REPLACE FUNCTION public.crear_contrato_mantenimiento(
  p_empresa_id uuid,
  p_datos      jsonb,
  p_equipos    uuid[] DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id     uuid;
  v_numero text;
  v_seq    bigint;
  v_eid    uuid;
BEGIN
  IF NOT es_miembro_empresa_st(p_empresa_id) THEN
    RAISE EXCEPTION 'Sin acceso';
  END IF;

  v_seq    := nextval('public.seq_contratos_mantenimiento');
  v_numero := 'CM-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO public.contratos_mantenimiento (
    empresa_id, numero, cliente_id, proyecto_id,
    incluye_preventivos, incluye_correctivos, visitas_incluidas,
    periodicidad_meses, fecha_inicio, fecha_fin, valor_contrato,
    estado, observaciones, created_by
  ) VALUES (
    p_empresa_id, v_numero,
    (p_datos->>'cliente_id')::uuid,
    (p_datos->>'proyecto_id')::uuid,
    COALESCE((p_datos->>'incluye_preventivos')::boolean, true),
    COALESCE((p_datos->>'incluye_correctivos')::boolean, false),
    (p_datos->>'visitas_incluidas')::integer,
    COALESCE((p_datos->>'periodicidad_meses')::integer, 12),
    (p_datos->>'fecha_inicio')::date,
    (p_datos->>'fecha_fin')::date,
    COALESCE((p_datos->>'valor_contrato')::numeric, 0),
    COALESCE(p_datos->>'estado', 'activo'),
    p_datos->>'observaciones',
    auth.uid()
  )
  RETURNING id INTO v_id;

  -- Vincular equipos
  FOREACH v_eid IN ARRAY p_equipos LOOP
    INSERT INTO public.contrato_equipos (contrato_id, equipo_id)
    VALUES (v_id, v_eid)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object('id', v_id, 'numero', v_numero);
END;
$$;

-- 6h. Actualizar contrato de mantenimiento
CREATE OR REPLACE FUNCTION public.actualizar_contrato_mantenimiento(
  p_id      uuid,
  p_datos   jsonb,
  p_equipos uuid[] DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.contratos_mantenimiento SET
    cliente_id           = COALESCE((p_datos->>'cliente_id')::uuid, cliente_id),
    proyecto_id          = (p_datos->>'proyecto_id')::uuid,
    incluye_preventivos  = COALESCE((p_datos->>'incluye_preventivos')::boolean, incluye_preventivos),
    incluye_correctivos  = COALESCE((p_datos->>'incluye_correctivos')::boolean, incluye_correctivos),
    visitas_incluidas    = (p_datos->>'visitas_incluidas')::integer,
    periodicidad_meses   = COALESCE((p_datos->>'periodicidad_meses')::integer, periodicidad_meses),
    fecha_inicio         = COALESCE((p_datos->>'fecha_inicio')::date, fecha_inicio),
    fecha_fin            = COALESCE((p_datos->>'fecha_fin')::date, fecha_fin),
    valor_contrato       = COALESCE((p_datos->>'valor_contrato')::numeric, valor_contrato),
    estado               = COALESCE(p_datos->>'estado', estado),
    observaciones        = p_datos->>'observaciones',
    updated_at           = now()
  WHERE id = p_id
    AND es_miembro_empresa_st(empresa_id)
    AND deleted_at IS NULL;

  IF p_equipos IS NOT NULL THEN
    DELETE FROM public.contrato_equipos WHERE contrato_id = p_id;
    DECLARE
      v_eid2 uuid;
    BEGIN
      FOREACH v_eid2 IN ARRAY p_equipos LOOP
        INSERT INTO public.contrato_equipos (contrato_id, equipo_id)
        VALUES (p_id, v_eid2)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END;
  END IF;
END;
$$;
