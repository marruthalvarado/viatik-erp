/**
 * workflow-types.ts
 * Tipos y helpers locales del módulo workflow.
 * Solo tipos/constantes — no exporta componentes React.
 */

import type {
  AprobacionConDetalle,
  HistorialConDetalle,
  ComentarioConUsuario,
} from "@/services/workflow-read";

// ---------------------------------------------------------------------------
// Códigos de estado de rendición relevantes para workflow
// ---------------------------------------------------------------------------

export type EstadoWorkflow =
  | "borrador"
  | "enviada"
  | "en_revision"
  | "aprobada"
  | "rechazada"
  | "devuelta";

export type AccionCodigo = "aprobar" | "rechazar" | "devolver";

// ---------------------------------------------------------------------------
// Entrada unificada del timeline (historial + comentarios mezclados)
// ---------------------------------------------------------------------------

export type TipoEntrada = "evento" | "comentario" | "decision";

export interface EntradaTimeline {
  id: string;
  tipo: TipoEntrada;
  fecha: string;
  usuario_nombre: string | null;
  texto: string;
  evento?: string | null; // para tipo "evento"
  accion_codigo?: string | null; // para tipo "decision"
  paso_nombre?: string | null;
}

// ---------------------------------------------------------------------------
// Paso con estado calculado (para el stepper visual)
// ---------------------------------------------------------------------------

export interface PasoConEstado {
  id: string;
  nombre: string | null;
  orden: number;
  rol_id: string;
  es_ultimo: boolean;
  estado: "pendiente" | "aprobado" | "rechazado" | "activo";
  aprobacion?: AprobacionConDetalle;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Combina historial de workflow + comentarios en un único timeline ordenado.
 */
export function buildTimeline(
  historial: HistorialConDetalle[],
  comentarios: ComentarioConUsuario[],
  aprobaciones: AprobacionConDetalle[],
): EntradaTimeline[] {
  const ACCIONES = new Set(["aprobar", "rechazar", "devolver"]);

  const eventos: EntradaTimeline[] = historial.map((h) => ({
    id: h.id,
    tipo: ACCIONES.has(h.evento ?? "") ? ("decision" as TipoEntrada) : ("evento" as TipoEntrada),
    fecha: h.created_at ?? "",
    usuario_nombre: h.usuario_nombre ?? null,
    texto: h.detalle ?? h.evento ?? "",
    evento: h.evento,
    accion_codigo: ACCIONES.has(h.evento ?? "") ? h.evento : null,
    paso_nombre: h.paso_nombre ?? null,
  }));

  const comentariosEntrada: EntradaTimeline[] = comentarios.map((c) => ({
    id: c.id,
    tipo: "comentario" as TipoEntrada,
    fecha: c.created_at ?? "",
    usuario_nombre: c.usuario_nombre ?? null,
    texto: c.comentario,
    evento: null,
    accion_codigo: null,
  }));

  // Las aprobaciones ya están reflejadas en el historial; no duplicar.
  void aprobaciones;

  return [...eventos, ...comentariosEntrada].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
  );
}

/**
 * Tonalidad visual por estado de workflow.
 */
export function workflowTone(
  estado: string | null | undefined,
): "success" | "danger" | "warning" | "info" | "neutral" {
  switch (estado) {
    case "aprobada":
      return "success";
    case "rechazada":
      return "danger";
    case "devuelta":
      return "warning";
    case "enviada":
    case "en_revision":
      return "info";
    case "borrador":
      return "neutral";
    default:
      return "neutral";
  }
}

/**
 * Etiqueta legible para código de estado.
 */
export function estadoLabel(codigo: string | null | undefined): string {
  switch (codigo) {
    case "borrador":
      return "Borrador";
    case "enviada":
      return "Enviada";
    case "en_revision":
      return "En revisión";
    case "aprobada":
      return "Aprobada";
    case "rechazada":
      return "Rechazada";
    case "devuelta":
      return "Devuelta";
    default:
      return codigo ?? "—";
  }
}

/**
 * Etiqueta e ícono para eventos del historial.
 */
export function eventoLabel(evento: string | null | undefined): string {
  switch (evento) {
    case "enviada":
      return "Enviada a aprobación";
    case "aprobar":
      return "Aprobado";
    case "rechazar":
      return "Rechazado";
    case "devolver":
      return "Devuelta para corrección";
    default:
      return evento ?? "Evento";
  }
}
