/**
 * Servicio CRUD para gastos_empresa.
 * Gastos operativos de la empresa, independientes de rendiciones de viaje.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/types/database";

export type GastoEmpresa = Tables<"gastos_empresa">;

export interface GastoEmpresaFiltros {
  anio?: number;
  categoriaId?: string | null;
  responsable?: string | null;
  soloDeducibles?: boolean;
  proyectoId?: string | null;
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

export async function getGastosEmpresa(
  empresaId: string,
  filtros: GastoEmpresaFiltros = {},
): Promise<GastoEmpresa[]> {
  let q = supabase
    .from("gastos_empresa")
    .select("*")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .order("fecha", { ascending: false });

  if (filtros.anio) {
    q = q
      .gte("fecha", `${filtros.anio}-01-01`)
      .lte("fecha", `${filtros.anio}-12-31`);
  }
  if (filtros.categoriaId) {
    q = q.eq("categoria_id", filtros.categoriaId);
  }
  if (filtros.responsable) {
    q = q.ilike("responsable", `%${filtros.responsable}%`);
  }
  if (filtros.soloDeducibles === true) {
    q = q.eq("es_deducible", true);
  } else if (filtros.soloDeducibles === false) {
    q = q.eq("es_deducible", false);
  }
  if (filtros.proyectoId) {
    q = q.eq("proyecto_id", filtros.proyectoId);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createGastoEmpresa(
  payload: Omit<GastoEmpresa, "id" | "created_at" | "updated_at" | "deleted_at">,
): Promise<GastoEmpresa> {
  const { data, error } = await supabase
    .from("gastos_empresa")
    .insert(payload as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as GastoEmpresa;
}

export async function updateGastoEmpresa(
  id: string,
  payload: Partial<GastoEmpresa>,
): Promise<GastoEmpresa> {
  const { data, error } = await supabase
    .from("gastos_empresa")
    .update(payload as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as GastoEmpresa;
}

export async function deleteGastoEmpresa(id: string): Promise<void> {
  const { error } = await supabase
    .from("gastos_empresa")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export interface KpiGastosEmpresa {
  total_anio: number;
  total_deducible: number;
  total_no_deducible: number;
  num_gastos: number;
}

export async function getKpiGastosEmpresa(
  empresaId: string,
  anio: number,
): Promise<KpiGastosEmpresa> {
  const { data, error } = await supabase
    .from("gastos_empresa")
    .select("total, es_deducible")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .gte("fecha", `${anio}-01-01`)
    .lte("fecha", `${anio}-12-31`);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  return {
    total_anio: rows.reduce((s, r) => s + (Number(r.total) || 0), 0),
    total_deducible: rows
      .filter((r) => r.es_deducible)
      .reduce((s, r) => s + (Number(r.total) || 0), 0),
    total_no_deducible: rows
      .filter((r) => !r.es_deducible)
      .reduce((s, r) => s + (Number(r.total) || 0), 0),
    num_gastos: rows.length,
  };
}
