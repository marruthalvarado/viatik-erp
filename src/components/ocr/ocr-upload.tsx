/**
 * ocr-upload.tsx — IA-1
 *
 * Zona de drag & drop para seleccionar documentos a procesar con OCR.
 * Acepta: JPG, JPEG, PNG, PDF (máx 20 MB).
 *
 * El componente no accede a servicios ni a Supabase directamente.
 * Delega el proceso al hook `useUploadDocument` vía prop `onFileSelected`.
 */
import { useRef, useState, useCallback } from "react";
import { Upload, FileImage, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface OcrUploadProps {
  /** Llamado cuando el usuario selecciona un archivo válido. */
  onFileSelected: (file: File) => void;
  /** Deshabilita la zona de drop mientras hay un proceso activo. */
  disabled?: boolean;
  className?: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "application/pdf", "application/xml", "text/xml"];
const EXTENSIONES_LABEL = "JPG, PNG, PDF, XML";
const MAX_MB = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esArchivoValido(file: File): boolean {
  const esXml = file.name.toLowerCase().endsWith(".xml");
  return (TIPOS_ACEPTADOS.includes(file.type) || esXml) && file.size <= MAX_MB * 1024 * 1024;
}

function iconoPorTipo(tipo: string) {
  if (tipo === "application/pdf") return FileText;
  return FileImage;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function OcrUpload({ onFileSelected, disabled = false, className }: OcrUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const procesar = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!esArchivoValido(file)) {
        setErrorLocal(
          `Tipo o tamaño inválido. Se aceptan ${EXTENSIONES_LABEL} de hasta ${MAX_MB} MB.`,
        );
        return;
      }
      setErrorLocal(null);
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleDrop = useCallback(
    (ev: React.DragEvent<HTMLDivElement>) => {
      ev.preventDefault();
      setDragging(false);
      if (disabled) return;
      const file = ev.dataTransfer.files[0];
      procesar(file);
    },
    [disabled, procesar],
  );

  const handleDragOver = useCallback(
    (ev: React.DragEvent<HTMLDivElement>) => {
      ev.preventDefault();
      if (!disabled) setDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleInputChange = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      procesar(ev.target.files?.[0]);
      // Reset para permitir volver a seleccionar el mismo archivo
      ev.target.value = "";
    },
    [procesar],
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Zona de carga de documentos. Arrastra un archivo o haz clic para seleccionar."
        aria-disabled={disabled}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(ev) => {
          if ((ev.key === "Enter" || ev.key === " ") && !disabled) {
            ev.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3",
          "rounded-xl border-2 border-dashed p-10 text-center",
          "transition-colors duration-150 outline-none",
          dragging && !disabled
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/40",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Upload className="size-5 text-muted-foreground" />
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            {dragging ? "Suelta el archivo aquí" : "Arrastra un documento o haz clic"}
          </p>
          <p className="text-xs text-muted-foreground">
            {EXTENSIONES_LABEL} · Máx. {MAX_MB} MB
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={(ev) => {
            ev.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Seleccionar archivo
        </Button>
      </div>

      {errorLocal && (
        <p role="alert" className="text-xs text-destructive">
          {errorLocal}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf,.xml"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleInputChange}
      />
    </div>
  );
}

// Sub-componente: ícono para previsualización de tipo de archivo
export function OcrFileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const Icon = iconoPorTipo(mimeType);
  return <Icon className={cn("text-muted-foreground", className)} />;
}
