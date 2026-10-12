/**
 * costeos-proyecto.ts
 * Servicio para el módulo Costeo de Proyecto (Importaciones).
 * Agrupa múltiples productos, prorratea gastos de importación y
 * calcula precio de venta por proyecto completo.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/database";
import type { TipoComponente } from "@/services/costeos";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type CosteoProyecto =
  Database["public"]["Tables"]["costeos_proyecto"]["Row"];

export type CosteoProyectoItemComponente =
  Database["public"]["Tables"]["costeo_proyecto_item_componentes"]["Row"];

export type CosteoProyectoItem =
  Database["public"]["Tables"]["costeo_proyecto_items"]["Row"];

export interface CosteoProyectoConItems extends CosteoProyecto {
  items: CosteoProyectoItem[];
  proyecto?: { id: string; nombre: string } | null;
  cotizacion?: { id: string; numero: string; razon_social: string } | null;
}

export interface CosteoProyectoDatos {
  proyecto_id?: string;
  cotizacion_id?: string;
  descripcion: string;
  estado?: "borrador" | "finalizado";
  moneda?: string;
  flete_total: number;
  seguro_total: number;
  agente_aduanas: number;
  bodega: number;
  otros_logistica: number;
  fodinfa_pct: number;
  arancel_pct: number;
  isd_pct: number;
  iva_importacion_pct: number;
  margen_empresa_pct: number;
  comision_venta_pct: number;
  gastos_admin_pct: number;
  notas?: string;
}

export interface CosteoProyectoItemPayload {
  orden: number;
  costeo_id?: string;
  descripcion: string;
  fabricante?: string;
  modelo?: string;
  codigo_nandina?: string;
  cantidad: number;
  precio_fob_unitario_usd: number;
  fodinfa_pct?: number;
  arancel_pct?: number;
  isd_pct?: number;
  iva_importacion_pct?: number;
}

const CP_SELECT = `
  *,
  items:costeo_proyecto_items(*),
  proyecto:proyectos(id, nombre),
  cotizacion:cotizaciones(id, numero, razon_social)
`;

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getCosteosByProyectoId(
  empresa_id: string,
): Promise<CosteoProyectoConItems[]> {
  const { data, error } = await supabase
    .from("costeos_proyecto")
    .select(CP_SELECT)
    .eq("empresa_id", empresa_id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CosteoProyectoConItems[];
}

export async function getCosteoProyecto(
  id: string,
): Promise<CosteoProyectoConItems> {
  const { data, error } = await supabase
    .from("costeos_proyecto")
    .select(CP_SELECT)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as CosteoProyectoConItems;
}

export async function getCosteosByProyecto(
  empresa_id: string,
  proyecto_id: string,
): Promise<CosteoProyectoConItems[]> {
  const { data, error } = await supabase
    .from("costeos_proyecto")
    .select(CP_SELECT)
    .eq("empresa_id", empresa_id)
    .eq("proyecto_id", proyecto_id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CosteoProyectoConItems[];
}

// ── Mutaciones vía RPC SECURITY DEFINER ──────────────────────────────────────

export async function crearCosteoProyecto(
  empresa_id: string,
  datos: CosteoProyectoDatos,
  items: CosteoProyectoItemPayload[],
): Promise<{ id: string; numero: string }> {
  const { data, error } = await supabase.rpc("crear_costeo_proyecto", {
    p_empresa_id: empresa_id,
    p_datos: datos,
    p_items: items,
  });
  if (error) throw new Error(error.message);
  return data as { id: string; numero: string };
}

export async function actualizarCosteoProyecto(
  id: string,
  datos: CosteoProyectoDatos,
  items: CosteoProyectoItemPayload[],
): Promise<void> {
  const { error } = await supabase.rpc("actualizar_costeo_proyecto", {
    p_id: id,
    p_datos: datos,
    p_items: items,
  });
  if (error) throw new Error(error.message);
}

// ── Componentes por ítem de proyecto ─────────────────────────────────────────

export interface ComponenteProyectoEstado {
  componente_id: string;
  activo: boolean;
  descripcion: string;
  tipo: TipoComponente;
  subtotal_usd: number;
  incluir_en_fob: boolean;
}

/**
 * Retorna el estado de componentes (activo/inactivo) para un ítem de proyecto.
 * Hace join con costeo_componentes para traer los datos base del componente.
 */
export async function getComponentesProyectoItem(
  item_id: string,
): Promise<ComponenteProyectoEstado[]> {
  const { data, error } = await supabase
    .from("costeo_proyecto_item_componentes")
    .select(`
      componente_id,
      activo,
      componente:costeo_componentes(descripcion, tipo, subtotal_usd, incluir_en_fob)
    `)
    .eq("costeo_proyecto_item_id", item_id);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{
    componente_id: string;
    activo: boolean;
    componente: {
      descripcion: string;
      tipo: TipoComponente;
      subtotal_usd: number;
      incluir_en_fob: boolean;
    };
  }>).map((row) => ({
    componente_id: row.componente_id,
    activo: row.activo,
    descripcion: row.componente?.descripcion ?? "",
    tipo: row.componente?.tipo ?? "componente_opcional",
    subtotal_usd: row.componente?.subtotal_usd ?? 0,
    incluir_en_fob: row.componente?.incluir_en_fob ?? true,
  }));
}

/**
 * Copia los componentes de un costeo a un ítem de proyecto (si aún no existen).
 * Llama al RPC copiar_componentes_a_proyecto_item.
 */
export async function copiarComponentesAProyectoItem(
  item_id: string,
  costeo_id: string,
): Promise<void> {
  const { error } = await supabase.rpc("copiar_componentes_a_proyecto_item", {
    p_item_id: item_id,
    p_costeo_id: costeo_id,
  });
  if (error) throw new Error(error.message);
}

/**
 * Guarda el estado activo/inactivo de cada componente para un ítem de proyecto.
 * Llama al RPC sincronizar_componentes_proyecto_item con upsert.
 */
export async function sincronizarComponentesProyectoItem(
  item_id: string,
  componentes: Array<{ componente_id: string; activo: boolean }>,
): Promise<void> {
  const { error } = await supabase.rpc("sincronizar_componentes_proyecto_item", {
    p_item_id: item_id,
    p_componentes: componentes,
  });
  if (error) throw new Error(error.message);
}

/**
 * Calcula el FOB total de los componentes activos (incluir_en_fob=true y activo=true).
 * Helper puramente cliente, sin llamadas a la BD.
 */
export function calcularFobDesdeComponentes(
  componentes: ComponenteProyectoEstado[],
): number {
  return componentes
    .filter((c) => c.incluir_en_fob && c.activo)
    .reduce((sum, c) => sum + (c.subtotal_usd ?? 0), 0);
}

/**
 * Importa los ítems de una cotización existente como payload de items
 * para pre-llenar el formulario de Costeo de Proyecto.
 * Retorna los items sin precios FOB (deben ser completados por el usuario).
 */
export async function importarItemsDesdeCotizacion(
  cotizacion_id: string,
): Promise<CosteoProyectoItemPayload[]> {
  const { data, error } = await supabase
    .from("cotizacion_items")
    .select("orden, descripcion, fabricante, modelo, cantidad")
    .eq("cotizacion_id", cotizacion_id)
    .order("orden");
  if (error) throw new Error(error.message);
  return (data ?? []).map((item) => ({
    orden: (item as { orden?: number | null }).orden ?? 0,
    descripcion: (item as { descripcion?: string | null }).descripcion ?? "",
    fabricante: (item as { fabricante?: string | null }).fabricante ?? undefined,
    modelo: (item as { modelo?: string | null }).modelo ?? undefined,
    cantidad: Number((item as { cantidad?: number | null }).cantidad ?? 1),
    precio_fob_unitario_usd: 0,  // el usuario ingresa el FOB real
  })) as CosteoProyectoItemPayload[];
}
