/**
 * ciclo-evaluaciones.ts
 * Servicio CRUD para Evaluaciones de Ciclotrón (DOC1604037 rev9)
 */
import { supabase } from "@/lib/supabase";
import type {
  CicloEvaluacion,
  DatosSitio,
  DatosPerformance,
} from "@/types/entities";

// ── Tipos de parámetros ───────────────────────────────────────────────────────

export interface CrearEvaluacionParams {
  empresa_id: string;
  ciclotrón_id: string;
  equipo_id?: string | null;
  tipo_evaluacion: CicloEvaluacion["tipo_evaluacion"];
  ingeniero_nombre?: string;
  tiene_deuterio: boolean;
  modelo_pt?: string;
  version_sw?: string;
}

export interface ProduccionDualInput {
  numero: number;
  site?: string;
  batch?: string;
  target?: string;
  fecha?: string;
  configuracion?: string;
  [key: string]: unknown;
}

// ── Mapeo DB → Entidad ────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): CicloEvaluacion {
  return {
    id:                row.id as string,
    empresa_id:        row.empresa_id as string,
    ciclotrón_id:      row["ciclotrón_id"] as string,
    equipo_id:         (row.equipo_id as string | null) ?? null,
    numero:            row.numero as string,
    fecha:             row.fecha as string,
    tipo_evaluacion:   row.tipo_evaluacion as CicloEvaluacion["tipo_evaluacion"],
    ingeniero_nombre:  (row.ingeniero_nombre as string | null) ?? null,
    estado:            row.estado as CicloEvaluacion["estado"],
    resultado_general: (row.resultado_general as CicloEvaluacion["resultado_general"]) ?? null,
    tiene_deuterio:    row.tiene_deuterio as boolean,
    modelo_pt:         (row.modelo_pt as string | null) ?? null,
    version_sw:        (row.version_sw as string | null) ?? null,
    datos_sitio:       (row.datos_sitio as DatosSitio) ?? {},
    datos_performance: (row.datos_performance as DatosPerformance) ?? {},
    datos_evaluacion:  (row.datos_evaluacion as { producciones: ProduccionDualInput[] }) ?? { producciones: [] },
    observaciones:     (row.observaciones as string | null) ?? null,
    created_at:        row.created_at as string,
    updated_at:        row.updated_at as string,
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Lista todas las evaluaciones de la empresa */
export async function getEvaluaciones(empresaId: string): Promise<CicloEvaluacion[]> {
  const { data, error } = await supabase
    .from("ciclo_evaluaciones")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

/** Lista evaluaciones de un ciclotrón específico */
export async function getEvaluacionesByCiclotrón(
  empresaId: string,
  ciclotrónId: string
): Promise<CicloEvaluacion[]> {
  const { data, error } = await supabase
    .from("ciclo_evaluaciones")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("ciclotrón_id", ciclotrónId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

/** Obtiene una evaluación por ID */
export async function getEvaluacion(id: string): Promise<CicloEvaluacion | null> {
  const { data, error } = await supabase
    .from("ciclo_evaluaciones")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data ? mapRow(data as Record<string, unknown>) : null;
}

// ── Mutaciones ────────────────────────────────────────────────────────────────

/** Crea una nueva evaluación con auto-número */
export async function crearEvaluacion(
  params: CrearEvaluacionParams
): Promise<CicloEvaluacion> {
  const { data, error } = await supabase.rpc("crear_ciclo_evaluacion", {
    p_empresa_id:     params.empresa_id,
    p_ciclotrón_id:   params.ciclotrón_id,
    p_equipo_id:      params.equipo_id ?? null,
    p_tipo:           params.tipo_evaluacion,
    p_ingeniero:      params.ingeniero_nombre ?? null,
    p_tiene_deuterio: params.tiene_deuterio,
    p_modelo_pt:      params.modelo_pt ?? null,
    p_version_sw:     params.version_sw ?? null,
  });
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

/** Guarda la sección de datos del sitio (paso 2) */
export async function guardarDatosSitio(
  evalId: string,
  datos: DatosSitio
): Promise<CicloEvaluacion> {
  const { data, error } = await supabase.rpc("guardar_ciclo_eval_seccion", {
    p_eval_id: evalId,
    p_seccion: "sitio",
    p_datos:   datos,
  });
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

/** Guarda los datos del Performance Test (paso 3) */
export async function guardarDatosPerformance(
  evalId: string,
  datos: DatosPerformance
): Promise<CicloEvaluacion> {
  const { data, error } = await supabase.rpc("guardar_ciclo_eval_seccion", {
    p_eval_id: evalId,
    p_seccion: "performance",
    p_datos:   datos,
  });
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

/** Guarda los datos de System Evaluation (paso 4) */
export async function guardarDatosEvaluacion(
  evalId: string,
  producciones: ProduccionDualInput[]
): Promise<CicloEvaluacion> {
  const { data, error } = await supabase.rpc("guardar_ciclo_eval_seccion", {
    p_eval_id: evalId,
    p_seccion: "evaluacion",
    p_datos:   { producciones },
  });
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

/** Marca la evaluación como completada */
export async function completarEvaluacion(
  evalId: string,
  resultado: "pass" | "fail",
  observaciones?: string
): Promise<CicloEvaluacion> {
  const { data, error } = await supabase.rpc("completar_ciclo_evaluacion", {
    p_eval_id:       evalId,
    p_resultado:     resultado,
    p_observaciones: observaciones ?? null,
  });
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

/** Cambia el estado a en_progreso */
export async function marcarEnProgreso(evalId: string): Promise<void> {
  const { error } = await supabase
    .from("ciclo_evaluaciones")
    .update({ estado: "en_progreso" })
    .eq("id", evalId);
  if (error) throw error;
}

/** Elimina una evaluación (solo en borrador) */
export async function eliminarEvaluacion(evalId: string): Promise<void> {
  const { error } = await supabase
    .from("ciclo_evaluaciones")
    .delete()
    .eq("id", evalId)
    .eq("estado", "borrador");
  if (error) throw error;
}
