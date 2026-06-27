/**
 * notifications-create.ts — FASE 9B
 *
 * Capa de creación programática de notificaciones desde TypeScript.
 *
 * Uso: eventos que NO ocurren vía trigger PostgreSQL (p.ej. errores
 * críticos capturados en el cliente, flujos de Edge Function).
 * Para eventos de DB (workflow, presupuesto, OCR, política) los triggers
 * SQL de la migración 20240629000000_notificaciones_motor.sql son
 * la fuente de verdad.
 *
 * Arquitectura: Service → Supabase (nunca desde componentes)
 */

import { supabase } from "@/integrations/supabase/client";
import type { NotificacionTipo, NotificacionPrioridad } from "./notifications-read";

// ---------------------------------------------------------------------------
// Parámetros base
// ---------------------------------------------------------------------------

export interface CrearNotificacionParams {
  empresaId: string;
  usuarioId: string;
  tipo: NotificacionTipo;
  prioridad: NotificacionPrioridad;
  titulo: string;
  mensaje: string;
  urlDestino?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Función base de creación
// ---------------------------------------------------------------------------

export async function crearNotificacion(params: CrearNotificacionParams): Promise<void> {
  const { empresaId, usuarioId, tipo, prioridad, titulo, mensaje, urlDestino, metadata } = params;

  const { error } = await supabase.from("notificaciones").insert({
    empresa_id: empresaId,
    usuario_id: usuarioId,
    tipo,
    prioridad,
    titulo,
    mensaje,
    url_destino: urlDestino ?? null,
    metadata: (metadata ?? {}) as never,
    leida: false,
  });

  if (error) throw new Error(`[notifications-create] ${error.message}`);
}

// ---------------------------------------------------------------------------
// Helpers tipados por evento
// ---------------------------------------------------------------------------

/** Error crítico del sistema — capturado desde error boundaries o catch global */
export async function notificarErrorCritico(params: {
  empresaId: string;
  usuarioId: string;
  descripcion: string;
  contexto?: Record<string, unknown>;
}): Promise<void> {
  return crearNotificacion({
    empresaId: params.empresaId,
    usuarioId: params.usuarioId,
    tipo: "sistema",
    prioridad: "alta",
    titulo: "Error crítico del sistema",
    mensaje: params.descripcion,
    urlDestino: "/dashboard",
    metadata: params.contexto,
  });
}

/** Notificación IA — cuando un modelo genera una sugerencia o alerta */
export async function notificarIA(params: {
  empresaId: string;
  usuarioId: string;
  titulo: string;
  mensaje: string;
  urlDestino?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  return crearNotificacion({
    empresaId: params.empresaId,
    usuarioId: params.usuarioId,
    tipo: "ia",
    prioridad: "media",
    titulo: params.titulo,
    mensaje: params.mensaje,
    urlDestino: params.urlDestino,
    metadata: params.metadata,
  });
}

/** Gasto rechazado — cuando un aprobador rechaza un gasto individual */
export async function notificarGastoRechazado(params: {
  empresaId: string;
  usuarioId: string;
  gastoId: string;
  numeroDocumento: string;
  motivo?: string;
}): Promise<void> {
  return crearNotificacion({
    empresaId: params.empresaId,
    usuarioId: params.usuarioId,
    tipo: "rendiciones",
    prioridad: "alta",
    titulo: "Gasto rechazado",
    mensaje: `El gasto ${params.numeroDocumento} fue rechazado.${params.motivo ? " Motivo: " + params.motivo : ""}`,
    urlDestino: `/gastos`,
    metadata: {
      gasto_id: params.gastoId,
      numero_documento: params.numeroDocumento,
      motivo: params.motivo,
    },
  });
}

/** Gasto observado — cuando un gasto queda pendiente de aclaración */
export async function notificarGastoObservado(params: {
  empresaId: string;
  usuarioId: string;
  gastoId: string;
  numeroDocumento: string;
  observacion: string;
}): Promise<void> {
  return crearNotificacion({
    empresaId: params.empresaId,
    usuarioId: params.usuarioId,
    tipo: "rendiciones",
    prioridad: "media",
    titulo: "Gasto observado",
    mensaje: `El gasto ${params.numeroDocumento} tiene una observación: ${params.observacion}`,
    urlDestino: `/gastos`,
    metadata: {
      gasto_id: params.gastoId,
      numero_documento: params.numeroDocumento,
      observacion: params.observacion,
    },
  });
}

/** Documento rechazado — cuando el estado del documento cambia a rechazado */
export async function notificarDocumentoRechazado(params: {
  empresaId: string;
  usuarioId: string;
  documentoId: string;
  nombreArchivo: string;
  motivo?: string;
}): Promise<void> {
  return crearNotificacion({
    empresaId: params.empresaId,
    usuarioId: params.usuarioId,
    tipo: "ocr",
    prioridad: "alta",
    titulo: "Documento rechazado",
    mensaje: `El documento "${params.nombreArchivo}" fue rechazado.${params.motivo ? " " + params.motivo : ""}`,
    urlDestino: "/documentos",
    metadata: {
      documento_id: params.documentoId,
      nombre_archivo: params.nombreArchivo,
      motivo: params.motivo,
    },
  });
}

/** Documento inválido — cuando el OCR no puede procesar el documento */
export async function notificarDocumentoInvalido(params: {
  empresaId: string;
  usuarioId: string;
  documentoId: string;
  nombreArchivo: string;
}): Promise<void> {
  return crearNotificacion({
    empresaId: params.empresaId,
    usuarioId: params.usuarioId,
    tipo: "ocr",
    prioridad: "media",
    titulo: "Documento inválido",
    mensaje: `No se pudo procesar el documento "${params.nombreArchivo}". Verifica el formato del archivo.`,
    urlDestino: "/documentos",
    metadata: {
      documento_id: params.documentoId,
      nombre_archivo: params.nombreArchivo,
    },
  });
}

/** Proyecto sin presupuesto — alerta cuando se agrega un gasto a un proyecto sin presupuesto */
export async function notificarProyectoSinPresupuesto(params: {
  empresaId: string;
  usuarioId: string;
  proyectoId: string;
  proyectoNombre: string;
}): Promise<void> {
  return crearNotificacion({
    empresaId: params.empresaId,
    usuarioId: params.usuarioId,
    tipo: "presupuesto",
    prioridad: "media",
    titulo: "Proyecto sin presupuesto asignado",
    mensaje: `El proyecto "${params.proyectoNombre}" no tiene presupuesto activo para el año en curso.`,
    urlDestino: "/presupuestos",
    metadata: {
      proyecto_id: params.proyectoId,
      proyecto_nombre: params.proyectoNombre,
    },
  });
}
