-- =============================================================================
-- VIATIQ — Migraciones RLS + Vistas + wf_mis_pendientes
-- Ejecutar COMPLETO en Supabase SQL Editor (Dashboard → SQL Editor)
-- Orden: 20240702 → 20240703 → 20240704 → 20240705 → 20240706
-- =============================================================================


-- ============================================================
-- 20240702000000_rls_empresas.sql
-- ============================================================
-- =============================================================================
-- RLS: empresas + empresas_usuarios
-- Problema: ambas tablas tienen RLS habilitado pero cero políticas →
--   todo SELECT de rol 'authenticated' devuelve [] (deny-by-default).
--
-- Diseño:
--   • empresas_usuarios → un usuario solo ve sus propias filas
--   • empresas           → un usuario solo ve las empresas a las que pertenece
--   • Mutaciones en empresas: cualquier miembro activo puede actualizar
--     su empresa (empresa-section.tsx lo hace vía supabase.from("empresas").update)
--   • Mutaciones en empresas_usuarios: denegadas para 'authenticated';
--     solo service_role (Dashboard / RPCs SECURITY DEFINER)
--   • service_role siempre ignora RLS — no requiere políticas propias
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FUNCIÓN AUXILIAR: verifica membresía activa sin tocar RLS
-- Usada en la política SELECT de 'empresas' para evitar recursión potencial.
-- SECURITY DEFINER → lee empresas_usuarios sin aplicar sus propias políticas.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_es_miembro_activo(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   empresas_usuarios eu
    WHERE  eu.empresa_id = p_empresa_id
      AND  eu.usuario_id = auth.uid()
      AND  eu.activo     = true
  );
$$;

-- =============================================================================
-- TABLA: empresas_usuarios
-- =============================================================================

-- SELECT: solo las filas donde el propio usuario es el miembro
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='empresas_usuarios' AND policyname='eu_select_own') THEN
    CREATE POLICY "eu_select_own"
      ON empresas_usuarios FOR SELECT TO authenticated
      USING (usuario_id = auth.uid());
  END IF;
END $$;

-- INSERT / UPDATE / DELETE: denegado para 'authenticated'.
-- Las altas/bajas/cambios de membresía solo se hacen desde el Dashboard
-- (service_role) o futuras RPCs SECURITY DEFINER.
-- (Sin políticas FOR INSERT/UPDATE/DELETE → deny-by-default de PostgreSQL)

-- =============================================================================
-- TABLA: empresas
-- =============================================================================

-- SELECT: solo empresas donde el usuario tiene membresía activa.
-- Usa la función SECURITY DEFINER para evitar cruce con la política de
-- empresas_usuarios al evaluar el EXISTS.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='empresas' AND policyname='empresas_select_member') THEN
    CREATE POLICY "empresas_select_member"
      ON empresas FOR SELECT TO authenticated
      USING (auth_es_miembro_activo(id));
  END IF;
END $$;

-- UPDATE: cualquier miembro activo puede modificar los datos de su empresa.
-- Cubre el caso de empresa-section.tsx (actualizar nombre, logo, moneda, etc.).
-- La USING verifica que el usuario pertenece a la empresa antes de mostrársela;
-- el WITH CHECK confirma que no puede trasladarse a otra empresa.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='empresas' AN

-- ============================================================
-- 20240703000000_rls_catalogos.sql
-- ============================================================
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


-- ============================================================
-- 20240704000000_wf_mis_pendientes_fix.sql
-- ============================================================
-- =============================================================================
-- FIX: wf_mis_pendientes — "structure of query does not match function result type"
-- Causa: la función en la BD fue modificada manualmente (Dashboard) y su
--   RETURNS TABLE quedó inconsistente con el SELECT interno.
-- Solución: recrear la función exactamente como en la migración original
--   (20240626000000_workflow_rpcs.sql) para forzar la sincronización.
-- =============================================================================

CREATE OR REPLACE FUNCTION wf_mis_pendientes(
  p_usuario_id  uuid,
  p_empresa_id  uuid
)
RETURNS TABLE(
  rendicion_id        uuid,
  numero              text,
  descripcion         text,
  proyecto_id         uuid,
  total_facturado     numeric,
  total_reembolsable  numeric,
  fecha_rendicion     date,
  fecha_envio         timestamptz,
  estado_codigo       text,
  estado_nombre       text,
  paso_nombre         text,
  paso_orden          integer,
  usuario_nombre      text,
  workflow_paso_id    uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid;
  v_rol_id uuid;
BEGIN
  -- [SEC-1] Identidad real del caller
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Obtener rol del usuario autenticado en la empresa
  -- (p_usuario_id se mantiene por compatibilidad de firma pero se ignora)
  SELECT eu.rol_id
    INTO v_rol_id
    FROM empresas_usuarios eu
   WHERE eu.usuario_id = v_uid
     AND eu.empresa_id = p_empresa_id
     AND eu.activo     = true
   LIMIT 1;

  IF v_rol_id IS NULL THEN
    RETURN;  -- sin rol en esta empresa → bandeja vacía
  END IF;

  RETURN QUERY
  SELECT
    r.id                                                    AS rendicion_id,
    r.numero                                                AS numero,
    r.descripcion                                           AS descripcion,
    r.proyecto_id                                           AS proyecto_id,
    r.total_facturado                                       AS total_facturado,
    r.total_reembolsable                                    AS total_reembolsable,
    r.fecha_rendicion::date                                 AS fecha_rendicion,
    r.fecha_envio                                           AS fecha_envio,
    er.codigo                                               AS estado_codigo,
    er.nombre                                               AS estado_nombre,
    wp.nombre::text                                         AS paso_nombre,
    wp.orden                                                AS paso_orden,
    TRIM(u.nombres || ' ' || COALESCE(u.apellidos, ''))    AS usuario_nombre,
    wp.id                                                   AS workflow_paso_id
  FROM rendiciones r
  JOIN estados_rendicion er    ON er.id = r.estado_rendicion_id
  JOIN usuarios u              ON u.id  = r.usuario_id
  JOIN workflow_pasos wp       ON wp.workflow_id = r.workflow_id
  JOIN workflows_aprobacion wa ON wa.id = r.workflow_id AND wa.activo = true
  WHERE r.empresa_id = p_empresa_id
    AND er.codigo IN ('enviada', 'en_revision')
    AND wp.rol_id   = v_rol_id
    -- Este paso aún no fue aprobado
    AND NOT EXISTS (
      SELECT 1
        FROM aprobaciones a
        JOIN acciones_aprobacion aa ON aa.id = a.accion_id
       WHERE a.rendicion_id     = r.id
         AND a.workflow_paso_id = wp.id
         AND aa.codigo          = 'aprobar'
    )
    -- Todos los pasos anteriores están aprobados
    AND NOT EXISTS (
      SELECT 1
        FROM workflow_pasos wp_prev
       WHERE wp_prev.workflow_id = r.workflow_id
         AND wp_prev.orden < wp.orden
         AND NOT EXISTS (
           SELECT 1
             FROM aprobaciones a2
             JOIN acciones_aprobacion aa2 ON aa2.id = a2.accion_id
            WHERE a2.rendicion_id     = r.id
              AND a2.workflow_paso_id = wp_prev.id
              AND aa2.codigo          = 'aprobar'
         )
    )
  ORDER BY r.fecha_envio ASC NULLS LAST;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'wf_mis_pendientes error: %', SQLERRM;
END;
$$;


-- ============================================================
-- 20240705000000_vistas_dashboard.sql
-- ============================================================
-- =============================================================================
-- VISTAS: vw_dashboard_*
-- Problema: las 5 vistas del Dashboard Ejecutivo están referenciadas en
--   database.ts y en src/services/dashboard.ts pero NUNCA fueron creadas
--   en ninguna migración → todos los KPIs devuelven null/vacío.
--
-- Diseño:
--   · Cada vista agrega datos por empresa.
--   · Se usan LEFT JOIN para no perder empresas sin movimiento.
--   · RLS en las tablas base (gastos, rendiciones, etc.) protege el acceso.
--   · Las vistas heredan RLS de las tablas base (SECURITY INVOKER por defecto).
--   · El filtro empresa_id en el SELECT del cliente garantiza el scoping.
-- =============================================================================

-- =============================================================================
-- vw_dashboard_ejecutivo
-- KPIs globales de la empresa: totales de gastos, rendiciones, anticipos,
-- proyectos activos y viajeros con movimiento.
-- Columnas según database.ts:
--   empresa_id, total_anticipos, total_gastado, total_proyectos_con_movimiento,
--   total_reembolsable, total_rendiciones, total_usuarios_con_movimiento
-- =============================================================================
CREATE OR REPLACE VIEW vw_dashboard_ejecutivo AS
SELECT
  r.empresa_id,
  COALESCE(SUM(r.total_facturado)    FILTER (WHERE r.deleted_at IS NULL), 0)   AS total_gastado,
  COALESCE(SUM(r.total_reembolsable) FILTER (WHERE r.deleted_at IS NULL), 0)   AS total_reembolsable,
  COUNT(r.id)                        FILTER (WHERE r.deleted_at IS NULL)        AS total_rendiciones,
  COUNT(DISTINCT r.proyecto_id)      FILTER (WHERE r.deleted_at IS NULL
                                              AND r.proyecto_id IS NOT NULL)    AS total_proyectos_con_movimiento,
  COUNT(DISTINCT r.usuario_id)       FILTER (WHERE r.deleted_at IS NULL)        AS total_usuarios_con_movimiento,
  COALESCE((
    SELECT SUM(a.valor)
    FROM   anticipos a
    WHERE  a.empresa_id = r.empresa_id
  ), 0)                                                                          AS total_anticipos
FROM rendiciones r
GROUP BY r.empresa_id;

-- =============================================================================
-- vw_dashboard_proyectos
-- Resumen financiero por proyecto: presupuesto vs. gasto real.
-- Columnas: empresa_id, proyecto_id, nombre, presupuesto, gasto_real,
--           saldo_presupuesto, margen_estimado, valor_contrato
-- =============================================================================
CREATE OR REPLACE VIEW vw_dashboard_proyectos AS
SELECT
  p.empresa_id,
  p.id                                                            AS proyecto_id,
  p.nombre,
  COALESCE(p.presupuesto, 0)                                      AS presupuesto,
  COALESCE(p.valor_contrato, 0)                                   AS valor_contrato,
  COALESCE(SUM(g.valor_factura) FILTER (WHERE g.deleted_at IS NULL), 0)
                                                                  AS gasto_real,
  COALESCE(p.presupuesto, 0)
    - COALESCE(SUM(g.valor_factura) FILTER (WHERE g.deleted_at IS NULL), 0)
                                                                  AS saldo_presupuesto,
  CASE
    WHEN COALESCE(p.valor_contrato, 0) > 0
    THEN ROUND(
      (COALESCE(p.valor_contrato, 0)
       - COALESCE(SUM(g.valor_factura) FILTER (WHERE g.deleted_at IS NULL), 0)
      ) / p.valor_contrato * 100, 2)
    ELSE NULL
  END                                                             AS margen_estimado
FROM proyectos p
LEFT JOIN gastos g ON g.empresa_id = p.empresa_id
                   AND g.rendicion_id IN (
                     SELECT id FROM rendiciones r
                     WHERE r.proyecto_id = p.id
                       AND r.deleted_at  IS NULL
                   )
WHERE p.deleted_at IS NULL
GROUP BY p.empresa_id, p.id, p.nombre, p.presupuesto, p.valor_contrato;

-- =============================================================================
-- vw_dashboard_clientes
-- Totales de gasto, rendiciones y proyectos por cliente.
-- Columnas: empresa_id, cliente_id, cliente, total_gastado,
--           total_rendiciones, total_proyectos
-- =============================================================================
CREATE OR REPLACE VIEW vw_dashboard_clientes AS
SELECT
  p.empresa_id,
  c.id                                                         AS cliente_id,
  c.nombre                                                     AS cliente,
  COALESCE(SUM(g.valor_factura) FILTER (WHERE g.deleted_at IS NULL), 0)
                                                               AS total_gastado,
  COUNT(DISTINCT r.id)   FILTER (WHERE r.deleted_at IS NULL)  AS total_rendiciones,
  COUNT(DISTINCT p.id)                                         AS total_proyectos
FROM clientes c
JOIN proyectos p   ON p.cliente_id = c.id AND p.deleted_at IS NULL
LEFT JOIN rendiciones r ON r.proyecto_id = p.id
LEFT JOIN gastos g      ON g.rendicion_id = r.id
WHERE c.deleted_at IS NULL
GROUP BY p.empresa_id, c.id, c.nombre;

-- =============================================================================
-- vw_dashboard_proveedores
-- Totales de gasto y cantidad de gastos por proveedor.
-- Columnas: empresa_id, id, nombre, total_gastado, cantidad_gastos
-- =============================================================================
CREATE OR REPLACE VIEW vw_dashboard_proveedores AS
SELECT
  pv.empresa_id,
  pv.id,
  pv.nombre,
  COALESCE(SUM(g.valor_factura) FILTER (WHERE g.deleted_at IS NULL), 0) AS total_gastado,
  COUNT(g.id)             FILTER (WHERE g.deleted_at IS NULL)            AS cantidad_gastos
FROM proveedores pv
LEFT JOIN gastos g ON g.proveedor_id = pv.id
                   AND g.empresa_id  = pv.empresa_id
WHERE pv.deleted_at IS NULL
GROUP BY pv.empresa_id, pv.id, pv.nombre;

-- =============================================================================
-- vw_dashboard_ia
-- Score promedio y total de auditorías IA por empresa.
-- Columnas: empresa_id, score_promedio, total_auditorias
-- =============================================================================
CREATE OR REPLACE VIEW vw_dashboard_ia AS
SELECT
  ai.empresa_id,
  ROUND(AVG(ai.score)::numeric, 1) AS score_promedio,
  COUNT(ai.id)                      AS total_auditorias
FROM auditorias_ia ai
GROUP BY ai.empresa_id;


-- ============================================================
-- 20240706000000_rls_negocio.sql
-- ============================================================
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
      id = auth.uid()
      OR
      -- Compañeros de empresa
      EXISTS (
        SELECT 1 FROM empresas_usuarios eu1
        JOIN   empresas_usuarios eu2 ON eu2.empresa_id = eu1.empresa_id
        WHERE  eu1.usuario_id = auth.uid()
          AND  eu1.activo     = true
          AND  eu2.usuario_id = id
          AND  eu2.activo     = true
      )
    ); END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='usuarios' AND policyname='usr_update_own') THEN
  CREATE POLICY "usr_update_own" ON usuarios FOR UPDATE TO authenticated
    USING  (id = auth.uid())
    WITH CHECK (id = auth.uid()); END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='usuarios' AND policyname='usr_insert') THEN
  -- INSERT lo maneja Supabase Auth (trigger) — bloqueado para authenticated directo
  -- pero service_role puede insertar
  CREATE POLICY "usr_insert" ON usuarios FOR INSERT TO authenticated WITH CHECK (id = auth.uid()); END IF; END $$;

