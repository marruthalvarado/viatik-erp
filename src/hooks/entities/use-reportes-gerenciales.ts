/**
 * Hooks React Query para reportes gerenciales — FASE 8A
 *
 * Wrappea src/services/reportes-gerenciales.ts.
 * staleTime gerencial: 30 minutos (1_800_000 ms).
 */

import { useQuery } from "@tanstack/react-query";
import { getRptResumenEjecutivo, getRptTopProveedores } from "@/services/reportes-gerenciales";
import type { ParamsResumenEjecutivo, ParamsTopProveedores } from "@/types/reportes";

const STALE_GERENCIAL = 30 * 60 * 1000; // 30 minutos

// =============================================================================
// RPT-GER-01: Resumen ejecutivo
// =============================================================================

/**
 * Hook para RPT-GER-01: KPIs consolidados del período.
 * Una sola llamada RPC que agrega rendiciones, aprobaciones, score IA y anticipos.
 * Se activa cuando `params.p_empresa_id` está presente.
 */
export function useRptResumenEjecutivo(params: ParamsResumenEjecutivo | null) {
  return useQuery({
    queryKey: ["reportes", "gerenciales", "resumen_ejecutivo", params],
    queryFn: () => getRptResumenEjecutivo(params!),
    enabled: !!params?.p_empresa_id,
    staleTime: STALE_GERENCIAL,
  });
}

// =============================================================================
// RPT-GER-05: Top proveedores
// =============================================================================

/**
 * Hook para RPT-GER-05: ranking de proveedores por gasto total.
 * Se activa cuando `params.p_empresa_id` está presente.
 */
export function useRptTopProveedores(params: ParamsTopProveedores | null) {
  return useQuery({
    queryKey: ["reportes", "gerenciales", "top_proveedores", params],
    queryFn: () => getRptTopProveedores(params!),
    enabled: !!params?.p_empresa_id,
    staleTime: STALE_GERENCIAL,
  });
}
