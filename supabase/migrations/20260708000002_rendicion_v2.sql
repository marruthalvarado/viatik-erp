-- =============================================================================
-- Rendicion v2: auto-numero, estado Registrada/Liquidada, rol financiero,
--               campos liquidado_por + fecha_liquidacion
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Seed nuevos estados
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM estados_rendicion WHERE codigo = 'registrada') THEN
    INSERT INTO estados_rendicion (codigo, nombre) VALUES ('registrada', 'Registrada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM estados_rendicion WHERE codigo = 'liquidada') THEN
    INSERT INTO estados_rendicion (codigo, nombre) VALUES ('liquidada', 'Liquidada');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Seed rol financiero
-- ---------------------------------------------------------------------------
INSERT INTO roles (codigo, nombre, descripcion)
VALUES ('financiero', 'Financiero', 'Gestiona la liquidación y desembolso de viáticos')
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Columnas nuevas en rendiciones
-- ---------------------------------------------------------------------------
ALTER TABLE rendiciones
  ADD COLUMN IF NOT EXISTS liquidado_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_liquidacion TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 4. Función helper: iniciales de empresa a partir del nombre
--    "Protonmedical S.A.S." → "PR"
--    "ORIMEC C.A"           → "OR"
--    "Nuclear Pet S.A."     → "NP"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._empresa_initials(p_nombre TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_clean TEXT;
  v_words TEXT[];
  v_result TEXT := '';
  v_word  TEXT;
  v_stop  TEXT[] := ARRAY['SA','SAS','CA','CIA','LTDA','CORP','INC','LLC','LTD','SRL',
                            'S.A','S.A.S','C.A','CIA.','LTDA.'];
BEGIN
  -- Normalise: remove punctuation except spaces and hyphens, trim, upper
  v_clean := upper(regexp_replace(p_nombre, '[.,]', '', 'g'));
  v_clean := regexp_replace(v_clean, '\s+', ' ', 'g');
  v_clean := trim(v_clean);

  -- Split by spaces / hyphens
  v_words := regexp_split_to_array(v_clean, '[\s\-]+');

  FOREACH v_word IN ARRAY v_words LOOP
    -- Skip empty and legal suffixes
    CONTINUE WHEN v_word = '' OR v_word = ANY(v_stop);
    v_result := v_result || left(v_word, 1);
    EXIT WHEN length(v_result) >= 3;
  END LOOP;

  -- If only 1 significant word we got 1 char → pad with next char of that word
  IF length(v_result) < 2 THEN
    FOREACH v_word IN ARRAY v_words LOOP
      CONTINUE WHEN v_word = '' OR v_word = ANY(v_stop);
      v_result := left(v_word, 2);
      EXIT;
    END LOOP;
  END IF;

  RETURN coalesce(nullif(v_result, ''), 'XX');
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Función: generar_numero_rendicion(empresa_id)
--    Devuelve el siguiente código disponible: PM-2025-00001
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generar_numero_rendicion(p_empresa_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_initials TEXT;
  v_year     TEXT;
  v_seq      INT;
  v_numero   TEXT;
BEGIN
  -- Obtener nombre de la empresa
  SELECT _empresa_initials(e.nombre)
    INTO v_initials
    FROM empresas e
   WHERE e.id = p_empresa_id
   LIMIT 1;

  v_initials := coalesce(v_initials, 'XX');
  v_year     := to_char(now(), 'YYYY');

  -- Siguiente secuencial para esta empresa + año
  SELECT coalesce(
    max(
      CASE
        WHEN numero ~ ('^' || v_initials || '-' || v_year || '-[0-9]{5}$')
        THEN (regexp_replace(numero, '^.*-([0-9]+)$', '\1'))::int
        ELSE 0
      END
    ), 0
  ) + 1
    INTO v_seq
    FROM rendiciones
   WHERE empresa_id = p_empresa_id
     AND deleted_at IS NULL;

  v_numero := v_initials || '-' || v_year || '-' || lpad(v_seq::text, 5, '0');
  RETURN v_numero;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generar_numero_rendicion(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Trigger: auto-asignar numero y estado 'registrada' al insertar rendicion
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._rendicion_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado_id UUID;
BEGIN
  -- Auto-numero si viene vacío
  IF NEW.numero IS NULL OR trim(NEW.numero) = '' THEN
    NEW.numero := generar_numero_rendicion(NEW.empresa_id);
  END IF;

  -- Auto-estado 'registrada' si no se especificó
  IF NEW.estado_rendicion_id IS NULL THEN
    SELECT id INTO v_estado_id
      FROM estados_rendicion
     WHERE codigo = 'registrada'
     LIMIT 1;
    NEW.estado_rendicion_id := v_estado_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rendicion_before_insert ON rendiciones;
CREATE TRIGGER trg_rendicion_before_insert
  BEFORE INSERT ON rendiciones
  FOR EACH ROW
  EXECUTE FUNCTION _rendicion_before_insert();

-- ---------------------------------------------------------------------------
-- 7. RPC: rendir_liquidar — financiero marca la rendición como liquidada
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rendir_liquidar(p_rendicion_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado_actual TEXT;
  v_estado_id     UUID;
  v_empresa_id    UUID;
  v_rol           TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Verificar estado actual de la rendición
  SELECT r.empresa_id, er.codigo
    INTO v_empresa_id, v_estado_actual
    FROM rendiciones r
    LEFT JOIN estados_rendicion er ON er.id = r.estado_rendicion_id
   WHERE r.id = p_rendicion_id
     AND r.deleted_at IS NULL
   FOR UPDATE;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Rendición no encontrada';
  END IF;

  IF v_estado_actual <> 'aprobada' THEN
    RAISE EXCEPTION 'La rendición debe estar aprobada para liquidar (estado actual: %)', v_estado_actual;
  END IF;

  -- Verificar que el caller tiene rol financiero o admin en la empresa
  SELECT r.codigo INTO v_rol
    FROM empresas_usuarios eu
    JOIN roles r ON r.id = eu.rol_id
   WHERE eu.empresa_id = v_empresa_id
     AND eu.usuario_id = auth.uid()
     AND eu.activo = TRUE
   LIMIT 1;

  IF v_rol NOT IN ('financiero', 'admin') THEN
    RAISE EXCEPTION 'Solo el rol financiero o administrador puede liquidar rendiciones';
  END IF;

  SELECT id INTO v_estado_id FROM estados_rendicion WHERE codigo = 'liquidada' LIMIT 1;

  UPDATE rendiciones SET
    estado_rendicion_id = v_estado_id,
    liquidado_por       = auth.uid(),
    fecha_liquidacion   = now(),
    updated_at          = now()
  WHERE id = p_rendicion_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rendir_liquidar(UUID) TO authenticated;
