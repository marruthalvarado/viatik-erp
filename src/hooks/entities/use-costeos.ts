/**
 * use-costeos.ts
 * Hooks React para el módulo de Costeos de Importación.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/contexts/company-context";
import {
  getCosteos,
  getCosteo,
  crearCosteo,
  actualizarCosteo,
  eliminarCosteo,
  actualizarEstadoCosteo,
  sincronizarProductoCatalogoDesdeCosteо,
  type CosteoDatos,
  type CosteoComponentePayload,
  type EstadoCosteo,
} from "@/services/costeos";

const QK = (empresaId: string | undefined) => ["costeos", empresaId] as const;

export function useCosteos() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: QK(empresaActivaId ?? undefined),
    queryFn:  () => getCosteos(empresaActivaId!),
    enabled:  !!empresaActivaId,
  });
}

export function useCosteo(id: string | null | undefined) {
  return useQuery({
    queryKey: ["costeo", id],
    queryFn:  () => getCosteo(id!),
    enabled:  !!id,
  });
}

export function useCrearCosteo() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({
      datos,
      componentes,
    }: {
      datos:        CosteoDatos;
      componentes:  CosteoComponentePayload[];
    }) => crearCosteo(empresaActivaId!, datos, componentes),
    onSuccess: async (result, { datos }) => {
      // Auto-crear producto en catálogo si el costeo no tenía producto vinculado
      if (!datos.producto_id && empresaActivaId) {
        await sincronizarProductoCatalogoDesdeCosteо(
          result.id,
          empresaActivaId,
          datos.descripcion_producto,
          datos.proveedor_id,
          datos.pvp_privado,
        ).catch(() => {/* silencioso: no bloquear el flujo */});
      }
      void qc.invalidateQueries({ queryKey: QK(empresaActivaId ?? undefined) });
      void qc.invalidateQueries({ queryKey: ["productos_catalogo", empresaActivaId] });
    },
  });
}

export function useActualizarCosteo() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({
      id,
      datos,
      componentes,
    }: {
      id:           string;
      datos:        CosteoDatos;
      componentes:  CosteoComponentePayload[];
    }) => actualizarCosteo(id, datos, componentes),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: QK(empresaActivaId ?? undefined) });
      void qc.invalidateQueries({ queryKey: ["costeo", id] });
    },
  });
}

export function useEliminarCosteo() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: (id: string) => eliminarCosteo(id),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: QK(empresaActivaId ?? undefined) }),
  });
}

export function useActualizarEstadoCosteo() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoCosteo }) =>
      actualizarEstadoCosteo(id, estado),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: QK(empresaActivaId ?? undefined) });
      void qc.invalidateQueries({ queryKey: ["costeo", id] });
    },
  });
}
