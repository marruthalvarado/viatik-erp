/**
 * Diálogo de confirmación de exportación — FASE 8F
 *
 * Se muestra cuando el dataset supera un umbral (> 5.000 filas)
 * para advertir al usuario antes de generar el archivo.
 * Componente reutilizable para todos los reportes.
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ExportFormat } from "@/services/export/export-utils";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  xlsx: "Excel (.xlsx)",
  pdf: "PDF",
  csv: "CSV",
  print: "Imprimir",
};

interface ExportDialogProps {
  open: boolean;
  format: ExportFormat | null;
  rowCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExportDialog({ open, format, rowCount, onConfirm, onCancel }: ExportDialogProps) {
  if (!format) return null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Exportar a {FORMAT_LABELS[format]}</AlertDialogTitle>
          <AlertDialogDescription>
            Este reporte contiene <strong>{rowCount.toLocaleString("es-EC")} registros</strong>. La
            generación del archivo puede tardar algunos segundos.
            {format === "pdf" && rowCount > 1000 && (
              <span className="mt-1 block text-amber-600 dark:text-amber-400">
                Para datasets grandes, Excel o CSV ofrecen mejor rendimiento que PDF.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Exportar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
