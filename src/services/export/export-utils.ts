/**
 * Tipos y utilidades compartidas para la capa de exportación — FASE 8F
 *
 * Toda la lógica de generación de archivos vive en los servicios de esta capa.
 * Los componentes NUNCA generan archivos directamente.
 */

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export type ExportFormat = "xlsx" | "pdf" | "csv" | "print";

export type ExportCellFormat = "text" | "number" | "currency" | "percent" | "date" | "boolean";

export interface ExportColumn {
  /** Clave del campo en cada ExportRow */
  key: string;
  /** Encabezado visible en el archivo exportado */
  header: string;
  /** Ancho de columna en caracteres (Excel) o mm (PDF). Auto si se omite. */
  width?: number;
  /** Formato de celda para renderizado */
  format?: ExportCellFormat;
  /** Alineación en PDF */
  align?: "left" | "right" | "center";
}

export type ExportCell = string | number | boolean | null | undefined;

export type ExportRow = Record<string, ExportCell>;

export interface ExportConfig {
  /** Nombre base del archivo (sin extensión) */
  filename: string;
  /** Título principal del reporte */
  title: string;
  /** Subtítulo opcional (ej: nombre del tab activo) */
  subtitle?: string;
  /** Nombre de la empresa activa */
  empresa?: string;
  /** Filtros aplicados para incluir en cabecera */
  filtros?: Record<string, string>;
  /** Definición de columnas */
  columns: ExportColumn[];
  /** Filas de datos */
  rows: ExportRow[];
  /** Fecha/hora de generación. Si se omite se usa new Date() */
  generatedAt?: string;
}

export interface ExportResult {
  success: boolean;
  error?: string;
}

// ─── Helpers de formato ────────────────────────────────────────────────────────

export function formatCell(value: ExportCell, format: ExportCellFormat = "text"): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Sí" : "No";

  switch (format) {
    case "number":
      return typeof value === "number"
        ? value.toLocaleString("es-EC", { maximumFractionDigits: 2 })
        : String(value);

    case "currency":
      return typeof value === "number"
        ? value.toLocaleString("es-EC", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2,
          })
        : String(value);

    case "percent":
      return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : String(value);

    case "date":
      if (typeof value === "string") return value.slice(0, 10);
      return String(value);

    default:
      return String(value);
  }
}

export function buildHeaderLines(config: ExportConfig): string[] {
  const lines: string[] = [config.title];
  if (config.empresa) lines.push(`Empresa: ${config.empresa}`);
  if (config.subtitle) lines.push(config.subtitle);
  lines.push(`Generado: ${config.generatedAt ?? new Date().toLocaleString("es-EC")}`);
  if (config.filtros) {
    for (const [k, v] of Object.entries(config.filtros)) {
      if (v) lines.push(`${k}: ${v}`);
    }
  }
  return lines;
}

/** Dispara la descarga de un Blob en el navegador sin manipulación DOM en componentes. */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
