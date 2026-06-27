/**
 * Servicio de exportación Excel — FASE 8F
 *
 * Usa SheetJS (xlsx) con dynamic import para code-splitting.
 * Características: formatos numéricos, fechas, encabezado, autofiltro, ancho automático.
 * No accede a Supabase. Solo transforma ExportConfig → archivo descargado.
 */
import type { CellValue } from "xlsx";
import { type ExportConfig, type ExportResult, formatCell, buildHeaderLines } from "./export-utils";

export async function exportToExcel(config: ExportConfig): Promise<ExportResult> {
  try {
    const XLSX = await import("xlsx");

    const aoa: CellValue[][] = [];

    // Cabecera de metadatos
    for (const line of buildHeaderLines(config)) {
      aoa.push([line]);
    }
    aoa.push([]); // fila vacía separadora

    const dataStartRow = aoa.length; // índice base-0 de la fila de encabezados de columna

    // Encabezados de columna
    aoa.push(config.columns.map((c) => c.header));

    // Filas de datos
    for (const row of config.rows) {
      aoa.push(
        config.columns.map((col) => {
          const raw = row[col.key];
          // Mantener números como número para que Excel calcule correctamente
          if ((col.format === "number" || col.format === "currency") && typeof raw === "number") {
            return raw;
          }
          return formatCell(raw, col.format);
        }),
      );
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Ancho de columnas (en caracteres)
    ws["!cols"] = config.columns.map((c) => ({
      wch: c.width ?? Math.max(c.header.length + 4, 14),
    }));

    // Autofiltro en la fila de encabezados
    if (config.rows.length > 0) {
      const lastCol = XLSX.utils.encode_col(config.columns.length - 1);
      ws["!autofilter"] = {
        ref: `A${dataStartRow + 1}:${lastCol}${dataStartRow + 1}`,
      };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, config.title.slice(0, 31));
    XLSX.writeFile(wb, `${config.filename}.xlsx`);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al exportar Excel",
    };
  }
}
