-- =============================================================================
-- Fix RLS rendiciones: permitir que aprobadores del workflow (Sistema 1)
-- puedan ver rendiciones que deben aprobar.
--
-- El policy anterior solo cubría:
--   - usuario_id = auth.uid()    (propietario)
--   - aprobador_id = auth.uid()  (Sistema 2 — aprobador directo)
--
-- Sistema 1 (cascade workflow) asigna workflow_id pero NO aprobador_id,
-- por lo que los aprobadores no podían ver las rendiciones en el detalle.
-- =============================================================================

-- Reemplazar la política con una versión que incluye workflow-based access
DROP POLICY IF EXISTS "rend_select_own_or_aprobador" ON rendiciones;

CREATE POLICY "rend_select_own_or_aprobador" ON rendiciones
  FOR SELECT TO authenticated
  USING (
    -- Propietario ve sus rendiciones
    usuario_id = auth.uid()
    -- Sistema 2: aprobador asignado directamente en la rendición
    OR aprobador_id = auth.uid()
    -- Sistema 1: usuario tiene rol en la empresa cuyo rol_id
    --            coincide con algún paso del workflow asignado a la rendición
    OR (
      workflow_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM empresas_usuarios eu
        JOIN workflow_pasos wp
          ON wp.rol_id       = eu.rol_id
         AND wp.workflow_id  = rendiciones.workflow_id
        WHERE eu.usuario_id  = auth.uid()
          AND eu.empresa_id  = rendiciones.empresa_id
          AND eu.activo      = true
      )
    )
  );
