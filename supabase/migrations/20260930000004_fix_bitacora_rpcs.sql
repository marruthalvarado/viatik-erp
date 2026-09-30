-- Fix: u.nombre no existe en public.usuarios — corregir a TRIM(CONCAT(u.nombres, ' ', COALESCE(u.apellidos, '')))

-- ── get_bitacora_proyecto ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_bitacora_proyecto(
  p_proyecto_id UUID,
  p_limit       INT DEFAULT 50,
  p_offset      INT DEFAULT 0
)
RETURNS TABLE (
  id                UUID,
  fecha             DATE,
  usuario_id        UUID,
  usuario_nombre    TEXT,
  ayer              TEXT,
  hoy               TEXT,
  bloqueos          TEXT,
  nivel_bloqueo     TEXT,
  novedades         TEXT,
  porcentaje_avance INTEGER,
  created_at        TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.id,
    pa.fecha,
    pa.usuario_id,
    TRIM(CONCAT(u.nombres, ' ', COALESCE(u.apellidos, '')))  AS usuario_nombre,
    pa.ayer,
    pa.hoy,
    pa.bloqueos,
    pa.nivel_bloqueo,
    pa.novedades,
    pa.porcentaje_avance,
    pa.created_at
  FROM proyecto_actualizaciones pa
  LEFT JOIN usuarios u ON u.id = pa.usuario_id
  WHERE pa.proyecto_id = p_proyecto_id
  ORDER BY pa.fecha DESC, pa.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- ── get_resumen_bitacora ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_resumen_bitacora(p_empresa_id UUID)
RETURNS TABLE (
  proyecto_id        UUID,
  proyecto_nombre    TEXT,
  tipo_proyecto      TEXT,
  ultima_fecha       DATE,
  ultimo_pct         INTEGER,
  total_entradas     BIGINT,
  entradas_hoy       BIGINT,
  tiene_bloqueo      BOOLEAN,
  nivel_bloqueo_max  TEXT,
  ultimo_usuario     TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id                                              AS proyecto_id,
    p.nombre                                          AS proyecto_nombre,
    p.tipo_proyecto                                   AS tipo_proyecto,
    MAX(pa.fecha)                                     AS ultima_fecha,
    (SELECT pa2.porcentaje_avance
     FROM proyecto_actualizaciones pa2
     WHERE pa2.proyecto_id = p.id
     ORDER BY pa2.fecha DESC, pa2.created_at DESC
     LIMIT 1)                                        AS ultimo_pct,
    COUNT(pa.id)                                     AS total_entradas,
    COUNT(pa.id) FILTER (WHERE pa.fecha = CURRENT_DATE) AS entradas_hoy,
    BOOL_OR(pa.nivel_bloqueo IN ('medio','critico')) AS tiene_bloqueo,
    (SELECT pa3.nivel_bloqueo
     FROM proyecto_actualizaciones pa3
     WHERE pa3.proyecto_id = p.id
       AND pa3.nivel_bloqueo IN ('medio','critico')
     ORDER BY
       CASE pa3.nivel_bloqueo WHEN 'critico' THEN 0 ELSE 1 END,
       pa3.fecha DESC
     LIMIT 1)                                        AS nivel_bloqueo_max,
    (SELECT TRIM(CONCAT(u.nombres, ' ', COALESCE(u.apellidos, '')))
     FROM proyecto_actualizaciones pa4
     JOIN usuarios u ON u.id = pa4.usuario_id
     WHERE pa4.proyecto_id = p.id
     ORDER BY pa4.fecha DESC, pa4.created_at DESC
     LIMIT 1)                                        AS ultimo_usuario
  FROM proyectos p
  LEFT JOIN proyecto_actualizaciones pa ON pa.proyecto_id = p.id
  WHERE p.empresa_id = p_empresa_id
    AND p.deleted_at IS NULL
  GROUP BY p.id, p.nombre, p.tipo_proyecto
  ORDER BY MAX(pa.fecha) DESC NULLS LAST, p.nombre;
END;
$$;
