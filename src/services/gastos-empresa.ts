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

// ─── Sugerencias por RUC ──────────────────────────────────────────────────────

export type SugerenciasRuc = Map<string, { categoriaId: string | null; proyectoId: string | null }>;

/**
 * Devuelve el mapa RUC → {categoriaId, proyectoId} basado en el último registro
 * de cada emisor en la empresa. Usado para pre-rellenar automáticamente el diálogo
 * de importación TXT SRI.
 */
export async function getSugerenciasPorRuc(empresaId: string): Promise<SugerenciasRuc> {
  const { data, error } = await supabase
    .from("gastos_empresa")
    .select("ruc_emisor, categoria_id, proyecto_id, created_at")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .not("ruc_emisor", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const map: SugerenciasRuc = new Map();
  for (const row of data ?? []) {
    if (row.ruc_emisor && !map.has(row.ruc_emisor)) {
      map.set(row.ruc_emisor, {
        categoriaId: row.categoria_id ?? null,
        proyectoId: row.proyecto_id ?? null,
      });
    }
  }
  return map;
}

/** Devuelve el Set de clave_acceso ya registradas (no eliminadas) para una empresa. */
export async function getClaveAccesoExistentes(empresaId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("gastos_empresa")
    .select("clave_acceso")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .not("clave_acceso", "is", null);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.clave_acceso as string));
}

export async function createGastosEmpresaLote(
  rows: Omit<GastoEmpresa, "id" | "created_at" | "updated_at" | "deleted_at">[],
): Promise<number> {
  const { data, error } = await supabase
    .from("gastos_empresa")
    .insert(rows as never[])
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
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

/** Verifica si existe un gasto en alguna rendición con la misma factura. */
export async function buscarReembolsoEnRendicion(
  empresaId: string,
  claveAcceso: string | null,
  numeroDocumento: string | null,
  rucEmisor: string | null,
): Promise<{ encontrado: boolean; rendicionNumero: string | null }> {
  // 1. Por clave_acceso
  if (claveAcceso) {
    const { data } = await supabase
      .from("gastos")
      .select("id, rendiciones(numero)")
      .eq("empresa_id", empresaId)
      .eq("clave_acceso", claveAcceso)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (data) {
      const num = (data.rendiciones as { numero?: string | null } | null)?.numero ?? null;
      return { encontrado: true, rendicionNumero: num };
    }
  }

  // 2. Por numero_documento (con o sin RUC)
  if (numeroDocumento) {
    const { data } = await supabase
      .from("gastos")
      .select("id, rendiciones(numero), proveedores(ruc)")
      .eq("empresa_id", empresaId)
      .eq("numero_documento", numeroDocumento)
      .is("deleted_at", null)
      .limit(20);

    const rows = data ?? [];
    if (rows.length > 0) {
      if (!rucEmisor) {
        const num =
          (rows[0].rendiciones as { numero?: string | null } | null)?.numero ?? null;
        return { encontrado: true, rendicionNumero: num };
      }
      const match = rows.find(
        (g) => (g.proveedores as { ruc?: string | null } | null)?.ruc === rucEmisor,
      );
      if (match) {
        const num = (match.rendiciones as { numero?: string | null } | null)?.numero ?? null;
        return { encontrado: true, rendicionNumero: num };
      }
    }
  }

  return { encontrado: false, rendicionNumero: null };
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
