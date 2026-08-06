-- =============================================================================
-- FIX: gas_select RLS — gastos no visibles en tab de rendición
-- =============================================================================
-- Diagnóstico: fn_actualizar_totales_rendicion (SECURITY DEFINER) sí ve los
-- gastos y actualiza total_facturado correctamente, pero el SELECT desde el
-- frontend devuelve 0 filas.
--
-- Causa probable: la policy gas_select fue creada (IF NOT EXISTS) con una
-- definición anterior incorrecta y nunca se reemplazó.
--
-- Fix: DROP + recrear con doble condición:
--   1. auth_es_miembro_activo(empresa_id)     — ruta normal (empresa member)
--   2. Fallback via rendición: si el gasto pertenece a una rendición cuyo
--      usuario_id = auth.uid(), el dueño puede ver sus propios gastos aunque
--      auth_es_miembro_activo falle por alguna inconsistencia de datos.
-- =============================================================================

-- ─── Función auxiliar SECURITY DEFINER ───────────────────────────────────────
-- Evita recursión de RLS: accede a rendiciones sin pasar por sus propias
-- políticas (usa privilegios del definidor).

CREATE OR REPLACE FUNCTION auth_puede_leer_gasto(
  p_empresa_id   uuid,
  p_rendicion_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    -- Ruta 1: usuario es miembro activo de la empresa
    auth_es_miembro_activo(p_empresa_id)
    OR
    -- Ruta 2 (fallback): gasto vinculado a una rendición propia del usuario
    (
      p_rendicion_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM   rendiciones r
        WHERE  r.id          = p_rendicion_id
          AND  (
            r.usuario_id    = auth.uid()
            OR r.aprobador_id = auth.uid()
          )
      )
    );
$$;

-- ─── Política SELECT ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "gas_select" ON gastos;

CREATE POLICY "gas_select" ON gastos
  FOR SELECT TO authenticated
  USING (auth_puede_leer_gasto(empresa_id, rendicion_id));

-- ─── Resto de políticas (recrear idempotentemente) ───────────────────────────

DROP POLICY IF EXISTS "gas_insert" ON gastos;
CREATE POLICY "gas_insert" ON gastos
  FOR INSERT TO authenticated
  WITH CHECK (auth_es_miembro_activo(empresa_id));

DROP POLICY IF EXISTS "gas_update" ON gastos;
CREATE POLICY "gas_update" ON gastos
  FOR UPDATE TO authenticated
  USING  (auth_puede_leer_gasto(empresa_id, rendicion_id))
  WITH CHECK (auth_es_miembro_activo(empresa_id));

DROP POLICY IF EXISTS "gas_delete" ON gastos;
CREATE POLICY "gas_delete" ON gastos
  FOR DELETE TO authenticated
  USING (auth_puede_leer_gasto(empresa_id, rendicion_id));
