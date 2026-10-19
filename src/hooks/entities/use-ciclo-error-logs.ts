/**
 * use-ciclo-error-logs.ts
 * Hooks React Query para el módulo de Error Logs de Ciclotrón.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/contexts/company-context";
import {
  getErrorLogs,
  getErrorLogCompleto,
  subirErrorLog,
  eliminarErrorLog,
  getFaultResumen,
  getFaultHistorial,
  getOsCorrectivas,
  type SubirLogParams,
} from "@/services/servicio-tecnico/ciclo-error-logs";

// ── Queries ───────────────────────────────────────────────────────────────────

/** Lista los logs (sin eventos) de un ciclotrón */
export function useErrorLogs(ciclotrónId: string | null) {
  const { empresaActiva } = useCompany();
  return useQuery({
    queryKey: ["ciclo_error_logs", empresaActiva?.id, ciclotrónId],
    queryFn:  () => getErrorLogs(empresaActiva!.id, ciclotrónId!),
    enabled:  !!empresaActiva?.id && !!ciclotrónId,
  });
}

/** Log completo con todos sus eventos */
export function useErrorLogCompleto(logId: string | null) {
  return useQuery({
    queryKey: ["ciclo_error_log_completo", logId],
    queryFn:  () => getErrorLogCompleto(logId!),
    enabled:  !!logId,
  });
}

/** Resumen histórico de faults del ciclotrón (últimos 90 días por defecto) */
export function useFaultResumen(ciclotrónId: string | null, diasAtras = 90) {
  return useQuery({
    queryKey: ["ciclo_fault_resumen", ciclotrónId, diasAtras],
    queryFn:  () => getFaultResumen(ciclotrónId!, diasAtras),
    enabled:  !!ciclotrónId,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

/** Historial de ocurrencias de un fault específico */
export function useFaultHistorial(ciclotrónId: string | null, clave: string | null) {
  return useQuery({
    queryKey: ["ciclo_fault_historial", ciclotrónId, clave],
    queryFn:  () => getFaultHistorial(ciclotrónId!, clave!),
    enabled:  !!ciclotrónId && !!clave,
    staleTime: 5 * 60 * 1000,
  });
}

/** OS correctivas previas de un equipo (para conexión fault → resolución) */
export function useOsCorrectivasPrevias(equipoId: string | null) {
  return useQuery({
    queryKey: ["os_correctivas_previas", equipoId],
    queryFn:  () => getOsCorrectivas(equipoId!),
    enabled:  !!equipoId,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Mutaciones ────────────────────────────────────────────────────────────────

/** Sube un log parseado a la DB */
export function useSubirErrorLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: SubirLogParams) => subirErrorLog(params),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({
        queryKey: ["ciclo_error_logs", vars.empresa_id, vars.ciclotrón_id],
      });
      void qc.invalidateQueries({
        queryKey: ["ciclo_fault_resumen", vars.ciclotrón_id],
      });
    },
  });
}

/** Elimina un log */
export function useEliminarErrorLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; ciclotrónId: string; empresaId: string }) =>
      eliminarErrorLog(id),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({
        queryKey: ["ciclo_error_logs", vars.empresaId, vars.ciclotrónId],
      });
      void qc.invalidateQueries({
        queryKey: ["ciclo_fault_resumen", vars.ciclotrónId],
      });
    },
  });
}
