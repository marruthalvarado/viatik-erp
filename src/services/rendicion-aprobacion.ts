/**
 * rendicion-aprobacion.ts
 * Opcion B: aprobador directo por rendicion.
 * 4 funciones simples que llaman a las RPCs SECURITY DEFINER.
 */

import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface RendicionPendiente {
  id: string;
  numero: string;
  proyecto_id: string;
  empresa_id: string;
  usuario_id: string;
  fecha_envio: string | null;
  total_facturado: number;
  anticipo_efectivo: number;
  anticipo_credito: number;
}

export interface UsuarioAprobador {
  usuario_id: string;
  nombres: string;
  apellidos: string | null;
  email: string | null;
}

// ---------------------------------------------------------------------------
// RPCs
// ---------------------------------------------------------------------------

/**
 * Empleado envía la rendición a un aprobador específico.
 * Estado: borrador | rechazada → enviada
 */
export async function enviarRendicion(rendicionId: string, aprobadorId: string): Promise<void> {
  const { error } = await supabase.rpc("rendir_enviar", {
    p_rendicion_id: rendicionId,
    p_aprobador_id: aprobadorId,
  });
  if (error) throw new Error(error.message);
}

/**
 * Aprobador aprueba la rendición asignada.
 * Estado: enviada → aprobada
 */
export async function aprobarRendicion(rendicionId: string, comentario?: string): Promise<void> {
  const { error } = await supabase.rpc("rendir_aprobar", {
    p_rendicion_id: rendicionId,
    p_comentario: comentario ?? null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Aprobador rechaza la rendición con motivo obligatorio.
 * Estado: enviada → rechazada
 */
export async function rechazarRendicion(rendicionId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("rendir_rechazar", {
    p_rendicion_id: rendicionId,
    p_motivo: motivo,
  });
  if (error) throw new Error(error.message);
}

/**
 * Devuelve las rendiciones donde el usuario actual es aprobador
 * y el estado es 'enviada'.
 */
export async function getMisRendicionesPendientes(): Promise<RendicionPendiente[]> {
  const { data, error } = await supabase.rpc("rendir_mis_pendientes");
  if (error) throw new Error(error.message);
  return (data ?? []) as RendicionPendiente[];
}

/**
 * Devuelve todos los usuarios activos de la empresa (excepto el actual)
 * como candidatos a aprobador.
 * Usa RPC SECURITY DEFINER para bypassear RLS de empresas_usuarios.
 */
export async function getAprobadoresDisponibles(): Promise<UsuarioAprobador[]> {
  const { data, error } = await supabase.rpc("rendir_aprobadores_disponibles");
  if (error) throw new Error(error.message);
  return (data ?? []) as UsuarioAprobador[];
}

// ---------------------------------------------------------------------------
// Tipos log
// ---------------------------------------------------------------------------

export interface RendirLogEntry {
  id: string;
  created_at: string;
  estado_codigo: string;
  observacion: string | null;
  usuario_nombre: string;
}

// ---------------------------------------------------------------------------
// RPCs V1.2
// ---------------------------------------------------------------------------

/**
 * Devuelve una rendición enviada o aprobada para que el empleado la corrija.
 * Requiere rol aprobador | financiero | admin.
 * Estado: enviada | aprobada → devuelta
 */
export async function devolverRendicion(
  rendicionId: string,
  observacion?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("rendir_devolver", {
    p_rendicion_id: rendicionId,
    p_observacion: observacion ?? null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Retorna el historial cronológico de estados de una rendición.
 */
export async function getRendirLog(rendicionId: string): Promise<RendirLogEntry[]> {
  const { data, error } = await supabase.rpc("rendir_log_rendicion", {
    p_rendicion_id: rendicionId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as RendirLogEntry[];
}
