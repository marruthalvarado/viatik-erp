/**
 * ciclo-error-logs.ts
 * Servicio CRUD para la tabla ciclo_error_logs.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CicloErrorLog, EventoLog, CicloFaultResumen } from "@/types/entities";

// ── Mapeo DB → Entidad ────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): CicloErrorLog {
  return {
    id:               row.id as string,
    empresa_id:       row.empresa_id as string,
    ciclotrón_id:     row["ciclotrón_id"] as string,
    archivo_nombre:   row.archivo_nombre as string,
    fecha_inicio:     (row.fecha_inicio as string | null) ?? null,
    fecha_fin:        (row.fecha_fin as string | null) ?? null,
    total_eventos:    (row.total_eventos as number) ?? 0,
    total_faults:     (row.total_faults as number) ?? 0,
    total_warnings:   (row.total_warnings as number) ?? 0,
    total_info:       (row.total_info as number) ?? 0,
    eventos:          (row.eventos as EventoLog[]) ?? [],
    created_at:       row.created_at as string,
    updated_at:       row.updated_at as string,
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Lista los logs de un ciclotrón, sin los eventos (para la lista) */
export async function getErrorLogs(
  empresaId: string,
  ciclotrónId: string
): Promise<CicloErrorLog[]> {
  const { data, error } = await supabase
    .from("ciclo_error_logs")
    .select("id, empresa_id, ciclotrón_id, archivo_nombre, fecha_inicio, fecha_fin, total_eventos, total_faults, total_warnings, total_info, created_at, updated_at")
    .eq("empresa_id", empresaId)
    .eq("ciclotrón_id", ciclotrónId)
    .order("fecha_inicio", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(row => mapRow({ ...row, eventos: [] }));
}

/** Obtiene un log completo con todos sus eventos */
export async function getErrorLogCompleto(id: string): Promise<CicloErrorLog | null> {
  const { data, error } = await supabase
    .from("ciclo_error_logs")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data ? mapRow(data as Record<string, unknown>) : null;
}

// ── Mutaciones ────────────────────────────────────────────────────────────────

export interface SubirLogParams {
  empresa_id:     string;
  ciclotrón_id:   string;
  archivo_nombre: string;
  fecha_inicio:   string | null;
  fecha_fin:      string | null;
  total_eventos:  number;
  total_faults:   number;
  total_warnings: number;
  total_info:     number;
  eventos:        EventoLog[];
}

/** Guarda un log parseado en la base de datos */
export async function subirErrorLog(params: SubirLogParams): Promise<CicloErrorLog> {
  const { data, error } = await supabase
    .from("ciclo_error_logs")
    .insert({
      empresa_id:     params.empresa_id,
      "ciclotrón_id": params.ciclotrón_id,
      archivo_nombre: params.archivo_nombre,
      fecha_inicio:   params.fecha_inicio,
      fecha_fin:      params.fecha_fin,
      total_eventos:  params.total_eventos,
      total_faults:   params.total_faults,
      total_warnings: params.total_warnings,
      total_info:     params.total_info,
      eventos:        params.eventos,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

/** Elimina un log */
export async function eliminarErrorLog(id: string): Promise<void> {
  const { error } = await supabase
    .from("ciclo_error_logs")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ── RPCs de análisis histórico ────────────────────────────────────────────────

/** Obtiene el resumen de faults históricos de un ciclotrón (últimos N días) */
export async function getFaultResumen(
  ciclotrónId: string,
  diasAtras = 90
): Promise<CicloFaultResumen[]> {
  const { data, error } = await supabase.rpc("ciclo_fault_resumen", {
    p_ciclotrón_id: ciclotrónId,
    p_dias_atras:   diasAtras,
  });
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    clave:       r.clave as string,
    subsistema:  r.subsistema as CicloFaultResumen["subsistema"],
    tipo:        r.tipo as CicloFaultResumen["tipo"],
    total:       Number(r.total),
    primera_vez: r.primera_vez as string,
    ultima_vez:  r.ultima_vez as string,
    mensaje_ref: r.mensaje_ref as string,
  }));
}

/** Obtiene el historial de ocurrencias de un fault específico */
export async function getFaultHistorial(
  ciclotrónId: string,
  clave: string,
  limite = 50
): Promise<Array<{ log_id: string; archivo: string; fecha_ts: string; mensaje: string; codigo: number }>> {
  const { data, error } = await supabase.rpc("ciclo_fault_historial", {
    p_ciclotrón_id: ciclotrónId,
    p_clave:        clave,
    p_limite:       limite,
  });
  if (error) throw error;
  return data ?? [];
}

/** Obtiene OS correctivas previas de un equipo para cruzar con faults */
export async function getOsCorrectivas(
  equipoId: string,
  limite = 10
): Promise<Array<{ id: string; numero: string; descripcion_problema: string | null; diagnostico: string | null; fecha_programada: string | null }>> {
  const { data, error } = await supabase
    .from("ordenes_servicio")
    .select("id, numero, descripcion_problema, diagnostico, fecha_programada")
    .eq("equipo_id", equipoId)
    .eq("tipo", "correctivo")
    .order("fecha_programada", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data ?? [];
}
