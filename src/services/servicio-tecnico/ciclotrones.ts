/**
 * Servicio CRUD para la tabla `ciclotrones`.
 * Cada ciclotrón pertenece a una empresa y almacena su perfil de parámetros
 * operativos en un campo JSONB configurable.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Ciclotrón, CiclotrónInsert, CiclotrónUpdate, CiclotrónParametros } from "@/types/entities";

export type { CiclotrónParametros };

// ── Parámetros por defecto basados en datos reales del PETtrace 800 ──────────
export const DEFAULT_CICLOTRÓN_PARAMETROS: CiclotrónParametros = {
  gas_flow:           { setpoint: 5.0,   min: 4.5,   max: 5.5,   alertar: true },
  magnet_i:           { setpoint: 426.7, min: 423.7, max: 429.7, alertar: true },
  dee1_kv:            { setpoint: 36.8,  min: 34.5,  max: 39.0,  alertar: true },
  dee2_kv:            { setpoint: 40.8,  min: 38.5,  max: 43.0,  alertar: true },
  target_i_spike_ua:  10,
  coll_max_pct:       12,
  vacuum_p_max:       1.9e-5,
  target_p_min:       350,
  target_p_max:       500,
  target_p_end_max:   100,
  he_cool_p_min:      40,
  he_cool_p_max:      70,
  arc_i_min:          100,
  arc_i_max:          1000,
  arc_v_min:          250,
  arc_v_max:          900,
};

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function getCiclotrones(empresaId: string): Promise<Ciclotrón[]> {
  const { data, error } = await supabase
    .from("ciclotrones")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("nombre");
  if (error) throw error;
  return data ?? [];
}

export async function getCiclotrón(id: string): Promise<Ciclotrón | null> {
  const { data, error } = await supabase
    .from("ciclotrones")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function crearCiclotrón(payload: CiclotrónInsert): Promise<Ciclotrón> {
  const { data, error } = await supabase
    .from("ciclotrones")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarCiclotrón(id: string, payload: CiclotrónUpdate): Promise<Ciclotrón> {
  const { data, error } = await supabase
    .from("ciclotrones")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarCiclotrón(id: string): Promise<void> {
  const { error } = await supabase
    .from("ciclotrones")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/** Extrae el perfil de parámetros tipado desde el campo JSONB */
export function parsearParametros(ciclotrón: Ciclotrón): CiclotrónParametros {
  return {
    ...DEFAULT_CICLOTRÓN_PARAMETROS,
    ...(ciclotrón.parametros as Partial<CiclotrónParametros>),
  };
}
