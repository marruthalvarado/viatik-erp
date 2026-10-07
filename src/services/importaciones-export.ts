/**
 * importaciones-export.ts
 * Exporta la Liquidación DAI de un embarque a Excel o PDF.
 * No accede a Supabase — recibe el objeto EmbarqueConLineas ya cargado.
 */
import type { EmbarqueConLineas } from "./importaciones-embarques";
import {
  LOGO_VIATIQ_PNG_B64,
  LOGO_VIATIQ_W,
  LOGO_VIATIQ_H,
} from "@/assets/branding/logo-viatiq-b64";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n ?? 0);

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-EC", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

// ── Excel ────────────────────────────────────────────────────────────────────

export async function exportLiquidacionExcel(emb: EmbarqueConLineas): Promise<void> {
  const XLSX = await import("xlsx");

  const aoa: (string | number | null)[][] = [];

  // Encabezado
  aoa.push(["LIQUIDACIÓN DAI — VIATIQ"]);
  aoa.push([]);
  aoa.push(["Embarque",          emb.numero_embarque ?? "—"]);
  aoa.push(["N° Liquidación",    emb.numero_liquidacion ?? "—"]);
  aoa.push(["Referencia DAI",    emb.referencia_dai ?? "—"]);
  aoa.push(["Fecha",             fmtDate(emb.fecha)]);
  aoa.push(["Proveedor",         emb.proveedor?.nombre ?? "—"]);
  aoa.push(["RUC/ID Proveedor",  emb.proveedor?.ruc ?? "—"]);
  aoa.push(["País origen",       emb.pais_origen ?? "—"]);
  aoa.push(["Estado",            emb.estado]);
  if (emb.costeo) {
    aoa.push(["Costeo vinculado", `${emb.costeo.numero} (est. ${fmt(emb.costeo.costo_aterrizaje_usd)})`]);
  }
  aoa.push([]);

  // Costos DAI
  aoa.push(["COSTOS DAI"]);
  aoa.push(["Concepto",          "Valor USD"]);
  aoa.push(["FOB Total",         emb.fob_total]);
  aoa.push(["Seguro",            emb.seguro]);
  aoa.push(["Flete",             emb.flete]);
  aoa.push(["Ajustes",           emb.ajustes]);
  aoa.push(["Valor aduanas",     emb.valor_aduanas]);
  aoa.push(["Arancel Ad-valorem",emb.arancel]);
  aoa.push(["FODINFA",           emb.fodinfa]);
  aoa.push(["IVA importación",   emb.iva_importacion]);
  aoa.push(["TOTAL LIQUIDADO",   emb.total_liquidado]);
  aoa.push([]);

  // Delta vs costeo
  if (emb.costeo) {
    const delta = emb.total_liquidado - emb.costeo.costo_aterrizaje_usd;
    const pct = emb.costeo.costo_aterrizaje_usd
      ? (delta / emb.costeo.costo_aterrizaje_usd) * 100
      : 0;
    aoa.push(["COMPARATIVO COSTEO"]);
    aoa.push(["Estimado",          emb.costeo.costo_aterrizaje_usd]);
    aoa.push(["Real (liquidado)",  emb.total_liquidado]);
    aoa.push(["Delta",             delta]);
    aoa.push(["Variación %",       `${pct.toFixed(1)}%`]);
    aoa.push([]);
  }

  // Líneas
  aoa.push(["DETALLE DE LÍNEAS"]);
  aoa.push(["Descripción", "FOB línea", "Cantidad", "Unidad", "Peso kg", "País origen", "Costo unit. calc.", "Observación"]);
  for (const l of emb.lineas) {
    aoa.push([
      l.descripcion_original,
      l.fob_linea,
      l.cantidad,
      l.unidad_medida ?? "",
      l.peso_kg ?? "",
      l.pais_origen ?? "",
      l.costo_unitario_calculado != null ? Number(l.costo_unitario_calculado) : "",
      l.observacion ?? "",
    ]);
  }

  if (emb.observacion) {
    aoa.push([]);
    aoa.push(["Observaciones", emb.observacion]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Anchos de columna
  ws["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Liquidación DAI");

  const filename = `Liquidacion_${emb.numero_embarque ?? emb.id}_${emb.fecha?.slice(0, 10) ?? "sin-fecha"}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ── PDF ──────────────────────────────────────────────────────────────────────

const PDF_BLUE       = [30, 64, 175]   as const;
const PDF_GRAY_LIGHT = [248, 250, 252] as const;
const PDF_GRAY_TEXT  = [100, 116, 139] as const;
const PDF_RED        = [220, 38, 38]   as const;
const PDF_GREEN      = [22, 163, 74]   as const;

export async function exportLiquidacionPdf(emb: EmbarqueConLineas, empresa?: string): Promise<void> {
  const { jsPDF }    = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");

  const doc   = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;

  // ── Cabecera ──────────────────────────────────────────────────────────────
  let y = 16;

  (doc as unknown as {
    addImage: (img: string, fmt: string, x: number, y: number, w: number, h: number) => void;
  }).addImage(LOGO_VIATIQ_PNG_B64, "PNG", 14, y - 3, LOGO_VIATIQ_W, LOGO_VIATIQ_H);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_BLUE);
  doc.text("LIQUIDACIÓN DAI", 14 + LOGO_VIATIQ_W + 6, y + 5);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_GRAY_TEXT);
  if (empresa) doc.text(empresa, 14 + LOGO_VIATIQ_W + 6, y + 11);

  // Número embarque (derecha)
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_BLUE);
  doc.text(emb.numero_embarque ?? "—", pageW - 14, y + 5, { align: "right" });

  y += 18;

  // Línea separadora
  doc.setDrawColor(...PDF_BLUE);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageW - 14, y);
  y += 5;

  // ── Datos generales ───────────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);

  const metaLeft = [
    ["N° Liquidación", emb.numero_liquidacion ?? "—"],
    ["Referencia DAI", emb.referencia_dai ?? "—"],
    ["Fecha",          fmtDate(emb.fecha)],
    ["Estado",         emb.estado],
  ];
  const metaRight = [
    ["Proveedor",     emb.proveedor?.nombre ?? "—"],
    ["RUC/ID",        emb.proveedor?.ruc ?? "—"],
    ["País origen",   emb.pais_origen ?? "—"],
    ["Costeo",        emb.costeo ? emb.costeo.numero : "Sin costeo"],
  ];

  const colLabelW = 32;
  const colValueW = 54;
  const colMid    = 14 + colLabelW + colValueW + 4;

  for (let i = 0; i < Math.max(metaLeft.length, metaRight.length); i++) {
    if (metaLeft[i]) {
      doc.setFont("helvetica", "bold");
      doc.text(metaLeft[i][0] + ":", 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(metaLeft[i][1], 14 + colLabelW, y);
    }
    if (metaRight[i]) {
      doc.setFont("helvetica", "bold");
      doc.text(metaRight[i][0] + ":", colMid, y);
      doc.setFont("helvetica", "normal");
      doc.text(metaRight[i][1], colMid + colLabelW, y);
    }
    y += 5;
  }

  y += 3;

  // ── Costos DAI ────────────────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_BLUE);
  doc.text("COSTOS DAI", 14, y);
  y += 2;

  const costRows = [
    ["FOB Total",            fmt(emb.fob_total)],
    ["Seguro",               fmt(emb.seguro)],
    ["Flete",                fmt(emb.flete)],
    ["Ajustes",              fmt(emb.ajustes)],
    ["Valor aduanas (CIF)",  fmt(emb.valor_aduanas)],
    ["Arancel Ad-valorem",   fmt(emb.arancel)],
    ["FODINFA",              fmt(emb.fodinfa)],
    ["IVA importación",      fmt(emb.iva_importacion)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Valor USD"]],
    body: costRows,
    foot: [["TOTAL LIQUIDADO", fmt(emb.total_liquidado)]],
    theme: "grid",
    headStyles:   { fillColor: PDF_BLUE, textColor: 255, fontSize: 8, fontStyle: "bold" },
    footStyles:   { fillColor: [240, 244, 255], textColor: PDF_BLUE, fontSize: 9, fontStyle: "bold" },
    bodyStyles:   { fontSize: 8, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: PDF_GRAY_LIGHT },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 14, right: pageW / 2 + 5 },
  });

  // ── Comparativo costeo (misma altura, lado derecho) ───────────────────────
  if (emb.costeo) {
    const delta = emb.total_liquidado - emb.costeo.costo_aterrizaje_usd;
    const pct   = emb.costeo.costo_aterrizaje_usd
      ? (delta / emb.costeo.costo_aterrizaje_usd) * 100
      : 0;

    autoTable(doc, {
      startY: y,
      head: [["Comparativo vs Costeo", ""]],
      body: [
        ["Costeo estimado",   fmt(emb.costeo.costo_aterrizaje_usd)],
        ["Real (liquidado)",  fmt(emb.total_liquidado)],
        ["Delta",             (delta >= 0 ? "+" : "") + fmt(delta)],
        ["Variación %",       (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%"],
      ],
      theme: "grid",
      headStyles:   { fillColor: PDF_BLUE, textColor: 255, fontSize: 8, fontStyle: "bold" },
      bodyStyles:   { fontSize: 8, textColor: [30, 30, 30] },
      alternateRowStyles: { fillColor: PDF_GRAY_LIGHT },
      columnStyles: {
        1: {
          halign: "right",
          textColor: delta > 0 ? PDF_RED : PDF_GREEN,
        },
      },
      margin: { left: pageW / 2 + 5, right: 14 },
    });
  }

  // Avanzar y después de las dos tablas paralelas
  const afterY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  y = afterY + 6;

  // ── Líneas del embarque ───────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_BLUE);
  doc.text("DETALLE DE LÍNEAS", 14, y);
  y += 2;

  const lineaRows = emb.lineas.map((l) => [
    l.descripcion_original,
    fmt(l.fob_linea),
    l.cantidad.toString(),
    l.unidad_medida ?? "—",
    l.costo_unitario_calculado != null ? fmt(Number(l.costo_unitario_calculado)) : "Calcular",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Descripción", "FOB línea", "Cant.", "Unidad", "Costo unit. calc."]],
    body: lineaRows,
    theme: "grid",
    headStyles:   { fillColor: PDF_BLUE, textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles:   { fontSize: 7.5, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: PDF_GRAY_LIGHT },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right" },
      2: { halign: "right" },
      4: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  // ── Observaciones ─────────────────────────────────────────────────────────
  if (emb.observacion) {
    const obsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_GRAY_TEXT);
    doc.text("Observaciones:", 14, obsY);
    doc.setFont("helvetica", "normal");
    doc.text(emb.observacion, 14, obsY + 4, { maxWidth: pageW - 28 });
  }

  // ── Pie de página en todas las páginas ───────────────────────────────────
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...PDF_GRAY_TEXT);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Generado por VIATIQ — ${new Date().toLocaleDateString("es-EC")} | Pág. ${i} de ${totalPages}`,
      pageW / 2,
      pageH - 8,
      { align: "center" }
    );
  }

  const filename = `Liquidacion_${emb.numero_embarque ?? emb.id}_${emb.fecha?.slice(0, 10) ?? "sin-fecha"}.pdf`;
  doc.save(filename);
}
