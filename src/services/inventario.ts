/**
 * inventario.ts
 * Servicio para el módulo de inventario de bodega.
 * Cubre: productos_catalogo, importaciones, importacion_lineas,
 *        inventario_unidades, inventario_movimientos.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/database";

// ── Tipos base ──────────────────────────────────────────────────────────────
export type ProductoCatalogo   = Database["public"]["Tables"]["productos_catalogo"]["Row"];
export type Importacion        = Database["public"]["Tables"]["importaciones"]["Row"];
export type ImportacionLinea   = Database["public"]["Tables"]["importacion_lineas"]["Row"];
export type InventarioUnidad   = Database["public"]["Tables"]["inventario_unidades"]["Row"];
export type InventarioMovimiento = Database["public"]["Tables"]["inventario_movimientos"]["Row"];

// ── Tipos enriquecidos ───────────────────────────────────────────────────────
export interface ImportacionConLineas extends Importacion {
  proveedor?: { id: string; nombre: string } | null;
  bodega?:    { id: string; nombre: string } | null;
  lineas:     ImportacionLineaConProducto[];
}

export interface ImportacionLineaConProducto extends ImportacionLinea {
  producto?: { id: string; codigo: string | null; nombre: string; tipo_seguimiento: string } | null;
}

export interface UnidadConDetalle extends InventarioUnidad {
  producto?:  { id: string; codigo: string | null; nombre: string; tipo_seguimiento: string; unidad_medida: string } | null;
  bodega?:    { id: string; nombre: string } | null;
  proyecto?:  { id: string; nombre: string } | null;
  cliente?:   { id: string; nombre: string } | null;
}

export interface MovimientoConDetalle extends InventarioMovimiento {
  unidad?:          { id: string; codigo: string | null } | null;
  bodega_origen?:   { id: string; nombre: string } | null;
  bodega_destino?:  { id: string; nombre: string } | null;
  proyecto?:        { id: string; nombre: string } | null;
  usuario?:         { id: string; nombres: string } | null;
}

// ── Payloads de escritura ───────────────────────────────────────────────────
export type ProductoPayload = Database["public"]["Tables"]["productos_catalogo"]["Insert"];
export type ImportacionPayload = Omit<Database["public"]["Tables"]["importaciones"]["Insert"], "created_at" | "updated_at">;
export type ImportacionLineaPayload = Omit<Database["public"]["Tables"]["importacion_lineas"]["Insert"], "created_at">;
export type UnidadPayload = Omit<Database["public"]["Tables"]["inventario_unidades"]["Insert"], "created_at" | "updated_at">;
export type MovimientoPayload = Omit<Database["public"]["Tables"]["inventario_movimientos"]["Insert"], "created_at">;

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTOS CATÁLOGO
// ═══════════════════════════════════════════════════════════════════════════

export async function getProductosCatalogo(empresa_id: string): Promise<ProductoCatalogo[]> {
  const { data, error } = await supabase
    .from("productos_catalogo")
    .select("*")
    .eq("empresa_id", empresa_id)
    .is("deleted_at", null)
    .order("codigo", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createProducto(payload: ProductoPayload): Promise<ProductoCatalogo> {
  const { data, error } = await supabase
    .from("productos_catalogo")
    .insert(payload as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProducto(id: string, payload: Partial<ProductoPayload>): Promise<void> {
  const { error } = await supabase
    .from("productos_catalogo")
    .update({ ...payload, updated_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProducto(id: string): Promise<void> {
  const { error } = await supabase
    .from("productos_catalogo")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTACIONES
// ═══════════════════════════════════════════════════════════════════════════

export async function getImportaciones(empresa_id: string): Promise<ImportacionConLineas[]> {
  const { data, error } = await supabase
    .from("importaciones")
    .select(`
      *,
      proveedor:proveedores(id, nombre),
      bodega:sucursales(id, nombre),
      lineas:importacion_lineas(
        *,
        producto:productos_catalogo(id, codigo, nombre, tipo_seguimiento)
      )
    `)
    .eq("empresa_id", empresa_id)
    .is("deleted_at", null)
    .order("fecha", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ImportacionConLineas[];
}

export async function getImportacion(id: string): Promise<ImportacionConLineas> {
  const { data, error } = await supabase
    .from("importaciones")
    .select(`
      *,
      proveedor:proveedores(id, nombre),
      bodega:sucursales(id, nombre),
      lineas:importacion_lineas(
        *,
        producto:productos_catalogo(id, codigo, nombre, tipo_seguimiento)
      )
    `)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as ImportacionConLineas;
}

export async function createImportacion(
  payload: ImportacionPayload,
  lineas: ImportacionLineaPayload[],
): Promise<Importacion> {
  const { data, error } = await supabase
    .from("importaciones")
    .insert(payload as never)
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (lineas.length > 0) {
    const lineasConId = lineas.map((l) => ({ ...l, importacion_id: data.id }));
    const { error: lineaError } = await supabase
      .from("importacion_lineas")
      .insert(lineasConId as never);
    if (lineaError) throw new Error(lineaError.message);

    // Calcular prorrateo si hay FOB total
    if (payload.fob_total && payload.fob_total > 0) {
      await supabase.rpc("inv_calcular_prorrateo", { p_importacion_id: data.id });
    }
  }

  return data;
}

export async function updateImportacion(id: string, payload: Partial<ImportacionPayload>): Promise<void> {
  const { error } = await supabase
    .from("importaciones")
    .update({ ...payload, updated_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);

  // Recalcular prorrateo
  await supabase.rpc("inv_calcular_prorrateo", { p_importacion_id: id });
}

export async function recalcularProrrateo(importacion_id: string): Promise<void> {
  const { error } = await supabase.rpc("inv_calcular_prorrateo", {
    p_importacion_id: importacion_id,
  });
  if (error) throw new Error(error.message);
}

export async function generarUnidades(importacion_id: string): Promise<number> {
  const { data, error } = await supabase.rpc("inv_generar_unidades", {
    p_importacion_id: importacion_id,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

// Líneas individuales
export async function upsertLineas(importacion_id: string, lineas: ImportacionLineaPayload[]): Promise<void> {
  // Borrar las existentes y reinsertar
  await supabase.from("importacion_lineas").delete().eq("importacion_id", importacion_id);
  if (lineas.length > 0) {
    const lineasConId = lineas.map((l) => ({ ...l, importacion_id }));
    const { error } = await supabase.from("importacion_lineas").insert(lineasConId as never);
    if (error) throw new Error(error.message);
  }
  await supabase.rpc("inv_calcular_prorrateo", { p_importacion_id: importacion_id });
}

// ═══════════════════════════════════════════════════════════════════════════
// INVENTARIO UNIDADES
// ═══════════════════════════════════════════════════════════════════════════

export async function getUnidades(empresa_id: string, filtros?: {
  estado?: string;
  producto_id?: string;
  bodega_id?: string;
}): Promise<UnidadConDetalle[]> {
  let query = supabase
    .from("inventario_unidades")
    .select(`
      *,
      producto:productos_catalogo(id, codigo, nombre, tipo_seguimiento, unidad_medida),
      bodega:sucursales(id, nombre),
      proyecto:proyectos(id, nombre),
      cliente:clientes(id, nombre)
    `)
    .eq("empresa_id", empresa_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (filtros?.estado)     query = query.eq("estado", filtros.estado);
  if (filtros?.producto_id) query = query.eq("producto_id", filtros.producto_id);
  if (filtros?.bodega_id)  query = query.eq("bodega_id", filtros.bodega_id);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as UnidadConDetalle[];
}

export async function createUnidad(payload: UnidadPayload): Promise<InventarioUnidad> {
  const { data, error } = await supabase
    .from("inventario_unidades")
    .insert(payload as never)
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Registrar movimiento de ingreso
  await supabase.from("inventario_movimientos").insert({
    empresa_id: payload.empresa_id,
    unidad_id: data.id,
    tipo: "Ingreso",
    fecha: payload.fecha_ingreso ?? new Date().toISOString().slice(0, 10),
    cantidad: payload.cantidad_original ?? 1,
    bodega_destino_id: payload.bodega_id ?? null,
    usuario_id: (await supabase.auth.getUser()).data.user?.id ?? null,
    observacion: "Ingreso manual",
  } as never);

  return data;
}

export async function updateUnidad(id: string, payload: Database["public"]["Tables"]["inventario_unidades"]["Update"]): Promise<void> {
  const { error } = await supabase
    .from("inventario_unidades")
    .update({ ...payload, updated_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function registrarMovimiento(payload: MovimientoPayload): Promise<void> {
  const { error } = await supabase
    .from("inventario_movimientos")
    .insert(payload as never);
  if (error) throw new Error(error.message);
}

export async function getMovimientos(unidad_id: string): Promise<MovimientoConDetalle[]> {
  const { data, error } = await supabase
    .from("inventario_movimientos")
    .select(`
      *,
      bodega_origen:sucursales!inventario_movimientos_bodega_origen_id_fkey(id, nombre),
      bodega_destino:sucursales!inventario_movimientos_bodega_destino_id_fkey(id, nombre),
      proyecto:proyectos(id, nombre),
      usuario:usuarios(id, nombres)
    `)
    .eq("unidad_id", unidad_id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MovimientoConDetalle[];
}

// ── KPIs de inventario ───────────────────────────────────────────────────────
export interface ResumenInventario {
  total_unidades: number;
  en_bodega: number;
  asignadas: number;
  en_transito: number;
  valor_total: number;
}

export async function getResumenInventario(empresa_id: string): Promise<ResumenInventario> {
  const { data, error } = await supabase
    .from("inventario_unidades")
    .select("estado, cantidad_actual, costo_unitario")
    .eq("empresa_id", empresa_id)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  return (data ?? []).reduce<ResumenInventario>(
    (acc, u) => {
      acc.total_unidades += u.cantidad_actual ?? 1;
      if (u.estado === "En bodega")   acc.en_bodega   += u.cantidad_actual ?? 1;
      if (u.estado === "Asignado")    acc.asignadas   += u.cantidad_actual ?? 1;
      if (u.estado === "En tránsito") acc.en_transito += u.cantidad_actual ?? 1;
      acc.valor_total += (u.costo_unitario ?? 0) * (u.cantidad_actual ?? 1);
      return acc;
    },
    { total_unidades: 0, en_bodega: 0, asignadas: 0, en_transito: 0, valor_total: 0 },
  );
}
