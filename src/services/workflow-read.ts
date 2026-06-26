/**
 * workflow-read.ts
 * Todas las operaciones de lectura del workflow.
 * Ninguna de estas funciones muta estado.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  WorkflowAprobacion,
  WorkflowPaso,
  Aprobacion,
  AccionAprobacion,
  HistorialWorkflow,
  Comentario,
} from "@/types/entities";

// ---------------------------------------------------------------------------
// Tipos enriquecidos para lectura
// ---------------------------------------------------------------------------

export interface AprobacionConDetalle extends Aprobacion {
  usuario_nombre: string | null;
  accion_codigo: string | null;
  accion_nombre: string | null;
  paso_nombre: string | null;
  paso_orden: number | null;
}

export interface HistorialConDetalle extends HistorialWorkflow {
  usuario_nombre: string | null;
  paso_nombre: string | null;
}

export interface ComentarioConUsuario extends Comentario {
  usuario_nombre: string | null;
}

export interface PasoActual {
  paso_id: string;
  nombre: string | null;
  orden: number;
  rol_id: string;
  es_ultimo: boolean;
}

export interface AprobacionPendiente {
  rendicion_id: string;
  numero: string;
  descripcion: string | null;
  proyecto_id: string;
  total_facturado: number | null;
  total_reembolsable: number | null;
  fecha_rendicion: string | null;
  fecha_envio: string | null;
  estado_codigo: string;
  estado_nombre: string;
  paso_nombre: string | null;
  paso_orden: number;
  usuario_nombre: string | null;
  workflow_paso_id: string;
}

// ---------------------------------------------------------------------------
// Workflows disponibles en la empresa
// ---------------------------------------------------------------------------

export async function getWorkflows(empresaId: string): Promise<WorkflowAprobacion[]> {
  const { data, error } = await supabase
    .from("workflows_aprobacion")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("nombre");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getWorkflowPasos(workflowId: string): Promise<WorkflowPaso[]> {
  const { data, error } = await supabase
    .from("workflow_pasos")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("orden");

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Catálogo de acciones
// ---------------------------------------------------------------------------

export async function getAccionesAprobacion(): Promise<AccionAprobacion[]> {
  const { data, error } = await supabase.from("acciones_aprobacion").select("*").order("nombre");

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Paso actual (vía RPC — lógica centralizada en Supabase)
// ---------------------------------------------------------------------------

export async function getPasoActual(rendicionId: string): Promise<PasoActual | null> {
  const { data, error } = await supabase.rpc("wf_paso_actual", {
    p_rendicion_id: rendicionId,
  });

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;
  return data[0] as PasoActual;
}

// ---------------------------------------------------------------------------
// Bandeja del aprobador (vía RPC)
// ---------------------------------------------------------------------------

export async function getMisAprobacionesPendientes(
  usuarioId: string,
  empresaId: string,
): Promise<AprobacionPendiente[]> {
  const { data, error } = await supabase.rpc("wf_mis_pendientes", {
    p_usuario_id: usuarioId,
    p_empresa_id: empresaId,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as AprobacionPendiente[];
}

// ---------------------------------------------------------------------------
// Aprobaciones de una rendición (historial de decisiones)
// ---------------------------------------------------------------------------

export async function getAprobacionesByRendicion(
  rendicionId: string,
): Promise<AprobacionConDetalle[]> {
  const { data, error } = await supabase
    .from("aprobaciones")
    .select(
      `
      *,
      usuarios(nombres, apellidos),
      acciones_aprobacion(codigo, nombre),
      workflow_pasos(nombre, orden)
    `,
    )
    .eq("rendicion_id", rendicionId)
    .order("fecha_accion", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const usuario = row.usuarios as unknown as { nombres: string; apellidos: string | null } | null;
    const accion = row.acciones_aprobacion as unknown as {
      codigo: string;
      nombre: string;
    } | null;
    const paso = row.workflow_pasos as unknown as { nombre: string | null; orden: number } | null;

    return {
      ...row,
      usuario_nombre: usuario ? `${usuario.nombres} ${usuario.apellidos ?? ""}`.trim() : null,
      accion_codigo: accion?.codigo ?? null,
      accion_nombre: accion?.nombre ?? null,
      paso_nombre: paso?.nombre ?? null,
      paso_orden: paso?.orden ?? null,
    } as AprobacionConDetalle;
  });
}

// ---------------------------------------------------------------------------
// Historial de workflow de una rendición
// ---------------------------------------------------------------------------

export async function getHistorialByRendicion(rendicionId: string): Promise<HistorialConDetalle[]> {
  const { data, error } = await supabase
    .from("historial_workflow")
    .select(
      `
      *,
      usuarios(nombres, apellidos),
      workflow_pasos(nombre)
    `,
    )
    .eq("rendicion_id", rendicionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const usuario = row.usuarios as unknown as { nombres: string; apellidos: string | null } | null;
    const paso = row.workflow_pasos as unknown as { nombre: string | null } | null;

    return {
      ...row,
      usuario_nombre: usuario ? `${usuario.nombres} ${usuario.apellidos ?? ""}`.trim() : null,
      paso_nombre: paso?.nombre ?? null,
    } as HistorialConDetalle;
  });
}

// ---------------------------------------------------------------------------
// Comentarios de una rendición
// ---------------------------------------------------------------------------

export async function getComentariosByRendicion(
  rendicionId: string,
): Promise<ComentarioConUsuario[]> {
  const { data, error } = await supabase
    .from("comentarios")
    .select("*, usuarios(nombres, apellidos)")
    .eq("rendicion_id", rendicionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const usuario = row.usuarios as unknown as { nombres: string; apellidos: string | null } | null;
    return {
      ...row,
      usuario_nombre: usuario ? `${usuario.nombres} ${usuario.apellidos ?? ""}`.trim() : null,
    } as ComentarioConUsuario;
  });
}
