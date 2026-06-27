/**
 * Servicios de reportes de auditoría — FASE 8A
 *
 * Solo lectura. Sin CRUD Factory. Sin INSERT/UPDATE/DELETE.
 * Patrón: Service → supabase.from()
 *
 * Reportes:
 *   · RPT-AUD-04: Cumplimiento de políticas (vw_rpt_cumplimiento_politicas)
 */

import { supabase } from "@/integrations/supabase/client";
import type { FiltroCumplimientoPoliticas, CumplimientoPoliticaRow } from "@/types/reportes";

// =============================================================================
// RPT-AUD-04: Cumplimiento de políticas
// =============================================================================

/**
 * Devuelve gastos comparados contra el tope de política correspondiente.
 * Incluye el excedente calculado por la vista SQL.
 * Permite filtrar solo los gastos que exceden el tope.
 * staleTime recomendado: 2 minutos (dato de auditoría, sensible a cambios).
 */
export async function getRptCumplimientoPoliticas(
  filtros: FiltroCumplimientoPoliticas,
): Promise<CumplimientoPoliticaRow[]> {
  let query = supabase
    .from("vw_rpt_cumplimiento_politicas")
    .select("*")
    .eq("empresa_id", filtros.empresa_id)
    .gte("fecha", filtros.fecha_desde)
    .lte("fecha", filtros.fecha_hasta)
    .order("excedente", { ascending: false })
    .order("fecha", { ascending: false });

  if (filtros.usuario_id) {
    query = query.eq("usuario_id", filtros.usuario_id);
  }
  if (filtros.categoria_gasto_id) {
    query = query.eq("categoria_gasto_id", filtros.categoria_gasto_id);
  }
  if (filtros.politica_id) {
    query = query.eq("politica_id", filtros.politica_id);
  }
  if (filtros.solo_excedentes) {
    query = query.gt("excedente", 0);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CumplimientoPoliticaRow[];
}
