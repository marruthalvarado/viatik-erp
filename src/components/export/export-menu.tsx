/**
 * Menú de exportación reutilizable — FASE 8F
 *
 * Punto de entrada único para exportar cualquier reporte.
 * Se integra en el PageHeader.actions de cada pantalla.
 *
 * Props:
 *   config   — ExportConfig con los datos y columnas actuales
 *   disabled — deshabilitar mientras los datos cargan
 *   label    — texto del botón (default "Exportar")
 *
 * Flujo: clic → (diálogo si >5000 filas) → useExport → servicio → descarga
 */
import { useState } from "react";
import { Download, FileSpreadsheet, FileText, FileDown, Printer } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useExport } from "@/hooks/use-export";
import type { ExportConfig, ExportFormat } from "@/services/export/export-utils";
import { ExportProgress } from "./export-progress";
import { ExportDialog } from "./export-dialog";

const DIALOG_THRESHOLD = 5_000;

interface ExportMenuProps {
  config: ExportConfig;
  disabled?: boolean;
  label?: string;
}

export function ExportMenu({ config, disabled = false, label = "Exportar" }: ExportMenuProps) {
  const { status, error, exportData, reset } = useExport();
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const isLoading = status === "loading";

  function handleSelect(format: ExportFormat) {
    reset();
    if (config.rows.length > DIALOG_THRESHOLD) {
      setPendingFormat(format);
      setDialogOpen(true);
    } else {
      void exportData(format, config);
    }
  }

  function handleConfirm() {
    setDialogOpen(false);
    if (pendingFormat) {
      void exportData(pendingFormat, config);
      setPendingFormat(null);
    }
  }

  function handleCancel() {
    setDialogOpen(false);
    setPendingFormat(null);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <ExportProgress status={status} error={error} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || isLoading || config.rows.length === 0}
              className="h-8 gap-1.5 text-xs"
              aria-label={`${label} — ${config.rows.length} registros`}
            >
              <Download className="size-3.5" aria-hidden="true" />
              {label}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {config.rows.length.toLocaleString("es-EC")} registros
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem className="gap-2 text-xs" onSelect={() => handleSelect("xlsx")}>
              <FileSpreadsheet className="size-3.5 text-emerald-600" aria-hidden="true" />
              Excel (.xlsx)
            </DropdownMenuItem>

            <DropdownMenuItem className="gap-2 text-xs" onSelect={() => handleSelect("pdf")}>
              <FileText className="size-3.5 text-red-500" aria-hidden="true" />
              PDF
            </DropdownMenuItem>

            <DropdownMenuItem className="gap-2 text-xs" onSelect={() => handleSelect("csv")}>
              <FileDown className="size-3.5 text-blue-500" aria-hidden="true" />
              CSV (separado por punto y coma)
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem className="gap-2 text-xs" onSelect={() => handleSelect("print")}>
              <Printer className="size-3.5 text-muted-foreground" aria-hidden="true" />
              Imprimir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ExportDialog
        open={dialogOpen}
        format={pendingFormat}
        rowCount={config.rows.length}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
