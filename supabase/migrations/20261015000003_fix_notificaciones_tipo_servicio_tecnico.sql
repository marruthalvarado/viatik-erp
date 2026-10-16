-- =============================================================================
-- Fix: agregar 'servicio_tecnico' al check constraint de notificaciones.tipo
-- La función cerrar_orden_servicio y generar_ordenes_preventivas usan este tipo
-- pero no estaba incluido en la lista original del constraint.
-- =============================================================================

ALTER TABLE public.notificaciones
  DROP CONSTRAINT IF EXISTS notificaciones_tipo_check;

ALTER TABLE public.notificaciones
  ADD CONSTRAINT notificaciones_tipo_check
    CHECK (tipo IN (
      'workflow', 'presupuesto', 'ocr', 'politica',
      'ia', 'sistema', 'viajes', 'rendiciones',
      'servicio_tecnico'
    ));
