-- =============================================================================
-- RLS: Tablas de negocio (con empresa_id)
-- Garantiza que cada usuario solo acceda a datos de su empresa.
-- Usa auth_es_miembro_activo() definida en 20240702000000_rls_empresas.sql.
--
-- Tablas cubiertas:
--   clientes, proveedores, proyectos, presupuestos, presupuesto_detalle,
--   rendiciones, gastos, documentos, anticipos,
--   aprobaciones, historial_workflow, comentarios, adjuntos,
--   auditorias_ia, auditoria, workflows_aprobacion, workflow_pasos
--
-- Diseño:
--   · SELECT/INSERT/UPDATE/DELETE → miembro activo de la empresa.
--   · workflow_pasos y workflows_aprobacion → miembro activo de la empresa.
--   · presupuesto_detalle → acceso vía presupuesto padre.
--   · Funciones SECURITY DEFINER existentes no se ven afectadas.
-- =============================================================================

-- Helper de miembro activo ya existe (20240702000000). Se usan macros DO para
-- idempotencia — si la política ya existe, no falla.

-- =============================================================================
-- clientes
-- =============================================================================
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clientes' AND policyname='cli_select') THEN
  CREATE POLICY "cli_select" ON clientes FOR SELECT TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clientes' AND policyname='cli_insert') THEN
  CREATE POLICY "cli_insert" ON clientes FOR INSERT TO authenticated WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clientes' AND policyname='cli_update') THEN
  CREATE POLICY "cli_update" ON clientes FOR UPDATE TO authenticated USING (auth_es_miembro_activo(empresa_id)) WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clientes' AND policyname='cli_delete') THEN
  CREATE POLICY "cli_delete" ON clientes FOR DELETE TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;

-- =============================================================================
-- proveedores
-- =============================================================================
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='proveedores' AND policyname='prov_select') THEN
  CREATE POLICY "prov_select" ON proveedores FOR SELECT TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='proveedores' AND policyname='prov_insert') THEN
  CREATE POLICY "prov_insert" ON proveedores FOR INSERT TO authenticated WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='proveedores' AND policyname='prov_update') THEN
  CREATE POLICY "prov_update" ON proveedores FOR UPDATE TO authenticated USING (auth_es_miembro_activo(empresa_id)) WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='proveedores' AND policyname='prov_delete') THEN
  CREATE POLICY "prov_delete" ON proveedores FOR DELETE TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;

-- =============================================================================
-- proyectos
-- =============================================================================
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='proyectos' AND policyname='proy_select') THEN
  CREATE POLICY "proy_select" ON proyectos FOR SELECT TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='proyectos' AND policyname='proy_insert') THEN
  CREATE POLICY "proy_insert" ON proyectos FOR INSERT TO authenticated WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='proyectos' AND policyname='proy_update') THEN
  CREATE POLICY "proy_update" ON proyectos FOR UPDATE TO authenticated USING (auth_es_miembro_activo(empresa_id)) WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='proyectos' AND policyname='proy_delete') THEN
  CREATE POLICY "proy_delete" ON proyectos FOR DELETE TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;

-- =============================================================================
-- presupuestos
-- =============================================================================
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='presupuestos' AND policyname='pres_select') THEN
  CREATE POLICY "pres_select" ON presupuestos FOR SELECT TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='presupuestos' AND policyname='pres_insert') THEN
  CREATE POLICY "pres_insert" ON presupuestos FOR INSERT TO authenticated WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='presupuestos' AND policyname='pres_update') THEN
  CREATE POLICY "pres_update" ON presupuestos FOR UPDATE TO authenticated USING (auth_es_miembro_activo(empresa_id)) WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='presupuestos' AND policyname='pres_delete') THEN
  CREATE POLICY "pres_delete" ON presupuestos FOR DELETE TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;

-- =============================================================================
-- presupuesto_detalle — sin empresa_id; acceso vía presupuesto padre
-- =============================================================================
ALTER TABLE presupuesto_detalle ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='presupuesto_detalle' AND policyname='pd_select') THEN
  CREATE POLICY "pd_select" ON presupuesto_detalle FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM presupuestos p
      WHERE p.id = presupuesto_id AND auth_es_miembro_activo(p.empresa_id)
    )); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='presupuesto_detalle' AND policyname='pd_insert') THEN
  CREATE POLICY "pd_insert" ON presupuesto_detalle FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT 1 FROM presupuestos p
      WHERE p.id = presupuesto_id AND auth_es_miembro_activo(p.empresa_id)
    )); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='presupuesto_detalle' AND policyname='pd_update') THEN
  CREATE POLICY "pd_update" ON presupuesto_detalle FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM presupuestos p WHERE p.id = presupuesto_id AND auth_es_miembro_activo(p.empresa_id)))
    WITH CHECK (EXISTS (SELECT 1 FROM presupuestos p WHERE p.id = presupuesto_id AND auth_es_miembro_activo(p.empresa_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='presupuesto_detalle' AND policyname='pd_delete') THEN
  CREATE POLICY "pd_delete" ON presupuesto_detalle FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM presupuestos p WHERE p.id = presupuesto_id AND auth_es_miembro_activo(p.empresa_id))); END IF; END $$;

-- =============================================================================
-- rendiciones
-- =============================================================================
ALTER TABLE rendiciones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rendiciones' AND policyname='ren_select') THEN
  CREATE POLICY "ren_select" ON rendiciones FOR SELECT TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rendiciones' AND policyname='ren_insert') THEN
  CREATE POLICY "ren_insert" ON rendiciones FOR INSERT TO authenticated WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rendiciones' AND policyname='ren_update') THEN
  CREATE POLICY "ren_update" ON rendiciones FOR UPDATE TO authenticated USING (auth_es_miembro_activo(empresa_id)) WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rendiciones' AND policyname='ren_delete') THEN
  CREATE POLICY "ren_delete" ON rendiciones FOR DELETE TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;

-- =============================================================================
-- gastos
-- =============================================================================
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gastos' AND policyname='gas_select') THEN
  CREATE POLICY "gas_select" ON gastos FOR SELECT TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gastos' AND policyname='gas_insert') THEN
  CREATE POLICY "gas_insert" ON gastos FOR INSERT TO authenticated WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gastos' AND policyname='gas_update') THEN
  CREATE POLICY "gas_update" ON gastos FOR UPDATE TO authenticated USING (auth_es_miembro_activo(empresa_id)) WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gastos' AND policyname='gas_delete') THEN
  CREATE POLICY "gas_delete" ON gastos FOR DELETE TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;

-- =============================================================================
-- documentos
-- =============================================================================
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='documentos' AND policyname='doc_select') THEN
  CREATE POLICY "doc_select" ON documentos FOR SELECT TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='documentos' AND policyname='doc_insert') THEN
  CREATE POLICY "doc_insert" ON documentos FOR INSERT TO authenticated WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='documentos' AND policyname='doc_update') THEN
  CREATE POLICY "doc_update" ON documentos FOR UPDATE TO authenticated USING (auth_es_miembro_activo(empresa_id)) WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='documentos' AND policyname='doc_delete') THEN
  CREATE POLICY "doc_delete" ON documentos FOR DELETE TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;

-- =============================================================================
-- anticipos
-- =============================================================================
ALTER TABLE anticipos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='anticipos' AND policyname='ant_select') THEN
  CREATE POLICY "ant_select" ON anticipos FOR SELECT TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='anticipos' AND policyname='ant_insert') THEN
  CREATE POLICY "ant_insert" ON anticipos FOR INSERT TO authenticated WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='anticipos' AND policyname='ant_update') THEN
  CREATE POLICY "ant_update" ON anticipos FOR UPDATE TO authenticated USING (auth_es_miembro_activo(empresa_id)) WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='anticipos' AND policyname='ant_delete') THEN
  CREATE POLICY "ant_delete" ON anticipos FOR DELETE TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;

-- =============================================================================
-- aprobaciones
-- =============================================================================
ALTER TABLE aprobaciones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='aprobaciones' AND policyname='apr_select') THEN
  CREATE POLICY "apr_select" ON aprobaciones FOR SELECT TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;
-- INSERT solo desde wf_registrar_accion (SECURITY DEFINER) — no policy para authenticated
-- UPDATE/DELETE bloqueados (registros inmutables por diseño)

-- =============================================================================
-- historial_workflow — acceso via rendicion padre
-- =============================================================================
ALTER TABLE historial_workflow ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='historial_workflow' AND policyname='hw_select') THEN
  CREATE POLICY "hw_select" ON historial_workflow FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM rendiciones r
      WHERE r.id = rendicion_id AND auth_es_miembro_activo(r.empresa_id)
    )); END IF; END $$;

-- =============================================================================
-- comentarios — acceso via rendicion padre
-- =============================================================================
ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comentarios' AND policyname='com_select') THEN
  CREATE POLICY "com_select" ON comentarios FOR SELECT TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comentarios' AND policyname='com_insert') THEN
  CREATE POLICY "com_insert" ON comentarios FOR INSERT TO authenticated WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comentarios' AND policyname='com_update') THEN
  CREATE POLICY "com_update" ON comentarios FOR UPDATE TO authenticated USING (auth_es_miembro_activo(empresa_id)) WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comentarios' AND policyname='com_delete') THEN
  CREATE POLICY "com_delete" ON comentarios FOR DELETE TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;

-- =============================================================================
-- adjuntos — acceso via empresa_id
-- =============================================================================
ALTER TABLE adjuntos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='adjuntos' AND policyname='adj_select') THEN
  CREATE POLICY "adj_select" ON adjuntos FOR SELECT TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='adjuntos' AND policyname='adj_insert') THEN
  CREATE POLICY "adj_insert" ON adjuntos FOR INSERT TO authenticated WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='adjuntos' AND policyname='adj_delete') THEN
  CREATE POLICY "adj_delete" ON adjuntos FOR DELETE TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;

-- =============================================================================
-- auditorias_ia
-- =============================================================================
ALTER TABLE auditorias_ia ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='auditorias_ia' AND policyname='aia_select') THEN
  CREATE POLICY "aia_select" ON auditorias_ia FOR SELECT TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='auditorias_ia' AND policyname='aia_insert') THEN
  CREATE POLICY "aia_insert" ON auditorias_ia FOR INSERT TO authenticated WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;

-- =============================================================================
-- auditoria (log general)
-- =============================================================================
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='auditoria' AND policyname='aud_select') THEN
  CREATE POLICY "aud_select" ON auditoria FOR SELECT TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;

-- =============================================================================
-- workflows_aprobacion
-- =============================================================================
ALTER TABLE workflows_aprobacion ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workflows_aprobacion' AND policyname='wa_select') THEN
  CREATE POLICY "wa_select" ON workflows_aprobacion FOR SELECT TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workflows_aprobacion' AND policyname='wa_insert') THEN
  CREATE POLICY "wa_insert" ON workflows_aprobacion FOR INSERT TO authenticated WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workflows_aprobacion' AND policyname='wa_update') THEN
  CREATE POLICY "wa_update" ON workflows_aprobacion FOR UPDATE TO authenticated USING (auth_es_miembro_activo(empresa_id)) WITH CHECK (auth_es_miembro_activo(empresa_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workflows_aprobacion' AND policyname='wa_delete') THEN
  CREATE POLICY "wa_delete" ON workflows_aprobacion FOR DELETE TO authenticated USING (auth_es_miembro_activo(empresa_id)); END IF; END $$;

-- =============================================================================
-- workflow_pasos — sin empresa_id; acceso vía workflow padre
-- =============================================================================
ALTER TABLE workflow_pasos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workflow_pasos' AND policyname='wp_select') THEN
  CREATE POLICY "wp_select" ON workflow_pasos FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM workflows_aprobacion wa
      WHERE wa.id = workflow_id AND auth_es_miembro_activo(wa.empresa_id)
    )); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workflow_pasos' AND policyname='wp_insert') THEN
  CREATE POLICY "wp_insert" ON workflow_pasos FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT 1 FROM workflows_aprobacion wa
      WHERE wa.id = workflow_id AND auth_es_miembro_activo(wa.empresa_id)
    )); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workflow_pasos' AND policyname='wp_update') THEN
  CREATE POLICY "wp_update" ON workflow_pasos FOR UPDATE TO authenticated
    USING  (EXISTS (SELECT 1 FROM workflows_aprobacion wa WHERE wa.id = workflow_id AND auth_es_miembro_activo(wa.empresa_id)))
    WITH CHECK (EXISTS (SELECT 1 FROM workflows_aprobacion wa WHERE wa.id = workflow_id AND auth_es_miembro_activo(wa.empresa_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workflow_pasos' AND policyname='wp_delete') THEN
  CREATE POLICY "wp_delete" ON workflow_pasos FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM workflows_aprobacion wa WHERE wa.id = workflow_id AND auth_es_miembro_activo(wa.empresa_id))); END IF; END $$;

-- =============================================================================
-- usuarios — sin empresa_id en la tabla; acceso si comparte empresa
-- Política: cualquier miembro autenticado puede leer perfiles de usuarios
-- de su empresa. No permite modificar perfiles ajenos.
-- =============================================================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='usuarios' AND policyname='usr_select') THEN
  CREATE POLICY "usr_select" ON usuarios FOR SELECT TO authenticated
    USING (
      -- Propio perfil siempre visible
      usuarios.id = auth.uid()
      OR
      -- Compañeros de empresa
      EXISTS (
        SELECT 1 FROM empresas_usuarios eu1
        JOIN   empresas_usuarios eu2 ON eu2.empresa_id = eu1.empresa_id
        WHERE  eu1.usuario_id = auth.uid()
          AND  eu1.activo     = true
          AND  eu2.usuario_id = usuarios.id
          AND  eu2.activo     = true
      )
    ); END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='usuarios' AND policyname='usr_update_own') THEN
  CREATE POLICY "usr_update_own" ON usuarios FOR UPDATE TO authenticated
    USING  (usuarios.id = auth.uid())
    WITH CHECK (usuarios.id = auth.uid()); END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='usuarios' AND policyname='usr_insert') THEN
  -- INSERT lo maneja Supabase Auth (trigger) — bloqueado para authenticated directo
  -- pero service_role puede insertar
  CREATE POLICY "usr_insert" ON usuarios FOR INSERT TO authenticated WITH CHECK