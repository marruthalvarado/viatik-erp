-- =============================================================================
-- ST-B: Modalidades → Modelos de Equipo → Protocolos de Mantenimiento
-- Jerarquía completa para gestión de mantenimiento preventivo de equipos médicos
-- =============================================================================
SET statement_timeout = 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Modalidades de equipos médicos (NM, CT, MR, XR, BMD, XM, RP, etc.)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.modalidades (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo        text NOT NULL,       -- NM, CT, MR, XR, BMD, XM, RP...
  nombre        text NOT NULL,       -- Medicina Nuclear, Tomografía Computarizada...
  descripcion   text,
  activa        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_modalidades_empresa ON public.modalidades(empresa_id);

ALTER TABLE public.modalidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modalidades_empresa" ON public.modalidades
  USING (empresa_id IN (
    SELECT eu.empresa_id FROM public.empresas_usuarios eu
    WHERE eu.usuario_id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Modelos de equipo (ECAM, ECAM Nova, Discovery 670, etc.)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.modelos_equipo (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  modalidad_id    uuid NOT NULL REFERENCES public.modalidades(id) ON DELETE RESTRICT,
  nombre          text NOT NULL,       -- ECAM, ECAM Nova, Discovery NM 670
  fabricante      text,                -- GE Healthcare, Siemens Healthineers...
  descripcion     text,
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, modalidad_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_modelos_equipo_empresa ON public.modelos_equipo(empresa_id);
CREATE INDEX IF NOT EXISTS idx_modelos_equipo_modalidad ON public.modelos_equipo(modalidad_id);

ALTER TABLE public.modelos_equipo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modelos_equipo_empresa" ON public.modelos_equipo
  USING (empresa_id IN (
    SELECT eu.empresa_id FROM public.empresas_usuarios eu
    WHERE eu.usuario_id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Vincular equipos_instalados a su modelo
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.equipos_instalados
  ADD COLUMN IF NOT EXISTS modelo_id uuid REFERENCES public.modelos_equipo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_equipos_instalados_modelo ON public.equipos_instalados(modelo_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Protocolos de mantenimiento (1 o más por modelo)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.protocolos_mantenimiento (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  modelo_id       uuid NOT NULL REFERENCES public.modelos_equipo(id) ON DELETE CASCADE,
  nombre          text NOT NULL,       -- "CHL ECAM Safety Check and PM"
  version         text,               -- "003.2023-02-07"
  descripcion     text,
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_protocolos_empresa ON public.protocolos_mantenimiento(empresa_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_modelo ON public.protocolos_mantenimiento(modelo_id);

ALTER TABLE public.protocolos_mantenimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "protocolos_mantenimiento_empresa" ON public.protocolos_mantenimiento
  USING (empresa_id IN (
    SELECT eu.empresa_id FROM public.empresas_usuarios eu
    WHERE eu.usuario_id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Secciones del protocolo (p.ej: "Basic Maintenance 6 months", "Annual 1st")
--    intervalo_meses: NULL = cada visita; 6 = semestral; 12 = anual; 24 = bienal; 60 = quinquenal
--    Las secciones son acumulativas: un PM anual incluye la sección de 6 meses también.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.protocolo_secciones (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id            uuid NOT NULL REFERENCES public.protocolos_mantenimiento(id) ON DELETE CASCADE,
  numero                  integer NOT NULL,   -- 1, 2, 3... (para ordenar)
  titulo                  text NOT NULL,
  intervalo_meses         integer,            -- NULL=cada visita, 6, 12, 24, 60
  descripcion_frecuencia  text,               -- "Every 6 months", "First time 6 months after install"
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (protocolo_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_protocolo_secciones_protocolo ON public.protocolo_secciones(protocolo_id);

ALTER TABLE public.protocolo_secciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "protocolo_secciones_empresa" ON public.protocolo_secciones
  USING (
    protocolo_id IN (
      SELECT pm.id FROM public.protocolos_mantenimiento pm
      WHERE pm.empresa_id IN (
        SELECT eu.empresa_id FROM public.empresas_usuarios eu
        WHERE eu.usuario_id = auth.uid()
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Tipo de campo para actividades (enum)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.tipo_campo_actividad AS ENUM ('check3', 'medicion', 'texto', 'foto');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Actividades dentro de cada sección
--    tipo_campo:
--      check3   → resultado: ok | not_ok | na  (el checkbox OK/Not OK/N.A. del PDF)
--      medicion → valor_medido: numeric, con valor_min/max y unidad
--      texto    → observación libre
--      foto     → evidencia fotográfica
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.protocolo_actividades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seccion_id      uuid NOT NULL REFERENCES public.protocolo_secciones(id) ON DELETE CASCADE,
  orden           integer NOT NULL DEFAULT 0,
  numero_paso     text,               -- "2.1.1", "3.2.3" — etiqueta del documento
  descripcion     text NOT NULL,
  referencia_proc text,               -- número de procedimiento interno ej "6.5.1", "---"

  tipo_campo      public.tipo_campo_actividad NOT NULL DEFAULT 'check3',

  -- Aplica solo a configuraciones específicas del equipo (NULL = todos)
  -- Ej: "HD3C", "HD3R", "dual_head"
  aplica_config   text,

  -- Para tipo 'medicion': rango aceptable y unidad
  valor_min       numeric,
  valor_max       numeric,
  unidad          text,               -- "V", "mV", "mA", "°C"...

  es_critico      boolean NOT NULL DEFAULT false,
  notas           text,

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_protocolo_actividades_seccion
  ON public.protocolo_actividades(seccion_id, orden);

ALTER TABLE public.protocolo_actividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "protocolo_actividades_empresa" ON public.protocolo_actividades
  USING (
    seccion_id IN (
      SELECT ps.id FROM public.protocolo_secciones ps
      JOIN public.protocolos_mantenimiento pm ON pm.id = ps.protocolo_id
      WHERE pm.empresa_id IN (
        SELECT eu.empresa_id FROM public.empresas_usuarios eu
        WHERE eu.usuario_id = auth.uid()
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RPCs SECURITY DEFINER
-- ─────────────────────────────────────────────────────────────────────────────

-- 8a. Crear modalidad
CREATE OR REPLACE FUNCTION public.rpc_crear_modalidad(
  p_empresa_id  uuid,
  p_codigo      text,
  p_nombre      text,
  p_descripcion text DEFAULT NULL
)
RETURNS public.modalidades
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.modalidades;
BEGIN
  INSERT INTO public.modalidades (empresa_id, codigo, nombre, descripcion)
  VALUES (p_empresa_id, upper(trim(p_codigo)), trim(p_nombre), p_descripcion)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- 8b. Actualizar modalidad
CREATE OR REPLACE FUNCTION public.rpc_actualizar_modalidad(
  p_id          uuid,
  p_codigo      text DEFAULT NULL,
  p_nombre      text DEFAULT NULL,
  p_descripcion text DEFAULT NULL,
  p_activa      boolean DEFAULT NULL
)
RETURNS public.modalidades
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.modalidades;
BEGIN
  UPDATE public.modalidades SET
    codigo      = COALESCE(upper(trim(p_codigo)), codigo),
    nombre      = COALESCE(trim(p_nombre), nombre),
    descripcion = COALESCE(p_descripcion, descripcion),
    activa      = COALESCE(p_activa, activa)
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- 8c. Crear modelo de equipo
CREATE OR REPLACE FUNCTION public.rpc_crear_modelo_equipo(
  p_empresa_id    uuid,
  p_modalidad_id  uuid,
  p_nombre        text,
  p_fabricante    text DEFAULT NULL,
  p_descripcion   text DEFAULT NULL
)
RETURNS public.modelos_equipo
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.modelos_equipo;
BEGIN
  INSERT INTO public.modelos_equipo (empresa_id, modalidad_id, nombre, fabricante, descripcion)
  VALUES (p_empresa_id, p_modalidad_id, trim(p_nombre), p_fabricante, p_descripcion)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- 8d. Actualizar modelo de equipo
CREATE OR REPLACE FUNCTION public.rpc_actualizar_modelo_equipo(
  p_id          uuid,
  p_nombre      text DEFAULT NULL,
  p_fabricante  text DEFAULT NULL,
  p_descripcion text DEFAULT NULL,
  p_activo      boolean DEFAULT NULL
)
RETURNS public.modelos_equipo
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.modelos_equipo;
BEGIN
  UPDATE public.modelos_equipo SET
    nombre      = COALESCE(trim(p_nombre), nombre),
    fabricante  = COALESCE(p_fabricante, fabricante),
    descripcion = COALESCE(p_descripcion, descripcion),
    activo      = COALESCE(p_activo, activo)
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- 8e. Crear protocolo
CREATE OR REPLACE FUNCTION public.rpc_crear_protocolo_mantenimiento(
  p_empresa_id  uuid,
  p_modelo_id   uuid,
  p_nombre      text,
  p_version     text DEFAULT NULL,
  p_descripcion text DEFAULT NULL
)
RETURNS public.protocolos_mantenimiento
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.protocolos_mantenimiento;
BEGIN
  INSERT INTO public.protocolos_mantenimiento (empresa_id, modelo_id, nombre, version, descripcion)
  VALUES (p_empresa_id, p_modelo_id, trim(p_nombre), p_version, p_descripcion)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- 8f. Actualizar protocolo
CREATE OR REPLACE FUNCTION public.rpc_actualizar_protocolo_mantenimiento(
  p_id          uuid,
  p_nombre      text DEFAULT NULL,
  p_version     text DEFAULT NULL,
  p_descripcion text DEFAULT NULL,
  p_activo      boolean DEFAULT NULL
)
RETURNS public.protocolos_mantenimiento
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.protocolos_mantenimiento;
BEGIN
  UPDATE public.protocolos_mantenimiento SET
    nombre      = COALESCE(trim(p_nombre), nombre),
    version     = COALESCE(p_version, version),
    descripcion = COALESCE(p_descripcion, descripcion),
    activo      = COALESCE(p_activo, activo)
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- 8g. Crear sección de protocolo
CREATE OR REPLACE FUNCTION public.rpc_crear_protocolo_seccion(
  p_protocolo_id          uuid,
  p_numero                integer,
  p_titulo                text,
  p_intervalo_meses       integer DEFAULT NULL,
  p_descripcion_frecuencia text DEFAULT NULL
)
RETURNS public.protocolo_secciones
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.protocolo_secciones;
BEGIN
  INSERT INTO public.protocolo_secciones
    (protocolo_id, numero, titulo, intervalo_meses, descripcion_frecuencia)
  VALUES
    (p_protocolo_id, p_numero, trim(p_titulo), p_intervalo_meses, p_descripcion_frecuencia)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- 8h. Actualizar sección
CREATE OR REPLACE FUNCTION public.rpc_actualizar_protocolo_seccion(
  p_id                    uuid,
  p_titulo                text DEFAULT NULL,
  p_intervalo_meses       integer DEFAULT NULL,
  p_descripcion_frecuencia text DEFAULT NULL
)
RETURNS public.protocolo_secciones
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.protocolo_secciones;
BEGIN
  UPDATE public.protocolo_secciones SET
    titulo                  = COALESCE(trim(p_titulo), titulo),
    intervalo_meses         = COALESCE(p_intervalo_meses, intervalo_meses),
    descripcion_frecuencia  = COALESCE(p_descripcion_frecuencia, descripcion_frecuencia)
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- 8i. Crear actividad en sección
CREATE OR REPLACE FUNCTION public.rpc_crear_protocolo_actividad(
  p_seccion_id      uuid,
  p_orden           integer,
  p_descripcion     text,
  p_numero_paso     text DEFAULT NULL,
  p_referencia_proc text DEFAULT NULL,
  p_tipo_campo      public.tipo_campo_actividad DEFAULT 'check3',
  p_aplica_config   text DEFAULT NULL,
  p_valor_min       numeric DEFAULT NULL,
  p_valor_max       numeric DEFAULT NULL,
  p_unidad          text DEFAULT NULL,
  p_es_critico      boolean DEFAULT false,
  p_notas           text DEFAULT NULL
)
RETURNS public.protocolo_actividades
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.protocolo_actividades;
BEGIN
  INSERT INTO public.protocolo_actividades
    (seccion_id, orden, descripcion, numero_paso, referencia_proc, tipo_campo,
     aplica_config, valor_min, valor_max, unidad, es_critico, notas)
  VALUES
    (p_seccion_id, p_orden, trim(p_descripcion), p_numero_paso, p_referencia_proc, p_tipo_campo,
     p_aplica_config, p_valor_min, p_valor_max, p_unidad, p_es_critico, p_notas)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- 8j. Actualizar actividad
CREATE OR REPLACE FUNCTION public.rpc_actualizar_protocolo_actividad(
  p_id              uuid,
  p_orden           integer DEFAULT NULL,
  p_descripcion     text DEFAULT NULL,
  p_numero_paso     text DEFAULT NULL,
  p_referencia_proc text DEFAULT NULL,
  p_tipo_campo      public.tipo_campo_actividad DEFAULT NULL,
  p_aplica_config   text DEFAULT NULL,
  p_valor_min       numeric DEFAULT NULL,
  p_valor_max       numeric DEFAULT NULL,
  p_unidad          text DEFAULT NULL,
  p_es_critico      boolean DEFAULT NULL,
  p_notas           text DEFAULT NULL
)
RETURNS public.protocolo_actividades
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.protocolo_actividades;
BEGIN
  UPDATE public.protocolo_actividades SET
    orden           = COALESCE(p_orden, orden),
    descripcion     = COALESCE(trim(p_descripcion), descripcion),
    numero_paso     = COALESCE(p_numero_paso, numero_paso),
    referencia_proc = COALESCE(p_referencia_proc, referencia_proc),
    tipo_campo      = COALESCE(p_tipo_campo, tipo_campo),
    aplica_config   = COALESCE(p_aplica_config, aplica_config),
    valor_min       = COALESCE(p_valor_min, valor_min),
    valor_max       = COALESCE(p_valor_max, valor_max),
    unidad          = COALESCE(p_unidad, unidad),
    es_critico      = COALESCE(p_es_critico, es_critico),
    notas           = COALESCE(p_notas, notas)
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- 8k. Eliminar actividad
CREATE OR REPLACE FUNCTION public.rpc_eliminar_protocolo_actividad(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.protocolo_actividades WHERE id = p_id;
END;
$$;

-- 8l. Eliminar sección (cascade borra sus actividades)
CREATE OR REPLACE FUNCTION public.rpc_eliminar_protocolo_seccion(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.protocolo_secciones WHERE id = p_id;
END;
$$;

-- 8m. Reordenar actividades de una sección
CREATE OR REPLACE FUNCTION public.rpc_reordenar_actividades(
  p_seccion_id  uuid,
  p_ids         uuid[]         -- array de IDs en el nuevo orden
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  i integer;
BEGIN
  FOR i IN 1 .. array_length(p_ids, 1) LOOP
    UPDATE public.protocolo_actividades
    SET orden = i
    WHERE id = p_ids[i] AND seccion_id = p_seccion_id;
  END LOOP;
END;
$$;
