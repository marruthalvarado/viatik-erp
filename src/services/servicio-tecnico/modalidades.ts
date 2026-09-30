import { supabase } from "@/integrations/supabase/client";

export interface Modalidad {
  id: string;
  empresa_id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  created_at: string;
}

export interface ModalidadPayload {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
}

export async function getModalidades(empresaId: string): Promise<Modalidad[]> {
  const { data, error } = await supabase
    .from("modalidades")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("codigo");
  if (error) throw error;
  return data ?? [];
}

export async function crearModalidad(
  empresaId: string,
  payload: ModalidadPayload
): Promise<Modalidad> {
  const { data, error } = await supabase.rpc("rpc_crear_modalidad", {
    p_empresa_id: empresaId,
    p_codigo: payload.codigo,
    p_nombre: payload.nombre,
    p_descripcion: payload.descripcion ?? null,
  });
  if (error) throw error;
  return data as Modalidad;
}

export async function actualizarModalidad(
  id: string,
  payload: Partial<ModalidadPayload & { activa: boolean }>
): Promise<Modalidad> {
  const { data, error } = await supabase.rpc("rpc_actualizar_modalidad", {
    p_id: id,
    p_codigo: payload.codigo ?? null,
    p_nombre: payload.nombre ?? null,
    p_descripcion: payload.descripcion ?? null,
    p_activa: payload.activa ?? null,
  });
  if (error) throw error;
  return data as Modalidad;
}
