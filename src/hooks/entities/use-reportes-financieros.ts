/**
 * Hooks React Query para reportes financieros — FASE 8A
 *
 * Wrappea src/services/reportes-financieros.ts.
 * staleTime financiero: 30 minutos (1_800_000 ms).
 */

import { useQuery } from "@tanstack/react-query";
import {
  getRptEjecucionPresupuestaria,
  getRptEvolucionMensual,
} from "@/services/reportes-financieros";
import type { FiltroEjecucionPresupuestaria, ParamsEvolucionMensual } from "@/types/reportes";

const STALE_FINANCIERO = 30 * 60 * 1000; // 30 minutos

// =============================================================================
// RPT-FIN-01: Ejecución presupuestaria
// =============================================================================

/**
 * Hook para RPT-FIN-01: presupuesto vs ejecución por categoría y proyecto.
 * Se activa cuando `filtros.empresa_id` está presente.
 */
export function useRptEjecucionPresupuestaria(filtros: FiltroEjecucionPresupuestaria | null) {
  return useQuery({
    queryKey: ["reportes", "financieros", "ejecucion_presupuestaria", filtros],
    queryFn: () => getRptEjecucionPresupuestaria(filtros!),
    enabled: !!filtros?.empresa_id,
    staleTime: STALE_FINANCIERO,
  });
}

// =============================================================================
// RPT-FIN-02: Evolución mensual
// =============================================================================

/**
 * Hook para RPT-FIN-02: serie temporal de gastos por mes.
 * Se activa cuando `params.p_empresa_id` está presente.
 */
export function useRptEvolucionMensual(params: ParamsEvolucionMensual | null) {
  return useQuery({
    queryKey: ["reportes", "financieros", "evolucion_mensual", params],
    queryFn: () => getRptEvolucionMensual(params!),
    enabled: !!params?.p_empresa_id,
    staleTime: STALE_FINANCIERO,
  });
}
