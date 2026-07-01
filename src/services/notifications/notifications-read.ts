/**
 * notifications-read.ts — FASE 9A
 *
 * Todas las operaciones de LECTURA sobre la tabla notificaciones.
 * Ninguna función muta estado.
 * No exportar supabase — solo usar aquí.
 *
 * Arquitectura: Hook → Service → Supabase
 */

import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type NotificacionTipo =
  "workflow" | "presupuesto" | "ocr" | "politica" | "ia" | "sistema" | "viajes" | "rendiciones";

export type NotificacionPrioridad = "alta" | "media" | "baja";

export interface Notificacion {
  id: string;
  empresa_id: string;
  usuario_id: string;
  tipo: NotificacionTipo;
  prioridad: NotificacionPrioridad;
  titulo: string;
  mensaje: string | null;
  url_destino: string | null;
  leida: boolean;
  fecha_lectura: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface NotificacionesParams {
  empresaId: string;
  usuarioId: string;
  soloNoLeidas?: boolean;
  limite?: number;
  tipo?: NotificacionTipo;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function mapRow(row: Record<string, unknown>): Notificacion {
  return {
    id: row.id as string,
    empresa_id: row.empresa_id as string,
    usuario_id: row.usuario_id as string,
    tipo: (row.tipo as NotificacionTipo) ?? "sistema",
    prioridad: (row.prioridad as NotificacionPrioridad) ?? "media",
    titulo: (row.titulo as string) ?? "",
    mensaje: (row.mensaje as string | null) ?? null,
    url_destino: (row.url_destino as string | null) ?? null,
    leida: (row.leida as boolean) ?? false,
    fecha_lectura: (row.fecha_lectura as string | null) ?? null,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

// ---------------------------------------------------------------------------
// Funciones exportadas
// ---------------------------------------------------------------------------

/**
 * Obtiene las notificaciones del usuario en la empresa activa.
 * Ordenadas por fecha descendente. Máximo 100 por defecto.
 */
export async function getNotificaciones(params: NotificacionesParams): Promise<Notificacion[]> {
  let query = supabase
    .from("notificaciones")
    .select("*")
    .eq("empresa_id", params.empresaId)
    .eq("usuario_id", params.usuarioId)
    .order("created_at", { ascending: false })
    .limit(params.limite ?? 100);

  if (params.soloNoLeidas) {
    query = query.eq("leida", false);
  }

  if (params.tipo) {
    query = query.eq("tipo", params.tipo);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/**
 * Cuenta las notificaciones no leídas del usuario.
 * Usa RPC para eficiencia (una sola query COUNT).
 */
export async function getConteoNoLeidas(usuarioId: string, empresaId: string): Promise<number> {
  const { data, error } = await supabase.rpc("contar_notificaciones_no_leidas", {
    p_usuario_id: usuarioId,
    p_empresa_id: empresaId,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}
