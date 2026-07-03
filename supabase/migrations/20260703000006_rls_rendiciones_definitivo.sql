-- =============================================================================
-- RLS rendiciones DEFINITIVO
--
-- Elimina TODAS las politicas SELECT existentes en rendiciones (por nombre
-- o por codigo de comando) para asegurarse de partir de estado limpio.
-- Luego crea una sola politica: el propietario o el aprobador asignado.
-- =============================================================================

-- 1. Barrer todas las politicas SELECT (idempotente, seguro ejecutar N veces)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'rendiciones'
      AND cmd        = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON rendiciones', pol.policyname);
  END LOOP;
END $$;

-- 2. Politica unica: propietario o aprobador asignado
CREATE POLICY "rend_select_own_or_aprobador" ON rendiciones
  FOR SELECT TO authenticated
  USING (
    usuario_id   = auth.uid()
    OR aprobador_id = auth.uid()
  );
