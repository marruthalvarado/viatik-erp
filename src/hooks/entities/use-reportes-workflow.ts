/**
 * Hooks React Query para reportes de workflow — FASE 8A
 *
 * Wrappea src/services/reportes-workflow.ts.
 * staleTime workflow: 1 minuto (60_000 ms) — dato operativo de alta frecuencia.
 */

import { useQuery } from "@tanstack/react-query";
import { getRptAprobacionesEficiencia, getRptTiemposWorkflow } from "@/services/reportes-workflow";
import type { FiltroAprobacionesEficiencia, ParamsTiemposWorkflow } from "@/types/reportes";

const STALE_WORKFLOW = 1 * 60 * 1000; // 1 minuto

// =============================================================================
// RPT-WF-02/03: Eficiencia de aprobaciones
// =============================================================================

/**
 * Hook para RPT-WF-02/03: acciones de aprobación con aprobador, paso y workflow.
 * Se activa cuando `filtros.empresa_id` está presente.
 */
export function useRptAprobacionesEficiencia(filtros: FiltroAprobacionesEficiencia | null) {
  return useQuery({
    queryKey: ["reportes", "workflow", "aprobaciones_eficiencia", filtros],
    queryFn: () => getRptAprobacionesEficiencia(filtros!),
    enabled: !!filtros?.empresa_id,
    staleTime: STALE_WORKFLOW,
  });
}

// =============================================================================
// RPT-WF-02: Tiempos de ciclo
// =============================================================================

/**
 * Hook para RPT-WF-02: tiempos de espera por rendición.
 * Incluye horas totales, número de acciones y rechazos.
 * Se activa cuando `params.p_empresa_id` está presente.
 */
export function useRptTiemposWorkflow(params: ParamsTiemposWorkflow | null) {
  return useQuery({
    queryKey: ["reportes", "workflow", "tiempos_workflow", params],
    queryFn: () => getRptTiemposWorkflow(params!),
    enabled: !!params?.p_empresa_id,
    staleTime: STALE_WORKFLOW,
  });
}
