/**
 * Hook de exportación unificado — FASE 8F
 *
 * Centraliza el despacho a los servicios de exportación.
 * Los componentes nunca llaman directamente a los servicios.
 *
 * Arquitectura: Componente → useExport → Service → archivo descargado
 */
import { useState, useCallback } from "react";
import type { ExportConfig, ExportFormat, ExportResult } from "@/services/export/export-utils";

export type ExportStatus = "idle" | "loading" | "success" | "error";

export interface UseExportReturn {
  status: ExportStatus;
  error: string | null;
  exportData: (format: ExportFormat, config: ExportConfig) => Promise<void>;
  reset: () => void;
}

export function useExport(): UseExportReturn {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const exportData = useCallback(
    async (format: ExportFormat, config: ExportConfig): Promise<void> => {
      setStatus("loading");
      setError(null);

      let result: ExportResult;

      try {
        switch (format) {
          case "xlsx": {
            const { exportToExcel } = await import("@/services/export/excel-export");
            result = await exportToExcel(config);
            break;
          }
          case "pdf": {
            const { exportToPdf } = await import("@/services/export/pdf-export");
            result = await exportToPdf(config);
            break;
          }
          case "csv": {
            const { exportToCsv } = await import("@/services/export/csv-export");
            result = await exportToCsv(config);
            break;
          }
          case "print": {
            const { exportToPrint } = await import("@/services/export/print-export");
            result = await exportToPrint(config);
            break;
          }
        }

        if (result.success) {
          setStatus("success");
          // Volver a idle después de 2s para permitir nueva exportación
          setTimeout(() => {
            setStatus((prev) => (prev === "success" ? "idle" : prev));
          }, 2000);
        } else {
          setStatus("error");
          setError(result.error ?? "Error desconocido en la exportación");
        }
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Error inesperado al exportar");
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return { status, error, exportData, reset };
}
