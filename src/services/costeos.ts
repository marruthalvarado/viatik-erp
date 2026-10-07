/**
 * costeos.ts
 * Servicio para el módulo de Costeos de Importación (cotizador pre-importación).
 * Reemplaza el Excel de cálculo de costo aterrizaje y PVP.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/database";

// ── Tipos base ───────────────────────────────────────────────────────────────
export type Costeo           = Database["public"]["Tables"]["costeos"]["Row"];
export type CosteoComponente = Database["public"]["Tables"]["costeo_componentes"]["Row"];
export type EstadoCosteo     = "borrador" | "aprobado" | "vigente" | "archivado";
export type TipoComponente   = "equipo_base" | "componente_opcional" | "servicio_adicional";

// ── Tipos enriquecidos ───────────────────────────────────────────────────────
export interface CosteoConRelaciones extends Costeo {
  componentes: CosteoComponente[];
  proveedor?: { id: string; nombre: string; logo_url: string | null } | null;
  proyecto?:  { id: string; nombre: string; codigo: string } | null;
  producto?:  { id: string; nombre: string; codigo: string; modelo: string | null } | null;
}

// ── Payloads ─────────────────────────────────────────────────────────────────
export interface CosteoDatos {
  proyecto_id?:                 string | null;
  producto_id?:                 string | null;
  proveedor_id:                 string;
  descripcion_producto:         string;
  moneda_proveedor:             "USD" | "EUR";
  precio_fob:                   number;
  tipo_cambio_eur:              number;
  flete_estimado:               number;
  seguro_estimado:              number;
  agente_aduanas_est:           number;
  bodega_est:                   number;
  otros_logistica:              number;
  codigo_nandina?:              string | null;
  fodinfa_pct:                  number;
  arancel_pct:                  number;
  isd_pct:                      number;
  iva_importacion_pct:          number;
  instalacion:                  number;
  entrenamiento:                number;
  gastos_admin_fabrica:         number;
  fee_agente_comercial:         number;
  garantia_reserva:             number;
  mantenimiento_preventivo_res: number;
  comision_venta_pct:           number;
  margen_empresa_pct:           number;
  pvp_privado:                  number;
  pvp_general:                  number;
  estado?:                      EstadoCosteo;
  notas?:                       string | null;
}

export interface CosteoComponentePayload {
  orden:           number;
  tipo:            TipoComponente;
  descripcion:     string;
  fabricante?:     string | null;
  modelo?:         string | null;
  moneda:          "USD" | "EUR";
  precio_unitario: number;
  tipo_cambio:     number;
  precio_usd:      number;
  cantidad:        number;
  subtotal_usd:    number;
  incluir_en_fob:  boolean;
  notas?:          string | null;
}

// ── Select string ─────────────────────────────────────────────────────────────
const COSTEO_SELECT = `
  *,
  componentes:costeo_componentes(*),
  proveedor:proveedores(id, nombre, logo_url),
  proyecto:proyectos(id, nombre, codigo),
  producto:productos_catalogo(id, nombre, codigo, modelo)
`;

// ── Lecturas ─────────────────────────────────────────────────────────────────
export async function getCosteos(empresa_id: string): Promise<CosteoConRelaciones[]> {
  const { data, error } = await supabase
    .from("costeos")
    .select(COSTEO_SELECT)
    .eq("empresa_id", empresa_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as CosteoConRelaciones[];
  rows.forEach((r) => { r.componentes?.sort((a, b) => a.orden - b.orden); });
  return rows;
}

export async function getCosteo(id: string): Promise<CosteoConRelaciones> {
  const { data, error } = await supabase
    .from("costeos")
    .select(COSTEO_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) throw new Error(error.message);
  const row = data as unknown as CosteoConRelaciones;
  row.componentes?.sort((a, b) => a.orden - b.orden);
  return row;
}

// ── Mutaciones (vía RPC SECURITY DEFINER) ────────────────────────────────────
export async function crearCosteo(
  empresa_id: string,
  datos: CosteoDatos,
  componentes: CosteoComponentePayload[],
): Promise<{ id: string; numero: string }> {
  const { data, error } = await supabase.rpc("crear_costeo", {
    p_empresa_id:   empresa_id,
    p_datos:        datos as unknown as Record<string, unknown>,
    p_componentes:  componentes as unknown[],
  });
  if (error) throw new Error(error.message);
  return data as { id: string; numero: string };
}

export async function actualizarCosteo(
  id: string,
  datos: CosteoDatos,
  componentes: CosteoComponentePayload[],
): Promise<void> {
  const { error } = await supabase.rpc("actualizar_costeo", {
    p_id:          id,
    p_datos:       datos as unknown as Record<string, unknown>,
    p_componentes: componentes as unknown[],
  });
  if (error) throw new Error(error.message);
}

export async function eliminarCosteo(id: string): Promise<void> {
  const { error } = await supabase.rpc("eliminar_costeo", { p_id: id });
  if (error) throw new Error(error.message);
}

export async function calcularCosteo(id: string): Promise<Costeo> {
  const { data, error } = await supabase.rpc("calcular_costeo", { p_costeo_id: id });
  if (error) throw new Error(error.message);
  return data as unknown as Costeo;
}

export async function actualizarEstadoCosteo(
  id: string,
  estado: EstadoCosteo,
): Promise<void> {
  const { error } = await supabase
    .from("costeos")
    .update({ estado, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
}

/**
 * Crea un producto en productos_catalogo a partir de un costeo y lo vincula.
 * Solo actúa si el costeo aún no tiene producto_id.
 */
export async function sincronizarProductoCatalogoDesdeCosteо(
  costeoId: string,
  empresaId: string,
  descripcionProducto: string,
  proveedorId: string,
  pvpPrivado: number,
): Promise<void> {
  // Verificar si ya tiene producto vinculado
  const { data: costeo } = await supabase
    .from("costeos")
    .select("producto_id")
    .eq("id", costeoId)
    .single();
  if (costeo?.producto_id) return; // ya vinculado, no hacer nada

  // Crear producto en catálogo
  const { data: producto, error: errProd } = await supabase
    .from("productos_catalogo")
    .insert({
      empresa_id:        empresaId,
      nombre:            descripcionProducto,
      proveedor_id:      proveedorId || null,
      precio_referencial: pvpPrivado || null,
      tipo_item:         "producto",
      para_cotizar:      true,
      estado:            "activo",
    } as never)
    .select("id")
    .single();
  if (errProd || !producto) return; // si falla, no bloquear el flujo

  // Vincular al costeo
  await supabase
    .from("costeos")
    .update({ producto_id: (producto as { id: string }).id } as never)
    .eq("id", costeoId);
}
