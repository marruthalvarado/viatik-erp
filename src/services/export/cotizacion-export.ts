/**
 * cotizacion-export.ts
 * Exporta cotizaciones a PDF (jsPDF) y Word (.docx) como Propuesta Técnico-Comercial.
 *
 * Estructura del documento:
 *   1. Portada / Encabezado destacado (número, asunto, cliente, fecha)
 *   2. Resumen Ejecutivo (texto libre de parametros_sistema)
 *   3. Tabla técnica de ítems (descripción técnica, agrupada por fabricante)
 *   4. Detalle de precios
 *   5. Términos de pago
 *   6. Información del oferente
 *   7. Términos y Condiciones (texto libre de parametros_sistema)
 */
import type { CotizacionConItems } from "@/services/cotizaciones";
import type { Empresa } from "@/types/entities";
import { supabase } from "@/integrations/supabase/client";
import {
  LOGO_VIATIQ_PNG_B64,
  LOGO_VIATIQ_W,
  LOGO_VIATIQ_H,
} from "@/assets/branding/logo-viatiq-b64";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportOptions {
  empresa_id: string;
  empresa?: Pick<Empresa, "nombre" | "ruc" | "telefono" | "correo" | "direccion">;
}

interface PropuestaParametros {
  resumen_ejecutivo: string;
  terminos_condiciones: string;
}

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

async function fetchPropuestaParametros(empresa_id: string): Promise<PropuestaParametros> {
  const { data } = await supabase
    .from("parametros_sistema")
    .select("clave, valor")
    .eq("empresa_id", empresa_id)
    .in("clave", ["propuesta_resumen_ejecutivo", "propuesta_terminos_condiciones"]);

  const map = Object.fromEntries((data ?? []).map((r) => [r.clave, r.valor ?? ""]));
  return {
    resumen_ejecutivo: map["propuesta_resumen_ejecutivo"] ?? "",
    terminos_condiciones: map["propuesta_terminos_condiciones"] ?? "",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF — jsPDF + autotable
// ─────────────────────────────────────────────────────────────────────────────

export async function exportCotizacionPdf(
  c: CotizacionConItems,
  opts: ExportOptions,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");

  const params = await fetchPropuestaParametros(opts.empresa_id);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.width;   // 210
  const H = doc.internal.pageSize.height;  // 297
  const ML = 14;
  const MR = 14;
  const CW = W - ML - MR;

  const BLUE    = [30, 64, 175]   as const;
  const BGBLUE  = [239, 246, 255] as const;
  const BGCOVER = [17, 34, 100]   as const;  // portada fondo oscuro
  const GRAY    = [107, 114, 128] as const;
  const DARK    = [17, 24, 39]    as const;
  const WHITE   = [255, 255, 255] as const;
  const BORDER  = [226, 232, 240] as const;

  // ────────────────────────────────────────────────────────────────────────────
  // PORTADA (bloque superior en la primera página)
  // ────────────────────────────────────────────────────────────────────────────

  // Fondo azul oscuro portada
  doc.setFillColor(...BGCOVER);
  doc.rect(0, 0, W, 80, "F");

  // Logo en la portada
  (doc as unknown as { addImage: (img: string, fmt: string, x: number, y: number, w: number, h: number) => void })
    .addImage(LOGO_VIATIQ_PNG_B64, "PNG", ML, 10, LOGO_VIATIQ_W * 0.8, LOGO_VIATIQ_H * 0.8);

  // Número cotización
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  doc.text(c.numero, W - MR, 14, { align: "right" });

  // Título principal
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("PROPUESTA TÉCNICO-COMERCIAL", ML, 36);

  // Asunto
  if (c.asunto) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 220, 255);
    const asuntoLines = doc.splitTextToSize(c.asunto, CW) as string[];
    doc.text(asuntoLines, ML, 46);
  }

  // Preparado para
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  const prepY = c.asunto ? 58 : 46;
  doc.text(`PREPARADO PARA: ${c.razon_social.toUpperCase()}`, ML, prepY);
  doc.text(`FECHA: ${fmtFecha(c.fecha)}${c.valida_hasta ? "   ·   VÁLIDO HASTA: " + fmtFecha(c.valida_hasta) : ""}`, ML, prepY + 6);

  let y = 88;

  // ────────────────────────────────────────────────────────────────────────────
  // INFO CLIENTE + DETALLES (dos columnas)
  // ────────────────────────────────────────────────────────────────────────────

  const colW = CW / 2 - 4;
  // Bloque izquierdo: cliente
  doc.setFillColor(...BGBLUE);
  doc.roundedRect(ML, y, colW, 26, 2, 2, "F");
  doc.setFontSize(7);
  doc.setTextColor(...BLUE);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE", ML + 4, y + 5);
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(c.razon_social, ML + 4, y + 11);
  if (c.ruc_cliente) {
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    doc.text("RUC: " + c.ruc_cliente, ML + 4, y + 17);
  }
  if (c.email_cliente) {
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(c.email_cliente, ML + 4, y + 22);
  }

  // Bloque derecho: detalles
  const rx = ML + colW + 8;
  doc.setFillColor(...BGBLUE);
  doc.roundedRect(rx, y, colW, 26, 2, 2, "F");
  doc.setFontSize(7);
  doc.setTextColor(...BLUE);
  doc.setFont("helvetica", "bold");
  doc.text("DETALLES", rx + 4, y + 5);
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  doc.text("Fecha:", rx + 4, y + 11);
  doc.setTextColor(...DARK);
  doc.text(fmtFecha(c.fecha), rx + 22, y + 11);
  if (c.valida_hasta) {
    doc.setTextColor(...GRAY);
    doc.text("Válida hasta:", rx + 4, y + 17);
    doc.setTextColor(...DARK);
    doc.text(fmtFecha(c.valida_hasta), rx + 28, y + 17);
  }
  if (c.lugar_entrega) {
    doc.setTextColor(...GRAY);
    doc.text("Entrega:", rx + 4, y + 22);
    doc.setTextColor(...DARK);
    doc.text(c.lugar_entrega, rx + 22, y + 22);
  }

  y += 34;

  // ────────────────────────────────────────────────────────────────────────────
  // RESUMEN EJECUTIVO
  // ────────────────────────────────────────────────────────────────────────────

  if (params.resumen_ejecutivo) {
    doc.setFontSize(9);
    doc.setTextColor(...BLUE);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN EJECUTIVO", ML, y);
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.4);
    doc.line(ML + 40, y - 1, W - MR, y - 1);
    y += 5;

    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    const resumLines = doc.splitTextToSize(params.resumen_ejecutivo, CW) as string[];
    // If it won't fit on page, add page
    const resumH = resumLines.length * 5;
    if (y + resumH > H - 30) {
      doc.addPage();
      y = 18;
    }
    doc.text(resumLines, ML, y);
    y += resumH + 8;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TABLA TÉCNICA DE ÍTEMS
  // ────────────────────────────────────────────────────────────────────────────

  // Agrupar por fabricante
  const byFab = new Map<string, typeof c.items>();
  for (const it of c.items) {
    const key = it.fabricante || "Sin fabricante";
    if (!byFab.has(key)) byFab.set(key, []);
    byFab.get(key)!.push(it);
  }

  const hasMultipleFabs = byFab.size > 1 || (byFab.size === 1 && !byFab.has("Sin fabricante"));

  if (y + 10 > H - 30) { doc.addPage(); y = 18; }

  doc.setFontSize(9);
  doc.setTextColor(...BLUE);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPCIÓN TÉCNICA DE LA OFERTA", ML, y);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.4);
  doc.line(ML + 65, y - 1, W - MR, y - 1);
  y += 6;

  // Plazo / garantía general
  if (c.dias_entrega || c.meses_garantia) {
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    const condParts: string[] = [];
    if (c.dias_entrega) condParts.push(`Plazo de entrega: ${c.dias_entrega} días laborables`);
    if (c.meses_garantia) condParts.push(`Garantía: ${c.meses_garantia} meses`);
    doc.text(condParts.join("   ·   "), ML, y);
    y += 6;
  }

  for (const [fab, items] of byFab) {
    if (y + 16 > H - 30) { doc.addPage(); y = 18; }

    if (hasMultipleFabs) {
      // Encabezado del fabricante
      doc.setFillColor(...BGBLUE);
      doc.roundedRect(ML, y, CW, 7, 1, 1, "F");
      doc.setFontSize(8);
      doc.setTextColor(...BLUE);
      doc.setFont("helvetica", "bold");
      doc.text(fab.toUpperCase(), ML + 4, y + 5);
      y += 10;
    }

    autoTable(doc as Parameters<typeof autoTable>[0], {
      startY: y,
      margin: { left: ML, right: MR },
      head: [["#", "Producto / Descripción", "Modelo", "Cant.", "Días entrega", "Garantía"]],
      body: items.map((it, i) => [
        String(i + 1),
        it.descripcion,
        it.modelo || "—",
        String(it.cantidad),
        it.dias_entrega ? `${it.dias_entrega} días` : (c.dias_entrega ? `${c.dias_entrega} días` : "—"),
        it.meses_garantia ? `${it.meses_garantia} meses` : (c.meses_garantia ? `${c.meses_garantia} meses` : "—"),
      ]),
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [...DARK] },
      headStyles: { fillColor: [...BLUE], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        2: { cellWidth: 22 },
        3: { cellWidth: 12, halign: "center" },
        4: { cellWidth: 22, halign: "center" },
        5: { cellWidth: 22, halign: "center" },
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // DETALLE DE PRECIOS
  // ────────────────────────────────────────────────────────────────────────────

  if (y + 16 > H - 30) { doc.addPage(); y = 18; }

  doc.setFontSize(9);
  doc.setTextColor(...BLUE);
  doc.setFont("helvetica", "bold");
  doc.text("DETALLE DE PRECIOS", ML, y);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.4);
  doc.line(ML + 38, y - 1, W - MR, y - 1);
  y += 6;

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
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [...DARK] },
    headStyles: { fillColor: [...BLUE], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 14, halign: "center" },
      6: { cellWidth: 24, halign: "right", fontStyle: "bold" },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ────────────────────────────────────────────────────────────────────────────
  // TÉRMINOS DE PAGO + TOTALES
  // ────────────────────────────────────────────────────────────────────────────

  if (y + 40 > H - 30) { doc.addPage(); y = 18; }

  const totW = 72;
  const totX = W - MR - totW;

  // Términos de pago (izquierda)
  if (c.terminos_pago?.length) {
    doc.setFontSize(8);
    doc.setTextColor(...BLUE);
    doc.setFont("helvetica", "bold");
    doc.text("TÉRMINOS DE PAGO", ML, y + 4);
    y += 8;
    for (const t of c.terminos_pago) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      doc.text(`• ${t.concepto}`, ML + 2, y);
      doc.text(`${t.porcentaje}%`, ML + 80, y, { align: "right" });
      y += 5;
    }
  }

  // Cuadro de totales (derecha, alineado con base de pago)
  const boxY = y - (c.terminos_pago?.length ? c.terminos_pago.length * 5 + 5 : 0);
  const safeBoxY = Math.max(boxY, y - 35);

  doc.setFillColor(...BGBLUE);
  doc.roundedRect(totX, safeBoxY, totW, 32, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", totX + 4, safeBoxY + 7);
  doc.setTextColor(...DARK);
  doc.text(fmtMoney(c.subtotal), totX + totW - 4, safeBoxY + 7, { align: "right" });

  let totRowY = safeBoxY + 13;
  if (c.descuento_total > 0) {
    doc.setTextColor(...GRAY);
    doc.text("Descuento:", totX + 4, totRowY);
    doc.setTextColor(200, 30, 30);
    doc.text(`- ${fmtMoney(c.descuento_total)}`, totX + totW - 4, totRowY, { align: "right" });
    totRowY += 6;
  }

  doc.setTextColor(...GRAY);
  doc.text(`IVA ${c.iva_pct}%:`, totX + 4, totRowY);
  doc.setTextColor(...DARK);
  doc.text(fmtMoney(c.iva), totX + totW - 4, totRowY, { align: "right" });

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(totX + 2, safeBoxY + 25, totX + totW - 2, safeBoxY + 25);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLUE);
  doc.text("TOTAL:", totX + 4, safeBoxY + 31);
  doc.text(fmtMoney(c.total), totX + totW - 4, safeBoxY + 31, { align: "right" });

  y = Math.max(y, safeBoxY + 38);

  // ────────────────────────────────────────────────────────────────────────────
  // INFORMACIÓN DEL OFERENTE
  // ────────────────────────────────────────────────────────────────────────────

  if (opts.empresa) {
    if (y + 20 > H - 30) { doc.addPage(); y = 18; }

    doc.setFontSize(8.5);
    doc.setTextColor(...BLUE);
    doc.setFont("helvetica", "bold");
    doc.text("INFORMACIÓN DEL OFERENTE", ML, y);
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.4);
    doc.line(ML + 52, y - 1, W - MR, y - 1);
    y += 5;

    const emp = opts.empresa;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(emp.nombre, ML, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    if (emp.ruc) { doc.text(`RUC: ${emp.ruc}`, ML, y); y += 4.5; }
    if (emp.direccion) { doc.text(emp.direccion, ML, y); y += 4.5; }
    if (emp.telefono) { doc.text(`Tel: ${emp.telefono}`, ML, y); y += 4.5; }
    if (emp.correo) { doc.text(emp.correo, ML, y); y += 4.5; }
    y += 4;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // NOTAS
  // ────────────────────────────────────────────────────────────────────────────

  if (c.notas) {
    if (y + 14 > H - 30) { doc.addPage(); y = 18; }
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "bold");
    doc.text("NOTAS", ML, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    const notaLines = doc.splitTextToSize(c.notas, CW) as string[];
    doc.text(notaLines, ML, y);
    y += notaLines.length * 4.5 + 6;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TÉRMINOS Y CONDICIONES
  // ────────────────────────────────────────────────────────────────────────────

  if (params.terminos_condiciones) {
    if (y + 20 > H - 30) { doc.addPage(); y = 18; }

    doc.setFontSize(8.5);
    doc.setTextColor(...BLUE);
    doc.setFont("helvetica", "bold");
    doc.text("TÉRMINOS Y CONDICIONES", ML, y);
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.4);
    doc.line(ML + 52, y - 1, W - MR, y - 1);
    y += 6;

    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    const tcLines = doc.splitTextToSize(params.terminos_condiciones, CW) as string[];
    // paginar si es largo
    let lineIdx = 0;
    while (lineIdx < tcLines.length) {
      const pageLines: string[] = [];
      while (lineIdx < tcLines.length && y + 4.5 < H - 18) {
        pageLines.push(tcLines[lineIdx++]);
        y += 4.5;
      }
      doc.text(pageLines, ML, y - pageLines.length * 4.5);
      if (lineIdx < tcLines.length) {
        doc.addPage();
        y = 18;
      }
    }
    y += 6;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PIE DE PÁGINA en todas las páginas
  // ────────────────────────────────────────────────────────────────────────────

  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    const empresa = opts.empresa?.nombre ?? "VIATIQ";
    doc.text(`${empresa} · Propuesta Técnico-Comercial ${c.numero}`, ML, H - 8);
    doc.text(`Pág. ${i} / ${totalPages}`, W - MR, H - 8, { align: "right" });
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(ML, H - 12, W - MR, H - 12);
  }

  doc.save(`${c.numero}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCX — docx npm (browser-compatible)
// ─────────────────────────────────────────────────────────────────────────────

export async function exportCotizacionDocx(
  c: CotizacionConItems,
  opts: ExportOptions,
): Promise<void> {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, HeadingLevel, BorderStyle,
    ShadingType, VerticalAlign,
  } = await import("docx");

  const params = await fetchPropuestaParametros(opts.empresa_id);

  const BLUE_HEX = "1E40AF";
  const COVER_HEX = "11226A";
  const GRAY_HEX = "6B7280";
  const BGBLUE   = "EFF6FF";
  const BGLIGHT  = "F8FAFC";
  const WHITE    = "FFFFFF";

  const bold = (text: string, color = "111827", sz = 20) =>
    new TextRun({ text, bold: true, color, size: sz });
  const normal = (text: string, color = "374151", sz = 18) =>
    new TextRun({ text, color, size: sz });
  const small = (text: string, color = GRAY_HEX, sz = 16) =>
    new TextRun({ text, color, size: sz });

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
  const para = (runs: any[], align: string = AlignmentType.LEFT, spacingAfter = 80) =>
    new Paragraph({ children: runs, alignment: align as typeof AlignmentType.LEFT, spacing: { after: spacingAfter } });

  const sectionHeading = (text: string) =>
    new Paragraph({
      children: [bold(text, BLUE_HEX, 20)],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE_HEX },
      },
    });

  // ── Portada ──
  const coverTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    borders: bordersNone,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: cellW(9360),
            shading: { type: ShadingType.CLEAR, fill: COVER_HEX },
            margins: { top: 400, bottom: 400, left: 400, right: 400 },
            borders: bordersNone,
            children: [
              new Paragraph({
                children: [bold("PROPUESTA TÉCNICO-COMERCIAL", WHITE, 36)],
                spacing: { after: 120 },
              }),
              ...(c.asunto
                ? [new Paragraph({ children: [normal(c.asunto, "C8DCFF", 22)], spacing: { after: 200 } })]
                : []),
              new Paragraph({
                children: [bold(c.numero, "93C5FD", 24)],
                spacing: { after: 80 },
              }),
              new Paragraph({
                children: [small(`PREPARADO PARA: ${c.razon_social.toUpperCase()}`, WHITE, 18)],
                spacing: { after: 40 },
              }),
              new Paragraph({
                children: [small(`FECHA: ${fmtFecha(c.fecha)}`, "C8DCFF", 16)],
                spacing: { after: 0 },
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // ── Info cliente + detalles ──
  const infoTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    borders: bordersNone,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: cellW(4500),
            shading: { type: ShadingType.CLEAR, fill: BGBLUE },
            borders: bordersNone,
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              para([bold("CLIENTE", BLUE_HEX, 16)], AlignmentType.LEFT, 40),
              para([bold(c.razon_social, "111827", 20)], AlignmentType.LEFT, 40),
              ...(c.ruc_cliente ? [para([small("RUC: " + c.ruc_cliente)], AlignmentType.LEFT, 30)] : []),
              ...(c.email_cliente ? [para([small(c.email_cliente)], AlignmentType.LEFT, 0)] : []),
            ],
          }),
          new TableCell({
            width: cellW(4860),
            shading: { type: ShadingType.CLEAR, fill: BGBLUE },
            borders: bordersNone,
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              para([bold("DETALLES", BLUE_HEX, 16)], AlignmentType.LEFT, 40),
              para([small("Fecha:  "), normal(fmtFecha(c.fecha))], AlignmentType.LEFT, 30),
              ...(c.valida_hasta ? [para([small("Válida hasta:  "), normal(fmtFecha(c.valida_hasta))], AlignmentType.LEFT, 30)] : []),
              ...(c.lugar_entrega ? [para([small("Entrega:  "), normal(c.lugar_entrega)], AlignmentType.LEFT, 30)] : []),
              ...(c.dias_entrega ? [para([small("Plazo:  "), normal(`${c.dias_entrega} días laborables`)], AlignmentType.LEFT, 30)] : []),
              ...(c.meses_garantia ? [para([small("Garantía:  "), normal(`${c.meses_garantia} meses`)], AlignmentType.LEFT, 0)] : []),
            ],
          }),
        ],
      }),
    ],
  });

  // ── Resumen ejecutivo ──
  const resumenSection = params.resumen_ejecutivo
    ? [
        sectionHeading("RESUMEN EJECUTIVO"),
        para([normal(params.resumen_ejecutivo, GRAY_HEX, 18)], AlignmentType.JUSTIFIED, 160),
      ]
    : [];

  // ── Tabla técnica (agrupada por fabricante) ──
  const byFab = new Map<string, typeof c.items>();
  for (const it of c.items) {
    const key = it.fabricante || "Sin fabricante";
    if (!byFab.has(key)) byFab.set(key, []);
    byFab.get(key)!.push(it);
  }
  const hasMultiFabs = byFab.size > 1 || (byFab.size === 1 && !byFab.has("Sin fabricante"));

  const TECH_COL_W = [500, 4200, 1200, 700, 1380, 1380];
  const techHeaders = ["#", "Descripción", "Modelo", "Cant.", "Días entrega", "Garantía"];

  const techHeaderRow = new TableRow({
    children: techHeaders.map((h, i) =>
      new TableCell({
        width: cellW(TECH_COL_W[i]),
        shading: { type: ShadingType.CLEAR, fill: BLUE_HEX },
        borders: bordersNone,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [para([bold(h, WHITE, 15)], i >= 3 ? AlignmentType.CENTER : AlignmentType.LEFT, 0)],
      })
    ),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const techSectionChildren: any[] = [sectionHeading("DESCRIPCIÓN TÉCNICA DE LA OFERTA")];

  for (const [fab, items] of byFab) {
    if (hasMultiFabs) {
      techSectionChildren.push(
        new Paragraph({
          children: [bold(fab.toUpperCase(), BLUE_HEX, 18)],
          spacing: { before: 120, after: 60 },
          shading: { type: ShadingType.CLEAR, fill: BGBLUE },
        })
      );
    }

    const techItemRows = items.map((it, idx) =>
      new TableRow({
        children: [
          new TableCell({
            width: cellW(TECH_COL_W[0]),
            shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? BGLIGHT : WHITE },
            borders: borderGray,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [para([normal(String(idx + 1), GRAY_HEX, 15)], AlignmentType.CENTER, 0)],
          }),
          new TableCell({
            width: cellW(TECH_COL_W[1]),
            shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? BGLIGHT : WHITE },
            borders: borderGray,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [para([normal(it.descripcion, "111827", 16)], AlignmentType.LEFT, 0)],
          }),
          new TableCell({
            width: cellW(TECH_COL_W[2]),
            shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? BGLIGHT : WHITE },
            borders: borderGray,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [para([small(it.modelo || "—")], AlignmentType.LEFT, 0)],
          }),
          new TableCell({
            width: cellW(TECH_COL_W[3]),
            shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? BGLIGHT : WHITE },
            borders: borderGray,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [para([normal(String(it.cantidad), "111827", 15)], AlignmentType.CENTER, 0)],
          }),
          new TableCell({
            width: cellW(TECH_COL_W[4]),
            shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? BGLIGHT : WHITE },
            borders: borderGray,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [para([small(it.dias_entrega ? `${it.dias_entrega} días` : (c.dias_entrega ? `${c.dias_entrega} días` : "—"))], AlignmentType.CENTER, 0)],
          }),
          new TableCell({
            width: cellW(TECH_COL_W[5]),
            shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? BGLIGHT : WHITE },
            borders: borderGray,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [para([small(it.meses_garantia ? `${it.meses_garantia} meses` : (c.meses_garantia ? `${c.meses_garantia} meses` : "—"))], AlignmentType.CENTER, 0)],
          }),
        ],
      })
    );

    techSectionChildren.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: TECH_COL_W,
        rows: [techHeaderRow, ...techItemRows],
      }),
      para([], AlignmentType.LEFT, 80)
    );
  }

  // ── Tabla de precios ──
  const PRICE_COL_W = [400, 3200, 1500, 600, 1100, 900, 1060];
  const priceHeaders = ["#", "Descripción", "Fabricante / Modelo", "Cant.", "P. Unit.", "Desc.", "Total"];

  const priceHeaderRow = new TableRow({
    children: priceHeaders.map((h, i) =>
      new TableCell({
        width: cellW(PRICE_COL_W[i]),
        shading: { type: ShadingType.CLEAR, fill: BLUE_HEX },
        borders: bordersNone,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [para([bold(h, WHITE, 15)], i >= 3 ? AlignmentType.RIGHT : AlignmentType.LEFT, 0)],
      })
    ),
  });

  const priceItemRows = c.items.map((it, idx) =>
    new TableRow({
      children: [
        new TableCell({
          width: cellW(PRICE_COL_W[0]),
          shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? BGLIGHT : WHITE },
          borders: borderGray,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para([normal(String(idx + 1), GRAY_HEX, 15)], AlignmentType.CENTER, 0)],
        }),
        new TableCell({
          width: cellW(PRICE_COL_W[1]),
          shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? BGLIGHT : WHITE },
          borders: borderGray,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para([normal(it.descripcion, "111827", 15)], AlignmentType.LEFT, 0)],
        }),
        new TableCell({
          width: cellW(PRICE_COL_W[2]),
          shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? BGLIGHT : WHITE },
          borders: borderGray,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para([small([it.fabricante, it.modelo].filter(Boolean).join(" ") || "—")], AlignmentType.LEFT, 0)],
        }),
        new TableCell({
          width: cellW(PRICE_COL_W[3]),
          shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? BGLIGHT : WHITE },
          borders: borderGray,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para([normal(String(it.cantidad), "111827", 15)], AlignmentType.RIGHT, 0)],
        }),
        new TableCell({
          width: cellW(PRICE_COL_W[4]),
          shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? BGLIGHT : WHITE },
          borders: borderGray,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para([normal(fmtMoney(it.precio_unitario), "111827", 15)], AlignmentType.RIGHT, 0)],
        }),
        new TableCell({
          width: cellW(PRICE_COL_W[5]),
          shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? BGLIGHT : WHITE },
          borders: borderGray,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para([small(it.descuento_pct > 0 ? `${it.descuento_pct}%` : "—")], AlignmentType.CENTER, 0)],
        }),
        new TableCell({
          width: cellW(PRICE_COL_W[6]),
          shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? BGLIGHT : WHITE },
          borders: borderGray,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para([bold(fmtMoney(it.precio_neto), BLUE_HEX, 15)], AlignmentType.RIGHT, 0)],
        }),
      ],
    })
  );

  const priceTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: PRICE_COL_W,
    rows: [priceHeaderRow, ...priceItemRows],
  });

  // ── Totales ──
  const totalesRows = [
    ["Subtotal", fmtMoney(c.subtotal)],
    ...(c.descuento_total > 0 ? [["Descuento", `- ${fmtMoney(c.descuento_total)}`]] : []),
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
            children: [para([bold("TOTAL USD", BLUE_HEX, 22)], AlignmentType.LEFT, 0)],
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

  // ── Términos de pago ──
  const terminosSection = c.terminos_pago?.length
    ? [
        sectionHeading("TÉRMINOS DE PAGO"),
        ...c.terminos_pago.map((t) =>
          para([normal(`• ${t.concepto}   `, GRAY_HEX), bold(`${t.porcentaje}%`, BLUE_HEX)])
        ),
        para([], AlignmentType.LEFT, 60),
      ]
    : [];

  // ── Oferente ──
  const oferenteSection = opts.empresa
    ? [
        sectionHeading("INFORMACIÓN DEL OFERENTE"),
        para([bold(opts.empresa.nombre, "111827", 20)], AlignmentType.LEFT, 40),
        ...(opts.empresa.ruc ? [para([small(`RUC: ${opts.empresa.ruc}`)], AlignmentType.LEFT, 30)] : []),
        ...(opts.empresa.direccion ? [para([small(opts.empresa.direccion)], AlignmentType.LEFT, 30)] : []),
        ...(opts.empresa.telefono ? [para([small(`Tel: ${opts.empresa.telefono}`)], AlignmentType.LEFT, 30)] : []),
        ...(opts.empresa.correo ? [para([small(opts.empresa.correo)], AlignmentType.LEFT, 60)] : []),
      ]
    : [];

  // ── Notas ──
  const notasSection = c.notas
    ? [
        sectionHeading("NOTAS"),
        para([normal(c.notas, GRAY_HEX)], AlignmentType.LEFT, 120),
      ]
    : [];

  // ── Términos y condiciones ──
  const tcSection = params.terminos_condiciones
    ? [
        sectionHeading("TÉRMINOS Y CONDICIONES"),
        para([normal(params.terminos_condiciones, GRAY_HEX, 16)], AlignmentType.JUSTIFIED, 120),
      ]
    : [];

  // ── Pie ──
  const pieSection = [
    para([small("Documento generado automáticamente por VIATIQ · © 2026 Nahdan", "9CA3AF")], AlignmentType.CENTER, 0),
  ];

  // ── Documento final ──
  const doc2 = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 800, right: 800 },
        },
      },
      children: [
        // Portada
        coverTable,
        para([], AlignmentType.LEFT, 120),
        // Datos cliente
        infoTable,
        para([], AlignmentType.LEFT, 160),
        // Resumen ejecutivo
        ...resumenSection,
        // Técnica
        ...techSectionChildren,
        // Precios
        sectionHeading("DETALLE DE PRECIOS"),
        priceTable,
        para([], AlignmentType.LEFT, 120),
        // Totales
        totalesTable,
        para([], AlignmentType.LEFT, 160),
        // Términos de pago
        ...terminosSection,
        // Oferente
        ...oferenteSection,
        // Notas
        ...notasSection,
        // T&C
        ...tcSection,
        // Pie
        para([], AlignmentType.LEFT, 80),
        ...pieSection,
      ],
    }],
  });

  const buffer = await Packer.toBlob(doc2);
  triggerDownload(buffer, `${c.numero}.docx`);
}
