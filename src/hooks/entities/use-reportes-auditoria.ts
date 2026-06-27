/**
 * Hooks React Query para reportes de auditoría — FASE 8A
 *
 * Wrappea src/services/reportes-auditoria.ts.
 * staleTime auditoría: 2 minutos (120_000 ms) — dato sensible a cambios frecuentes.
 */

import { useQuery } from "@tanstack/react-query";
import { getRptCumplimientoPoliticas } from "@/services/reportes-auditoria";
import type { FiltroCumplimientoPoliticas } from "@/types/reportes";

const STALE_AUDITORIA = 2 * 60 * 1000; // 2 minutos

// =============================================================================
// RPT-AUD-04: Cumplimiento de políticas
// =============================================================================

/**
 * Hook para RPT-AUD-04: gastos vs topes de política con excedente calculado.
 * Se activa cuando `filtros.empresa_id` está presente.
 */
export function useRptCumplimientoPoliticas(filtros: FiltroCumplimientoPoliticas | null) {
  return useQuery({
    queryKey: ["reportes", "auditoria", "cumplimiento_politicas", filtros],
    queryFn: () => getRptCumplimientoPoliticas(filtros!),
    enabled: !!filtros?.empresa_id,
    staleTime: STALE_AUDITORIA,
  });
}
