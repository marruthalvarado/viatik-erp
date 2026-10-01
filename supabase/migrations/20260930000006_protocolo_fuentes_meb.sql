-- ─────────────────────────────────────────────────────────────────────────────
-- Actividad 2.8.1: Verificación fuentes de alimentación MEB (+5V, +12V, -12V, +24V DC)
-- Convierte el campo único "Valor" en 4 campos de medición con rangos ±5%
-- ─────────────────────────────────────────────────────────────────────────────

-- 0. Asegurar que las columnas existen en ambas tablas (idempotente)
ALTER TABLE public.protocolo_actividades
  ADD COLUMN IF NOT EXISTS etiquetas_medicion TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rangos_medicion     JSONB  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS variantes_modelo    JSONB  DEFAULT NULL;

ALTER TABLE public.os_actividades
  ADD COLUMN IF NOT EXISTS etiquetas_medicion  TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rangos_medicion     JSONB  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valores_medidos     JSONB  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS variantes_modelo    JSONB  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS modelo_seleccionado TEXT   DEFAULT NULL;

-- 1. Actualizar en protocolo_actividades (afecta futuras OS)
UPDATE public.protocolo_actividades
SET
  tipo_campo         = 'medicion',
  etiquetas_medicion = ARRAY['+5 V', '+12 V', '-12 V', '+24 V DC'],
  rangos_medicion    = '[
    {"min": 4.75,  "max": 5.25},
    {"min": 11.4,  "max": 12.6},
    {"min": -12.6, "max": -11.4},
    {"min": 22.8,  "max": 25.2}
  ]'::jsonb
WHERE descripcion ILIKE '%fuentes de alimentaci_n MEB%'
   OR descripcion ILIKE '%fuentes de alimentación MEB%'
   OR descripcion ILIKE '%+5 V%12 V%+24 V%'
   OR descripcion ILIKE '%+5V%12V%24V%';

-- 2. Actualizar en os_actividades (afecta OS ya existentes)
UPDATE public.os_actividades
SET
  tipo_campo         = 'medicion',
  etiquetas_medicion = ARRAY['+5 V', '+12 V', '-12 V', '+24 V DC'],
  rangos_medicion    = '[
    {"min": 4.75,  "max": 5.25},
    {"min": 11.4,  "max": 12.6},
    {"min": -12.6, "max": -11.4},
    {"min": 22.8,  "max": 25.2}
  ]'::jsonb
WHERE descripcion ILIKE '%fuentes de alimentaci_n MEB%'
   OR descripcion ILIKE '%fuentes de alimentación MEB%'
   OR descripcion ILIKE '%+5 V%12 V%+24 V%'
   OR descripcion ILIKE '%+5V%12V%24V%';
