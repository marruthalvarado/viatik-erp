-- =============================================================================
-- RLS: Tablas de catálogo global (sin empresa_id)
-- Problema: tablas habilitadas con RLS desde el Dashboard de Supabase pero
--   sin políticas → deny-by-default bloquea INSERT/UPDATE/DELETE.
--
-- Catálogos afectados (globales, sin empresa_id):
--   roles, monedas, categorias_gasto, estados_gasto, origenes_gasto,
--   categorias_documento, tipos_documento, estados_documento,
--   estados_rendicion, tipos_rendicion, acciones_aprobacion
--
-- Diseño de seguridad:
--   • SELECT: cualquier usuario autenticado (catálogos son de referencia).
--   • INSERT/UPDATE/DELETE: cualquier usuario autenticado.
--     Justificación: el ERP no tiene RBAC granular en la BD para catálogos
--     globales; el acceso a la sección Administración ya está controlado
--     por la UI. Restringir a service_role haría inoperables los formularios.
--
-- Tablas con empresa_id que también necesitan políticas:
--   politicas, parametros_sistema
--   (empresas y empresas_usuarios ya tienen políticas en 20240702000000)
-- =============================================================================

-- ─── HELPER: reutilizado por políticas con empresa_id ────────────────────────
-- (ya definida en 20240702000000, usamos la misma función)

-- =============================================================================
-- 1. roles — catálogo global
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='roles' AND policyname='roles_select'
  ) THEN
    CREATE POLICY "roles_select"
      ON roles FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='roles' AND policyname='roles_insert'
  ) THEN
    CREATE POLICY "roles_insert"
      ON roles FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='roles' AND policyname='roles_update'
  ) THEN
    CREATE POLICY "roles_update"
      ON roles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='roles' AND policyname='roles_delete'
  ) THEN
    CREATE POLICY "roles_delete"
      ON roles FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- Asegurar que RLS esté habilitado
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. monedas — catálogo global
-- =============================================================================
ALTER TABLE monedas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='monedas' AND policyname='monedas_select') THEN
    CREATE POLICY "monedas_select" ON monedas FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='monedas' AND policyname='monedas_insert') THEN
    CREATE POLICY "monedas_insert" ON monedas FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='monedas' AND policyname='monedas_update') THEN
    CREATE POLICY "monedas_update" ON monedas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='monedas' AND policyname='monedas_delete') THEN
    CREATE POLICY "monedas_delete" ON monedas FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- =============================================================================
-- 3. categorias_gasto — catálogo global
-- =============================================================================
ALTER TABLE categorias_gasto ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categorias_gasto' AND policyname='cg_select') THEN
  CREATE POLICY "cg_select" ON categorias_gasto FOR SELECT TO authenticated USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categorias_gasto' AND policyname='cg_insert') THEN
  CREATE POLICY "cg_insert" ON categorias_gasto FOR INSERT TO authenticated WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categorias_gasto' AND policyname='cg_update') THEN
  CREATE POLICY "cg_update" ON categorias_gasto FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categorias_gasto' AND policyname='cg_delete') THEN
  CREATE POLICY "cg_delete" ON categorias_gasto FOR DELETE TO authenticated USING (true); END IF; END $$;

-- =============================================================================
-- 4. estados_gasto — catálogo global
-- =============================================================================
ALTER TABLE estados_gasto ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='estados_gasto' AND policyname='eg_select') THEN
  CREATE POLICY "eg_select" ON estados_gasto FOR SELECT TO authenticated USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='estados_gasto' AND policyname='eg_insert') THEN
  CREATE POLICY "eg_insert" ON estados_gasto FOR INSERT TO authenticated WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='estados_gasto' AND policyname='eg_update') THEN
  CREATE POLICY "eg_update" ON estados_gasto FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='estados_gasto' AND policyname='eg_delete') THEN
  CREATE POLICY "eg_delete" ON estados_gasto FOR DELETE TO authenticated USING (true); END IF; END $$;

-- =============================================================================
-- 5. origenes_gasto — catálogo global
-- =============================================================================
ALTER TABLE origenes_gasto ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='origenes_gasto' AND policyname='og_select') THEN
  CREATE POLICY "og_select" ON origenes_gasto FOR SELECT TO authenticated USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='origenes_gasto' AND policyname='og_insert') THEN
  CREATE POLICY "og_insert" ON origenes_gasto FOR INSERT TO authenticated WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='origenes_gasto' AND policyname='og_update') THEN
  CREATE POLICY "og_update" ON origenes_gasto FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='origenes_gasto' AND policyname='og_delete') THEN
  CREATE POLICY "og_delete" ON origenes_gasto FOR DELETE TO authenticated USING (true); END IF; END $$;

-- =============================================================================
-- 6. categorias_documento — catálogo global
-- =============================================================================
ALTER TABLE categorias_documento ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categorias_documento' AND policyname='cd_select') THEN
  CREATE POLICY "cd_select" ON categorias_documento FOR SELECT TO authenticated USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categorias_documento' AND policyname='cd_insert') THEN
  CREATE POLICY "cd_insert" ON categorias_documento FOR INSERT TO authenticated WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categorias_documento' AND policyname='cd_update') THEN
  CREATE POLICY "cd_update" ON categorias_documento FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categorias_documento' AND policyname='cd_delete') THEN
  CREATE POLICY "cd_delete" ON categorias_documento FOR DELETE TO authenticated USING (true); END IF; END $$;

-- =============================================================================
-- 7. tipos_documento — catálogo global
-- =============================================================================
ALTER TABLE tipos_documento ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tipos_documento' AND policyname='td_select') THEN
  CREATE POLICY "td_select" ON tipos_documento FOR SELECT TO authenticated USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tipos_documento' AND policyname='td_insert') THEN
  CREATE POLICY "td_insert" ON tipos_documento FOR INSERT TO authenticated WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tipos_documento' AND policyname='td_update') THEN
  CREATE POLICY "td_update" ON tipos_documento FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tipos_documento' AND policyname='td_delete') THEN
  CREATE POLICY "td_delete" ON tipos_documento FOR DELETE TO authenticated USING (true); END IF; END $$;

-- =============================================================================
-- 8. estados_documento — catálogo global
-- =============================================================================
ALTER TABLE estados_documento ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='estados_documento' AND policyname='ed_select') THEN
  CREATE POLICY "ed_select" ON estados_documento FOR SELECT TO authenticated USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='estados_documento' AND policyname='ed_insert') THEN
  CREATE POLICY "ed_insert" ON estados_documento FOR INSERT TO authenticated WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='estados_documento' AND policyname='ed_update') THEN
  CREATE POLICY "ed_update" ON estados_documento FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='estados_documento' AND policyname='ed_delete') THEN
  CREATE POLICY "ed_delete" ON estados_documento FOR DELETE TO authenticated USING (true); END IF; END $$;

-- =============================================================================
-- 9. estados_rendicion — catálogo global
-- =============================================================================
ALTER TABLE estados_rendicion ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='estados_rendicion' AND policyname='er_select') THEN
  CREATE POLICY "er_select" ON estados_rendicion FOR SELECT TO authenticated USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='estados_rendicion' AND policyname='er_insert') THEN
  CREATE POLICY "er_insert" ON estados_rendicion FOR INSERT TO authenticated WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='estados_rendicion' AND policyname='er_update') THEN
  CREATE POLICY "er_update" ON estados_rendicion FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='estados_rendicion' AND policyname='er_delete') THEN
  CREATE POLICY "er_delete" ON estados_rendicion FOR DELETE TO authenticated USING (true); END IF; END $$;

-- =============================================================================
-- 10. tipos_rendicion — catálogo global
-- =============================================================================
ALTER TABLE tipos_rendicion ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tipos_rendicion' AND policyname='tr_select') THEN
  CREATE POLICY "tr_select" ON tipos_rendicion FOR SELECT TO authenticated USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tipos_rendicion' AND policyname='tr_insert') THEN
  CREATE POLICY "tr_insert" ON tipos_rendicion FOR INSERT TO authenticated WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tipos_rendicion' AND policyname='tr_update') THEN
  CREATE POLICY "tr_update" ON tipos_rendicion FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tipos_rendicion' AND policyname='tr_delete') THEN
  CREATE POLICY "tr_delete" ON tipos_rendicion FOR DELETE TO authenticated USING (true); END IF; END $$;

-- =============================================================================
-- 11. acciones_aprobacion — catálogo global (solo lectura en runtime)
-- =============================================================================
ALTER TABLE acciones_aprobacion ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='acciones_aprobacion' AND policyname='aa_select') THEN
  CREATE POLICY "aa_select" ON acciones_aprobacion FOR SELECT TO authenticated USING (true); END IF; END $$;

-- =============================================================================
-- 12. politicas — tiene empresa_id
-- Política: el usuario puede ver/gestionar políticas de su empresa activa.
-- =============================================================================
ALTER TABLE politicas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='politicas' AND policyname='pol_select') THEN
    CREATE POLICY "pol_select"
      ON politicas FOR SELECT TO authenticated
      USING (auth_es_miembro_activo(empresa_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='politicas' AND policyname='pol_insert') THEN
    CREATE POLICY "pol_insert"
      ON politicas FOR INSERT TO authenticated
      WITH CHECK (auth_es_miembro_activo(empresa_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='politicas' AND policyname='pol_update') THEN
    CREATE POLICY "pol_update"
      ON politicas FOR UPDATE TO authenticated
      USING  (auth_es_miembro_activo(empresa_id))
      WITH CHECK (auth_es_miembro_activo(empresa_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='politicas' AND policyname='pol_delete') THEN
    CREATE POLICY "pol_delete"
      ON politicas FOR DELETE TO authenticated
      USING (auth_es_miembro_activo(empresa_id));
  END IF;
END $$;

-- =============================================================================
-- 13. parametros_sistema — tiene empresa_id
-- =============================================================================
ALTER TABLE parametros_sistema ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='parametros_sistema' AND policyname='ps_select') THEN
    CREATE POLICY "ps_select"
      ON parametros_sistema FOR SELECT TO authenticated
      USING (auth_es_miembro_activo(empresa_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='parametros_sistema' AND policyname='ps_insert') THEN
    CREATE POLICY "ps_insert"
      ON parametros_sistema FOR INSERT TO authenticated
      WITH CHECK (auth_es_miembro_activo(empresa_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='parametros_sistema' AND policyname='ps_update') THEN
    CREATE POLICY "ps_update"
      ON parametros_sistema FOR UPDATE TO authenticated
      USING  (auth_es_miembro_activo(empresa_id))
      WITH CHECK (auth_es_miembro_activo(empresa_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='parametros_sistema' AND policyname='ps_delete') THEN
    CREATE POLICY "ps_delete"
      ON parametros_sistema FOR DELETE TO authenticated
      USING (auth_es_miembro_activo(empresa_id));
  END IF;
END $$;
