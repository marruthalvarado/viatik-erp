/**
 * Servicios de reportes financieros — FASE 8A
 *
 * Solo lectura. Sin CRUD Factory. Sin INSERT/UPDATE/DELETE.
 * Patrón: Service → supabase.from() | supabase.rpc()
 *
 * Reportes:
 *   · RPT-FIN-01: Ejecución presupuestaria (vw_rpt_ejecucion_presupuestaria)
 *   · RPT-FIN-02: Evolución mensual        (RPC rpt_evolucion_mensual)
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  FiltroEjecucionPresupuestaria,
  EjecucionPresupuestariaRow,
  ParamsEvolucionMensual,
  EvolucionMensualRow,
} from "@/types/reportes";

// =============================================================================
// RPT-FIN-01: Ejecución presupuestaria
// =============================================================================

/**
 * Devuelve el estado de ejecución de cada categoría en cada presupuesto.
 * Incluye valor presupuestado, ejecutado, disponible y % de ejecución.
 * staleTime recomendado: 30 minutos (dato financiero).
 */
export async function getRptEjecucionPresupuestaria(
  filtros: FiltroEjecucionPresupuestaria,
): Promise<EjecucionPresupuestariaRow[]> {
  let query = supabase
    .from("vw_rpt_ejecucion_presupuestaria")
    .select("*")
    .eq("empresa_id", filtros.empresa_id)
    .order("anio", { ascending: false })
    .order("proyecto_nombre", { ascending: true });

  if (filtros.proyecto_id) {
    query = query.eq("proyecto_id", filtros.proyecto_id);
  }
  if (filtros.anio) {
    query = query.eq("anio", filtros.anio);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as EjecucionPresupuestariaRow[];
}

// =============================================================================
// RPT-FIN-02: Evolución mensual de gastos
// =============================================================================

/**
 * Serie temporal mensual de gastos facturados y reembolsables.
 * Útil para gráficas de tendencia (LineChart, BarChart).
 * staleTime recomendado: 30 minutos.
 */
export async function getRptEvolucionMensual(
  params: ParamsEvolucionMensual,
): Promise<EvolucionMensualRow[]> {
  const rpcParams: {
    p_empresa_id: string;
    p_anio_desde: number;
    p_anio_hasta: number;
    p_categoria_id?: string;
  } = {
    p_empresa_id: params.p_empresa_id,
    p_anio_desde: params.p_anio_desde,
    p_anio_hasta: params.p_anio_hasta,
  };

  if (params.p_categoria_id) {
    rpcParams.p_categoria_id = params.p_categoria_id;
  }

  const { data, error } = await supabase.rpc("rpt_evolucion_mensual", rpcParams);
  if (error) throw new Error(error.message);
  return (data ?? []) as EvolucionMensualRow[];
}
