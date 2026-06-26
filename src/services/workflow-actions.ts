/**
 * workflow-actions.ts
 * Todas las mutaciones del workflow se ejecutan exclusivamente vía RPC.
 * El frontend nunca realiza múltiples UPDATE/INSERT para cambiar estado.
 * La atomicidad está garantizada por las funciones PL/pgSQL en Supabase.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/types/database";

// ---------------------------------------------------------------------------
// Tipos de respuesta de RPCs
// ---------------------------------------------------------------------------

export interface WfRpcResult {
  ok: boolean;
  error?: string;
  nuevo_estado?: string;
  accion?: string;
  workflow_id?: string;
}

function parseRpcResult(data: Json | null, rpcName: string): WfRpcResult {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`RPC ${rpcName} retornó una respuesta inesperada`);
  }
  const result = data as Record<string, unknown>;
  if (result.ok === false) {
    throw new Error(typeof result.error === "string" ? result.error : `Error en ${rpcName}`);
  }
  return result as unknown as WfRpcResult;
}

// ---------------------------------------------------------------------------
// RPC: wf_enviar_aprobacion
// Transición atómica: borrador/devuelta → enviada
// ---------------------------------------------------------------------------

export async function enviarAprobacion(params: {
  rendicionId: string;
  usuarioId: string;
  empresaId: string;
}): Promise<WfRpcResult> {
  const { rendicionId, usuarioId, empresaId } = params;

  const { data, error } = await supabase.rpc("wf_enviar_aprobacion", {
    p_rendicion_id: rendicionId,
    p_usuario_id: usuarioId,
    p_empresa_id: empresaId,
  });

  if (error) throw new Error(error.message);
  return parseRpcResult(data as Json, "wf_enviar_aprobacion");
}

// ---------------------------------------------------------------------------
// RPC: wf_registrar_accion
// Transición atómica para aprobar / rechazar / devolver
// ---------------------------------------------------------------------------

export async function registrarAccion(params: {
  rendicionId: string;
  workflowPasoId: string;
  accionCodigo: "aprobar" | "rechazar" | "devolver";
  comentario: string | null;
  usuarioId: string;
  empresaId: string;
}): Promise<WfRpcResult> {
  const { rendicionId, workflowPasoId, accionCodigo, comentario, usuarioId, empresaId } = params;

  const { data, error } = await supabase.rpc("wf_registrar_accion", {
    p_rendicion_id: rendicionId,
    p_workflow_paso_id: workflowPasoId,
    p_accion_codigo: accionCodigo,
    p_comentario: comentario,
    p_usuario_id: usuarioId,
    p_empresa_id: empresaId,
  });

  if (error) throw new Error(error.message);
  return parseRpcResult(data as Json, "wf_registrar_accion");
}

// ---------------------------------------------------------------------------
// Agregar comentario (INSERT directo — no es transición de estado)
// ---------------------------------------------------------------------------

export async function agregarComentario(params: {
  rendicionId: string;
  usuarioId: string;
  empresaId: string;
  comentario: string;
}): Promise<void> {
  const { rendicionId, usuarioId, empresaId, comentario } = params;

  const { error } = await supabase.from("comentarios").insert({
    rendicion_id: rendicionId,
    usuario_id: usuarioId,
    empresa_id: empresaId,
    comentario,
  });

  if (error) throw new Error(error.message);
}
