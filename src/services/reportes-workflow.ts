/**
 * Servicios de reportes de workflow — FASE 8A
 *
 * Solo lectura. Sin CRUD Factory. Sin INSERT/UPDATE/DELETE.
 * Patrón: Service → supabase.from() | supabase.rpc()
 *
 * Reportes:
 *   · RPT-WF-02/03: Eficiencia de aprobaciones (vw_rpt_aprobaciones_eficiencia)
 *   · RPT-WF-02:    Tiempos de ciclo           (RPC rpt_tiempos_workflow)
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  FiltroAprobacionesEficiencia,
  AprobacionEficienciaRow,
  ParamsTiemposWorkflow,
  TiempoWorkflowRow,
} from "@/types/reportes";

// =============================================================================
// RPT-WF-02/03: Eficiencia de aprobaciones
// =============================================================================

/**
 * Devuelve cada acción de aprobación con aprobador, paso y workflow.
 * Útil para detectar cuellos de botella y patrones de rechazo.
 * staleTime recomendado: 1 minuto (workflow es dato operativo de alta frecuencia).
 */
export async function getRptAprobacionesEficiencia(
  filtros: FiltroAprobacionesEficiencia,
): Promise<AprobacionEficienciaRow[]> {
  let query = supabase
    .from("vw_rpt_aprobaciones_eficiencia")
    .select("*")
    .eq("empresa_id", filtros.empresa_id)
    .gte("fecha_accion", filtros.fecha_desde)
    .lte("fecha_accion", filtros.fecha_hasta)
    .order("fecha_accion", { ascending: false });

  if (filtros.aprobador_id) {
    query = query.eq("aprobador_id", filtros.aprobador_id);
  }
  if (filtros.workflow_id) {
    query = query.eq("workflow_id", filtros.workflow_id);
  }
  if (filtros.accion_codigo) {
    query = query.eq("accion_codigo", filtros.accion_codigo);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AprobacionEficienciaRow[];
}

// =============================================================================
// RPT-WF-02: Tiempos de ciclo de workflow
// =============================================================================

/**
 * Calcula tiempos de espera por rendición: horas totales, n_acciones, n_rechazos.
 * Retorna solo rendiciones enviadas en el período.
 * staleTime recomendado: 1 minuto.
 */
export async function getRptTiemposWorkflow(
  params: ParamsTiemposWorkflow,
): Promise<TiempoWorkflowRow[]> {
  const { data, error } = await supabase.rpc("rpt_tiempos_workflow", {
    p_empresa_id: params.p_empresa_id,
    p_fecha_desde: params.p_fecha_desde,
    p_fecha_hasta: params.p_fecha_hasta,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as TiempoWorkflowRow[];
}
