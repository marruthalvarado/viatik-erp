-- =============================================================================
-- Fix RLS rendiciones: el rol administrador de la empresa puede ver
-- TODAS las rendiciones de su empresa (para dashboard, reportes, etc.)
-- =============================================================================

DROP POLICY IF EXISTS "rend_select_own_or_aprobador" ON rendiciones;

CREATE POLICY "rend_select_own_or_aprobador" ON rendiciones
  FOR SELECT TO authenticated
  USING (
    -- Propietario ve sus propias rendiciones
    usuario_id = auth.uid()

    -- Sistema 2: aprobador asignado directamente
    OR aprobador_id = auth.uid()

    -- Sistema 1: usuario tiene rol que coincide con un paso del workflow
    OR (
      workflow_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM empresas_usuarios eu
        JOIN workflow_pasos wp
          ON wp.rol_id      = eu.rol_id
         AND wp.workflow_id = rendiciones.workflow_id
        WHERE eu.usuario_id = auth.uid()
          AND eu.empresa_id = rendiciones.empresa_id
          AND eu.activo     = true
      )
    )

    -- Administrador ve todas las rendiciones de su empresa
    OR EXISTS (
      SELECT 1
      FROM empresas_usuarios eu
      JOIN roles r ON r.id = eu.rol_id
      WHERE eu.usuario_id = auth.uid()
        AND eu.empresa_id = rendiciones.empresa_id
        AND eu.activo     = true
        AND lower(r.codigo) IN ('admin', 'administrador')
    )
  );
