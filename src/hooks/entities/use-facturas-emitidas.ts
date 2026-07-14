/**
 * Hooks React Query para el módulo Facturas Emitidas.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFacturasEmitidas,
  createFacturaEmitida,
  updateFacturaEmitida,
  deleteFacturaEmitida,
  getFacturacionMensual,
  getKpiFacturacion,
} from "@/services/facturas-emitidas";
import type { FacturaEmitida } from "@/services/facturas-emitidas";

// ─── Listado ──────────────────────────────────────────────────────────────────

export function useFacturasEmitidas(
  empresaId: string | null,
  anio?: number,
  proyectoId?: string | null,
) {
  return useQuery({
    queryKey: ["facturas_emitidas", empresaId, anio, proyectoId],
    queryFn: () => getFacturasEmitidas(empresaId!, anio, proyectoId),
    enabled: !!empresaId,
  });
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export function useKpiFacturacion(empresaId: string | null, anio: number) {
  return useQuery({
    queryKey: ["facturas_emitidas", "kpi", empresaId, anio],
    queryFn: () => getKpiFacturacion(empresaId!, anio),
    enabled: !!empresaId,
  });
}

// ─── Evolución mensual ────────────────────────────────────────────────────────

export function useFacturacionMensual(empresaId: string | null, anio: number) {
  return useQuery({
    queryKey: ["facturas_emitidas", "mensual", empresaId, anio],
    queryFn: () => getFacturacionMensual(empresaId!, anio),
    enabled: !!empresaId,
  });
}

// ─── Mutaciones ───────────────────────────────────────────────────────────────

export function useCrearFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createFacturaEmitida,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facturas_emitidas"] });
      qc.invalidateQueries({ queryKey: ["presupuestos", "resumen_financiero"] });
    },
  });
}

export function useActualizarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<FacturaEmitida> }) =>
      updateFacturaEmitida(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facturas_emitidas"] });
      qc.invalidateQueries({ queryKey: ["presupuestos", "resumen_financiero"] });
    },
  });
}

export function useEliminarFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteFacturaEmitida,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facturas_emitidas"] });
      qc.invalidateQueries({ queryKey: ["presupuestos", "resumen_financiero"] });
    },
  });
}
