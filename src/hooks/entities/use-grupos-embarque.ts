import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/contexts/company-context";
import {
  getGruposEmbarque,
  crearGrupoEmbarque,
  actualizarGrupoEmbarque,
  eliminarGrupoEmbarque,
  vincularImportacionAGrupo,
  desvincularImportacionDeGrupo,
  prorratearGrupoEmbarque,
  recibirEmbarque,
  type GrupoPayload,
} from "@/services/importaciones-grupo";

const QUERY_KEY = "grupos_embarque";
const EMBARQUES_KEY = "embarques";

export function useGruposEmbarque() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: [QUERY_KEY, empresaActivaId],
    queryFn: () => getGruposEmbarque(empresaActivaId!),
    enabled: !!empresaActivaId,
  });
}

export function useCrearGrupoEmbarque() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: (payload: GrupoPayload) => crearGrupoEmbarque(empresaActivaId!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useActualizarGrupoEmbarque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<GrupoPayload> }) =>
      actualizarGrupoEmbarque(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useEliminarGrupoEmbarque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarGrupoEmbarque(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [EMBARQUES_KEY] });
    },
  });
}

export function useVincularImportacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ importacionId, grupoId }: { importacionId: string; grupoId: string }) =>
      vincularImportacionAGrupo(importacionId, grupoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [EMBARQUES_KEY] });
    },
  });
}

export function useDesvincularImportacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (importacionId: string) => desvincularImportacionDeGrupo(importacionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [EMBARQUES_KEY] });
    },
  });
}

export function useProrratearGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (grupoId: string) => prorratearGrupoEmbarque(grupoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [EMBARQUES_KEY] });
    },
  });
}

export function useRecibirEmbarque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (importacionId: string) => recibirEmbarque(importacionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [EMBARQUES_KEY] });
    },
  });
}
