/**
 * use-upload-document.ts — IA-1
 *
 * Hook para upload de documentos con progreso, cancelación y reintento.
 *
 * Arquitectura: Componente → Hook → OcrService → Storage
 * El componente nunca llama servicios directamente.
 *
 * Uso:
 *   const { upload, estado, progreso, error, cancelar, reintentar } =
 *     useUploadDocument({ empresaId, rendicionId });
 *
 *   const handleFile = (file: File) => upload(file);
 */
import { useState, useRef, useCallback } from "react";
import {
  procesarDocumentoOcr,
  validarArchivo,
  type OcrPipelineResult,
} from "@/services/ocr/ocr-service";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type EstadoUpload =
  | "idle"
  | "validando"
  | "subiendo"
  | "procesando_ocr"
  | "completado"
  | "error"
  | "cancelado";

export interface UseUploadDocumentOptions {
  empresaId: string;
  rendicionId: string | null;
  /** Callback cuando el proceso completo termina con éxito. */
  onSuccess?: (resultado: OcrPipelineResult) => void;
  /** Callback cuando ocurre un error. */
  onError?: (error: Error) => void;
}

export interface UseUploadDocumentReturn {
  /** Inicia el proceso upload + OCR para un archivo. */
  upload: (file: File) => Promise<void>;
  /** Estado actual del proceso. */
  estado: EstadoUpload;
  /** Progreso de upload 0-100 (solo válido en estado 'subiendo'). */
  progreso: number;
  /** Mensaje de error cuando estado === 'error'. */
  error: string | null;
  /** Archivo actualmente en proceso. */
  archivoActual: File | null;
  /** Resultado cuando estado === 'completado'. */
  resultado: OcrPipelineResult | null;
  /** Cancela el upload en curso (solo durante 'subiendo'). */
  cancelar: () => void;
  /** Reintenta el último upload fallido o cancelado. */
  reintentar: () => Promise<void>;
  /** Reinicia el estado al inicial. */
  reset: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUploadDocument(options: UseUploadDocumentOptions): UseUploadDocumentReturn {
  const { empresaId, rendicionId, onSuccess, onError } = options;

  const [estado, setEstado] = useState<EstadoUpload>("idle");
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [archivoActual, setArchivoActual] = useState<File | null>(null);
  const [resultado, setResultado] = useState<OcrPipelineResult | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setEstado("idle");
    setProgreso(0);
    setError(null);
    setArchivoActual(null);
    setResultado(null);
  }, []);

  const cancelar = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setEstado("cancelado");
      setProgreso(0);
    }
  }, []);

  const ejecutar = useCallback(
    async (file: File) => {
      // Cancelar cualquier operación anterior
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setArchivoActual(file);
      setError(null);
      setResultado(null);
      setProgreso(0);

      // Validación
      setEstado("validando");
      const validacion = validarArchivo(file);
      if (!validacion.valido) {
        const err = new Error(validacion.error);
        setEstado("error");
        setError(validacion.error ?? "Archivo inválido");
        onError?.(err);
        return;
      }

      try {
        setEstado("subiendo");

        const res = await procesarDocumentoOcr(
          { file, empresaId, rendicionId },
          {
            signal: controller.signal,
            onProgress: (pct) => {
              setProgreso(pct);
              // Cuando upload termina, el siguiente paso es OCR
              if (pct >= 100) setEstado("procesando_ocr");
            },
          },
        );

        if (controller.signal.aborted) return;

        setResultado(res);
        setEstado("completado");
        onSuccess?.(res);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setEstado("cancelado");
          return;
        }
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setEstado("error");
        setError(msg);
        onError?.(err instanceof Error ? err : new Error(msg));
      }
    },
    [empresaId, rendicionId, onSuccess, onError],
  );

  const reintentar = useCallback(async () => {
    if (!archivoActual) return;
    await ejecutar(archivoActual);
  }, [archivoActual, ejecutar]);

  return {
    upload: ejecutar,
    estado,
    progreso,
    error,
    archivoActual,
    resultado,
    cancelar,
    reintentar,
    reset,
  };
}
