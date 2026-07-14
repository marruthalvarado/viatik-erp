/**
 * Servicio CRUD para facturas_emitidas.
 * Incluye consultas de resumen por año/mes para Dashboard.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/types/database";

export type FacturaEmitida = Tables<"facturas_emitidas">;

// ─── CRUD básico ──────────────────────────────────────────────────────────────

export async function getFacturasEmitidas(
  empresaId: string,
  anio?: number,
  proyectoId?: string | null,
): Promise<FacturaEmitida[]> {
  let q = supabase
    .from("facturas_emitidas")
    .select("*")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .order("fecha", { ascending: false });

  if (anio) {
    q = q.gte("fecha", `${anio}-01-01`).lte("fecha", `${anio}-12-31`);
  }
  if (proyectoId !== undefined && proyectoId !== null) {
    q = q.eq("proyecto_id", proyectoId);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createFacturaEmitida(
  payload: Omit<FacturaEmitida, "id" | "created_at" | "updated_at" | "deleted_at">,
): Promise<FacturaEmitida> {
  const { data, error } = await supabase
    .from("facturas_emitidas")
    .insert(payload as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as FacturaEmitida;
}

export async function updateFacturaEmitida(
  id: string,
  payload: Partial<FacturaEmitida>,
): Promise<FacturaEmitida> {
  const { data, error } = await supabase
    .from("facturas_emitidas")
    .update(payload as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as FacturaEmitida;
}

export async function deleteFacturaEmitida(id: string): Promise<void> {
  const { error } = await supabase
    .from("facturas_emitidas")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Resumen financiero ───────────────────────────────────────────────────────

export interface ResumenFacturacionMensual {
  mes: string; // "YYYY-MM"
  label: string; // "Ene", "Feb", …
  total_facturado: number;
  num_facturas: number;
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export async function getFacturacionMensual(
  empresaId: string,
  anio: number,
): Promise<ResumenFacturacionMensual[]> {
  const { data, error } = await supabase
    .from("facturas_emitidas")
    .select("fecha, total")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .gte("fecha", `${anio}-01-01`)
    .lte("fecha", `${anio}-12-31`);

  if (error) throw new Error(error.message);

  // Agrupar por mes
  const map = new Map<number, { total: number; count: number }>();
  for (let m = 1; m <= 12; m++) map.set(m, { total: 0, count: 0 });

  for (const row of data ?? []) {
    const m = new Date(row.fecha + "T00:00:00").getMonth() + 1;
    const entry = map.get(m)!;
    entry.total += Number(row.total) || 0;
    entry.count += 1;
  }

  return Array.from(map.entries()).map(([m, { total, count }]) => ({
    mes: `${anio}-${String(m).padStart(2, "0")}`,
    label: MESES[m - 1],
    total_facturado: total,
    num_facturas: count,
  }));
}

export interface KpiFacturacion {
  total_anio: number;
  total_mes_actual: number;
  num_facturas_anio: number;
  num_clientes_distintos: number;
}

export async function getKpiFacturacion(empresaId: string, anio: number): Promise<KpiFacturacion> {
  const mesActual = new Date().getMonth() + 1;
  const inicioMes = `${anio}-${String(mesActual).padStart(2, "0")}-01`;
  const finMes = new Date(anio, mesActual, 0).toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("facturas_emitidas")
    .select("total, fecha, ruc_cliente")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .gte("fecha", `${anio}-01-01`)
    .lte("fecha", `${anio}-12-31`);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const total_anio = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
  const total_mes_actual = rows
    .filter((r) => r.fecha >= inicioMes && r.fecha <= finMes)
    .reduce((s, r) => s + (Number(r.total) || 0), 0);
  const num_facturas_anio = rows.length;
  const num_clientes_distintos = new Set(rows.map((r) => r.ruc_cliente).filter(Boolean)).size;

  return { total_anio, total_mes_actual, num_facturas_anio, num_clientes_distintos };
}

// ─── Facturado por proyecto ───────────────────────────────────────────────────

export async function getFacturadoPorProyecto(empresaId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("facturas_emitidas")
    .select("proyecto_id, total")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .not("proyecto_id", "is", null);

  if (error) throw new Error(error.message);

  const map = new Map<string, number>();
  for (const r of data ?? []) {
    if (!r.proyecto_id) continue;
    map.set(r.proyecto_id, (map.get(r.proyecto_id) ?? 0) + (Number(r.total) || 0));
  }
  return map;
}
