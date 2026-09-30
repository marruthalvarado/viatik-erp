/**
 * Servicio: Base Instalada (equipos_instalados)
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/database";

export type EquipoInstalado = Database["public"]["Tables"]["equipos_instalados"]["Row"];

export interface EquipoInstaladoConRelaciones extends EquipoInstalado {
  cliente?: { id: string; nombre: string; logo_url: string | null } | null;
  proyecto?: { id: string; nombre: string } | null;
  catalogo?: { id: string; nombre: string; fabricante: string | null; modelo: string | null } | null;
  tecnico_instalador?: { id: string; nombres: string; apellidos: string } | null;
  modelo_equipo?: { id: string; nombre: string; modalidad_id: string; modalidad?: { id: string; nombre: string } | null } | null;
}

export interface EquipoInstaladoPayload {
  inventario_unidad_id?: string | null;
  catalogo_id?: string | null;
  cotizacion_id?: string | null;
  factura_id?: string | null;
  cliente_id?: string | null;
  proyecto_id?: string | null;
  tecnico_instalador_id?: string | null;
  modelo_id?: string | null;
  nombre: string;
  fabricante?: string | null;
  fabricante_id?: string | null;
  modelo?: string | null;
  numero_serie?: string | null;
  numero_parte?: string | null;
  ubicacion_instalacion?: string | null;
  fecha_venta?: string | null;
  fecha_instalacion?: string | null;
  garantia_meses?: number;
  estado?: string;
  requiere_mantenimiento?: boolean;
  frecuencia_mantenimiento_dias?: number | null;
  proximo_mantenimiento?: string | null;
  foto_url?: string | null;
  acta_entrega_url?: string | null;
  notas?: string | null;
}

const EQUIPO_SELECT = `
  *,
  cliente:clientes(id, nombre, logo_url),
  proyecto:proyectos(id, nombre),
  catalogo:productos_catalogo(id, nombre, fabricante, modelo),
  tecnico_instalador:usuarios!equipos_instalados_tecnico_instalador_id_fkey(id, nombres, apellidos),
  modelo_equipo:modelos_equipo(id, nombre, modalidad_id, modalidad:modalidades(id, nombre))
`;

export async function getEquiposInstalados(empresa_id: string): Promise<EquipoInstaladoConRelaciones[]> {
  const { data, error } = await supabase
    .from("equipos_instalados")
    .select(EQUIPO_SELECT)
    .eq("empresa_id", empresa_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EquipoInstaladoConRelaciones[];
}

export async function getEquipoInstalado(id: string): Promise<EquipoInstaladoConRelaciones> {
  const { data, error } = await supabase
    .from("equipos_instalados")
    .select(EQUIPO_SELECT)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as EquipoInstaladoConRelaciones;
}

export async function crearEquipoInstalado(
  empresa_id: string,
  payload: EquipoInstaladoPayload,
): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc("crear_equipo_instalado", {
    p_empresa_id: empresa_id,
    p_datos: payload,
  });
  if (error) throw new Error(error.message);
  return data as { id: string };
}

export async function actualizarEquipoInstalado(
  id: string,
  payload: Partial<EquipoInstaladoPayload>,
): Promise<void> {
  const { error } = await supabase.rpc("actualizar_equipo_instalado", {
    p_id: id,
    p_datos: payload,
  });
  if (error) throw new Error(error.message);
}

export async function eliminarEquipoInstalado(id: string): Promise<void> {
  const { error } = await supabase
    .from("equipos_instalados")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Subir foto del equipo instalado */
export async function subirFotoEquipo(
  empresa_id: string,
  equipo_id: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${empresa_id}/equipos/${equipo_id}.${ext}`;
  const { error } = await supabase.storage
    .from("os-fotos")
    .upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("os-fotos").getPublicUrl(path);
  return data.publicUrl;
}
