/**
 * Servicios de reportes gerenciales — FASE 8A
 *
 * Solo lectura. Sin CRUD Factory. Sin INSERT/UPDATE/DELETE.
 * Patrón: Service → supabase.rpc()
 *
 * Reportes:
 *   · RPT-GER-01: Resumen ejecutivo  (RPC rpt_resumen_ejecutivo)
 *   · RPT-GER-05: Top proveedores    (RPC rpt_top_proveedores)
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  ParamsResumenEjecutivo,
  ResumenEjecutivoResponse,
  ParamsTopProveedores,
  TopProveedorRow,
} from "@/types/reportes";

// =============================================================================
// RPT-GER-01: Resumen ejecutivo
// =============================================================================

/**
 * KPIs consolidados del período: rendiciones, aprobaciones, score IA, anticipos.
 * Una sola llamada RPC — diseñada para el panel gerencial principal.
 * staleTime recomendado: 30 minutos.
 */
export async function getRptResumenEjecutivo(
  params: ParamsResumenEjecutivo,
): Promise<ResumenEjecutivoResponse> {
  const { data, error } = await supabase.rpc("rpt_resumen_ejecutivo", {
    p_empresa_id: params.p_empresa_id,
    p_fecha_desde: params.p_fecha_desde,
    p_fecha_hasta: params.p_fecha_hasta,
  });
  if (error) throw new Error(error.message);
  // El RPC retorna JSONB. Casteamos al shape conocido.
  return data as ResumenEjecutivoResponse;
}

// =============================================================================
// RPT-GER-05: Top proveedores
// =============================================================================

/**
 * Ranking de proveedores por gasto total en el período.
 * Incluye: nombre, país, ciudad, n_gastos, total, % del total, categoría principal.
 * staleTime recomendado: 30 minutos.
 */
export async function getRptTopProveedores(
  params: ParamsTopProveedores,
): Promise<TopProveedorRow[]> {
  const rpcParams: {
    p_empresa_id: string;
    p_fecha_desde: string;
    p_fecha_hasta: string;
    p_limite?: number;
  } = {
    p_empresa_id: params.p_empresa_id,
    p_fecha_desde: params.p_fecha_desde,
    p_fecha_hasta: params.p_fecha_hasta,
  };

  if (params.p_limite !== undefined) {
    rpcParams.p_limite = params.p_limite;
  }

  const { data, error } = await supabase.rpc("rpt_top_proveedores", rpcParams);
  if (error) throw new Error(error.message);
  return (data ?? []) as TopProveedorRow[];
}
