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
 * Usa XHR para tracking de progreso real.
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
  // Este valor es solo para organizar carpetas en el bucket, no se guarda en BD.
  const pathRendicionId = rendicionId ?? "sin_rendicion";
  const path = safePath(empresaId, pathRendicionId, documentoId, file.name);

  // Crear URL de upload firmada para poder usar XHR con progreso
  const { data: signedData, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (signedError || !signedData) {
    throw new Error(`[ocr-storage] No se pudo crear URL de upload: ${signedError?.message}`);
  }

  // Upload real con XHR para progreso byte a byte
  await uploadWithProgress(signedData.signedUrl, file, { onProgress, signal });

  // Generar URL firmada de lectura (1 hora)
  const { data: urlData, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);

  if (urlError || !urlData) {
    throw new Error(`[ocr-storage] No se pudo crear URL de lectura: ${urlError?.message}`);
  }

  return { storagePath: path, signedUrl: urlData.signedUrl };
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

// ─── Upload con progreso (XHR) ────────────────────────────────────────────────

function uploadWithProgress(
  signedUrl: string,
  file: File,
  options: StorageUploadOptions,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new DOMException("Upload cancelado", "AbortError"));
      });
    }

    xhr.upload.addEventListener("progress", (ev) => {
      if (ev.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`[ocr-storage] Upload falló con estado ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () =>
      reject(new Error("[ocr-storage] Error de red durante el upload")),
    );
    xhr.addEventListener("abort", () => reject(new DOMException("Upload cancelado", "AbortError")));

    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

void buildPath; // evita warning de unused — buildPath es alias interno
