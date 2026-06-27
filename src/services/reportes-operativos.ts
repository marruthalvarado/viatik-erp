/**
 * Servicios de reportes operativos — FASE 8A
 *
 * Solo lectura. Sin CRUD Factory. Sin INSERT/UPDATE/DELETE.
 * Patrón: Service → supabase.from() | supabase.rpc()
 *
 * Reportes:
 *   · RPT-OPS-01: Estado de rendiciones (vw_rpt_rendiciones_estado)
 *   · RPT-OPS-02: Detalle de gastos    (vw_rpt_gastos_detalle)
 *   · RPT-OPS-03: Detalle de viajes    (vw_rpt_viajes_detalle)
 *   · RPT-OPS-04: Anticipos            (vw_rpt_anticipos)
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  FiltroRendicionesEstado,
  RendicionEstadoRow,
  FiltroGastosDetalle,
  GastoDetalleRow,
  FiltroViajesDetalle,
  ViajeDetalleRow,
  FiltroAnticipos,
  AnticipoRow,
} from "@/types/reportes";

// =============================================================================
// RPT-OPS-01: Estado de rendiciones
// =============================================================================

/**
 * Devuelve todas las rendiciones de la empresa con estado, usuario y proyecto.
 * staleTime recomendado: 5 minutos (dato operativo).
 */
export async function getRptRendicionesEstado(
  filtros: FiltroRendicionesEstado,
): Promise<RendicionEstadoRow[]> {
  let query = supabase
    .from("vw_rpt_rendiciones_estado")
    .select("*")
    .eq("empresa_id", filtros.empresa_id)
    .gte("fecha_rendicion", filtros.fecha_desde)
    .lte("fecha_rendicion", filtros.fecha_hasta)
    .order("fecha_rendicion", { ascending: false });

  if (filtros.estado_codigo) {
    query = query.eq("estado_codigo", filtros.estado_codigo);
  }
  if (filtros.usuario_id) {
    query = query.eq("usuario_id", filtros.usuario_id);
  }
  if (filtros.proyecto_id) {
    query = query.eq("proyecto_id", filtros.proyecto_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as RendicionEstadoRow[];
}

// =============================================================================
// RPT-OPS-02: Detalle de gastos
// =============================================================================

/**
 * Devuelve gastos con categoría, proveedor y proyecto.
 * staleTime recomendado: 5 minutos.
 */
export async function getRptGastosDetalle(
  filtros: FiltroGastosDetalle,
): Promise<GastoDetalleRow[]> {
  let query = supabase
    .from("vw_rpt_gastos_detalle")
    .select("*")
    .eq("empresa_id", filtros.empresa_id)
    .gte("fecha", filtros.fecha_desde)
    .lte("fecha", filtros.fecha_hasta)
    .order("fecha", { ascending: false });

  if (filtros.categoria_gasto_id) {
    query = query.eq("categoria_gasto_id", filtros.categoria_gasto_id);
  }
  if (filtros.proveedor_id) {
    query = query.eq("proveedor_id", filtros.proveedor_id);
  }
  if (filtros.proyecto_id) {
    query = query.eq("proyecto_id", filtros.proyecto_id);
  }
  if (filtros.estado_codigo) {
    query = query.eq("estado_codigo", filtros.estado_codigo);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as GastoDetalleRow[];
}

// =============================================================================
// RPT-OPS-03: Detalle de viajes
// =============================================================================

/**
 * Devuelve viajes con país, proyecto y duración calculada.
 * staleTime recomendado: 5 minutos.
 */
export async function getRptViajesDetalle(
  filtros: FiltroViajesDetalle,
): Promise<ViajeDetalleRow[]> {
  let query = supabase
    .from("vw_rpt_viajes_detalle")
    .select("*")
    .eq("empresa_id", filtros.empresa_id)
    .gte("fecha_inicio", filtros.fecha_desde)
    .lte("fecha_inicio", filtros.fecha_hasta)
    .order("fecha_inicio", { ascending: false });

  if (filtros.usuario_id) {
    query = query.eq("usuario_id", filtros.usuario_id);
  }
  if (filtros.proyecto_id) {
    query = query.eq("proyecto_id", filtros.proyecto_id);
  }
  if (filtros.pais_id) {
    query = query.eq("pais_id", filtros.pais_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ViajeDetalleRow[];
}

// =============================================================================
// RPT-OPS-04: Anticipos
// =============================================================================

/**
 * Devuelve anticipos con estado de liquidación.
 * staleTime recomendado: 5 minutos.
 */
export async function getRptAnticipos(filtros: FiltroAnticipos): Promise<AnticipoRow[]> {
  let query = supabase
    .from("vw_rpt_anticipos")
    .select("*")
    .eq("empresa_id", filtros.empresa_id)
    .gte("fecha", filtros.fecha_desde)
    .lte("fecha", filtros.fecha_hasta)
    .order("fecha", { ascending: false });

  if (filtros.proyecto_id) {
    query = query.eq("proyecto_id", filtros.proyecto_id);
  }
  if (filtros.liquidado !== undefined) {
    query = query.eq("liquidado", filtros.liquidado);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AnticipoRow[];
}
