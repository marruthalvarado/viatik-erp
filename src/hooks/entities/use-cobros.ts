/**
 * use-cobros.ts - Hooks para cobros de facturas emitidas.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listarCobros,
  crearCobro,
  crearCobrosLote,
  eliminarCobro,
  getCobrosAgregadosPorEmpresa,
  getResumenCobros,
} from "@/services/cobros";
import type { CobroInsert } from "@/types/entities";

const KEY = (facturaId: string) => ["cobros", facturaId] as const;

export function useCobros(facturaId: string | null | undefined) {
  return useQuery({
    queryKey: KEY(facturaId ?? ""),
    queryFn: () => listarCobros(facturaId!),
    enabled: !!facturaId,
  });
}

export function useCrearCobro(facturaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CobroInsert) => crearCobro(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY(facturaId) });
      void qc.invalidateQueries({ queryKey: ["facturas_emitidas"] });
      void qc.invalidateQueries({ queryKey: ["cobros_agregados"] });
      void qc.invalidateQueries({ queryKey: ["resumen_cobros"] });
    },
  });
}

export function useEliminarCobro(facturaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarCobro(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY(facturaId) });
      void qc.invalidateQueries({ queryKey: ["facturas_emitidas"] });
      void qc.invalidateQueries({ queryKey: ["cobros_agregados"] });
      void qc.invalidateQueries({ queryKey: ["resumen_cobros"] });
    },
  });
}

/** Crea múltiples cobros de una sola vez (reconciliación bancaria). */
export function useCrearCobrosLote(empresaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payloads: CobroInsert[]) => crearCobrosLote(payloads),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["facturas_emitidas"] });
      void qc.invalidateQueries({ queryKey: ["cobros_agregados", empresaId] });
      void qc.invalidateQueries({ queryKey: ["resumen_cobros", empresaId] });
    },
  });
}

/** Mapa facturaId -> monto_cobrado para toda la empresa (un solo query). */
export function useCobrosAgregados(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["cobros_agregados", empresaId],
    queryFn: () => getCobrosAgregadosPorEmpresa(empresaId!),
    enabled: !!empresaId,
  });
}

/** Resumen completo de cuentas por cobrar para el dashboard BI. */
export function useResumenCobros(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["resumen_cobros", empresaId],
    queryFn: () => getResumenCobros(empresaId!),
    enabled: !!empresaId,
  });
}
