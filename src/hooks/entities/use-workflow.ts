/**
 * use-workflow.ts
 * Todos los hooks del motor de workflow.
 * Consumen workflow-read.ts, workflow-actions.ts y permissions.ts.
 * Los componentes nunca acceden a Supabase directamente.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/auth-context";
import { useCompany } from "@/contexts/company-context";

import {
  getWorkflows,
  getWorkflowPasos,
  getAccionesAprobacion,
  getPasoActual,
  getMisAprobacionesPendientes,
  getAprobacionesByRendicion,
  getHistorialByRendicion,
  getComentariosByRendicion,
} from "@/services/workflow-read";

import { enviarAprobacion, registrarAccion, agregarComentario } from "@/services/workflow-actions";

import { getRolUsuarioEnEmpresa } from "@/services/permissions";

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

export function useWorkflows() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["workflows", empresaActivaId],
    queryFn: () => getWorkflows(empresaActivaId!),
    enabled: !!empresaActivaId,
  });
}

export function useWorkflowPasos(workflowId: string | null | undefined) {
  return useQuery({
    queryKey: ["workflow-pasos", workflowId],
    queryFn: () => getWorkflowPasos(workflowId!),
    enabled: !!workflowId,
  });
}

export function useAccionesAprobacion() {
  return useQuery({
    queryKey: ["acciones-aprobacion"],
    queryFn: getAccionesAprobacion,
    staleTime: Infinity, // catálogo estático
  });
}

export function usePasoActual(rendicionId: string | null | undefined) {
  return useQuery({
    queryKey: ["workflow-paso-actual", rendicionId],
    queryFn: () => getPasoActual(rendicionId!),
    enabled: !!rendicionId,
  });
}

export function useMisAprobacionesPendientes() {
  const { user } = useAuth();
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["mis-aprobaciones-pendientes", user?.id, empresaActivaId],
    queryFn: () => getMisAprobacionesPendientes(user!.id, empresaActivaId!),
    enabled: !!user?.id && !!empresaActivaId,
    refetchInterval: 60_000, // actualizar cada minuto
  });
}

export function useAprobacionesRendicion(rendicionId: string | null | undefined) {
  return useQuery({
    queryKey: ["aprobaciones", rendicionId],
    queryFn: () => getAprobacionesByRendicion(rendicionId!),
    enabled: !!rendicionId,
  });
}

export function useHistorialRendicion(rendicionId: string | null | undefined) {
  return useQuery({
    queryKey: ["historial-workflow", rendicionId],
    queryFn: () => getHistorialByRendicion(rendicionId!),
    enabled: !!rendicionId,
  });
}

export function useComentariosRendicion(rendicionId: string | null | undefined) {
  return useQuery({
    queryKey: ["comentarios-workflow", rendicionId],
    queryFn: () => getComentariosByRendicion(rendicionId!),
    enabled: !!rendicionId,
  });
}

// ---------------------------------------------------------------------------
// Permisos del usuario actual
// ---------------------------------------------------------------------------

export function useRolUsuarioEnEmpresa() {
  const { user } = useAuth();
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["rol-usuario-empresa", user?.id, empresaActivaId],
    queryFn: () => getRolUsuarioEnEmpresa(user!.id, empresaActivaId!),
    enabled: !!user?.id && !!empresaActivaId,
    staleTime: 5 * 60_000, // 5 minutos
  });
}

// ---------------------------------------------------------------------------
// Mutaciones
// ---------------------------------------------------------------------------

export function useEnviarAprobacion() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { empresaActivaId } = useCompany();

  return useMutation({
    mutationFn: (rendicionId: string) =>
      enviarAprobacion({
        rendicionId,
        usuarioId: user!.id,
        empresaId: empresaActivaId!,
      }),
    onSuccess: (_data, rendicionId) => {
      void qc.invalidateQueries({ queryKey: ["rendiciones"] });
      void qc.invalidateQueries({ queryKey: ["historial-workflow", rendicionId] });
      void qc.invalidateQueries({ queryKey: ["workflow-paso-actual", rendicionId] });
      void qc.invalidateQueries({ queryKey: ["mis-aprobaciones-pendientes"] });
    },
  });
}

export function useRegistrarAccion() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { empresaActivaId } = useCompany();

  return useMutation({
    mutationFn: (params: {
      rendicionId: string;
      workflowPasoId: string;
      accionCodigo: "aprobar" | "rechazar" | "devolver";
      comentario: string | null;
    }) =>
      registrarAccion({
        ...params,
        usuarioId: user!.id,
        empresaId: empresaActivaId!,
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["rendiciones"] });
      void qc.invalidateQueries({ queryKey: ["aprobaciones", vars.rendicionId] });
      void qc.invalidateQueries({ queryKey: ["historial-workflow", vars.rendicionId] });
      void qc.invalidateQueries({ queryKey: ["workflow-paso-actual", vars.rendicionId] });
      void qc.invalidateQueries({ queryKey: ["mis-aprobaciones-pendientes"] });
    },
  });
}

export function useAgregarComentario() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { empresaActivaId } = useCompany();

  return useMutation({
    mutationFn: (params: { rendicionId: string; comentario: string }) =>
      agregarComentario({
        ...params,
        usuarioId: user!.id,
        empresaId: empresaActivaId!,
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["comentarios-workflow", vars.rendicionId] });
    },
  });
}
