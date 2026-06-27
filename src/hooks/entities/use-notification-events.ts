/**
 * use-notification-events.ts — FASE 9B
 *
 * Hook que expone mutaciones para generar notificaciones
 * desde el lado TypeScript (eventos que no pasan por triggers PG).
 *
 * Arquitectura: Componente → Hook → Service → Supabase
 *
 * Uso típico:
 *   const { notificarError } = useNotificationEvents();
 *   notificarError.mutate({ descripcion: "Fallo al procesar PDF" });
 */
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useCompany } from "@/contexts/company-context";
import {
  notificarErrorCritico,
  notificarIA,
  notificarGastoRechazado,
  notificarGastoObservado,
  notificarDocumentoRechazado,
  notificarDocumentoInvalido,
  notificarProyectoSinPresupuesto,
} from "@/services/notifications/notifications-create";

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

export function useNotificationEvents() {
  const { user } = useAuth();
  const { empresaActivaId } = useCompany();

  const empresaId = empresaActivaId ?? "";
  const usuarioId = user?.id ?? "";

  // ── Error crítico ─────────────────────────────────────────────────────────
  const notificarError = useMutation({
    mutationFn: (params: { descripcion: string; contexto?: Record<string, unknown> }) =>
      notificarErrorCritico({ empresaId, usuarioId, ...params }),
  });

  // ── Sugerencia / alerta IA ────────────────────────────────────────────────
  const notificarSugerenciaIA = useMutation({
    mutationFn: (params: {
      titulo: string;
      mensaje: string;
      urlDestino?: string;
      metadata?: Record<string, unknown>;
    }) => notificarIA({ empresaId, usuarioId, ...params }),
  });

  // ── Gasto rechazado ───────────────────────────────────────────────────────
  const notificarRechazarGasto = useMutation({
    mutationFn: (params: { gastoId: string; numeroDocumento: string; motivo?: string }) =>
      notificarGastoRechazado({ empresaId, usuarioId, ...params }),
  });

  // ── Gasto observado ───────────────────────────────────────────────────────
  const notificarObservarGasto = useMutation({
    mutationFn: (params: { gastoId: string; numeroDocumento: string; observacion: string }) =>
      notificarGastoObservado({ empresaId, usuarioId, ...params }),
  });

  // ── Documento rechazado ───────────────────────────────────────────────────
  const notificarRechazarDocumento = useMutation({
    mutationFn: (params: { documentoId: string; nombreArchivo: string; motivo?: string }) =>
      notificarDocumentoRechazado({ empresaId, usuarioId, ...params }),
  });

  // ── Documento inválido ────────────────────────────────────────────────────
  const notificarDocInvalido = useMutation({
    mutationFn: (params: { documentoId: string; nombreArchivo: string }) =>
      notificarDocumentoInvalido({ empresaId, usuarioId, ...params }),
  });

  // ── Proyecto sin presupuesto ──────────────────────────────────────────────
  const notificarSinPresupuesto = useMutation({
    mutationFn: (params: { proyectoId: string; proyectoNombre: string }) =>
      notificarProyectoSinPresupuesto({ empresaId, usuarioId, ...params }),
  });

  return {
    notificarError,
    notificarSugerenciaIA,
    notificarRechazarGasto,
    notificarObservarGasto,
    notificarRechazarDocumento,
    notificarDocInvalido,
    notificarSinPresupuesto,
  };
}
