-- =============================================================================
-- MÓDULO IMPORTACIONES — Fase 4: Grupos de Embarque y Prorrateo Consolidado
-- Un grupo_embarque agrupa múltiples importaciones (DAIs) de un mismo envío
-- físico (distintos proveedores / proyectos / clientes), distribuyendo los
-- costos compartidos de transporte (flete, seguro) proporcionales al FOB.
-- =============================================================================

-- ── Secuencia para número de grupo ──────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.grupos_embarque_seq START 1;

-- ── Tabla: grupos_embarque ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.grupos_embarque (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid    NOT NULL REFERENCES public.empresas(id),
  numero            text    NOT NULL,            -- GE-2026-0001
  descripcion       text,
  fecha             date    NOT NULL DEFAULT CURRENT_DATE,
  -- Costos compartidos del transporte físico (se prorratean a las importaciones)
  flete_total       numeric(14,2) NOT NULL DEFAULT 0,
  seguro_total      numeric(14,2) NOT NULL DEFAULT 0,
  otros_logistica   numeric(14,2) NOT NULL DEFAULT 0,
  -- Totales calculados al prorratear
  fob_total_grupo   numeric(14,2) NOT NULL DEFAULT 0,
  -- Estado
  estado            text    NOT NULL DEFAULT 'Abierto'
                    CHECK (estado IN ('Abierto','Prorrateado','Cerrado')),
  observacion       text,
  created_by        uuid    REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

-- ── Vincular importaciones a su grupo de embarque ───────────────────────────
ALTER TABLE public.importaciones
  ADD COLUMN IF NOT EXISTS grupo_embarque_id  uuid    REFERENCES public.grupos_embarque(id),
  ADD COLUMN IF NOT EXISTS flete_prorrateado  numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seguro_prorrateado numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otros_prorrateado  numeric(14,2) DEFAULT 0;

-- Índices
CREATE INDEX IF NOT EXISTS idx_grupos_embarque_empresa
  ON public.grupos_embarque(empresa_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_importaciones_grupo
  ON public.importaciones(grupo_embarque_id)
  WHERE grupo_embarque_id IS NOT NULL;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.grupos_embarque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grp_embarque_empresa" ON public.grupos_embarque;
CREATE POLICY "grp_embarque_empresa" ON public.grupos_embarque
  USING (empresa_id IN (
    SELECT eu.empresa_id FROM public.empresas_usuarios eu
    WHERE eu.usuario_id = auth.uid() AND eu.activo = true
  ));

-- ── RPC: crear_grupo_embarque ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crear_grupo_embarque(
  p_empresa_id      uuid,
  p_datos           jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id     uuid;
  v_numero text;
BEGIN
  -- Verificar pertenencia
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas_usuarios
    WHERE usuario_id = auth.uid() AND empresa_id = p_empresa_id AND activo = true
  ) THEN
    RAISE EXCEPTION 'Sin permisos para esta empresa';
  END IF;

  v_numero := 'GE-' || to_char(now(), 'YYYY') || '-'
    || LPAD(nextval('public.grupos_embarque_seq')::text, 4, '0');

  INSERT INTO public.grupos_embarque (
    empresa_id, numero, descripcion, fecha,
    flete_total, seguro_total, otros_logistica,
    estado, observacion, created_by
  ) VALUES (
    p_empresa_id, v_numero,
    p_datos->>'descripcion',
    COALESCE((p_datos->>'fecha')::date, CURRENT_DATE),
    COALESCE((p_datos->>'flete_total')::numeric, 0),
    COALESCE((p_datos->>'seguro_total')::numeric, 0),
    COALESCE((p_datos->>'otros_logistica')::numeric, 0),
    COALESCE(p_datos->>'estado', 'Abierto'),
    p_datos->>'observacion',
    auth.uid()
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'numero', v_numero);
END;
$$;

-- ── RPC: actualizar_grupo_embarque ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.actualizar_grupo_embarque(
  p_id    uuid,
  p_datos jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.grupos_embarque SET
    descripcion     = COALESCE(p_datos->>'descripcion',     descripcion),
    fecha           = COALESCE((p_datos->>'fecha')::date,   fecha),
    flete_total     = COALESCE((p_datos->>'flete_total')::numeric,    flete_total),
    seguro_total    = COALESCE((p_datos->>'seguro_total')::numeric,   seguro_total),
    otros_logistica = COALESCE((p_datos->>'otros_logistica')::numeric, otros_logistica),
    estado          = COALESCE(p_datos->>'estado',          estado),
    observacion     = COALESCE(p_datos->>'observacion',     observacion),
    updated_at      = now()
  WHERE id = p_id
    AND empresa_id IN (
      SELECT eu.empresa_id FROM public.empresas_usuarios eu
      WHERE eu.usuario_id = auth.uid() AND eu.activo = true
    );
END;
$$;

-- ── RPC: eliminar_grupo_embarque ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.eliminar_grupo_embarque(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Desvincular importaciones antes de eliminar
  UPDATE public.importaciones SET grupo_embarque_id = NULL WHERE grupo_embarque_id = p_id;

  UPDATE public.grupos_embarque
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_id
    AND empresa_id IN (
      SELECT eu.empresa_id FROM public.empresas_usuarios eu
      WHERE eu.usuario_id = auth.uid() AND eu.activo = true
    );
END;
$$;

-- ── RPC: vincular_importacion_a_grupo ────────────────────────────────────────
-- Asocia una importacion al grupo de embarque.
CREATE OR REPLACE FUNCTION public.vincular_importacion_a_grupo(
  p_importacion_id  uuid,
  p_grupo_id        uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.importaciones
  SET grupo_embarque_id = p_grupo_id,
      updated_at        = now()
  WHERE id = p_importacion_id
    AND empresa_id IN (
      SELECT eu.empresa_id FROM public.empresas_usuarios eu
      WHERE eu.usuario_id = auth.uid() AND eu.activo = true
    );
END;
$$;

-- ── RPC: desvincular_importacion_de_grupo ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.desvincular_importacion_de_grupo(
  p_importacion_id  uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.importaciones
  SET grupo_embarque_id   = NULL,
      flete_prorrateado   = 0,
      seguro_prorrateado  = 0,
      otros_prorrateado   = 0,
      updated_at          = now()
  WHERE id = p_importacion_id
    AND empresa_id IN (
      SELECT eu.empresa_id FROM public.empresas_usuarios eu
      WHERE eu.usuario_id = auth.uid() AND eu.activo = true
    );
END;
$$;

-- ── RPC: prorratear_grupo_embarque ───────────────────────────────────────────
-- Distribuye flete_total + seguro_total + otros_logistica del grupo a cada
-- importacion proporcionalmente a su fob_total. Luego recalcula el
-- costo_unitario_calculado de todas las líneas de cada importacion.
CREATE OR REPLACE FUNCTION public.prorratear_grupo_embarque(p_grupo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo        record;
  v_empresa_id   uuid;
  v_fob_total    numeric := 0;
  v_imp          record;
  v_prorated_fle numeric;
  v_prorated_seg numeric;
  v_prorated_otr numeric;
  v_count        integer := 0;
BEGIN
  -- Verificar permisos
  SELECT g.*, eu.empresa_id AS emp_id
  INTO v_grupo
  FROM public.grupos_embarque g
  JOIN public.empresas_usuarios eu ON eu.empresa_id = g.empresa_id
  WHERE g.id = p_grupo_id
    AND eu.usuario_id = auth.uid()
    AND eu.activo = true
    AND g.deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo de embarque no encontrado o sin permisos';
  END IF;

  -- Sumar FOB de todas las importaciones vinculadas
  SELECT COALESCE(SUM(fob_total), 0)
  INTO v_fob_total
  FROM public.importaciones
  WHERE grupo_embarque_id = p_grupo_id
    AND deleted_at IS NULL;

  IF v_fob_total = 0 THEN
    RAISE EXCEPTION 'El grupo no tiene importaciones con FOB > 0 para prorratear';
  END IF;

  -- Distribuir costos a cada importación proporcional a su FOB
  FOR v_imp IN
    SELECT id, fob_total
    FROM public.importaciones
    WHERE grupo_embarque_id = p_grupo_id
      AND deleted_at IS NULL
  LOOP
    v_prorated_fle := ROUND((v_imp.fob_total / v_fob_total) * v_grupo.flete_total,   2);
    v_prorated_seg := ROUND((v_imp.fob_total / v_fob_total) * v_grupo.seguro_total,  2);
    v_prorated_otr := ROUND((v_imp.fob_total / v_fob_total) * v_grupo.otros_logistica, 2);

    UPDATE public.importaciones
    SET flete_prorrateado  = v_prorated_fle,
        seguro_prorrateado = v_prorated_seg,
        otros_prorrateado  = v_prorated_otr,
        -- Actualizar flete y seguro en la propia importacion para el prorrateo de líneas
        flete  = CASE WHEN flete = 0 THEN v_prorated_fle ELSE flete + v_prorated_fle END,
        seguro = CASE WHEN seguro = 0 THEN v_prorated_seg ELSE seguro + v_prorated_seg END,
        updated_at = now()
    WHERE id = v_imp.id;

    -- Recalcular costo unitario de las líneas de esta importacion
    PERFORM public.inv_calcular_prorrateo(v_imp.id);

    v_count := v_count + 1;
  END LOOP;

  -- Actualizar fob_total y estado del grupo
  UPDATE public.grupos_embarque
  SET fob_total_grupo = v_fob_total,
      estado          = 'Prorrateado',
      updated_at      = now()
  WHERE id = p_grupo_id;

  RETURN jsonb_build_object(
    'ok',              true,
    'importaciones',   v_count,
    'fob_total_grupo', v_fob_total,
    'flete_distribuido',  v_grupo.flete_total,
    'seguro_distribuido', v_grupo.seguro_total
  );
END;
$$;

-- ── RPC: recibir_embarque ─────────────────────────────────────────────────────
-- Marca una importacion como "Recibida" y genera unidades de inventario
-- para cada línea vinculada a un producto del catálogo.
CREATE OR REPLACE FUNCTION public.recibir_embarque(p_importacion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id  uuid;
  v_unidades    integer;
BEGIN
  -- Verificar pertenencia
  SELECT empresa_id INTO v_empresa_id
  FROM public.importaciones
  WHERE id = p_importacion_id
    AND empresa_id IN (
      SELECT eu.empresa_id FROM public.empresas_usuarios eu
      WHERE eu.usuario_id = auth.uid() AND eu.activo = true
    )
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Importacion no encontrada o sin permisos';
  END IF;

  -- Marcar como Recibida
  UPDATE public.importaciones
  SET estado     = 'Recibida',
      updated_at = now()
  WHERE id = p_importacion_id;

  -- Generar unidades en inventario
  v_unidades := public.inv_generar_unidades(p_importacion_id);

  RETURN jsonb_build_object(
    'ok',       true,
    'unidades', v_unidades
  );
END;
$$;

-- ── GRANTs ───────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.crear_grupo_embarque(uuid, jsonb)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_grupo_embarque(uuid, jsonb)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_grupo_embarque(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_importacion_a_grupo(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desvincular_importacion_de_grupo(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.prorratear_grupo_embarque(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.recibir_embarque(uuid)                  TO authenticated;

COMMENT ON TABLE  public.grupos_embarque IS
  'Agrupa múltiples importaciones (DAIs) de un mismo envío físico. '
  'Los costos compartidos de transporte se prorratean a cada importacion '
  'proporcional a su FOB mediante prorratear_grupo_embarque().';
