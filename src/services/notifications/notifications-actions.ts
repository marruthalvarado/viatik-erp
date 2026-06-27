/**
 * notifications-actions.ts — FASE 9A
 *
 * Todas las operaciones de ESCRITURA sobre la tabla notificaciones.
 * Ninguna función lee estado de UI.
 *
 * Arquitectura: Hook → Service → Supabase
 */

import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Marcar una notificación como leída
// ---------------------------------------------------------------------------

export async function marcarComoLeida(notificacionId: string): Promise<void> {
  const { error } = await supabase
    .from("notificaciones")
    .update({ leida: true, fecha_lectura: new Date().toISOString() })
    .eq("id", notificacionId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Marcar todas como leídas (RPC para atomicidad)
// ---------------------------------------------------------------------------

export async function marcarTodasComoLeidas(usuarioId: string, empresaId: string): Promise<number> {
  const { data, error } = await supabase.rpc("marcar_todas_notificaciones_leidas", {
    p_usuario_id: usuarioId,
    p_empresa_id: empresaId,
  });

  if (error) throw error;
  return (data as number) ?? 0;
}

// ---------------------------------------------------------------------------
// Eliminar una notificación
// ---------------------------------------------------------------------------

export async function eliminarNotificacion(notificacionId: string): Promise<void> {
  const { error } = await supabase.from("notificaciones").delete().eq("id", notificacionId);

  if (error) throw error;
}
