/**
 * ocr-preview.tsx — IA-1
 *
 * Previsualización del archivo seleccionado antes o durante el procesamiento OCR.
 * Para imágenes: miniatura. Para PDFs: ícono + nombre de archivo.
 *
 * El componente no accede a servicios ni a Supabase directamente.
 */
import { useEffect, useState } from "react";
import { FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface OcrPreviewProps {
  /** Archivo a previsualizar. */
  file: File;
  /** Muestra botón de eliminar cuando hay un proceso activo y el usuario quiere cancelar. */
  onRemove?: () => void;
  /** Deshabilita el botón de eliminar. */
  removeDisabled?: boolean;
  className?: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_PREVIEW_BYTES = 5 * 1024 * 1024; // Solo generar preview para imágenes < 5 MB

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function esImagen(file: File): boolean {
  return file.type.startsWith("image/");
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function OcrPreview({ file, onRemove, removeDisabled = false, className }: OcrPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!esImagen(file) || file.size > MAX_PREVIEW_BYTES) {
      setObjectUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setObjectUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className={cn("flex items-center gap-3 rounded-lg border bg-muted/40 p-3", className)}>
      {/* Miniatura o ícono */}
      <div className="shrink-0">
        {objectUrl ? (
          <img
            src={objectUrl}
            alt={`Vista previa de ${file.name}`}
            className="size-14 rounded-md object-cover border"
          />
        ) : (
          <div className="flex size-14 items-center justify-center rounded-md border bg-background">
            <FileText className="size-6 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Metadatos */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(file.size)}
          {file.type === "application/pdf" && " · PDF"}
        </p>
        {file.type === "application/pdf" && (
          <p className="mt-0.5 text-xs text-amber-600">
            OCR de PDF requiere procesamiento en servidor
          </p>
        )}
      </div>

      {/* Botón eliminar/cancelar */}
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 size-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          disabled={removeDisabled}
          aria-label="Cancelar y eliminar archivo seleccionado"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
