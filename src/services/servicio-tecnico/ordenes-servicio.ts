/**
 * Servicio: Órdenes de Servicio
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/database";

export type OrdenServicio = Database["public"]["Tables"]["ordenes_servicio"]["Row"];
export type OsRepuesto   = Database["public"]["Tables"]["os_repuestos"]["Row"];
export type OsFoto       = Database["public"]["Tables"]["os_fotos"]["Row"];

export interface OrdenConRelaciones extends OrdenServicio {
  equipo?: {
    id: string; nombre: string; numero_serie: string | null;
    modelo: string | null; ubicacion_instalacion: string | null;
    fabricante: string | null; garantia_hasta: string | null;
    cliente?: { id: string; nombre: string; logo_url: string | null } | null;
  } | null;
  cliente?: { id: string; nombre: string; contacto_nombre: string | null; contacto_cargo: string | null } | null;
  tecnico?: { id: string; nombres: string; apellidos: string; cargo: string | null } | null;
  contrato?: { id: string; numero: string } | null;
  repuestos?: OsRepuesto[];
  fotos?: OsFoto[];
}

export interface OsRepuestoPayload {
  catalogo_id?: string | null;
  descripcion: string;
  cantidad?: number;
  precio_unitario?: number;
  notas?: string | null;
}

export interface OrdenServicioPayload {
  tipo: string;
  estado?: string;
  modalidad_cobro?: string;
  equipo_id: string;
  cliente_id?: string | null;
  proyecto_id?: string | null;
  contrato_id?: string | null;
  tecnico_id?: string | null;
  fecha_programada?: string | null;
  descripcion_problema?: string | null;
  diagnostico?: string | null;
  trabajos_realizados?: string | null;
  observaciones?: string | null;
  costo_mano_obra?: number;
  cotizacion_id?: string | null;
  factura_id?: string | null;
  firma_tecnico_url?: string | null;
  firma_cliente_url?: string | null;
}

const OS_SELECT = `
  *,
  equipo:equipos_instalados(
    id, nombre, numero_serie, modelo, ubicacion_instalacion,
    fabricante, garantia_hasta,
    cliente:clientes(id, nombre, logo_url)
  ),
  cliente:clientes(id, nombre, contacto_nombre, contacto_cargo),
  tecnico:usuarios!ordenes_servicio_tecnico_id_fkey(id, nombres, apellidos, cargo),
  contrato:contratos_mantenimiento(id, numero),
  repuestos:os_repuestos(*),
  fotos:os_fotos(*)
`;

export async function getOrdenesServicio(empresa_id: string): Promise<OrdenConRelaciones[]> {
  const { data, error } = await supabase
    .from("ordenes_servicio")
    .select(OS_SELECT)
    .eq("empresa_id", empresa_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as OrdenConRelaciones[];
}

export async function getOrdenServicio(id: string): Promise<OrdenConRelaciones> {
  const { data, error } = await supabase
    .from("ordenes_servicio")
    .select(OS_SELECT)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as OrdenConRelaciones;
}

export async function crearOrdenServicio(
  empresa_id: string,
  payload: OrdenServicioPayload,
  repuestos: OsRepuestoPayload[] = [],
): Promise<{ id: string; numero: string }> {
  const { data, error } = await supabase.rpc("crear_orden_servicio", {
    p_empresa_id: empresa_id,
    p_datos: payload,
    p_repuestos: repuestos,
  });
  if (error) throw new Error(error.message);
  return data as { id: string; numero: string };
}

export async function actualizarOrdenServicio(
  id: string,
  payload: Partial<OrdenServicioPayload>,
  repuestos?: OsRepuestoPayload[],
): Promise<void> {
  const { error } = await supabase.rpc("actualizar_orden_servicio", {
    p_id: id,
    p_datos: payload,
    p_repuestos: repuestos ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function cerrarOrdenServicio(
  id: string,
  trabajos_realizados: string,
  observaciones?: string,
  costo_mano_obra?: number,
): Promise<void> {
  const { error } = await supabase.rpc("cerrar_orden_servicio", {
    p_id: id,
    p_trabajos_realizados: trabajos_realizados,
    p_observaciones: observaciones ?? null,
    p_costo_mano_obra: costo_mano_obra ?? 0,
  });
  if (error) throw new Error(error.message);
}

export async function eliminarOrdenServicio(id: string): Promise<void> {
  const { error } = await supabase
    .from("ordenes_servicio")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function generarOrdenesPreventivasManual(
  empresa_id: string,
  dias_horizonte = 7,
): Promise<number> {
  const { data, error } = await supabase.rpc("generar_ordenes_preventivas", {
    p_empresa_id: empresa_id,
    p_dias_horizonte: dias_horizonte,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/** Subir foto de orden de servicio (antes/durante/después) */
export async function subirFotoOS(
  empresa_id: string,
  orden_id: string,
  momento: "antes" | "durante" | "despues",
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const ts = Date.now();
  const path = `${empresa_id}/os/${orden_id}/${momento}_${ts}.${ext}`;
  const { error } = await supabase.storage
    .from("os-fotos")
    .upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("os-fotos").getPublicUrl(path);
  return data.publicUrl;
}

/** Registrar foto en la tabla os_fotos */
export async function agregarFotoOS(
  orden_id: string,
  momento: "antes" | "durante" | "despues",
  url: string,
  descripcion?: string,
): Promise<void> {
  const { error } = await supabase
    .from("os_fotos")
    .insert({ orden_id, momento, url, descripcion: descripcion ?? null } as never);
  if (error) throw new Error(error.message);
}

export async function eliminarFotoOS(foto_id: string): Promise<void> {
  const { error } = await supabase
    .from("os_fotos")
    .delete()
    .eq("id", foto_id);
  if (error) throw new Error(error.message);
}
