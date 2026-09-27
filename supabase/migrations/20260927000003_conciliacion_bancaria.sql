-- ─────────────────────────────────────────────────────────────────────────────
-- Módulo Conciliación Bancaria — Fase C
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Cuentas bancarias por empresa
CREATE TABLE IF NOT EXISTS public.cuentas_bancarias (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID          NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  banco         TEXT          NOT NULL,          -- 'ProCredit', 'Pichincha', 'Internacional', etc.
  nombre        TEXT          NOT NULL,          -- Alias: "Cta. Cte. ProCredit USD"
  numero_cuenta TEXT,
  moneda        TEXT          NOT NULL DEFAULT 'USD',
  activa        BOOLEAN       NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cuentas_bancarias ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='cuentas_bancarias' AND policyname='cuentas_bancarias_empresa_all'
  ) THEN
    CREATE POLICY cuentas_bancarias_empresa_all ON public.cuentas_bancarias
      FOR ALL USING (
        empresa_id IN (
          SELECT eu.empresa_id FROM public.empresas_usuarios eu
          WHERE eu.usuario_id = auth.uid() AND eu.activo = true
        )
      );
  END IF;
END $$;

-- 2. Movimientos bancarios importados
CREATE TABLE IF NOT EXISTS public.movimientos_bancarios (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id     UUID          NOT NULL REFERENCES public.cuentas_bancarias(id) ON DELETE CASCADE,
  empresa_id    UUID          NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  fecha         DATE          NOT NULL,
  descripcion   TEXT,
  referencia    TEXT,
  tipo          TEXT          NOT NULL CHECK (tipo IN ('DEBITO','CREDITO')),
  monto         NUMERIC(14,2) NOT NULL,
  saldo         NUMERIC(14,2),
  estado        TEXT          NOT NULL DEFAULT 'sin_conciliar'
                  CHECK (estado IN ('sin_conciliar','conciliado','ignorado')),
  -- Referencia al objeto conciliado
  match_tipo    TEXT          CHECK (match_tipo IN ('factura','gasto','cobro','manual')),
  match_id      UUID,
  match_nota    TEXT,
  -- Hash para evitar duplicar al reimportar el mismo extracto
  hash_unico    TEXT          NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (cuenta_id, hash_unico)
);

ALTER TABLE public.movimientos_bancarios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='movimientos_bancarios' AND policyname='movimientos_bancarios_empresa_all'
  ) THEN
    CREATE POLICY movimientos_bancarios_empresa_all ON public.movimientos_bancarios
      FOR ALL USING (
        empresa_id IN (
          SELECT eu.empresa_id FROM public.empresas_usuarios eu
          WHERE eu.usuario_id = auth.uid() AND eu.activo = true
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_movimientos_bancarios_cuenta_estado
  ON public.movimientos_bancarios (cuenta_id, estado);

CREATE INDEX IF NOT EXISTS idx_movimientos_bancarios_empresa_fecha
  ON public.movimientos_bancarios (empresa_id, fecha DESC);

-- 3. RPC — importar lote de movimientos (idempotente: skip duplicados)
CREATE OR REPLACE FUNCTION public.importar_movimientos_bancarios(
  p_cuenta_id  UUID,
  p_empresa_id UUID,
  p_movimientos JSONB   -- [{fecha, descripcion, referencia, tipo, monto, saldo?}]
)
RETURNS TABLE (insertados INT, duplicados INT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_insertados INT := 0;
  v_duplicados INT := 0;
  m            JSONB;
  v_hash       TEXT;
BEGIN
  FOR m IN SELECT * FROM jsonb_array_elements(p_movimientos)
  LOOP
    v_hash := md5(
      p_cuenta_id::text
      || (m->>'fecha')
      || (m->>'tipo')
      || (m->>'monto')
      || COALESCE(m->>'referencia', '')
    );

    INSERT INTO public.movimientos_bancarios
      (cuenta_id, empresa_id, fecha, descripcion, referencia, tipo, monto, saldo, hash_unico)
    VALUES (
      p_cuenta_id,
      p_empresa_id,
      (m->>'fecha')::DATE,
      m->>'descripcion',
      m->>'referencia',
      m->>'tipo',
      (m->>'monto')::NUMERIC,
      CASE WHEN m->>'saldo' IS NOT NULL THEN (m->>'saldo')::NUMERIC ELSE NULL END,
      v_hash
    )
    ON CONFLICT (cuenta_id, hash_unico) DO NOTHING;

    IF FOUND THEN
      v_insertados := v_insertados + 1;
    ELSE
      v_duplicados := v_duplicados + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_insertados, v_duplicados;
END;
$$;

-- 4. RPC — marcar movimiento como conciliado (y opcionalmente crear cobro)
CREATE OR REPLACE FUNCTION public.marcar_movimiento_conciliado(
  p_movimiento_id UUID,
  p_match_tipo    TEXT,          -- 'factura' | 'gasto' | 'cobro' | 'manual'
  p_match_id      UUID  DEFAULT NULL,
  p_match_nota    TEXT  DEFAULT NULL,
  -- Si match_tipo='factura', crear cobro automáticamente
  p_crear_cobro   BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_mov public.movimientos_bancarios%ROWTYPE;
BEGIN
  SELECT * INTO v_mov FROM public.movimientos_bancarios WHERE id = p_movimiento_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento no encontrado'; END IF;

  UPDATE public.movimientos_bancarios
  SET
    estado     = 'conciliado',
    match_tipo = p_match_tipo,
    match_id   = p_match_id,
    match_nota = p_match_nota
  WHERE id = p_movimiento_id;

  -- Si es match con factura, crear cobro automáticamente
  IF p_crear_cobro AND p_match_tipo = 'factura' AND p_match_id IS NOT NULL THEN
    INSERT INTO public.cobros (factura_id, empresa_id, fecha_cobro, monto, observacion)
    VALUES (
      p_match_id,
      v_mov.empresa_id,
      v_mov.fecha,
      v_mov.monto,
      COALESCE(p_match_nota, 'Conciliación bancaria')
    )
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- 5. RPC — marcar movimiento como ignorado
CREATE OR REPLACE FUNCTION public.ignorar_movimiento_bancario(
  p_movimiento_id UUID,
  p_nota          TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.movimientos_bancarios
  SET estado = 'ignorado', match_nota = p_nota
  WHERE id = p_movimiento_id;
END;
$$;

-- 6. RPC — deshacer conciliación (volver a sin_conciliar)
CREATE OR REPLACE FUNCTION public.desconciliar_movimiento(
  p_movimiento_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.movimientos_bancarios
  SET estado = 'sin_conciliar', match_tipo = NULL, match_id = NULL, match_nota = NULL
  WHERE id = p_movimiento_id;
END;
$$;
