-- ─────────────────────────────────────────────────────────────────────────────
-- Migración: origen en movimientos_bancarios + soporte Banco Guayaquil API
-- ─────────────────────────────────────────────────────────────────────────────
SET statement_timeout = 0;

-- 1. Agregar columna origen (fuente del movimiento)
ALTER TABLE public.movimientos_bancarios
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'manual'
    CHECK (origen IN ('manual', 'banco_guayaquil', 'procredit', 'csv'));

-- Índice para filtrar por origen
CREATE INDEX IF NOT EXISTS idx_movimientos_bancarios_origen
  ON public.movimientos_bancarios (empresa_id, origen);

-- 2. Agregar bg_document_id para deduplicación nativa del API BG
--    (el campo "document" del response, único por cuenta + fecha)
ALTER TABLE public.movimientos_bancarios
  ADD COLUMN IF NOT EXISTS bg_document_id TEXT;

-- Constraint de dedup para movimientos BG: un document por cuenta
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'movimientos_bancarios_cuenta_bg_document'
  ) THEN
    ALTER TABLE public.movimientos_bancarios
      ADD CONSTRAINT movimientos_bancarios_cuenta_bg_document
      UNIQUE (cuenta_id, bg_document_id);
  END IF;
END $$;

-- 3. RPC para sync Banco Guayaquil (llamada desde Edge Function con service_role)
--    Inserta movimientos BG de forma idempotente usando bg_document_id
CREATE OR REPLACE FUNCTION public.importar_movimientos_banco_guayaquil(
  p_cuenta_id   UUID,
  p_empresa_id  UUID,
  p_movimientos JSONB  -- [{bg_document_id, fecha, descripcion, referencia, tipo, monto, saldo?, canal?, tipo_tx?}]
)
RETURNS TABLE (insertados INT, duplicados INT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_insertados INT := 0;
  v_duplicados INT := 0;
  m            JSONB;
BEGIN
  FOR m IN SELECT * FROM jsonb_array_elements(p_movimientos)
  LOOP
    INSERT INTO public.movimientos_bancarios
      (cuenta_id, empresa_id, fecha, descripcion, referencia, tipo, monto, saldo,
       origen, bg_document_id,
       -- hash_unico: requerido (UNIQUE NOT NULL) — usamos bg_document_id como hash
       hash_unico)
    VALUES (
      p_cuenta_id,
      p_empresa_id,
      (m->>'fecha')::DATE,
      m->>'descripcion',
      m->>'referencia',
      m->>'tipo',
      (m->>'monto')::NUMERIC,
      CASE WHEN m->>'saldo' IS NOT NULL THEN (m->>'saldo')::NUMERIC ELSE NULL END,
      'banco_guayaquil',
      m->>'bg_document_id',
      -- hash_unico = bg:<document_id> para no chocar con importaciones manuales
      'bg:' || (m->>'bg_document_id')
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

COMMENT ON FUNCTION public.importar_movimientos_banco_guayaquil IS
  'Importa movimientos desde el API de Banco Guayaquil de forma idempotente. '
  'Llamada desde la Edge Function banco-guayaquil-sync con service_role.';
