/**
 * cotizacion-export.ts
 * Exporta cotizaciones a PDF (jsPDF) y Word (.docx) para descarga en el browser.
 */
import type { CotizacionConItems } from "@/services/cotizaciones";
import {
  LOGO_VIATIQ_PNG_B64,
  LOGO_VIATIQ_W,
  LOGO_VIATIQ_H,
} from "@/assets/branding/logo-viatiq-b64";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) =>
  "$" + n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtFecha = (d: string) => {
  const [y, m, day] = d.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${parseInt(day)} de ${meses[parseInt(m) - 1]}. ${y}`;
};

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF — jsPDF + autotable
// ─────────────────────────────────────────────────────────────────────────────

export async function exportCotizacionPdf(c: CotizacionConItems): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.width;   // 210
  const H = doc.internal.pageSize.height;  // 297
  const ML = 14;  // margin left
  const MR = 14;  // margin right
  const CW = W - ML - MR; // content width

  const BLUE    = [30, 64, 175]   as const;
  const BGBLUE  = [239, 246, 255] as const;
  const GRAY    = [107, 114, 128] as const;
  const DARK    = [17, 24, 39]    as const;
  const BORDER  = [226, 232, 240] as const;

  let y = 14;

  // ── Cabecera ──
  // Logo
  (doc as unknown as { addImage: (img: string, fmt: string, x: number, y: number, w: number, h: number) => void })
    .addImage(LOGO_VIATIQ_PNG_B64, "PNG", ML, y - 2, LOGO_VIATIQ_W, LOGO_VIATIQ_H);

  // Número cotización (derecha)
  doc.setFontSize(18);
  doc.setTextColor(...BLUE);
  doc.setFont("helvetica", "bold");
  doc.text(c.numero, W - MR, y + 2, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  doc.text("PROPUESTA TÉCNICO-COMERCIAL", W - MR, y + 8, { align: "right" });

  y += 20;

  // Línea separadora azul
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.line(ML, y, W - MR, y);
  y += 5;

  // ── Info cliente ──
  const colW = CW / 2 - 4;
  // Bloque izquierdo: cliente
  doc.setFillColor(...BGBLUE);
  doc.roundedRect(ML, y, colW, 28, 2, 2, "F");
  doc.setFontSize(7);
  doc.setTextColor(...BLUE);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE", ML + 4, y + 5);
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(c.razon_social, ML + 4, y + 11);
  if (c.ruc_cliente) {
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text("RUC: " + c.ruc_cliente, ML + 4, y + 17);
  }
  if (c.email_cliente) {
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(c.email_cliente, ML + 4, y + 22);
  }

  // Bloque derecho: fechas/condiciones
  const rx = ML + colW + 8;
  doc.setFillColor(...BGBLUE);
  doc.roundedRect(rx, y, colW, 28, 2, 2, "F");
  doc.setFontSize(7);
  doc.setTextColor(...BLUE);
  doc.setFont("helvetica", "bold");
  doc.text("DETALLES", rx + 4, y + 5);
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  doc.text("Fecha:", rx + 4, y + 11);
  doc.setTextColor(...DARK);
  doc.text(fmtFecha(c.fecha), rx + 24, y + 11);
  if (c.valida_hasta) {
    doc.setTextColor(...GRAY);
    doc.text("Válida:", rx + 4, y + 17);
    doc.setTextColor(...DARK);
    doc.text(fmtFecha(c.valida_hasta), rx + 24, y + 17);
  }
  if (c.lugar_entrega) {
    doc.setTextColor(...GRAY);
    doc.text("Entrega:", rx + 4, y + 22);
    doc.setTextColor(...DARK);
    doc.text(c.lugar_entrega, rx + 24, y + 22);
  }

  y += 34;

  // ── Condiciones generales ──
  if (c.dias_entrega || c.meses_garantia) {
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    const parts: string[] = [];
    if (c.dias_entrega) parts.push(`Plazo de entrega: ${c.dias_entrega} días laborables`);
    if (c.meses_garantia) parts.push(`Garantía: ${c.meses_garantia} meses`);
    doc.text(parts.join("   ·   "), ML, y);
    y += 6;
  }

  // ── Tabla de ítems ──
  doc.setFontSize(9);
  doc.setTextColor(...BLUE);
  doc.setFont("helvetica", "bold");
  doc.text("ÍTEMS", ML, y + 4);
  y += 7;

  autoTable(doc as Parameters<typeof autoTable>[0], {
    startY: y,
    margin: { left: ML, right: MR },
    head: [["#", "Descripción", "Fab./Modelo", "Cant.", "P. Unit.", "Desc.", "Total"]],
    body: c.items.map((it, idx) => [
      String(idx + 1),
      it.descripcion,
      [it.fabricante, it.modelo].filter(Boolean).join(" ") || "—",
      String(it.cantidad),
      fmtMoney(it.precio_unitario),
      it.descuento_pct > 0 ? `${it.descuento_pct}%` : "—",
      fmtMoney(it.precio_neto),
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [...DARK] },
    headStyles: { fillColor: [...BLUE], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 14, halign: "center" },
      6: { cellWidth: 24, halign: "right", fontStyle: "bold" },
    },
    didDrawPage: () => { /* page numbers added at end */ },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ── Totales + Términos de pago ──
  const totW = 72;
  const totX = W - MR - totW;

  // Términos de pago (izquierda del bloque de totales)
  if (c.terminos_pago?.length) {
    doc.setFontSize(8);
    doc.setTextColor(...BLUE);
    doc.setFont("helvetica", "bold");
    doc.text("TÉRMINOS DE PAGO", ML, y + 4);
    y += 7;
    c.terminos_pago.forEach((t) => {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      doc.text(`• ${t.concepto}`, ML + 2, y);
      doc.text(`${t.porcentaje}%`, ML + 80, y, { align: "right" });
      y += 5;
    });
    y += 2;
  }

  // Cuadro de totales
  const boxY = y;
  doc.setFillColor(...BGBLUE);
  doc.roundedRect(totX, boxY, totW, 28, 2, 2, "F");

  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", totX + 4, boxY + 7);
  doc.setTextColor(...DARK);
  doc.text(fmtMoney(c.subtotal), totX + totW - 4, boxY + 7, { align: "right" });

  if (c.descuento_total > 0) {
    doc.setTextColor(...GRAY);
    doc.text("Descuento:", totX + 4, boxY + 13);
    doc.setTextColor([200, 30, 30] as unknown as number);
    doc.text(`− ${fmtMoney(c.descuento_total)}`, totX + totW - 4, boxY + 13, { align: "right" });
  }

  doc.setTextColor(...GRAY);
  doc.text(`IVA ${c.iva_pct}%:`, totX + 4, boxY + (c.descuento_total > 0 ? 19 : 13));
  doc.setTextColor(...DARK);
  doc.text(fmtMoney(c.iva), totX + totW - 4, boxY + (c.descuento_total > 0 ? 19 : 13), { align: "right" });

  // Línea divisoria
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(totX + 2, boxY + 22, totX + totW - 2, boxY + 22);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLUE);
  doc.text("TOTAL:", totX + 4, boxY + 27);
  doc.text(fmtMoney(c.total), totX + totW - 4, boxY + 27, { align: "right" });

  // ── Notas ──
  if (c.notas) {
    const ny = Math.max(y + 35, boxY + 35);
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "bold");
    doc.text("NOTAS", ML, ny);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(c.notas, CW) as string[];
    doc.text(lines, ML, ny + 4.5);
  }

  // ── Pie de página ──
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text("VIATIQ · Gestión de viáticos", ML, H - 8);
    doc.text(`${i} / ${totalPages}`, W - MR, H - 8, { align: "right" });
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(ML, H - 12, W - MR, H - 12);
  }

  doc.save(`${c.numero}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCX — docx npm (browser-compatible)
// ─────────────────────────────────────────────────────────────────────────────

export async function exportCotizacionDocx(c: CotizacionConItems): Promise<void> {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, HeadingLevel, BorderStyle,
    ShadingType, VerticalAlign,
  } = await import("docx");

  const BLUE_HEX = "1E40AF";
  const GRAY_HEX = "6B7280";
  const BGBLUE   = "EFF6FF";
  const WHITE     = "FFFFFF";

  const bold = (text: string, color = "111827", sz = 20) =>
    new TextRun({ text, bold: true, color, size: sz });
  const normal = (text: string, color = "374151", sz = 18) =>
    new TextRun({ text, color, size: sz });
  const small = (text: string, color = GRAY_HEX) =>
    new TextRun({ text, color, size: 16 });

  const cellW = (w: number) => ({ size: w, type: WidthType.DXA });
  const bordersNone = {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };
  const borderGray = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const para = (runs: any[], align: string = AlignmentType.LEFT, spacing = 80) =>
    new Paragraph({ children: runs, alignment: align as typeof AlignmentType.LEFT, spacing: { after: spacing } });

  // ── Sección: título ──
  const titleSection = [
    new Paragraph({
      children: [bold(c.numero, BLUE_HEX, 28)],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
    }),
    para([small("PROPUESTA TÉCNICO-COMERCIAL · VIATIQ")], AlignmentType.LEFT, 200),
  ];

  // ── Sección: cliente + fechas (tabla 2 columnas) ──
  const infoTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    borders: bordersNone,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: cellW(4500),
            borders: bordersNone,
            shading: { type: ShadingType.CLEAR, fill: BGBLUE },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              para([bold("CLIENTE", BLUE_HEX, 16)], AlignmentType.LEFT, 40),
              para([bold(c.razon_social, "111827", 20)], AlignmentType.LEFT, 40),
              ...(c.ruc_cliente ? [para([small("RUC: " + c.ruc_cliente)], AlignmentType.LEFT, 40)] : []),
              ...(c.email_cliente ? [para([small(c.email_cliente)], AlignmentType.LEFT, 0)] : []),
            ],
          }),
          new TableCell({
            width: cellW(4860),
            borders: bordersNone,
            shading: { type: ShadingType.CLEAR, fill: BGBLUE },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              para([bold("DETALLES", BLUE_HEX, 16)], AlignmentType.LEFT, 40),
              para([small("Fecha:  "), normal(fmtFecha(c.fecha))], AlignmentType.LEFT, 30),
              ...(c.valida_hasta ? [para([small("Válida hasta:  "), normal(fmtFecha(c.valida_hasta))], AlignmentType.LEFT, 30)] : []),
              ...(c.lugar_entrega ? [para([small("Entrega:  "), normal(c.lugar_entrega)], AlignmentType.LEFT, 30)] : []),
              ...(c.dias_entrega ? [para([small(`Plazo:  `), normal(`${c.dias_entrega} días laborables`)], AlignmentType.LEFT, 30)] : []),
              ...(c.meses_garantia ? [para([small("Garantía:  "), normal(`${c.meses_garantia} meses`)], AlignmentType.LEFT, 0)] : []),
            ],
          }),
        ],
      }),
    ],
  });

  // ── Sección: tabla de ítems ──
  const COL_WIDTHS = [400, 3400, 1600, 600, 1100, 800, 1060];
  const headers = ["#", "Descripción", "Fabricante / Modelo", "Cant.", "P. Unit.", "Desc.", "Total"];
  const headerRow = new TableRow({
    children: headers.map((h, i) =>
      new TableCell({
        width: cellW(COL_WIDTHS[i]),
        shading: { type: ShadingType.CLEAR, fill: BLUE_HEX },
        borders: bordersNone,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [para([bold(h, WHITE, 16)], i >= 3 ? AlignmentType.RIGHT : AlignmentType.LEFT, 0)],
      })
    ),
  });

  const itemRows = c.items.map((it, idx) =>
    new TableRow({
      children: [
        new TableCell({
          width: cellW(COL_WIDTHS[0]),
          shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? "F9FAFB" : WHITE },
          borders: borderGray,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para([normal(String(idx + 1), GRAY_HEX, 16)], AlignmentType.CENTER, 0)],
        }),
        new TableCell({
          width: cellW(COL_WIDTHS[1]),
          shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? "F9FAFB" : WHITE },
          borders: borderGray,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para([normal(it.descripcion, "111827", 16)], AlignmentType.LEFT, 0)],
        }),
        new TableCell({
          width: cellW(COL_WIDTHS[2]),
          shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? "F9FAFB" : WHITE },
          borders: borderGray,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para([small([it.fabricante, it.modelo].filter(Boolean).join(" ") || "—")], AlignmentType.LEFT, 0)],
        }),
        new TableCell({
          width: cellW(COL_WIDTHS[3]),
          shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? "F9FAFB" : WHITE },
          borders: borderGray,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para([normal(String(it.cantidad), "111827", 16)], AlignmentType.RIGHT, 0)],
        }),
        new TableCell({
          width: cellW(COL_WIDTHS[4]),
          shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? "F9FAFB" : WHITE },
          borders: borderGray,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para([normal(fmtMoney(it.precio_unitario), "111827", 16)], AlignmentType.RIGHT, 0)],
        }),
        new TableCell({
          width: cellW(COL_WIDTHS[5]),
          shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? "F9FAFB" : WHITE },
          borders: borderGray,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para([small(it.descuento_pct > 0 ? `${it.descuento_pct}%` : "—")], AlignmentType.CENTER, 0)],
        }),
        new TableCell({
          width: cellW(COL_WIDTHS[6]),
          shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? "F9FAFB" : WHITE },
          borders: borderGray,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para([bold(fmtMoney(it.precio_neto), BLUE_HEX, 16)], AlignmentType.RIGHT, 0)],
        }),
      ],
    })
  );

  const itemsTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: COL_WIDTHS,
    rows: [headerRow, ...itemRows],
  });

  // ── Sección: totales ──
  const totalesRows = [
    ["Subtotal", fmtMoney(c.subtotal)],
    ...(c.descuento_total > 0 ? [["Descuento", `− ${fmtMoney(c.descuento_total)}`]] : []),
    [`IVA ${c.iva_pct}%`, fmtMoney(c.iva)],
  ];

  const totalesTable = new Table({
    width: { size: 4000, type: WidthType.DXA },
    columnWidths: [2400, 1600],
    indent: { size: 5360, type: WidthType.DXA },
    borders: bordersNone,
    rows: [
      ...totalesRows.map(([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: cellW(2400),
              borders: bordersNone,
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
              children: [para([small(label)], AlignmentType.LEFT, 0)],
            }),
            new TableCell({
              width: cellW(1600),
              borders: bordersNone,
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
              children: [para([normal(value)], AlignmentType.RIGHT, 0)],
            }),
          ],
        })
      ),
      new TableRow({
        children: [
          new TableCell({
            width: cellW(2400),
            shading: { type: ShadingType.CLEAR, fill: BGBLUE },
            borders: bordersNone,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: [para([bold("TOTAL", BLUE_HEX, 22)], AlignmentType.LEFT, 0)],
          }),
          new TableCell({
            width: cellW(1600),
            shading: { type: ShadingType.CLEAR, fill: BGBLUE },
            borders: bordersNone,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: [para([bold(fmtMoney(c.total), BLUE_HEX, 22)], AlignmentType.RIGHT, 0)],
          }),
        ],
      }),
    ],
  });

  // ── Sección: términos de pago ──
  const terminosSection = c.terminos_pago?.length
    ? [
        para([bold("TÉRMINOS DE PAGO", BLUE_HEX, 18)], AlignmentType.LEFT, 60),
        ...c.terminos_pago.map((t) =>
          para([normal(`• ${t.concepto}   `, GRAY_HEX), bold(`${t.porcentaje}%`, BLUE_HEX)])
        ),
      ]
    : [];

  // ── Sección: notas ──
  const notasSection = c.notas
    ? [
        para([bold("NOTAS", BLUE_HEX, 18)], AlignmentType.LEFT, 60),
        para([normal(c.notas, GRAY_HEX)]),
      ]
    : [];

  // ── Documento final ──
  const doc2 = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 800, right: 800 },
        },
      },
      children: [
        ...titleSection,
        infoTable,
        para([], AlignmentType.LEFT, 120),
        para([bold("ÍTEMS", BLUE_HEX, 18)], AlignmentType.LEFT, 80),
        itemsTable,
        para([], AlignmentType.LEFT, 120),
        ...terminosSection,
        para([], AlignmentType.LEFT, 80),
        // Totales (tabla con indent para alineación derecha)
        totalesTable,
        para([], AlignmentType.LEFT, 0),
        ...notasSection,
        para([small("Documento generado por VIATIQ · © 2026 Nahdan", "9CA3AF")], AlignmentType.CENTER, 0),
      ],
    }],
  });

  const buffer = await Packer.toBlob(doc2);
  triggerDownload(buffer, `${c.numero}.docx`);
}
