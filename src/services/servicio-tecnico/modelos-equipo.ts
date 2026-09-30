import { supabase } from "@/integrations/supabase/client";

export interface ModeloEquipo {
  id: string;
  empresa_id: string;
  modalidad_id: string;
  nombre: string;
  fabricante_id: string | null;   // FK → proveedores (internacionales)
  fabricante: string | null;      // texto legado / override
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  // join opcional al cargar con fabricante:proveedores(id,nombre)
  proveedor?: { id: string; nombre: string } | null;
}

export interface ModeloEquipoPayload {
  modalidad_id: string;
  nombre: string;
  fabricante_id?: string | null;
  fabricante?: string | null;
  descripcion?: string | null;
}

export async function getModelosEquipo(
  empresaId: string,
  modalidadId?: string,
): Promise<ModeloEquipo[]> {
  let q = supabase
    .from("modelos_equipo")
    .select("*, proveedor:proveedores(id, nombre)")
    .eq("empresa_id", empresaId)
    .order("nombre");
  if (modalidadId) q = q.eq("modalidad_id", modalidadId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ModeloEquipo[];
}

export async function crearModeloEquipo(
  empresaId: string,
  payload: ModeloEquipoPayload,
): Promise<ModeloEquipo> {
  const { data, error } = await supabase.rpc("rpc_crear_modelo_equipo", {
    p_empresa_id:    empresaId,
    p_modalidad_id:  payload.modalidad_id,
    p_nombre:        payload.nombre,
    p_fabricante_id: payload.fabricante_id ?? null,
    p_fabricante:    payload.fabricante ?? null,
    p_descripcion:   payload.descripcion ?? null,
  });
  if (error) throw error;
  return data as ModeloEquipo;
}

export async function actualizarModeloEquipo(
  id: string,
  payload: Partial<Omit<ModeloEquipoPayload, "modalidad_id"> & { activo: boolean }>,
): Promise<ModeloEquipo> {
  const { data, error } = await supabase.rpc("rpc_actualizar_modelo_equipo", {
    p_id:            id,
    p_nombre:        payload.nombre       ?? null,
    p_fabricante_id: payload.fabricante_id ?? null,
    p_fabricante:    payload.fabricante   ?? null,
    p_descripcion:   payload.descripcion  ?? null,
    p_activo:        payload.activo       ?? null,
  });
  if (error) throw error;
  return data as ModeloEquipo;
}
