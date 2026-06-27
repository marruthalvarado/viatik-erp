/**
 * Servicio de exportación CSV — FASE 8F
 *
 * UTF-8 con BOM para compatibilidad con Excel español.
 * Separador configurable (default ";").
 * No accede a Supabase. Solo transforma ExportConfig → archivo descargado.
 */
import {
  type ExportConfig,
  type ExportResult,
  formatCell,
  buildHeaderLines,
  triggerBlobDownload,
} from "./export-utils";

export interface CsvExportOptions {
  separator?: "," | ";" | "\t";
  includeMetaHeader?: boolean;
}

export async function exportToCsv(
  config: ExportConfig,
  options: CsvExportOptions = {},
): Promise<ExportResult> {
  try {
    const { separator = ";", includeMetaHeader = true } = options;
    const lines: string[] = [];

    if (includeMetaHeader) {
      for (const line of buildHeaderLines(config)) {
        lines.push(`"${line.replace(/"/g, '""')}"`);
      }
      lines.push(""); // línea vacía antes de los datos
    }

    // Encabezados
    lines.push(config.columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(separator));

    // Filas de datos
    for (const row of config.rows) {
      const cells = config.columns.map((col) => {
        const raw = row[col.key];
        const formatted = formatCell(raw, col.format);
        return `"${formatted.replace(/"/g, '""')}"`;
      });
      lines.push(cells.join(separator));
    }

    // BOM UTF-8 para que Excel lo abra correctamente
    const content = "﻿" + lines.join("\r\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    triggerBlobDownload(blob, `${config.filename}.csv`);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al exportar CSV",
    };
  }
}
