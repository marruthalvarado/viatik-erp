/**
 * Servicio para la tabla `ciclo_producciones`.
 * Maneja el ciclo de vida completo de un batch de producción:
 * subida de archivo a Storage, registro en BD y resultado de análisis.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CicloProduccion, CicloProduccionInsert, CicloProduccionUpdate, CicloAnomalia } from "@/types/entities";

export type { CicloAnomalia };

// ── Consultas ────────────────────────────────────────────────────────────────

export async function getCicloProduccionesDeciclotron(
  ciclotrónId: string,
): Promise<CicloProduccion[]> {
  const { data, error } = await supabase
    .from("ciclo_producciones")
    .select("*")
    .eq("ciclotrón_id", ciclotrónId)
    .order("numero_batch", { ascending: false, nullsFirst: false })
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getCicloProduccion(id: string): Promise<CicloProduccion | null> {
  const { data, error } = await supabase
    .from("ciclo_producciones")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// ── Creación y actualización ─────────────────────────────────────────────────

export async function crearCicloProduccion(
  payload: CicloProduccionInsert,
): Promise<CicloProduccion> {
  const { data, error } = await supabase
    .from("ciclo_producciones")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarCicloProduccion(
  id: string,
  payload: CicloProduccionUpdate,
): Promise<CicloProduccion> {
  const { data, error } = await supabase
    .from("ciclo_producciones")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarCicloProduccion(id: string): Promise<void> {
  const { error } = await supabase
    .from("ciclo_producciones")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ── Storage ──────────────────────────────────────────────────────────────────

const BUCKET = "ciclo-producciones";

/**
 * Sube el archivo original del batch y devuelve el path en Storage.
 * El path incluye empresa_id/ciclotrón_id/nombre para evitar colisiones.
 */
export async function subirArchivoBatch(
  empresaId: string,
  ciclotrónId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "log";
  const ts = Date.now();
  const path = `${empresaId}/${ciclotrónId}/${ts}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
  if (error) throw error;

  void ext; // utilizado sólo para documentar
  return path;
}

/** Descarga el archivo original desde Storage como Blob */
export async function descargarArchivoBatch(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return data;
}

/** Obtiene una URL firmada de 10 minutos para previsualización o descarga */
export async function urlFirmadaBatch(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}

export async function eliminarArchivoBatch(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

// ── Helpers de estado ────────────────────────────────────────────────────────

export function estadoDesdeAnomalias(
  anomalias: CicloAnomalia[],
): CicloProduccion["estado"] {
  if (anomalias.length === 0) return "normal";
  const hayCritico = anomalias.some((a) => a.severidad === "critical");
  return hayCritico ? "critico" : "con_alertas";
}
