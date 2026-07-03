/**
 * use-rendicion-aprobacion.ts
 * Hooks para el flujo de aprobacion directa de rendiciones (Opcion B).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/auth-context";
import { useCompany } from "@/contexts/company-context";

import {
  enviarRendicion,
  aprobarRendicion,
  rechazarRendicion,
  getMisRendicionesPendientes,
  getAprobadoresDisponibles,
} from "@/services/rendicion-aprobacion";

// ---------------------------------------------------------------------------
// Query: aprobadores disponibles para la empresa
// ---------------------------------------------------------------------------
export function useAprobadoresDisponibles() {
  const { user } = useAuth();
  const { empresaActivaId } = useCompany();

  return useQuery({
    queryKey: ["aprobadores-disponibles", empresaActivaId, user?.id],
    queryFn: () => getAprobadoresDisponibles(empresaActivaId!, user!.id),
    enabled: !!empresaActivaId && !!user?.id,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Query: mis rendiciones pendientes de aprobacion
// ---------------------------------------------------------------------------
export function useMisRendicionesPendientes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["rendiciones-pendientes-aprobacion", user?.id],
    queryFn: getMisRendicionesPendientes,
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutation: enviar rendicion
// ---------------------------------------------------------------------------
export function useEnviarRendicion(rendicionId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (aprobadorId: string) => enviarRendicion(rendicionId, aprobadorId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rendicion", rendicionId] });
      void qc.invalidateQueries({ queryKey: ["rendiciones"] });
      void qc.invalidateQueries({ queryKey: ["rendiciones-pendientes-aprobacion"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: aprobar rendicion
// ---------------------------------------------------------------------------
export function useAprobarRendicion(rendicionId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (comentario?: string) => aprobarRendicion(rendicionId, comentario),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rendicion", rendicionId] });
      void qc.invalidateQueries({ queryKey: ["rendiciones"] });
      void qc.invalidateQueries({ queryKey: ["rendiciones-pendientes-aprobacion"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: rechazar rendicion
// ---------------------------------------------------------------------------
export function useRechazarRendicion(rendicionId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (motivo: string) => rechazarRendicion(rendicionId, motivo),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rendicion", rendicionId] });
      void qc.invalidateQueries({ queryKey: ["rendiciones"] });
      void qc.invalidateQueries({ queryKey: ["rendiciones-pendientes-aprobacion"] });
    },
  });
}
