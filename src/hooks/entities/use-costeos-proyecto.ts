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
  getComponentesProyectoItem,
  copiarComponentesAProyectoItem,
  sincronizarComponentesProyectoItem,
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

// ── Componentes por ítem de proyecto ─────────────────────────────────────────

const QK_COMP = "costeo_proyecto_item_componentes";

export function useComponentesProyectoItem(item_id: string | null | undefined) {
  return useQuery({
    queryKey: [QK_COMP, item_id],
    queryFn: () => getComponentesProyectoItem(item_id!),
    enabled: !!item_id,
  });
}

export function useCopiarComponentesAProyectoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ item_id, costeo_id }: { item_id: string; costeo_id: string }) =>
      copiarComponentesAProyectoItem(item_id, costeo_id),
    onSuccess: (_, { item_id }) => {
      void qc.invalidateQueries({ queryKey: [QK_COMP, item_id] });
    },
  });
}

export function useSincronizarComponentesProyectoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      item_id,
      componentes,
    }: {
      item_id: string;
      componentes: Array<{ componente_id: string; activo: boolean }>;
    }) => sincronizarComponentesProyectoItem(item_id, componentes),
    onSuccess: (_, { item_id }) => {
      void qc.invalidateQueries({ queryKey: [QK_COMP, item_id] });
    },
  });
}
