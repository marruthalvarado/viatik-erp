/**
 * ocr-storage.ts — IA-1
 *
 * Gestión de archivos de documentos en Supabase Storage.
 * Bucket: "documentos"
 * Path:   {empresa_id}/{rendicion_id}/{documento_id}_{nombre_archivo}
 *
 * Arquitectura: Hook → Service → Supabase Storage
 * Nunca acceder directamente desde componentes.
 */
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "documentos";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface StorageUploadResult {
  /** Path completo en el bucket. */
  storagePath: string;
  /** URL pública firmada válida por 1 hora (para preview). */
  signedUrl: string;
}

export interface StorageUploadOptions {
  /** Callback de progreso: 0-100 */
  onProgress?: (percent: number) => void;
  /** AbortSignal para cancelación. */
  signal?: AbortSignal;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function buildPath(
  empresaId: string,
  rendicionId: string,
  documentoId: string,
  fileName: string,
): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "bin";
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${empresaId}/${rendicionId}/${documentoId}_${safe}.${ext === safe.split(".").pop() ? "" : ext}`.replace(
    /\.+$/,
    "",
  );
}

/** Limpia el path para evitar dobles extensiones. */
function safePath(
  empresaId: string,
  rendicionId: string,
  documentoId: string,
  fileName: string,
): string {
  const nameParts = fileName.split(".");
  const ext = nameParts.length > 1 ? nameParts.pop()!.toLowerCase() : "bin";
  const base = nameParts.join("_").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${empresaId}/${rendicionId}/${documentoId}_${base}.${ext}`;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Sube un archivo al bucket y retorna el path y una URL firmada.
 * Usa el cliente de Supabase directamente (más robusto que signed upload URL + XHR).
 */
export async function uploadDocumento(
  file: File,
  empresaId: string,
  rendicionId: string | null,
  documentoId: string,
  options: StorageUploadOptions = {},
): Promise<StorageUploadResult> {
  const { onProgress, signal } = options;

  // Para el path de Storage usamos "sin_rendicion" cuando no hay rendición asignada.
  const pathRendicionId = rendicionId ?? "sin_rendicion";
  const path = safePath(empresaId, pathRendicionId, documentoId, file.name);

  // Progreso simulado: 0% → 40% mientras iniciamos, 40% → 95% durante upload
  onProgress?.(10);

  if (signal?.aborted) {
    throw new DOMException("Upload cancelado", "AbortError");
  }

  // Upload estándar Supabase (más confiable que signed URL + XHR)
  const contentType = file.type || "application/octet-stream";
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType });

  if (uploadError) {
    throw new Error(`[ocr-storage] Upload falló: ${uploadError.message}`);
  }

  onProgress?.(90);

  // Generar URL firmada de lectura (1 hora) — no fatal si falla
  let signedUrl = "";
  try {
    const { data: urlData } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);
    signedUrl = urlData?.signedUrl ?? "";
  } catch {
    // URL firmada es solo para preview — el pipeline continúa sin ella
  }

  onProgress?.(100);
  return { storagePath: path, signedUrl };
}

/** Descarga un archivo del bucket como Blob. */
export async function downloadDocumento(storagePath: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(`[ocr-storage] Error al descargar: ${error?.message}`);
  }
  return data;
}

/** Elimina un archivo del bucket. */
export async function deleteDocumento(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) {
    throw new Error(`[ocr-storage] Error al eliminar: ${error.message}`);
  }
}

/** Retorna una URL firmada válida por `ttlSeconds` para visualizar el archivo. */
export async function getSignedUrl(storagePath: string, ttlSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);
  if (error || !data) {
    throw new Error(`[ocr-storage] Error al crear URL firmada: ${error?.message}`);
  }
  return data.signedUrl;
}

void buildPath; // evita warning de unused — buildPath es alias interno
