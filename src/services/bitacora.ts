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
// Usa query directa en lugar de RPC para mayor fiabilidad
export async function getResumenBitacora(
  empresaId: string,
): Promise<ResumenBitacora[]> {
  const { data: proyectos, error: eproy } = await supabase
    .from("proyectos")
    .select("id, nombre, tipo_proyecto")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .order("nombre");
  if (eproy) throw eproy;
  if (!proyectos || proyectos.length === 0) return [];

  const ids = proyectos.map((p) => p.id);
  const { data: actualizaciones, error: eact } = await supabase
    .from("proyecto_actualizaciones")
    .select("id, proyecto_id, fecha, porcentaje_avance, nivel_bloqueo, usuario_id, created_at")
    .in("proyecto_id", ids)
    .order("fecha", { ascending: false });
  if (eact) throw eact;

  const acts = actualizaciones ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return proyectos.map((p) => {
    const pActs = acts.filter((a) => a.proyecto_id === p.id);
    const latest = pActs[0] ?? null;
    const totalEntradas = pActs.length;
    const entradasHoy = pActs.filter((a) => a.fecha === today).length;
    const tieneBloqueo = pActs.some(
      (a) => a.nivel_bloqueo === "medio" || a.nivel_bloqueo === "critico",
    );
    const nivelMax = pActs
      .filter((a) => a.nivel_bloqueo === "critico" || a.nivel_bloqueo === "medio")
      .sort((a, b) =>
        a.nivel_bloqueo === "critico" ? -1 : b.nivel_bloqueo === "critico" ? 1 : 0,
      )[0]?.nivel_bloqueo ?? null;

    return {
      proyecto_id: p.id,
      proyecto_nombre: p.nombre,
      tipo_proyecto: p.tipo_proyecto as TipoProyecto | null,
      ultima_fecha: latest?.fecha ?? null,
      ultimo_pct: latest?.porcentaje_avance ?? null,
      total_entradas: totalEntradas,
      entradas_hoy: entradasHoy,
      tiene_bloqueo: tieneBloqueo,
      nivel_bloqueo_max: nivelMax as NivelBloqueo | null,
      ultimo_usuario: null, // se evita join adicional en dashboard
    };
  });
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
