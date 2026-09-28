/**
 * cotizaciones.ts
 * Servicio para el módulo de Cotizaciones (propuestas técnico-comerciales).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/database";

// ── Tipos base ──────────────────────────────────────────────────────────────
export type Cotizacion     = Database["public"]["Tables"]["cotizaciones"]["Row"];
export type CotizacionItem = Database["public"]["Tables"]["cotizacion_items"]["Row"];
export type ProductoCatalogo = Database["public"]["Tables"]["productos_catalogo"]["Row"];

export type EstadoCotizacion = "borrador" | "enviada" | "aprobada" | "rechazada" | "vencida";

// ── Tipos enriquecidos ───────────────────────────────────────────────────────

/** Item enriquecido con datos del catálogo y del proveedor/fabricante */
export interface CotizacionItemEnriquecido extends CotizacionItem {
  catalogo?: {
    nombre: string | null;
    descripcion_larga: string | null;
    foto_url: string | null;
    descripcion_tecnica: string | null;
  } | null;
  proveedor?: {
    id: string;
    nombre: string;
    logo_url: string | null;
  } | null;
}

export interface CotizacionConItems extends Cotizacion {
  items: CotizacionItemEnriquecido[];
  cliente?: {
    id: string;
    nombre: string;
    ruc: string | null;
    logo_url: string | null;
    contacto_nombre: string | null;
    contacto_cargo: string | null;
  } | null;
}

// ── Payloads ────────────────────────────────────────────────────────────────
export interface CotizacionDatos {
  cliente_id?: string;
  razon_social: string;
  ruc_cliente?: string;
  email_cliente?: string;
  asunto?: string;
  fecha?: string;
  valida_hasta?: string;
  lugar_entrega?: string;
  dias_entrega?: number;
  meses_garantia?: number;
  terminos_pago?: Array<{ concepto: string; porcentaje: number }>;
  notas?: string;
  observacion_interna?: string;
  iva_pct?: number;
}

export interface CotizacionItemPayload {
  orden: number;
  catalogo_id?: string;
  descripcion: string;
  fabricante?: string;
  modelo?: string;
  cantidad: number;
  precio_unitario: number;
  descuento_pct?: number;
  dias_entrega?: number;
  meses_garantia?: number;
  notas?: string;
  proveedor_id?: string;
}

// ── Lecturas ────────────────────────────────────────────────────────────────
const COTIZACION_SELECT = `
  *,
  items:cotizacion_items(
    *,
    catalogo:productos_catalogo(nombre, descripcion_larga, foto_url, descripcion_tecnica),
    proveedor:proveedores(id, nombre, logo_url)
  ),
  cliente:clientes(id, nombre, ruc, logo_url, contacto_nombre, contacto_cargo)
`;

export async function getCotizaciones(empresa_id: string): Promise<CotizacionConItems[]> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select(COTIZACION_SELECT)
    .eq("empresa_id", empresa_id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CotizacionConItems[];
}

export async function getCotizacion(id: string): Promise<CotizacionConItems> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select(COTIZACION_SELECT)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as CotizacionConItems;
}

// ── Mutaciones (vía RPC SECURITY DEFINER) ───────────────────────────────────
export async function crearCotizacion(
  empresa_id: string,
  datos: CotizacionDatos,
  items: CotizacionItemPayload[],
): Promise<{ id: string; numero: string }> {
  const { data, error } = await supabase.rpc("crear_cotizacion", {
    p_empresa_id: empresa_id,
    p_datos: datos,
    p_items: items,
  });
  if (error) throw new Error(error.message);
  return data as { id: string; numero: string };
}

export async function actualizarCotizacion(
  id: string,
  datos: CotizacionDatos,
  items: CotizacionItemPayload[],
): Promise<void> {
  const { error } = await supabase.rpc("actualizar_cotizacion", {
    p_id: id,
    p_datos: datos,
    p_items: items,
  });
  if (error) throw new Error(error.message);
}

export async function actualizarEstadoCotizacion(
  id: string,
  estado: EstadoCotizacion,
): Promise<void> {
  const { error } = await supabase.rpc("actualizar_estado_cotizacion", {
    p_id: id,
    p_estado: estado,
  });
  if (error) throw new Error(error.message);
}

export async function convertirCotizacionAFactura(
  cotizacion_id: string,
  numero_factura?: string,
): Promise<{ factura_id: string; numero: string }> {
  const { data, error } = await supabase.rpc("convertir_cotizacion_a_factura", {
    p_cotizacion_id: cotizacion_id,
    p_numero_factura: numero_factura ?? null,
    p_fecha_factura: new Date().toISOString().split("T")[0],
  });
  if (error) throw new Error(error.message);
  return data as { factura_id: string; numero: string };
}

// ── Catálogo de productos (para selector en cotizaciones) ───────────────────
export async function getProductosCatalogoCotizar(empresa_id: string): Promise<ProductoCatalogo[]> {
  const { data, error } = await supabase
    .from("productos_catalogo")
    .select("*")
    .eq("empresa_id", empresa_id)
    .eq("para_cotizar", true)
    .is("deleted_at", null)
    .order("nombre", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createProductoCatalogo(
  payload: Database["public"]["Tables"]["productos_catalogo"]["Insert"],
): Promise<ProductoCatalogo> {
  const { data, error } = await supabase
    .from("productos_catalogo")
    .insert(payload as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProductoCatalogo(
  id: string,
  payload: Database["public"]["Tables"]["productos_catalogo"]["Update"],
): Promise<void> {
  const { error } = await supabase
    .from("productos_catalogo")
    .update({ ...payload, updated_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProductoCatalogo(id: string): Promise<void> {
  const { error } = await supabase
    .from("productos_catalogo")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}
