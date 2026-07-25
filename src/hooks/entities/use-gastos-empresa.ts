/**
 * Hooks React Query para el módulo Gastos de Empresa.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGastosEmpresa,
  createGastoEmpresa,
  updateGastoEmpresa,
  deleteGastoEmpresa,
  getKpiGastosEmpresa,
} from "@/services/gastos-empresa";
import type { GastoEmpresa, GastoEmpresaFiltros } from "@/services/gastos-empresa";

const QK = "gastos_empresa";

// ─── Listado ──────────────────────────────────────────────────────────────────

export function useGastosEmpresa(
  empresaId: string | null,
  filtros: GastoEmpresaFiltros = {},
) {
  return useQuery({
    queryKey: [QK, "list", empresaId, filtros],
    queryFn: () => getGastosEmpresa(empresaId!, filtros),
    enabled: !!empresaId,
  });
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export function useKpiGastosEmpresa(empresaId: string | null, anio: number) {
  return useQuery({
    queryKey: [QK, "kpi", empresaId, anio],
    queryFn: () => getKpiGastosEmpresa(empresaId!, anio),
    enabled: !!empresaId,
  });
}

// ─── Mutaciones ───────────────────────────────────────────────────────────────

export function useCrearGastoEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createGastoEmpresa,
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useActualizarGastoEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<GastoEmpresa> }) =>
      updateGastoEmpresa(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useEliminarGastoEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteGastoEmpresa,
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}
