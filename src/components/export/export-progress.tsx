/**
 * Indicador de progreso de exportación — FASE 8F
 * Muestra el estado actual: cargando / éxito / error.
 */
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { ExportStatus } from "@/hooks/use-export";

interface ExportProgressProps {
  status: ExportStatus;
  error: string | null;
}

export function ExportProgress({ status, error }: ExportProgressProps) {
  if (status === "idle") return null;

  if (status === "loading") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        Exportando…
      </span>
    );
  }

  if (status === "success") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
        Descargado
      </span>
    );
  }

  if (status === "error") {
    return (
      <span
        className="flex items-center gap-1.5 text-xs text-destructive"
        title={error ?? undefined}
      >
        <AlertCircle className="size-3.5" aria-hidden="true" />
        {error ? error.slice(0, 60) : "Error al exportar"}
      </span>
    );
  }

  return null;
}
