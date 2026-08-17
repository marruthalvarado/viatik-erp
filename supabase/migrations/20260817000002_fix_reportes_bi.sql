-- =============================================================================
-- Fix: Reportes BI — dos errores en producción
--
-- 1. rendiciones puede no tener fecha_envio / fecha_aprobacion si fue creada
--    antes de los migrations de workflow (columnas del schema inicial).
--    Añadir con IF NOT EXISTS es idempotente.
--
-- 2. rpt_tiempos_workflow usaba EXTRACT(EPOCH…)/3600.0 que en PG14+ devuelve
--    double precision; ROUND(dp, int) no existe en Postgres → error de tipo.
--    Fix: castear a ::numeric antes de ROUND.
--
-- Aplicar en: Supabase Dashboard → SQL Editor → Run
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Columnas en rendiciones (idempotente)
-- ---------------------------------------------------------------------------
ALTER TABLE public.rendiciones
  ADD COLUMN IF NOT EXISTS fecha_envio       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_aprobacion  TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2. Recrear rpt_tiempos_workflow con cast explícito a numeric
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpt_tiempos_workflow(
  p_empresa_id  uuid,
  p_fecha_desde date,
  p_fecha_hasta date
)
RETURNS TABLE (
  rendicion_id           uuid,
  rendicion_numero       text,
  usuario_nombre         text,
  fecha_envio            timestamp with time zone,
  fecha_primera_accion   timestamp with time zone,
  fecha_aprobacion_final timestamp with time zone,
  horas_espera_total     numeric,
  n_acciones             bigint,
  n_rechazos             bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id::uuid                                                              AS rendicion_id,
    r.numero::text                                                          AS rendicion_numero,
    (COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, ''))::text    AS usuario_nombre,
    r.fecha_envio,
    MIN(a.fecha_accion)                                                     AS fecha_primera_accion,
    r.fecha_aprobacion                                                      AS fecha_aprobacion_final,
    ROUND(
      EXTRACT(EPOCH FROM (r.fecha_aprobacion - r.fecha_envio))::numeric / 3600.0,
      2
    )                                                                       AS horas_espera_total,
    COUNT(a.id)::bigint                                                     AS n_acciones,
    (COUNT(a.id) FILTER (WHERE ac.codigo = 'rechazar'))::bigint             AS n_rechazos
  FROM rendiciones r
  LEFT JOIN usuarios            u  ON u.id  = r.usuario_id
  LEFT JOIN aprobaciones        a  ON a.rendicion_id = r.id
  LEFT JOIN acciones_aprobacion ac ON ac.id = a.accion_id
  WHERE r.empresa_id = p_empresa_id
    AND r.fecha_envio IS NOT NULL
    AND r.fecha_envio::date BETWEEN p_fecha_desde AND p_fecha_hasta
    AND r.deleted_at IS NULL
  GROUP BY r.id, r.numero, u.nombres, u.apellidos, r.fecha_envio, r.fecha_aprobacion
  ORDER BY r.fecha_envio DESC;
END;
$$;
