/**
 * Servicio: Actividades de mantenimiento por orden de servicio
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/database";

export type OrdenActividad = Database["public"]["Tables"]["orden_actividades"]["Row"];
export type PlantillaActividad = Database["public"]["Tables"]["plantillas_actividad"]["Row"];

export interface ActividadUpdate {
  completada?: boolean;
  observacion?: string | null;
  completada_en?: string | null;
}

// ── Actividades de una orden ──────────────────────────────────────────────────

export async function getOrdenActividades(orden_id: string): Promise<OrdenActividad[]> {
  const { data, error } = await supabase.rpc("get_orden_actividades", {
    p_orden_id: orden_id,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrdenActividad[];
}

export async function actualizarActividad(
  id: string,
  payload: ActividadUpdate,
): Promise<void> {
  const update: Record<string, unknown> = { ...payload };
  if (payload.completada && !payload.completada_en) {
    update.completada_en = new Date().toISOString();
  }
  if (payload.completada === false) {
    update.completada_en = null;
  }
  const { error } = await supabase
    .from("orden_actividades")
    .update(update as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function crearActividadManual(
  orden_id: string,
  nombre: string,
  descripcion?: string,
): Promise<OrdenActividad> {
  const { data, error } = await supabase
    .from("orden_actividades")
    .insert({ orden_id, nombre, descripcion: descripcion ?? null } as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as OrdenActividad;
}

export async function eliminarActividad(id: string): Promise<void> {
  const { error } = await supabase
    .from("orden_actividades")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function poblarActividadesOrden(
  orden_id: string,
  empresa_id: string,
  tipo_os: string,
  fabricante_id?: string | null,
): Promise<number> {
  const { data, error } = await supabase.rpc("poblar_actividades_orden", {
    p_orden_id: orden_id,
    p_empresa_id: empresa_id,
    p_tipo_os: tipo_os,
    p_fabricante_id: fabricante_id ?? null,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

// ── Plantillas ────────────────────────────────────────────────────────────────

export async function getPlantillasActividad(empresa_id: string): Promise<PlantillaActividad[]> {
  const { data, error } = await supabase
    .from("plantillas_actividad")
    .select("*")
    .eq("empresa_id", empresa_id)
    .eq("activa", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as PlantillaActividad[];
}

export async function crearPlantillaActividad(
  empresa_id: string,
  payload: Omit<PlantillaActividad, "id" | "empresa_id" | "created_at">,
): Promise<PlantillaActividad> {
  const { data, error } = await supabase
    .from("plantillas_actividad")
    .insert({ ...payload, empresa_id } as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PlantillaActividad;
}

export async function actualizarPlantillaActividad(
  id: string,
  payload: Partial<Omit<PlantillaActividad, "id" | "empresa_id" | "created_at">>,
): Promise<void> {
  const { error } = await supabase
    .from("plantillas_actividad")
    .update(payload as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Firma ─────────────────────────────────────────────────────────────────────

export interface FirmaPayload {
  firma_cliente_nombre?: string | null;
  firma_cliente_cargo?: string | null;
  firma_cliente_data?: string | null;
  firma_tecnico_data?: string | null;
  firma_tecnico2_url?: string | null;
}

export async function guardarFirmaOrden(
  orden_id: string,
  firma: FirmaPayload,
): Promise<void> {
  const { error } = await supabase
    .from("ordenes_servicio")
    .update(firma as never)
    .eq("id", orden_id);
  if (error) throw new Error(error.message);
}
