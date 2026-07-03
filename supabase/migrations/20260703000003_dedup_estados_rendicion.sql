-- Eliminar duplicados en estados_rendicion
-- Mantener el registro con el ID más antiguo (menor) para cada código

DO $$
DECLARE
  r RECORD;
  keep_id UUID;
BEGIN
  -- Para cada código duplicado
  FOR r IN
    SELECT codigo, COUNT(*) as cnt
    FROM estados_rendicion
    GROUP BY codigo
    HAVING COUNT(*) > 1
  LOOP
    -- Obtener el ID a conservar (el más antiguo)
    SELECT id INTO keep_id
    FROM estados_rendicion
    WHERE codigo = r.codigo
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT 1;

    -- Reasignar rendiciones que apuntan a duplicados
    UPDATE rendiciones
    SET estado_rendicion_id = keep_id
    WHERE estado_rendicion_id IN (
      SELECT id FROM estados_rendicion
      WHERE codigo = r.codigo AND id <> keep_id
    );

    -- Eliminar los duplicados
    DELETE FROM estados_rendicion
    WHERE codigo = r.codigo AND id <> keep_id;

    RAISE NOTICE 'Deduplicado: % (kept %)', r.codigo, keep_id;
  END LOOP;
END $$;
