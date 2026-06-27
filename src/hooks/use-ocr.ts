/**
 * use-ocr.ts — IA-1
 *
 * Hook para consultar y reutilizar resultados OCR de documentos existentes.
 *
 * Arquitectura: Componente → Hook → OcrService → Supabase
 * El componente nunca llama servicios directamente.
 *
 * Uso:
 *   // Consultar extracción existente por documento
 *   const { extraccion, cargando, error } = useOcr({ documentoId });
 *
 *   // Iniciar OCR sobre un documento ya subido
 *   const { reprocesar, procesando } = useOcrReprocesar({ documentoId });
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getExtraccionByDocumentoId, procesarDocumentoOcr } from "@/services/ocr/ocr-service";
import type { OcrExtraccion } from "@/types/entities";
import type { OcrPipelineResult } from "@/services/ocr/ocr-service";

// ─── Claves de query ──────────────────────────────────────────────────────────

export const OCR_KEYS = {
  extraccion: (documentoId: string) => ["ocr_extracciones", documentoId] as const,
};

// ─── useOcr — consultar extracción existente ──────────────────────────────────

export interface UseOcrOptions {
  documentoId: string;
  /** Si false, no ejecuta la query. Default: true. */
  enabled?: boolean;
}

export interface UseOcrReturn {
  extraccion: OcrExtraccion | null;
  cargando: boolean;
  error: string | null;
  /** Recarga manualmente la extracción. */
  recargar: () => void;
}

export function useOcr({ documentoId, enabled = true }: UseOcrOptions): UseOcrReturn {
  const query = useQuery({
    queryKey: OCR_KEYS.extraccion(documentoId),
    queryFn: () => getExtraccionByDocumentoId(documentoId),
    enabled: enabled && Boolean(documentoId),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return {
    extraccion: query.data ?? null,
    cargando: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    recargar: () => void query.refetch(),
  };
}

// ─── useOcrReprocesar — iniciar OCR sobre documento existente ─────────────────

export interface UseOcrReprocesarOptions {
  empresaId: string;
  rendicionId: string;
  documentoId: string;
  onSuccess?: (resultado: OcrPipelineResult) => void;
  onError?: (error: Error) => void;
}

export interface UseOcrReprocesarReturn {
  /** Reprocesa el OCR de un archivo ya subido (requiere el File original). */
  reprocesar: (file: File) => void;
  procesando: boolean;
  error: string | null;
}

export function useOcrReprocesar(options: UseOcrReprocesarOptions): UseOcrReprocesarReturn {
  const { empresaId, rendicionId, documentoId, onSuccess, onError } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (file: File) =>
      procesarDocumentoOcr({ file, empresaId, rendicionId, documentoId }, {}),
    onSuccess: (resultado) => {
      void queryClient.invalidateQueries({
        queryKey: OCR_KEYS.extraccion(documentoId),
      });
      onSuccess?.(resultado);
    },
    onError: (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  });

  return {
    reprocesar: (file: File) => mutation.mutate(file),
    procesando: mutation.isPending,
    error: mutation.error instanceof Error ? mutation.error.message : null,
  };
}
