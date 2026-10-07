import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/contexts/company-context";
import {
  getEmbarques,
  getEmbarque,
  crearEmbarque,
  actualizarEmbarque,
  eliminarEmbarque,
  prorratearCostos,
  vincularCosteoEmbarque,
  type EmbarquePayload,
  type LineaPayload,
} from "@/services/importaciones-embarques";

const QUERY_KEY = "embarques";

export function useEmbarques() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: [QUERY_KEY, empresaActivaId],
    queryFn: () => getEmbarques(empresaActivaId!),
    enabled: !!empresaActivaId,
  });
}

export function useEmbarque(id: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, "detail", id],
    queryFn: () => getEmbarque(id!),
    enabled: !!id,
  });
}

export function useCrearEmbarque() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({
      datos,
      lineas,
    }: {
      datos: EmbarquePayload;
      lineas: LineaPayload[];
    }) => crearEmbarque(empresaActivaId!, datos, lineas),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useActualizarEmbarque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      datos,
      lineas,
    }: {
      id: string;
      datos: Partial<EmbarquePayload>;
      lineas?: LineaPayload[];
    }) => actualizarEmbarque(id, datos, lineas),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useEliminarEmbarque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarEmbarque(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useProrratearCostos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (importacion_id: string) => prorratearCostos(importacion_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useVincularCosteoEmbarque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      embarque_id,
      costeo_id,
    }: {
      embarque_id: string;
      costeo_id: string;
    }) => vincularCosteoEmbarque(embarque_id, costeo_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
