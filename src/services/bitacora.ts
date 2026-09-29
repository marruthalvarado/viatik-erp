import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/database";

export type NivelBloqueo = "ninguno" | "bajo" | "medio" | "critico";
export type TipoProyecto =
  | "desarrollo_software"
  | "ventas_comercial"
  | "implementacion"
  | "mantenimiento"
  | "consultoria"
  | "otro";

export type ProyectoActualizacion =
  Database["public"]["Tables"]["proyecto_actualizaciones"]["Row"];

export type InsertProyectoActualizacion =
  Database["public"]["Tables"]["proyecto_actualizaciones"]["Insert"];

export interface BitacoraEntrada {
  id: string;
  fecha: string;
  usuario_id: string;
  usuario_nombre: string;
  ayer: string | null;
  hoy: string | null;
  bloqueos: string | null;
  nivel_bloqueo: NivelBloqueo;
  novedades: string | null;
  porcentaje_avance: number | null;
  created_at: string;
}

export interface ResumenBitacora {
  proyecto_id: string;
  proyecto_nombre: string;
  tipo_proyecto: TipoProyecto | null;
  ultima_fecha: string | null;
  ultimo_pct: number | null;
  total_entradas: number;
  entradas_hoy: number;
  tiene_bloqueo: boolean;
  nivel_bloqueo_max: NivelBloqueo | null;
  ultimo_usuario: string | null;
}

// ── Timeline de un proyecto ────────────────────────────────
export async function getBitacoraProyecto(
  proyectoId: string,
  limit = 50,
  offset = 0,
): Promise<BitacoraEntrada[]> {
  const { data, error } = await supabase.rpc("get_bitacora_proyecto", {
    p_proyecto_id: proyectoId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return (data ?? []) as BitacoraEntrada[];
}

// ── Resumen de todos los proyectos (para dashboard) ────────
export async function getResumenBitacora(
  empresaId: string,
): Promise<ResumenBitacora[]> {
  const { data, error } = await supabase.rpc("get_resumen_bitacora", {
    p_empresa_id: empresaId,
  });
  if (error) throw error;
  return (data ?? []) as ResumenBitacora[];
}

// ── Crear actualización ────────────────────────────────────
export async function createActualizacion(
  payload: InsertProyectoActualizacion,
): Promise<ProyectoActualizacion> {
  const { data, error } = await supabase
    .from("proyecto_actualizaciones")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Actualizar (solo el autor) ─────────────────────────────
export async function updateActualizacion(
  id: string,
  payload: Partial<InsertProyectoActualizacion>,
): Promise<ProyectoActualizacion> {
  const { data, error } = await supabase
    .from("proyecto_actualizaciones")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Eliminar (solo el autor) ───────────────────────────────
export async function deleteActualizacion(id: string): Promise<void> {
  const { error } = await supabase
    .from("proyecto_actualizaciones")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ── Helpers de label ──────────────────────────────────────
export const TIPO_PROYECTO_LABELS: Record<TipoProyecto, string> = {
  desarrollo_software: "Desarrollo de software",
  ventas_comercial:    "Ventas / Comercial",
  implementacion:      "Implementación",
  mantenimiento:       "Mantenimiento",
  consultoria:         "Consultoría",
  otro:                "Otro",
};

export const NIVEL_BLOQUEO_LABELS: Record<NivelBloqueo, string> = {
  ninguno: "Sin bloqueo",
  bajo:    "Bajo",
  medio:   "Medio",
  critico: "Crítico",
};

export const NIVEL_BLOQUEO_COLOR: Record<NivelBloqueo, string> = {
  ninguno: "text-green-600 bg-green-50",
  bajo:    "text-yellow-700 bg-yellow-50",
  medio:   "text-orange-700 bg-orange-50",
  critico: "text-red-700 bg-red-50",
};
