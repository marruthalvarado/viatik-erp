-- =============================================================================
-- Fix RLS rendiciones: cada usuario solo ve SUS rendiciones o las que
-- debe aprobar. Se reemplaza la politica "ren_select" que permitia ver
-- todas las rendiciones de la empresa.
-- =============================================================================

-- 1. Eliminar politica permisiva anterior
DROP POLICY IF EXISTS "ren_select" ON rendiciones;

-- 2. Eliminar la politica parcial de aprobador (la reemplazamos con una sola)
DROP POLICY IF EXISTS "rend_select_aprobador" ON rendiciones;

-- 3. Nueva politica unificada
--    - El propietario ve sus rendiciones
--    - El aprobador asignado ve las que tiene asignadas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rendiciones' AND policyname = 'rend_select_own_or_aprobador'
  ) THEN
    CREATE POLICY "rend_select_own_or_aprobador" ON rendiciones
      FOR SELECT TO authenticated
      USING (
        usuario_id   = auth.uid()
        OR aprobador_id = auth.uid()
      );
  END IF;
END $$;

-- 4. Las politicas de INSERT/UPDATE/DELETE no cambian:
--    INSERT: usuario crea sus propias rendiciones
--    UPDATE del aprobador ya cubierta por rend_update_aprobador (migracion anterior)
