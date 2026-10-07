/**
 * importaciones-grupo.ts
 * Servicio para Grupos de Embarque (Importaciones Fase 4).
 * Un grupo agrupa múltiples importaciones (DAIs) de un mismo envío físico,
 * distribuyendo los costos de transporte proporcional al FOB de cada una.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/database";
import type { EmbarqueConLineas } from "./importaciones-embarques";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type GrupoEmbarque = Database["public"]["Tables"]["grupos_embarque"]["Row"];

export type EstadoGrupo = "Abierto" | "Prorrateado" | "Cerrado";

export interface GrupoConImportaciones extends GrupoEmbarque {
  importaciones: EmbarqueConLineas[];
}

export interface GrupoPayload {
  descripcion?: string | null;
  fecha: string;
  flete_total: number;
  seguro_total: number;
  otros_logistica: number;
  estado?: EstadoGrupo;
  observacion?: string | null;
}

export interface ResultadoProrrateo {
  ok: boolean;
  importaciones: number;
  fob_total_grupo: number;
  flete_distribuido: number;
  seguro_distribuido: number;
}

// ── SELECT ─────────────────────────────────────────────────────────────────────

const IMPORTACION_SELECT = `
  *,
  proveedor:proveedores(id, nombre, ruc),
  costeo:costeos(id, numero, costo_aterrizaje_usd),
  lineas:importacion_lineas(*)
`;

// ── Queries ────────────────────────────────────────────────────────────────────

export async function getGruposEmbarque(empresaId: string): Promise<GrupoConImportaciones[]> {
  const { data, error } = await supabase
    .from("grupos_embarque")
    .select("*")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .order("fecha", { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) return [];

  // Para cada grupo, cargar sus importaciones vinculadas
  const grupos: GrupoConImportaciones[] = [];
  for (const g of data) {
    const { data: imps, error: impErr } = await supabase
      .from("importaciones")
      .select(IMPORTACION_SELECT)
      .eq("grupo_embarque_id", g.id)
      .is("deleted_at", null)
      .order("fecha", { ascending: true });

    if (impErr) throw new Error(impErr.message);
    grupos.push({ ...g, importaciones: (imps ?? []) as EmbarqueConLineas[] });
  }
  return grupos;
}

// ── Mutations via RPC ─────────────────────────────────────────────────────────

export async function crearGrupoEmbarque(
  empresaId: string,
  payload: GrupoPayload,
): Promise<{ id: string; numero: string }> {
  const { data, error } = await supabase.rpc("crear_grupo_embarque", {
    p_empresa_id: empresaId,
    p_datos: payload,
  });
  if (error) throw new Error(error.message);
  return data as { id: string; numero: string };
}

export async function actualizarGrupoEmbarque(
  id: string,
  payload: Partial<GrupoPayload>,
): Promise<void> {
  const { error } = await supabase.rpc("actualizar_grupo_embarque", {
    p_id: id,
    p_datos: payload,
  });
  if (error) throw new Error(error.message);
}

export async function eliminarGrupoEmbarque(id: string): Promise<void> {
  const { error } = await supabase.rpc("eliminar_grupo_embarque", { p_id: id });
  if (error) throw new Error(error.message);
}

export async function vincularImportacionAGrupo(
  importacionId: string,
  grupoId: string,
): Promise<void> {
  const { error } = await supabase.rpc("vincular_importacion_a_grupo", {
    p_importacion_id: importacionId,
    p_grupo_id: grupoId,
  });
  if (error) throw new Error(error.message);
}

export async function desvincularImportacionDeGrupo(importacionId: string): Promise<void> {
  const { error } = await supabase.rpc("desvincular_importacion_de_grupo", {
    p_importacion_id: importacionId,
  });
  if (error) throw new Error(error.message);
}

export async function prorratearGrupoEmbarque(grupoId: string): Promise<ResultadoProrrateo> {
  const { data, error } = await supabase.rpc("prorratear_grupo_embarque", {
    p_grupo_id: grupoId,
  });
  if (error) throw new Error(error.message);
  return data as ResultadoProrrateo;
}

export async function recibirEmbarque(
  importacionId: string,
): Promise<{ ok: boolean; unidades: number }> {
  const { data, error } = await supabase.rpc("recibir_embarque", {
    p_importacion_id: importacionId,
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; unidades: number };
}
