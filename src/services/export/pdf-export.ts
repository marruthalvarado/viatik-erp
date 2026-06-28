/**
 * Servicio de exportación PDF — FASE 8F
 *
 * Usa jsPDF + jspdf-autotable con dynamic import para code-splitting.
 * Incluye: logo placeholder, empresa, título, filtros, fecha, tabla paginada, pie.
 * No accede a Supabase. Solo transforma ExportConfig → archivo descargado.
 */
import type { UserOptions } from "jspdf-autotable";
import { type ExportConfig, type ExportResult, formatCell } from "./export-utils";
import {
  LOGO_VIATIQ_PNG_B64,
  LOGO_VIATIQ_W,
  LOGO_VIATIQ_H,
} from "@/assets/branding/logo-viatiq-b64";

const PDF_BLUE = [30, 64, 175] as const;
const PDF_GRAY_LIGHT = [248, 250, 252] as const;
const PDF_GRAY_TEXT = [100, 116, 139] as const;

export async function exportToPdf(config: ExportConfig): Promise<ExportResult> {
  try {
    const { jsPDF } = await import("jspdf");
    const { autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.width;
    const pageH = doc.internal.pageSize.height;

    // ── Cabecera primera página ────────────────────────────────────────────────
    let y = 16;

    // Logo VIATIQ
    (
      doc as unknown as {
        addImage: (img: string, fmt: string, x: number, y: number, w: number, h: number) => void;
      }
    ).addImage(LOGO_VIATIQ_PNG_B64, "PNG", 14, y - 3, LOGO_VIATIQ_W, LOGO_VIATIQ_H);

    // Título (junto al logo, a la derecha)
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(config.title, 14 + LOGO_VIATIQ_W + 6, y + 5);
    y += 11;

    // Empresa / subtítulo
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    if (config.empresa) {
      doc.setTextColor(...PDF_GRAY_TEXT);
      doc.text(config.empresa, 14, y);
      doc.setTextColor(0, 0, 0);
      y += 5;
    }
    if (config.subtitle) {
      doc.setTextColor(...PDF_GRAY_TEXT);
      doc.text(config.subtitle, 14, y);
      doc.setTextColor(0, 0, 0);
      y += 5;
    }

    // Filtros aplicados
    if (config.filtros) {
      const partes = Object.entries(config.filtros)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`);
      if (partes.length > 0) {
        doc.setFontSize(8);
        doc.setTextColor(...PDF_GRAY_TEXT);
        doc.text(`Filtros: ${partes.join("  |  ")}`, 14, y);
        doc.setTextColor(0, 0, 0);
        y += 5;
      }
    }

    // Fecha de generación
    doc.setFontSize(7);
    doc.setTextColor(...PDF_GRAY_TEXT);
    doc.text(`Generado: ${config.generatedAt ?? new Date().toLocaleString("es-EC")}`, 14, y);
    doc.setTextColor(0, 0, 0);
    y += 4;

    // ── Tabla ──────────────────────────────────────────────────────────────────
    const tableOptions: UserOptions = {
      startY: y,
      head: [config.columns.map((c) => c.header)],
      body: config.rows.map((row) =>
        config.columns.map((col) => formatCell(row[col.key], col.format)),
      ),
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [...PDF_BLUE],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [...PDF_GRAY_LIGHT],
      },
      columnStyles: Object.fromEntries(
        config.columns.map((col, i) => [
          i,
          {
            halign:
              col.align ??
              (col.format === "number" || col.format === "currency" || col.format === "percent"
                ? "right"
                : "left"),
            cellWidth: col.width ?? "auto",
          },
        ]),
      ),
      didDrawPage: (data) => {
        const pageNum = data.pageNumber;
        const total = doc.getNumberOfPages();
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...PDF_GRAY_TEXT);
        // Pie izquierdo: título del reporte
        doc.text(config.title, 14, pageH - 9);
        // Pie central: aviso legal
        doc.text(
          "VIATIQ · © 2026 Nuclearpet S.A.S. Todos los derechos reservados. · Software propietario.",
          pageW / 2,
          pageH - 9,
          { align: "center" },
        );
        // Pie derecho: paginación
        doc.text(`Página ${pageNum} de ${total}`, pageW - 14, pageH - 9, { align: "right" });
        doc.setTextColor(0, 0, 0);
      },
    };

    autoTable(doc, tableOptions);

    doc.save(`${config.filename}.pdf`);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al exportar PDF",
    };
  }
}
