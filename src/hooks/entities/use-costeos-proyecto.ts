/**
 * use-costeos-proyecto.ts
 * Hooks React para el módulo Costeo de Proyecto.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/contexts/company-context";
import {
  getCosteosByProyectoId,
  getCosteoProyecto,
  getCosteosByProyecto,
  crearCosteoProyecto,
  actualizarCosteoProyecto,
  importarItemsDesdeCotizacion,
  type CosteoProyectoDatos,
  type CosteoProyectoItemPayload,
} from "@/services/costeos-proyecto";

const QK = "costeos_proyecto";

// ── Queries ───────────────────────────────────────────────────────────────────

export function useCosteoProyectos() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: [QK, empresaActivaId],
    queryFn: () => getCosteosByProyectoId(empresaActivaId!),
    enabled: !!empresaActivaId,
  });
}

export function useCosteoProyecto(id: string | null | undefined) {
  return useQuery({
    queryKey: [QK, "detail", id],
    queryFn: () => getCosteoProyecto(id!),
    enabled: !!id,
  });
}

export function useCosteosByProyecto(proyecto_id: string | null | undefined) {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: [QK, "by_proyecto", empresaActivaId, proyecto_id],
    queryFn: () => getCosteosByProyecto(empresaActivaId!, proyecto_id!),
    enabled: !!empresaActivaId && !!proyecto_id,
  });
}

// ── Mutaciones ────────────────────────────────────────────────────────────────

export function useCrearCosteoProyecto() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({
      datos,
      items,
    }: {
      datos: CosteoProyectoDatos;
      items: CosteoProyectoItemPayload[];
    }) => crearCosteoProyecto(empresaActivaId!, datos, items),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK, empresaActivaId] }),
  });
}

export function useActualizarCosteoProyecto() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({
      id,
      datos,
      items,
    }: {
      id: string;
      datos: CosteoProyectoDatos;
      items: CosteoProyectoItemPayload[];
    }) => actualizarCosteoProyecto(id, datos, items),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: [QK, empresaActivaId] });
      void qc.invalidateQueries({ queryKey: [QK, "detail", id] });
    },
  });
}

export function useImportarItemsDesdeCotizacion() {
  return useMutation({
    mutationFn: (cotizacion_id: string) =>
      importarItemsDesdeCotizacion(cotizacion_id),
  });
}
