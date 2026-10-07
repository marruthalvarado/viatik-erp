/**
 * Servicio de Embarques (Importaciones — Fase 2)
 * Gestiona el ciclo de vida de una liquidación DAI: crear, editar, prorratear,
 * y vincular con el costeo pre-importación para comparar estimado vs real.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/database";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type Embarque = Database["public"]["Tables"]["importaciones"]["Row"];
export type EmbarqueLinea = Database["public"]["Tables"]["importacion_lineas"]["Row"];

export type EstadoEmbarque = "En tránsito" | "Recibida" | "Parcial";

export interface EmbarqueConLineas extends Embarque {
  lineas: EmbarqueLinea[];
  proveedor: { id: string; nombre: string; ruc: string | null } | null;
  costeo: { id: string; numero: string; costo_aterrizaje_usd: number } | null;
}

export interface LineaPayload {
  producto_id?: string | null;
  descripcion_original: string;
  fob_linea: number;
  cantidad: number;
  unidad_medida?: string | null;
  peso_kg?: number | null;
  pais_origen?: string | null;
  observacion?: string | null;
}

export interface EmbarquePayload {
  numero_liquidacion?: string | null;
  referencia_dai?: string | null;
  fecha: string;
  proveedor_id?: string | null;
  gasto_empresa_id?: string | null;
  bodega_destino_id?: string | null;
  pais_origen?: string | null;
  costeo_id?: string | null;
  fob_total: number;
  seguro: number;
  flete: number;
  ajustes: number;
  valor_aduanas: number;
  arancel: number;
  fodinfa: number;
  iva_importacion: number;
  total_liquidado: number;
  estado: EstadoEmbarque;
  observacion?: string | null;
}

// ── SELECT ────────────────────────────────────────────────────────────────────

const EMBARQUE_SELECT = `
  *,
  proveedor:proveedores(id, nombre, ruc),
  costeo:costeos(id, numero, costo_aterrizaje_usd),
  lineas:importacion_lineas(*)
` as const;

export async function getEmbarques(empresa_id: string): Promise<EmbarqueConLineas[]> {
  const { data, error } = await supabase
    .from("importaciones")
    .select(EMBARQUE_SELECT)
    .eq("empresa_id", empresa_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EmbarqueConLineas[];
}

export async function getEmbarque(id: string): Promise<EmbarqueConLineas | null> {
  const { data, error } = await supabase
    .from("importaciones")
    .select(EMBARQUE_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as unknown as EmbarqueConLineas | null;
}

// ── MUTACIONES vía RPCs ───────────────────────────────────────────────────────

export async function crearEmbarque(
  empresa_id: string,
  datos: EmbarquePayload,
  lineas: LineaPayload[]
): Promise<{ id: string; numero_embarque: string }> {
  const { data, error } = await supabase.rpc("crear_embarque", {
    p_empresa_id: empresa_id,
    p_datos: datos as unknown as Record<string, unknown>,
    p_lineas: lineas as unknown as Record<string, unknown>[],
  });
  if (error) throw new Error(error.message);
  return data as { id: string; numero_embarque: string };
}

export async function actualizarEmbarque(
  id: string,
  datos: Partial<EmbarquePayload>,
  lineas?: LineaPayload[]
): Promise<void> {
  const { error } = await supabase.rpc("actualizar_embarque", {
    p_id: id,
    p_datos: datos as unknown as Record<string, unknown>,
    p_lineas: lineas !== undefined
      ? (lineas as unknown as Record<string, unknown>[])
      : null,
  });
  if (error) throw new Error(error.message);
}

export async function eliminarEmbarque(id: string): Promise<void> {
  const { error } = await supabase.rpc("eliminar_embarque", { p_id: id });
  if (error) throw new Error(error.message);
}

export async function prorratearCostos(importacion_id: string): Promise<void> {
  const { error } = await supabase.rpc("inv_calcular_prorrateo", {
    p_importacion_id: importacion_id,
  });
  if (error) throw new Error(error.message);
}

export async function vincularCosteoEmbarque(
  embarque_id: string,
  costeo_id: string
): Promise<void> {
  const { error } = await supabase.rpc("vincular_costeo_embarque", {
    p_embarque_id: embarque_id,
    p_costeo_id: costeo_id,
  });
  if (error) throw new Error(error.message);
}

export async function actualizarCostoCatalogo(
  embarque_id: string
): Promise<{ actualizados: number }> {
  const { data, error } = await supabase.rpc(
    "actualizar_costo_catalogo_desde_embarque",
    { p_embarque_id: embarque_id }
  );
  if (error) throw new Error(error.message);
  return (data as { actualizados: number }) ?? { actualizados: 0 };
}
