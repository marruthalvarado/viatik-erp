/**
 * Hooks React Query para reportes operativos — FASE 8A
 *
 * Wrappea src/services/reportes-operativos.ts.
 * Patrón idéntico al de use-dashboard.ts.
 *
 * staleTime operativo: 5 minutos (300_000 ms).
 * Persistencia de filtros: localStorage bajo `viatik:reporte:operativos:filtros`.
 */

import { useQuery } from "@tanstack/react-query";
import {
  getRptRendicionesEstado,
  getRptGastosDetalle,
  getRptViajesDetalle,
  getRptAnticipos,
} from "@/services/reportes-operativos";
import type {
  FiltroRendicionesEstado,
  FiltroGastosDetalle,
  FiltroViajesDetalle,
  FiltroAnticipos,
} from "@/types/reportes";

const STALE_OPERATIVO = 5 * 60 * 1000; // 5 minutos

// =============================================================================
// RPT-OPS-01: Estado de rendiciones
// =============================================================================

/**
 * Hook para RPT-OPS-01: tabla de rendiciones con estado, usuario y proyecto.
 * Se activa cuando `filtros.empresa_id` está presente.
 */
export function useRptRendicionesEstado(filtros: FiltroRendicionesEstado | null) {
  return useQuery({
    queryKey: ["reportes", "operativos", "rendiciones_estado", filtros],
    queryFn: () => getRptRendicionesEstado(filtros!),
    enabled: !!filtros?.empresa_id,
    staleTime: STALE_OPERATIVO,
  });
}

// =============================================================================
// RPT-OPS-02: Detalle de gastos
// =============================================================================

/**
 * Hook para RPT-OPS-02: gastos con categoría, proveedor y proyecto.
 * Se activa cuando `filtros.empresa_id` está presente.
 */
export function useRptGastosDetalle(filtros: FiltroGastosDetalle | null) {
  return useQuery({
    queryKey: ["reportes", "operativos", "gastos_detalle", filtros],
    queryFn: () => getRptGastosDetalle(filtros!),
    enabled: !!filtros?.empresa_id,
    staleTime: STALE_OPERATIVO,
  });
}

// =============================================================================
// RPT-OPS-03: Detalle de viajes
// =============================================================================

/**
 * Hook para RPT-OPS-03: viajes con país, proyecto, usuario y duración.
 * Se activa cuando `filtros.empresa_id` está presente.
 */
export function useRptViajesDetalle(filtros: FiltroViajesDetalle | null) {
  return useQuery({
    queryKey: ["reportes", "operativos", "viajes_detalle", filtros],
    queryFn: () => getRptViajesDetalle(filtros!),
    enabled: !!filtros?.empresa_id,
    staleTime: STALE_OPERATIVO,
  });
}

// =============================================================================
// RPT-OPS-04: Anticipos
// =============================================================================

/**
 * Hook para RPT-OPS-04: anticipos con estado de liquidación.
 * Se activa cuando `filtros.empresa_id` está presente.
 */
export function useRptAnticipos(filtros: FiltroAnticipos | null) {
  return useQuery({
    queryKey: ["reportes", "operativos", "anticipos", filtros],
    queryFn: () => getRptAnticipos(filtros!),
    enabled: !!filtros?.empresa_id,
    staleTime: STALE_OPERATIVO,
  });
}
