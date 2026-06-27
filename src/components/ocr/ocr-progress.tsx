/**
 * ocr-progress.tsx — IA-1
 *
 * Barra de progreso para el proceso upload + OCR.
 * Incluye botones de cancelar y reintentar según el estado.
 *
 * El componente no accede a servicios ni a Supabase directamente.
 * Recibe el estado desde el hook `useUploadDocument`.
 */
import { Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { EstadoUpload } from "@/hooks/use-upload-document";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface OcrProgressProps {
  estado: EstadoUpload;
  progreso: number;
  error?: string | null;
  onCancelar?: () => void;
  onReintentar?: () => void;
  onReset?: () => void;
  className?: string;
}

// ─── Textos por estado ────────────────────────────────────────────────────────

const TEXTOS: Record<EstadoUpload, string> = {
  idle: "",
  validando: "Validando archivo...",
  subiendo: "Subiendo documento...",
  procesando_ocr: "Extrayendo texto con OCR...",
  completado: "Procesamiento completado",
  error: "Ocurrió un error",
  cancelado: "Upload cancelado",
};

// ─── Componente ───────────────────────────────────────────────────────────────

export function OcrProgress({
  estado,
  progreso,
  error,
  onCancelar,
  onReintentar,
  onReset,
  className,
}: OcrProgressProps) {
  if (estado === "idle") return null;

  const enProceso = estado === "validando" || estado === "subiendo" || estado === "procesando_ocr";
  const esError = estado === "error";
  const esCancelado = estado === "cancelado";
  const esCompletado = estado === "completado";

  // El progreso del upload va de 0-100; durante OCR mostramos indeterminado
  const valorBarra = estado === "procesando_ocr" ? undefined : progreso;

  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border p-4", className)}>
      {/* Estado + ícono */}
      <div className="flex items-center gap-2">
        {enProceso && <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />}
        {esCompletado && <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />}
        {(esError || esCancelado) && (
          <XCircle
            className={cn("size-4", esError ? "text-destructive" : "text-muted-foreground")}
            aria-hidden="true"
          />
        )}

        <span
          className={cn(
            "text-sm font-medium",
            esError && "text-destructive",
            esCancelado && "text-muted-foreground",
            esCompletado && "text-emerald-600",
          )}
        >
          {TEXTOS[estado]}
        </span>
      </div>

      {/* Barra de progreso */}
      {(enProceso || esCompletado) && (
        <div
          role="progressbar"
          aria-valuenow={valorBarra}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso del procesamiento OCR"
        >
          {valorBarra !== undefined ? (
            <Progress value={valorBarra} className="h-1.5" />
          ) : (
            // Progreso indeterminado (animación CSS)
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/3 animate-[progress-indeterminate_1.5s_ease-in-out_infinite] rounded-full bg-primary" />
            </div>
          )}
          {estado === "subiendo" && (
            <p className="mt-1 text-xs text-muted-foreground text-right">{progreso}%</p>
          )}
        </div>
      )}

      {/* Mensaje de error */}
      {esError && error && (
        <div className="flex items-start gap-1.5">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 justify-end">
        {enProceso && onCancelar && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancelar}
            aria-label="Cancelar upload"
          >
            Cancelar
          </Button>
        )}

        {(esError || esCancelado) && (
          <>
            {onReintentar && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={onReintentar}
                aria-label="Reintentar upload"
              >
                Reintentar
              </Button>
            )}
            {onReset && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onReset}
                aria-label="Volver al inicio"
              >
                Volver
              </Button>
            )}
          </>
        )}

        {esCompletado && onReset && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
            aria-label="Subir otro documento"
          >
            Subir otro
          </Button>
        )}
      </div>
    </div>
  );
}
