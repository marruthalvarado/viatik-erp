-- ─────────────────────────────────────────────────────────────────────────────
-- Actividad 2.8.1: Verificación fuentes de alimentación MEB (+5V, +12V, -12V, +24V DC)
-- Convierte el campo único "Valor" en 4 campos de medición con rangos ±5%
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Actualizar en protocolos_actividades (afecta futuras OS)
UPDATE public.protocolos_actividades
SET
  tipo_campo         = 'medicion',
  etiquetas_medicion = ARRAY['+5 V', '+12 V', '-12 V', '+24 V DC'],
  rangos_medicion    = '[
    {"min": 4.75,  "max": 5.25},
    {"min": 11.4,  "max": 12.6},
    {"min": -12.6, "max": -11.4},
    {"min": 22.8,  "max": 25.2}
  ]'::jsonb
WHERE descripcion ILIKE '%fuentes de alimentación MEB%'
   OR descripcion ILIKE '%+5 V%±12 V%+24 V%'
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
  ]'::jsonb,
  valores_medidos    = CASE
    WHEN valores_medidos IS NULL THEN NULL
    ELSE valores_medidos
  END
WHERE descripcion ILIKE '%fuentes de alimentación MEB%'
   OR descripcion ILIKE '%+5 V%±12 V%+24 V%'
   OR descripcion ILIKE '%+5V%12V%24V%';
