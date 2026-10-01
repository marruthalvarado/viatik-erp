/**
 * cotizacion-export.ts
 * Exporta cotizaciones a PDF (jsPDF) y Word (.docx) como Propuesta Técnico-Comercial.
 *
 * Estructura del documento (alineada con propuesta de referencia):
 *   1. Portada — logos oferente + cliente, contacto, "Presentado por"
 *   2. Resumen Ejecutivo
 *   3. Cuadro Técnico-Comercial (tabla resumen)
 *   4. Descripción técnica — tarjetas por producto con foto + descripción larga
 *   5. Detalle de precios (agrupado por fabricante con subtotales)
 *   6. Términos de pago + totales
 *   7. Información del oferente
 *   8. Términos y Condiciones (con sub-encabezados detectados)
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
  empresa?: Pick<Empresa, "nombre" | "ruc" | "telefono" | "correo" | "direccion" | "sitio_web" | "logo_url">;
}

interface PropuestaParametros {
  resumen_ejecutivo: string;
  terminos_condiciones: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers comunes
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

/** Carga una imagen desde URL y devuelve base64 + mime, o null si falla. */
async function fetchImageBase64(
  url: string,
): Promise<{ b64: string; mime: "PNG" | "JPEG" } | null> {
  try {
    const res = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);
    const ct = res.headers.get("content-type") ?? "";
    const mime: "PNG" | "JPEG" = ct.includes("png") ? "PNG" : "JPEG";
    return { b64, mime };
  } catch {
    return null;
  }
}

/** Carga una imagen desde URL como ArrayBuffer para docx ImageRun. */
async function fetchImageBuffer(
  url: string,
): Promise<{ data: ArrayBuffer; type: "png" | "jpg" | "gif" | "bmp" | "svg" } | null> {
  try {
    const res = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (!res.ok) return null;
    const data = await res.arrayBuffer();
    const ct = res.headers.get("content-type") ?? "";
    const type = ct.includes("png") ? "png"
      : ct.includes("svg") ? "svg"
      : ct.includes("gif") ? "gif"
      : "jpg";
    return { data, type };
  } catch {
    return null;
  }
}

/** Detecta si una línea es un encabezado de sección en T&C */
function isTcHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Encabezado si es corto (<= 60 chars) y: termina en ":", es TODO MAYÚSCULAS, o empieza con número.
  if (trimmed.length > 60) return false;
  return (
    trimmed.endsWith(":") ||
    trimmed === trimmed.toUpperCase() ||
    /^\d+[\.\)]/.test(trimmed)
  );
}

/** Agrupa ítems de cotización por fabricante */
function groupByFabricante(items: CotizacionConItems["items"]) {
  const map = new Map<string, CotizacionConItems["items"]>();
  for (const it of items) {
    const key = it.fabricante || "Sin fabricante";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  return map;
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

  // Pre-cargar imágenes en paralelo
  const urlsToFetch = [
    opts.empresa?.logo_url ?? null,
    c.cliente?.logo_url ?? null,
    ...c.items.map((it) => it.proveedor?.logo_url ?? null),
    ...c.items.map((it) => it.catalogo?.foto_url ?? null),
  ].filter(Boolean) as string[];

  const uniqueUrls = [...new Set(urlsToFetch)];
  const fetchResults = await Promise.allSettled(uniqueUrls.map(fetchImageBase64));
  const imgCache = new Map<string, { b64: string; mime: "PNG" | "JPEG" } | null>();
  uniqueUrls.forEach((url, i) => {
    const r = fetchResults[i];
    imgCache.set(url, r.status === "fulfilled" ? r.value : null);
  });

  const getImg = (url: string | null | undefined) => url ? (imgCache.get(url) ?? null) : null;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;
  const ML = 14;
  const MR = 14;
  const CW = W - ML - MR;

  // ── PALETA DE COLORES (basada en membrete actual de Protonmed) ────────────
  const TEAL   = [0, 124, 143]   as const;   // color principal de marca (teal)
  const DARK   = [31, 31, 31]    as const;   // texto oscuro
  const GRAY   = [107, 114, 128] as const;   // texto secundario
  const WHITE  = [255, 255, 255] as const;
  const BGROW  = [245, 248, 249] as const;   // fondo alternado de filas
  const BORDER = [226, 232, 240] as const;
  const HDRH   = 10;                         // altura cabecera páginas 2+

  // Alias tipado para addImage
  type JsPDFWithImage = { addImage: (img: string, fmt: string, x: number, y: number, w: number, h: number) => void };

  const addImg = (img: { b64: string; mime: "PNG" | "JPEG" } | null, x: number, y: number, maxW: number, maxH: number) => {
    if (!img) return;
    try {
      (doc as unknown as JsPDFWithImage).addImage(
        `data:image/${img.mime.toLowerCase()};base64,${img.b64}`,
        img.mime, x, y, maxW, maxH,
      );
    } catch { /* imagen inválida, ignorar */ }
  };

  // Helper: encabezado de sección estilo membrete
  const sectionTitle = (title: string, yPos: number) => {
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL);
    doc.text(title, ML, yPos);
    doc.setDrawColor(...TEAL); doc.setLineWidth(0.5);
    doc.line(ML, yPos + 1.5, W - MR, yPos + 1.5);
  };

  const empresaImg = getImg(opts.empresa?.logo_url);
  const clienteImg = getImg(c.cliente?.logo_url);

  // ── PORTADA (página 1 completa, fondo blanco — membrete) ─────────────────
  // Logos: cliente (izquierda) + empresa (derecha)
  const logoH = 28;
  if (clienteImg) {
    addImg(clienteImg, ML, 12, 55, logoH);
  }
  if (empresaImg) {
    addImg(empresaImg, W - MR - 52, 12, 52, logoH);
  } else {
    (doc as unknown as JsPDFWithImage).addImage(
      LOGO_VIATIQ_PNG_B64, "PNG", W - MR - 40, 14, LOGO_VIATIQ_W * 0.9, LOGO_VIATIQ_H * 0.9,
    );
  }

  // Línea separadora teal
  doc.setDrawColor(...TEAL); doc.setLineWidth(0.8);
  doc.line(ML, 46, W - MR, 46);

  // Título principal en teal
  doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL);
  doc.text("PROPUESTA TÉCNICO-COMERCIAL", ML, 60);

  // Asunto(s) en teal, tamaño menor
  let coverY = 70;
  if (c.asunto) {
    doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.setTextColor(...TEAL);
    const asuntoLines = doc.splitTextToSize(c.asunto, CW) as string[];
    doc.text(asuntoLines, ML, coverY);
    coverY += asuntoLines.length * 6 + 4;
  }

  // "Preparado para:" en gris
  coverY += 14;
  doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
  doc.text("Preparado para:", ML, coverY);
  coverY += 8;

  // Nombre del cliente en negro grande
  doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK);
  doc.text(c.razon_social, ML, coverY);
  coverY += 8;

  // Contacto
  const contacto = c.cliente?.contacto_nombre;
  if (contacto) {
    const cargo = c.cliente?.contacto_cargo;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
    doc.text(`At. ${contacto}${cargo ? " - " + cargo : ""}`, ML, coverY);
    coverY += 7;
  }

  // Espacio antes del número de referencia
  coverY += 40;

  // Línea de referencia
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK);
  const refLine = `OFERTA REFERENCIAL ${c.numero}     Fecha: ${fmtFecha(c.fecha)}${c.valida_hasta ? "     Válida hasta: " + fmtFecha(c.valida_hasta) : ""}`;
  doc.text(refLine, ML, coverY);
  coverY += 8;

  // "Presentado por" en teal bold
  if (opts.empresa?.nombre) {
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL);
    doc.text(`Presentado por ${opts.empresa.nombre}`, ML, coverY);
  }

  // Franja teal al pie de la portada
  doc.setFillColor(...TEAL);
  doc.rect(0, H - 8, W, 8, "F");

  // ── CONTENIDO: nueva página ───────────────────────────────────────────────
  doc.addPage();
  let y = HDRH + 8;

  // ── RESUMEN EJECUTIVO ─────────────────────────────────────────────────────
  if (params.resumen_ejecutivo) {
    sectionTitle("RESUMEN EJECUTIVO", y);
    y += 8;

    // Renderiza párrafos con sub-headings: una línea es heading si es corta (<= 60 chars) y no empieza con espacio o bullet
    const isResumenHeading = (line: string) => {
      const t = line.trim();
      return t.length > 0 && t.length <= 70 && !t.startsWith("•") && !t.startsWith("-") && !t.startsWith(">") && t === t.trimEnd();
    };

    const paragraphs = params.resumen_ejecutivo.split("\n");
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) { y += 3; continue; }
      if (y + 5 > H - 22) { doc.addPage(); y = HDRH + 8; }

      // Detectar si es sub-heading:
      // 1. Termina en ":" (ej: "Un equipo certificado:")
      // 2. Tiene métrica corta antes de ":" (ej: ">90%: texto", "<24h: texto", "15+ años: texto")
      // 3. Línea corta sin bullet ni punto
      const colonIdx = trimmed.indexOf(":");
      const isMetricHeading = colonIdx > 0 && colonIdx <= 20;
      const isSubHeading = trimmed.endsWith(":")
        || isMetricHeading
        || (trimmed.length <= 55 && !trimmed.startsWith("•") && !trimmed.startsWith("-") && !trimmed.startsWith(">") && !trimmed.match(/\s{2,}/));

      if (isSubHeading && trimmed !== paragraphs[0]?.trim()) {
        // Sub-heading en teal bold
        doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL);
        doc.text(trimmed, ML, y);
        y += 6;
      } else if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
        // Bullets
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK);
        const bulletLines = doc.splitTextToSize(trimmed, CW - 6) as string[];
        for (const bl of bulletLines) {
          if (y + 4 > H - 22) { doc.addPage(); y = HDRH + 8; }
          doc.text(bl, ML + 4, y);
          y += 4.8;
        }
      } else {
        // Párrafo normal
        doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK);
        const wrappedLines = doc.splitTextToSize(trimmed, CW) as string[];
        for (const wl of wrappedLines) {
          if (y + 4 > H - 22) { doc.addPage(); y = HDRH + 8; }
          doc.text(wl, ML, y);
          y += 4.8;
        }
        y += 2;
      }
    }
    y += 4;
  }

  // ── CUADRO TÉCNICO-COMERCIAL (nueva hoja siempre) ───────────────────────
  doc.addPage(); y = HDRH + 8;
  sectionTitle("CUADRO TÉCNICO-COMERCIAL DE LA OFERTA", y);
  y += 7;

  const cuadroRows: [string, string][] = [];
  if (c.asunto) cuadroRows.push(["Proyecto", c.asunto]);
  // Precio original (antes de descuento) = subtotal + descuento_total
  const precioOriginal = c.subtotal + c.descuento_total;
  cuadroRows.push(["Precio", fmtMoney(precioOriginal)]);
  if (c.descuento_total > 0) cuadroRows.push(["Descuento", `- ${fmtMoney(c.descuento_total)}`]);
  if (c.iva_pct > 0) cuadroRows.push([`IVA ${c.iva_pct}%`, fmtMoney(c.iva)]);
  cuadroRows.push([`Precio ${c.razon_social || "cliente"} (IVA incluido)`, fmtMoney(c.total)]);
  if (c.terminos_pago?.length)
    cuadroRows.push(["Forma de pago", c.terminos_pago.map((t) => `${t.porcentaje}% ${t.concepto}`).join("\n")]);
  if (c.dias_entrega) cuadroRows.push(["Plazo de entrega", `${c.dias_entrega} días hábiles a partir de la recepción del anticipo y entrega de documentación habilitante para la importación`]);
  if (c.meses_garantia) cuadroRows.push(["Garantía", `${c.meses_garantia} meses a partir de la instalación del equipo`]);
  cuadroRows.push(["Soporte técnico", "Local/regional - tiempo de respuesta máximo de 48 horas"]);
  if (c.lugar_entrega) cuadroRows.push(["Lugar de entrega e instalación", c.lugar_entrega]);

  autoTable(doc as Parameters<typeof autoTable>[0], {
    startY: y,
    margin: { left: ML, right: MR },
    body: cuadroRows.map(([k, v]) => [k, v]),
    styles: { fontSize: 8, cellPadding: 2.8, textColor: [...DARK], overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: "bold", fillColor: [...TEAL], textColor: [...WHITE] },
      1: { cellWidth: CW - 52 },
    },
    tableLineColor: [...BORDER],
    tableLineWidth: 0.2,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // ── DESCRIPCIÓN TÉCNICA (nueva hoja siempre) ─────────────────────────────
  doc.addPage(); y = HDRH + 8;
  sectionTitle("DESCRIPCIÓN TÉCNICA DE LA OFERTA", y);
  y += 8;

  const byFab = groupByFabricante(c.items);

  for (const [fab, items] of byFab) {
    if (y + 20 > H - 22) { doc.addPage(); y = HDRH + 8; }

    // ── Encabezado del fabricante: barra teal con logo ────────────────────
    const fabItem = items.find((it) => it.proveedor?.logo_url);
    const fabImg = getImg(fabItem?.proveedor?.logo_url);

    doc.setFillColor(...TEAL);
    doc.rect(ML, y, CW, 11, "F");
    doc.setFontSize(9.5); doc.setTextColor(...WHITE); doc.setFont("helvetica", "bold");
    doc.text(`EQUIPOS - ${fab.toUpperCase()}`, ML + 4, y + 7.5);

    if (fabImg) {
      try { addImg(fabImg, W - MR - 32, y + 1, 30, 9); } catch { /* skip */ }
    }
    y += 15;

    // ── Tarjeta por producto ──────────────────────────────────────────────
    for (const it of items) {
      const fotoImg = getImg(it.catalogo?.foto_url);
      // Prioridad: descripcion_larga → descripcion_tecnica (catálogo) → descripcion del ítem
      const descLarga = it.catalogo?.descripcion_larga || it.catalogo?.descripcion_tecnica || it.descripcion;
      // Para el header teal: nombre del catálogo si existe, si no la primera línea de descripcion
      const headerName = it.catalogo?.nombre ?? it.descripcion;
      const leftW = fotoImg ? CW * 0.62 : CW;
      const rightW = CW - leftW - 4;

      // FIX: set rendering font BEFORE splitTextToSize so descH is computed at correct 8pt size
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      const descLines = descLarga ? doc.splitTextToSize(descLarga, leftW) as string[] : [];
      const descH = descLines.length * 4.2;
      const cardH = Math.max(
        descH + 22,
        fotoImg ? 46 : 22,
      );

      if (y + cardH + 14 > H - 22) { doc.addPage(); y = HDRH + 8; }

      // Barra del nombre del producto en teal
      doc.setFillColor(...TEAL);
      doc.rect(ML, y, CW, 8, "F");
      doc.setFontSize(9); doc.setTextColor(...WHITE); doc.setFont("helvetica", "bold");
      const prodName = doc.splitTextToSize(headerName, CW - 8) as string[];
      doc.text(prodName[0], ML + 3, y + 5.5);
      y += 9;

      // Sub-título: fabricante + cantidad
      doc.setFontSize(7.5); doc.setFont("helvetica", "italic"); doc.setTextColor(...GRAY);
      const subLabel = [it.fabricante || fab, it.modelo ? `Modelo: ${it.modelo}` : null, `Cantidad: ${it.cantidad}`]
        .filter(Boolean).join("  ·  ");
      doc.text(subLabel, ML, y + 4);
      y += 8;

      // Descripción larga (izquierda) + foto (derecha)
      if (descLines.length > 0) {
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK);
        // Usar array pre-dividido (sin align:justify ni maxWidth) para compatibilidad con Adobe Acrobat
        doc.text(descLines, ML, y, { lineHeightFactor: 1.55 });
      }
      if (fotoImg) {
        const imgX = ML + leftW + 4;
        const imgW = rightW - 2;
        const imgH = Math.min(imgW * 0.7, cardH - 10);
        addImg(fotoImg, imgX, y - 2, imgW, imgH);
      }

      y += Math.max(descH, fotoImg ? 36 : 4) + 10;
    }
    y += 4;
  }

  // ── DETALLE DE PRECIOS (nueva hoja siempre) ───────────────────────────────
  doc.addPage(); y = HDRH + 8;
  sectionTitle("DETALLE DE PRECIOS POR ÍTEM", y);
  y += 7;

  // Numeración global continua
  let globalItemNum = 0;

  for (const [fab, items] of byFab) {
    if (y + 20 > H - 22) { doc.addPage(); y = HDRH + 8; }

    // Encabezado del fabricante con logo (igual que en descripción técnica)
    if (byFab.size > 1) {
      const fabItem2 = items.find((it) => it.proveedor?.logo_url);
      const fabImg2 = getImg(fabItem2?.proveedor?.logo_url);

      doc.setFillColor(...TEAL);
      doc.rect(ML, y, CW, 10, "F");
      doc.setFontSize(9); doc.setTextColor(...WHITE); doc.setFont("helvetica", "bold");
      doc.text(fab.toUpperCase(), ML + 4, y + 6.8);
      if (fabImg2) {
        try { addImg(fabImg2, W - MR - 28, y + 0.5, 26, 9); } catch { /* skip */ }
      }
      y += 13;
    }

    // Subtotal por fabricante sin descuento (precio_unitario * cantidad)
    const subtotalOriginal = items.reduce((s, it) => s + it.precio_unitario * it.cantidad, 0);

    autoTable(doc as Parameters<typeof autoTable>[0], {
      startY: y,
      margin: { left: ML, right: MR },
      head: [["Ítem", "Descripción", "Cant.", "Precio Unitario", "Total"]],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: ([
        ...items.map((it) => {
          globalItemNum++;
          const totalOriginal = it.precio_unitario * it.cantidad;
          return [
            String(globalItemNum),
            it.catalogo?.nombre ?? it.descripcion,
            String(it.cantidad),
            fmtMoney(it.precio_unitario),
            fmtMoney(totalOriginal),
          ];
        }),
        ...(byFab.size > 1 ? [[
          { content: "", styles: { fillColor: [...BGROW] } },
          { content: `SUBTOTAL ${fab.toUpperCase()}`, styles: { fillColor: [...BGROW], fontStyle: "bold" as const, textColor: [...TEAL] } },
          { content: "", styles: { fillColor: [...BGROW] } },
          { content: "", styles: { fillColor: [...BGROW] } },
          { content: fmtMoney(subtotalOriginal), styles: { fillColor: [...BGROW], fontStyle: "bold" as const, textColor: [...TEAL] } },
        ]] : []),
      ] as unknown as import("jspdf-autotable").RowInput[]),
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [...DARK] },
      headStyles: { fillColor: [...TEAL], textColor: [...WHITE], fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: [...BGROW] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        2: { cellWidth: 12, halign: "center" },
        3: { cellWidth: 32, halign: "right" },
        4: { cellWidth: 28, halign: "right", fontStyle: "bold" },
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── OPCIONES (si hay ítems con precio 0) ─────────────────────────────────
  const opcionItems = c.items.filter((it) => it.precio_neto === 0);
  if (opcionItems.length > 0) {
    if (y + 14 > H - 22) { doc.addPage(); y = HDRH + 8; }
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL);
    doc.text("Opciones", ML, y); y += 7;
    autoTable(doc as Parameters<typeof autoTable>[0], {
      startY: y,
      margin: { left: ML, right: MR },
      head: [["Ítem", "Descripción", "Cant.", "Precio Unitario", "Total"]],
      body: opcionItems.map((it, i) => [
        `${i + 1}*`,
        it.catalogo?.nombre ?? it.descripcion,
        String(it.cantidad),
        fmtMoney(it.precio_unitario),
        fmtMoney(it.precio_neto),
      ]),
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [...DARK] },
      headStyles: { fillColor: [...TEAL], textColor: [...WHITE], fontStyle: "bold", fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        2: { cellWidth: 12, halign: "center" },
        3: { cellWidth: 32, halign: "right" },
        4: { cellWidth: 28, halign: "right" },
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── TÉRMINOS DE PAGO + TOTALES ────────────────────────────────────────────
  if (y + 50 > H - 22) { doc.addPage(); y = HDRH + 8; }

  const totW = 72;
  const totX = W - MR - totW;

  if (c.terminos_pago?.length) {
    doc.setFontSize(9); doc.setTextColor(...TEAL); doc.setFont("helvetica", "bold");
    doc.text("Opciones de pago", ML, y + 5);
    y += 10;
    for (const t of c.terminos_pago) {
      doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK); doc.setFontSize(8.5);
      doc.text(`• ${t.concepto}`, ML + 2, y);
      doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL);
      doc.text(`${t.porcentaje}%`, ML + 85, y, { align: "right" });
      y += 6;
    }
    y += 4;
  }

  // Caja de totales (esquina derecha)
  const boxY = y - (c.terminos_pago?.length ? 0 : 0);
  const boxH = 36 + (c.descuento_total > 0 ? 7 : 0);
  doc.setFillColor(...BGROW);
  doc.roundedRect(totX, boxY, totW, boxH, 2, 2, "F");
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
  doc.roundedRect(totX, boxY, totW, boxH, 2, 2, "S");

  doc.setFontSize(8); doc.setTextColor(...GRAY); doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", totX + 4, boxY + 8);
  doc.setTextColor(...DARK); doc.text(fmtMoney(c.subtotal), totX + totW - 4, boxY + 8, { align: "right" });
  let totRowY = boxY + 15;
  if (c.descuento_total > 0) {
    doc.setTextColor(...GRAY); doc.text("Descuento:", totX + 4, totRowY);
    doc.setTextColor(200, 30, 30); doc.text(`- ${fmtMoney(c.descuento_total)}`, totX + totW - 4, totRowY, { align: "right" });
    totRowY += 7;
  }
  doc.setTextColor(...GRAY); doc.text(`IVA ${c.iva_pct}%:`, totX + 4, totRowY);
  doc.setTextColor(...DARK); doc.text(fmtMoney(c.iva), totX + totW - 4, totRowY, { align: "right" });
  doc.setDrawColor(...TEAL); doc.setLineWidth(0.4);
  doc.line(totX + 3, totRowY + 4, totX + totW - 3, totRowY + 4);
  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL);
  doc.text("TOTAL:", totX + 4, totRowY + 11);
  doc.text(fmtMoney(c.total), totX + totW - 4, totRowY + 11, { align: "right" });

  y = boxY + boxH + 10;

  // ── INFORMACIÓN DEL OFERENTE (nueva hoja) ────────────────────────────────
  if (opts.empresa) {
    doc.addPage(); y = HDRH + 8;
    sectionTitle("INFORMACIÓN DEL OFERENTE", y);
    y += 8;

    const emp = opts.empresa;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK);
    const oferenteLines: [string, string][] = [
      ["Razón social", emp.nombre],
      ...(emp.ruc       ? [["RUC", emp.ruc] as [string, string]] : []),
      ...(emp.direccion ? [["Dirección", emp.direccion] as [string, string]] : []),
      ...(emp.telefono  ? [["Teléfono", emp.telefono] as [string, string]] : []),
      ...(emp.correo    ? [["Correo", emp.correo] as [string, string]] : []),
      ...(emp.sitio_web ? [["Web", emp.sitio_web] as [string, string]] : []),
    ];
    for (const [label, val] of oferenteLines) {
      if (y + 5 > H - 22) { doc.addPage(); y = HDRH + 8; }
      doc.setFont("helvetica", "bold"); doc.text(`${label}:`, ML, y);
      const labelW = doc.getTextWidth(`${label}: `);
      doc.setFont("helvetica", "normal"); doc.text(val, ML + labelW + 1, y);
      y += 5;
    }
    y += 6;
    // Párrafo legal
    doc.setFontSize(7.5); doc.setFont("helvetica", "italic"); doc.setTextColor(...GRAY);
    const legalText = "La presente Oferta se encuentra integrada por el presente Cuadro Técnico-Comercial, las especificaciones técnicas del equipo y los anexos detallados en la sección de Términos y Condiciones.";
    const legalLines = doc.splitTextToSize(legalText, CW) as string[];
    doc.text(legalLines, ML, y); y += legalLines.length * 4.2 + 4;
  }

  // ── NOTAS ────────────────────────────────────────────────────────────────
  if (c.notas) {
    if (y + 14 > H - 22) { doc.addPage(); y = HDRH + 8; }
    doc.setFontSize(8); doc.setTextColor(...GRAY); doc.setFont("helvetica", "bold");
    doc.text("NOTAS", ML, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK);
    const nLines = doc.splitTextToSize(c.notas, CW) as string[];
    doc.text(nLines, ML, y); y += nLines.length * 4.5 + 6;
  }

  // ── TÉRMINOS Y CONDICIONES (nueva hoja siempre) ──────────────────────────
  if (params.terminos_condiciones) {
    doc.addPage(); y = HDRH + 8;
    sectionTitle("TÉRMINOS Y CONDICIONES", y);
    y += 9;

    const tcLines = params.terminos_condiciones.split("\n");
    for (const line of tcLines) {
      const trimmed = line.trim();
      if (!trimmed) { y += 2; continue; }
      if (y + 5 > H - 16) { doc.addPage(); y = HDRH + 8; }

      if (isTcHeading(trimmed)) {
        if (y + 6 > H - 16) { doc.addPage(); y = HDRH + 8; }
        doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...TEAL);
        doc.text(trimmed, ML, y); y += 6;
      } else {
        doc.setFontSize(7.8); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
        const wrapped = doc.splitTextToSize(trimmed, CW) as string[];
        for (const wl of wrapped) {
          if (y + 4 > H - 16) { doc.addPage(); y = HDRH + 8; }
          doc.text(wl, ML, y); y += 4.2;
        }
      }
    }
  }

  // ── ENCABEZADO + PIE DE PÁGINA (todas las páginas) ───────────────────────
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    if (i > 1) {
      // Cabecera: barra teal delgada con info empresa y logo
      doc.setFillColor(...TEAL);
      doc.rect(0, 0, W, HDRH, "F");
      doc.setFontSize(7); doc.setTextColor(...WHITE); doc.setFont("helvetica", "normal");
      doc.text(`${opts.empresa?.nombre ?? "VIATIQ"} · Propuesta ${c.numero}`, ML, 6.5);
      // Logo empresa en cabecera
      if (empresaImg) {
        try { addImg(empresaImg, W - MR - 22, 0.5, 22, 9); } catch { /* skip */ }
      }
    }

    // Pie: barra teal delgada + número de página
    doc.setFillColor(...TEAL);
    doc.rect(0, H - 7, W, 7, "F");
    doc.setFontSize(7); doc.setTextColor(...WHITE); doc.setFont("helvetica", "normal");
    doc.text(`${opts.empresa?.nombre ?? "VIATIQ"} · Propuesta ${c.numero}`, ML, H - 3);
    doc.text(`Página ${i} de ${totalPages}`, W - MR, H - 3, { align: "right" });
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
    ShadingType, VerticalAlign, ImageRun,
  } = await import("docx");

  const params = await fetchPropuestaParametros(opts.empresa_id);

  // Pre-cargar imágenes en paralelo (para ImageRun de docx necesitamos ArrayBuffer)
  const urlsToFetch = [
    opts.empresa?.logo_url ?? null,
    c.cliente?.logo_url ?? null,
    ...c.items.map((it) => it.proveedor?.logo_url ?? null),
    ...c.items.map((it) => it.catalogo?.foto_url ?? null),
  ].filter(Boolean) as string[];

  const uniqueUrls = [...new Set(urlsToFetch)];
  const fetchResults = await Promise.allSettled(uniqueUrls.map(fetchImageBuffer));
  const imgCache = new Map<string, { data: ArrayBuffer; type: "png" | "jpg" | "gif" | "bmp" | "svg" } | null>();
  uniqueUrls.forEach((url, i) => {
    const r = fetchResults[i];
    imgCache.set(url, r.status === "fulfilled" ? r.value : null);
  });

  const getImg = (url: string | null | undefined) => url ? (imgCache.get(url) ?? null) : null;

  // ── Constantes de estilo ────────────────────────────────────────────────────
  const TEAL_HEX   = "007C8F";   // color principal de marca (teal)
  const GRAY_HEX   = "6B7280";
  const BGLIGHT    = "F0F9FA";   // fondo alternado filas muy claro
  const BGROW_HEX  = "F5F8F9";
  const WHITE      = "FFFFFF";

  // ── Helpers de texto ────────────────────────────────────────────────────────
  const bold   = (text: string, color = "111827", sz = 20) => new TextRun({ text, bold: true,  color, size: sz });
  const normal = (text: string, color = "374151", sz = 18) => new TextRun({ text, color, size: sz });
  const small  = (text: string, color = GRAY_HEX, sz = 16) => new TextRun({ text, color, size: sz });
  const italic = (text: string, color = GRAY_HEX, sz = 17) => new TextRun({ text, italics: true, color, size: sz });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const para = (runs: any[], align: string = AlignmentType.LEFT, spacingAfter = 80) =>
    new Paragraph({ children: runs, alignment: align as typeof AlignmentType.LEFT, spacing: { after: spacingAfter } });

  const BLUE_HEX   = TEAL_HEX;   // alias de compatibilidad → teal
  const ACCENT_HEX = TEAL_HEX;   // alias de compatibilidad → teal
  const BGBLUE     = BGLIGHT;    // alias de compatibilidad → fondo claro teal
  const COVER_HEX  = TEAL_HEX;   // color de portada

  const sectionHeading = (text: string) =>
    new Paragraph({
      children: [bold(text, ACCENT_HEX, 20)],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT_HEX } },
    });

  /** Parsea texto con marcadores **negrita** en TextRun[]. Útil para resumen ejecutivo. */
  const parseBoldRuns = (text: string, color: string, sz: number) =>
    text.split(/(\*\*[^*]+\*\*)/).map((part) =>
      part.startsWith("**") && part.endsWith("**")
        ? bold(part.slice(2, -2), color, sz)
        : normal(part, color, sz)
    );

  const cellW   = (w: number) => ({ size: w, type: WidthType.DXA });
  const noB     = { top: { style: BorderStyle.NONE, size: 0, color: WHITE }, bottom: { style: BorderStyle.NONE, size: 0, color: WHITE }, left: { style: BorderStyle.NONE, size: 0, color: WHITE }, right: { style: BorderStyle.NONE, size: 0, color: WHITE } };
  const grayB   = { top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" }, bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" }, left: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" }, right: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" } };

  /** Crea un ImageRun si el buffer está disponible, o null */
  const makeImageRun = (
    imgData: { data: ArrayBuffer; type: "png" | "jpg" | "gif" | "bmp" | "svg" } | null,
    widthPx: number,
    heightPx: number,
  ) => {
    if (!imgData) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new ImageRun({
        data: imgData.data,
        transformation: { width: widthPx, height: heightPx },
      } as any);
    } catch { return null; }
  };

  // ── PORTADA ──────────────────────────────────────────────────────────────────
  const empresaImgRun = makeImageRun(getImg(opts.empresa?.logo_url), 140, 60);
  const clienteImgRun = makeImageRun(getImg(c.cliente?.logo_url), 120, 60);

  const coverLogoRow = (empresaImgRun || clienteImgRun)
    ? [new Table({
        width: { size: 9360, type: WidthType.DXA },
        borders: noB,
        rows: [new TableRow({
          children: [
            new TableCell({
              width: cellW(4680), borders: noB, shading: { type: ShadingType.CLEAR, fill: COVER_HEX },
              margins: { top: 200, bottom: 0, left: 400, right: 100 },
              children: [new Paragraph({ children: empresaImgRun ? [empresaImgRun] : [], spacing: { after: 0 } })],
            }),
            new TableCell({
              width: cellW(4680), borders: noB, shading: { type: ShadingType.CLEAR, fill: COVER_HEX },
              margins: { top: 200, bottom: 0, left: 100, right: 400 },
              verticalAlign: VerticalAlign.TOP,
              children: [new Paragraph({ children: clienteImgRun ? [clienteImgRun] : [], alignment: AlignmentType.RIGHT, spacing: { after: 0 } })],
            }),
          ],
        })],
      })]
    : [];

  const contacto = c.cliente?.contacto_nombre;
  const cargo    = c.cliente?.contacto_cargo;

  const coverTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    borders: noB,
    rows: [
      new TableRow({
        children: [new TableCell({
          width: cellW(9360),
          shading: { type: ShadingType.CLEAR, fill: COVER_HEX },
          margins: { top: 300, bottom: 500, left: 400, right: 400 },
          borders: noB,
          children: [
            new Paragraph({ children: [bold("PROPUESTA TÉCNICO-COMERCIAL", WHITE, 40)], spacing: { after: 140 } }),
            ...(c.asunto ? [new Paragraph({ children: [normal(c.asunto, "C8DCFF", 24)], spacing: { after: 200 } })] : []),
            new Paragraph({ children: [bold(c.numero, "93C5FD", 22)], spacing: { after: 120 } }),
            new Paragraph({ children: [small(`PREPARADO PARA: ${c.razon_social.toUpperCase()}`, WHITE, 18)], spacing: { after: 60 } }),
            ...(contacto ? [new Paragraph({ children: [italic(`At. ${contacto}${cargo ? " — " + cargo : ""}`, "C8DCFF", 17)], spacing: { after: 60 } })] : []),
            ...(opts.empresa?.nombre ? [new Paragraph({ children: [bold(`Presentado por ${opts.empresa.nombre}`, WHITE, 18)], spacing: { after: 80 } })] : []),
            new Paragraph({ children: [small(`Fecha: ${fmtFecha(c.fecha)}${c.valida_hasta ? "   ·   Válido hasta: " + fmtFecha(c.valida_hasta) : ""}`, "93C5FD", 16)], spacing: { after: 0 } }),
          ],
        })],
      }),
    ],
  });

  // ── Info cliente ──────────────────────────────────────────────────────────
  const infoTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    borders: noB,
    rows: [new TableRow({
      children: [
        new TableCell({
          width: cellW(4500), shading: { type: ShadingType.CLEAR, fill: BGBLUE }, borders: noB,
          margins: { top: 100, bottom: 100, left: 120, right: 80 },
          children: [
            para([bold("CLIENTE", BLUE_HEX, 16)], AlignmentType.LEFT, 40),
            para([bold(c.razon_social, "111827", 20)], AlignmentType.LEFT, 40),
            ...(c.ruc_cliente ? [para([small("RUC: " + c.ruc_cliente)], AlignmentType.LEFT, 30)] : []),
            ...(c.email_cliente ? [para([small(c.email_cliente)], AlignmentType.LEFT, 0)] : []),
          ],
        }),
        new TableCell({
          width: cellW(4860), shading: { type: ShadingType.CLEAR, fill: BGBLUE }, borders: noB,
          margins: { top: 100, bottom: 100, left: 80, right: 120 },
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
    })],
  });

  // ── Resumen ejecutivo ────────────────────────────────────────────────────
  const resumenSection = params.resumen_ejecutivo
    ? [
        sectionHeading("RESUMEN EJECUTIVO"),
        para(parseBoldRuns(params.resumen_ejecutivo, GRAY_HEX, 18), AlignmentType.JUSTIFIED, 160),
      ]
    : [];

  // ── Cuadro Técnico-Comercial ─────────────────────────────────────────────
  const cuadroRows: [string, string][] = [];
  if (c.asunto) cuadroRows.push(["Proyecto", c.asunto]);
  cuadroRows.push(["Precio total", fmtMoney(c.total)]);
  if (c.terminos_pago?.length)
    cuadroRows.push(["Forma de pago", c.terminos_pago.map((t) => `${t.porcentaje}% ${t.concepto}`).join(" / ")]);
  if (c.dias_entrega) cuadroRows.push(["Plazo de entrega", `${c.dias_entrega} días laborables`]);
  if (c.meses_garantia) cuadroRows.push(["Garantía", `${c.meses_garantia} meses`]);
  cuadroRows.push(["Soporte técnico", "Incluido"]);
  if (c.lugar_entrega) cuadroRows.push(["Lugar de entrega e instalación", c.lugar_entrega]);

  const cuadroTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2800, 6560],
    rows: cuadroRows.map(([k, v], idx) =>
      new TableRow({
        children: [
          new TableCell({
            width: cellW(2800),
            shading: { type: ShadingType.CLEAR, fill: BGBLUE },
            borders: grayB,
            margins: { top: 80, bottom: 80, left: 120, right: 80 },
            children: [para([bold(k, ACCENT_HEX, 18)], AlignmentType.LEFT, 0)],
          }),
          new TableCell({
            width: cellW(6560),
            shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? BGLIGHT : WHITE },
            borders: grayB,
            margins: { top: 80, bottom: 80, left: 120, right: 80 },
            children: [para([normal(v, "111827", 18)], AlignmentType.LEFT, 0)],
          }),
        ],
      })
    ),
  });

  // ── Descripción técnica (tarjetas por producto) ──────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const techChildren: any[] = [sectionHeading("DESCRIPCIÓN TÉCNICA DE LA OFERTA")];
  const byFab = groupByFabricante(c.items);

  for (const [fab, items] of byFab) {
    // Encabezado fabricante
    const fabItemF = items.find((it) => it.proveedor?.logo_url);
    const fabImgRun = makeImageRun(getImg(fabItemF?.proveedor?.logo_url), 110, 50);

    if (fabImgRun) {
      techChildren.push(new Table({
        width: { size: 9360, type: WidthType.DXA }, borders: noB,
        rows: [new TableRow({
          children: [
            new TableCell({
              width: cellW(6800), borders: noB, shading: { type: ShadingType.CLEAR, fill: BGBLUE },
              margins: { top: 80, bottom: 80, left: 120, right: 80 }, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [bold(fab.toUpperCase(), BLUE_HEX, 22)], spacing: { after: 0 } })],
            }),
            new TableCell({
              width: cellW(2560), borders: noB, shading: { type: ShadingType.CLEAR, fill: BGBLUE },
              margins: { top: 60, bottom: 60, left: 40, right: 120 },
              children: [new Paragraph({ children: [fabImgRun], alignment: AlignmentType.RIGHT, spacing: { after: 0 } })],
            }),
          ],
        })],
      }));
    } else {
      techChildren.push(
        new Paragraph({
          children: [bold(fab.toUpperCase(), BLUE_HEX, 20)],
          spacing: { before: 120, after: 80 },
          shading: { type: ShadingType.CLEAR, fill: BGBLUE },
          indent: { left: 120 },
        })
      );
    }

    // Tarjeta por ítem
    for (const it of items) {
      const fotoImgRun = makeImageRun(getImg(it.catalogo?.foto_url), 185, 130);
      const descLarga = it.catalogo?.descripcion_larga || it.descripcion;
      const headerName = it.catalogo?.nombre ?? it.descripcion;

      // Nombre + subtítulo
      techChildren.push(
        new Paragraph({
          children: [bold(headerName, "111827", 22)],
          spacing: { before: 140, after: 40 },
        }),
        new Paragraph({
          children: [italic(`${it.fabricante || fab}  ·  Modelo: ${it.modelo || "—"}  ·  Cantidad: ${it.cantidad}`, GRAY_HEX, 17)],
          spacing: { after: 80 },
        }),
      );

      if (descLarga || fotoImgRun) {
        const leftColW = fotoImgRun ? 5700 : 9360;
        const rightColW = 9360 - leftColW - 0;

        const row = new TableRow({
          children: [
            new TableCell({
              width: cellW(leftColW), borders: noB,
              margins: { top: 60, bottom: 60, left: 0, right: 120 },
              children: descLarga
                ? [para([normal(descLarga, "374151", 17)], AlignmentType.JUSTIFIED, 0)]
                : [para([], AlignmentType.LEFT, 0)],
            }),
            ...(fotoImgRun ? [new TableCell({
              width: cellW(rightColW), borders: noB,
              margins: { top: 0, bottom: 0, left: 60, right: 0 },
              verticalAlign: VerticalAlign.TOP,
              children: [new Paragraph({ children: [fotoImgRun], alignment: AlignmentType.CENTER, spacing: { after: 0 } })],
            })] : []),
          ],
        });

        techChildren.push(
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: fotoImgRun ? [leftColW, rightColW] : [leftColW],
            borders: noB,
            rows: [row],
          }),
          para([], AlignmentType.LEFT, 60),
        );
      }
    }

    techChildren.push(para([], AlignmentType.LEFT, 120));
  }

  // ── Tabla de precios (una tabla continua, fabricante como fila span) ──────
  // 5 columnas: Ítem | Descripción | Cant. | Precio Unitario | Total
  const PRICE_COL_W = [400, 4200, 600, 1100, 1060];
  const priceHeaders = ["Ítem", "Descripción", "Cant.", "Precio Unitario", "Total"];
  const PRICE_TOTAL_W = PRICE_COL_W.reduce((a, b) => a + b, 0); // 7360

  const makePriceHeaderRow = () =>
    new TableRow({
      children: priceHeaders.map((h, i) =>
        new TableCell({
          width: cellW(PRICE_COL_W[i]),
          shading: { type: ShadingType.CLEAR, fill: BGBLUE }, borders: noB,
          verticalAlign: VerticalAlign.CENTER, margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [para([bold(h, BLUE_HEX, 15)], i >= 2 ? AlignmentType.RIGHT : AlignmentType.LEFT, 0)],
        })
      ),
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceChildren: any[] = [sectionHeading("DETALLE DE PRECIOS POR ÍTEM")];

  // Construir TODAS las filas en una sola tabla
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPriceRows: any[] = [];

  for (const [fab, items] of byFab) {
    // Fila de fabricante abarcando las 5 columnas
    if (byFab.size > 1) {
      allPriceRows.push(
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 5,
              width: cellW(PRICE_TOTAL_W),
              shading: { type: ShadingType.CLEAR, fill: BGBLUE },
              borders: grayB,
              margins: { top: 80, bottom: 80, left: 120, right: 80 },
              children: [para([bold(fab.toUpperCase(), BLUE_HEX, 17)], AlignmentType.LEFT, 0)],
            }),
          ],
        })
      );
    }

    const subtotal = items.reduce((s, it) => s + it.precio_neto, 0);

    items.forEach((it, localIdx) => {
      const bg = localIdx % 2 === 0 ? BGLIGHT : WHITE;
      const itemName = it.catalogo?.nombre ?? it.descripcion;
      allPriceRows.push(
        new TableRow({
          children: [
            new TableCell({ width: cellW(PRICE_COL_W[0]), shading: { type: ShadingType.CLEAR, fill: bg }, borders: grayB, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [para([normal(String(localIdx + 1), GRAY_HEX, 15)], AlignmentType.CENTER, 0)] }),
            new TableCell({ width: cellW(PRICE_COL_W[1]), shading: { type: ShadingType.CLEAR, fill: bg }, borders: grayB, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [para([normal(itemName, "111827", 15)], AlignmentType.LEFT, 0)] }),
            new TableCell({ width: cellW(PRICE_COL_W[2]), shading: { type: ShadingType.CLEAR, fill: bg }, borders: grayB, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [para([normal(String(it.cantidad), "111827", 15)], AlignmentType.RIGHT, 0)] }),
            new TableCell({ width: cellW(PRICE_COL_W[3]), shading: { type: ShadingType.CLEAR, fill: bg }, borders: grayB, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [para([normal(fmtMoney(it.precio_unitario), "111827", 15)], AlignmentType.RIGHT, 0)] }),
            new TableCell({ width: cellW(PRICE_COL_W[4]), shading: { type: ShadingType.CLEAR, fill: bg }, borders: grayB, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [para([bold(fmtMoney(it.precio_neto), BLUE_HEX, 15)], AlignmentType.RIGHT, 0)] }),
          ],
        })
      );
    });

    if (byFab.size > 1) {
      const subtotalLabelW = PRICE_COL_W[0] + PRICE_COL_W[1] + PRICE_COL_W[2] + PRICE_COL_W[3];
      allPriceRows.push(
        new TableRow({
          children: [
            new TableCell({ columnSpan: 4, width: cellW(subtotalLabelW), shading: { type: ShadingType.CLEAR, fill: BGBLUE }, borders: grayB, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [para([bold(`Subtotal ${fab}`, BLUE_HEX, 15)], AlignmentType.RIGHT, 0)] }),
            new TableCell({ width: cellW(PRICE_COL_W[4]), shading: { type: ShadingType.CLEAR, fill: BGBLUE }, borders: grayB, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [para([bold(fmtMoney(subtotal), BLUE_HEX, 15)], AlignmentType.RIGHT, 0)] }),
          ],
        })
      );
    }
  }

  priceChildren.push(
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: PRICE_COL_W,
      rows: [makePriceHeaderRow(), ...allPriceRows],
    }),
    para([], AlignmentType.LEFT, 80),
  );

  // ── Totales ──────────────────────────────────────────────────────────────
  const totalesRows = [
    ["Subtotal", fmtMoney(c.subtotal)],
    ...(c.descuento_total > 0 ? [["Descuento", `- ${fmtMoney(c.descuento_total)}`]] : []),
    [`IVA ${c.iva_pct}%`, fmtMoney(c.iva)],
  ];

  const totalesTable = new Table({
    width: { size: 4000, type: WidthType.DXA },
    columnWidths: [2400, 1600],
    indent: { size: 5360, type: WidthType.DXA },
    borders: noB,
    rows: [
      ...totalesRows.map(([label, value]) =>
        new TableRow({
          children: [
            new TableCell({ width: cellW(2400), borders: noB, margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: [para([small(label)], AlignmentType.LEFT, 0)] }),
            new TableCell({ width: cellW(1600), borders: noB, margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: [para([normal(value)], AlignmentType.RIGHT, 0)] }),
          ],
        })
      ),
      new TableRow({
        children: [
          new TableCell({ width: cellW(2400), shading: { type: ShadingType.CLEAR, fill: BGBLUE }, borders: noB, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [para([bold("TOTAL USD", BLUE_HEX, 22)], AlignmentType.LEFT, 0)] }),
          new TableCell({ width: cellW(1600), shading: { type: ShadingType.CLEAR, fill: BGBLUE }, borders: noB, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [para([bold(fmtMoney(c.total), BLUE_HEX, 22)], AlignmentType.RIGHT, 0)] }),
        ],
      }),
    ],
  });

  // ── Términos de pago ─────────────────────────────────────────────────────
  const terminosSection = c.terminos_pago?.length
    ? [
        sectionHeading("TÉRMINOS DE PAGO"),
        ...c.terminos_pago.map((t) =>
          para([normal(`• ${t.concepto}   `, GRAY_HEX), bold(`${t.porcentaje}%`, BLUE_HEX)])
        ),
        para([], AlignmentType.LEFT, 60),
      ]
    : [];

  // ── Información del oferente ──────────────────────────────────────────────
  const oferenteSection = opts.empresa
    ? [
        sectionHeading("INFORMACIÓN DEL OFERENTE"),
        para([bold(opts.empresa.nombre, "111827", 22)], AlignmentType.LEFT, 60),
        ...(opts.empresa.ruc       ? [para([small(`RUC: ${opts.empresa.ruc}`)], AlignmentType.LEFT, 40)] : []),
        ...(opts.empresa.direccion ? [para([small(opts.empresa.direccion)], AlignmentType.LEFT, 40)] : []),
        ...(opts.empresa.telefono  ? [para([small(`Tel: ${opts.empresa.telefono}`)], AlignmentType.LEFT, 40)] : []),
        ...(opts.empresa.correo    ? [para([small(opts.empresa.correo)], AlignmentType.LEFT, 40)] : []),
        ...(opts.empresa.sitio_web ? [para([small(`Web: ${opts.empresa.sitio_web}`)], AlignmentType.LEFT, 60)] : []),
      ]
    : [];

  // ── Notas ────────────────────────────────────────────────────────────────
  const notasSection = c.notas
    ? [sectionHeading("NOTAS"), para([normal(c.notas, GRAY_HEX)], AlignmentType.LEFT, 120)]
    : [];

  // ── T&C con sub-encabezados detectados ──────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tcChildren: any[] = [];
  if (params.terminos_condiciones) {
    tcChildren.push(sectionHeading("TÉRMINOS Y CONDICIONES"));
    const tcLines = params.terminos_condiciones.split("\n");
    let currentBlock: string[] = [];

    const flushBlock = () => {
      if (currentBlock.length > 0) {
        tcChildren.push(para([normal(currentBlock.join("\n"), GRAY_HEX, 16)], AlignmentType.JUSTIFIED, 80));
        currentBlock = [];
      }
    };

    for (const line of tcLines) {
      const trimmed = line.trim();
      if (!trimmed) { flushBlock(); continue; }
      if (isTcHeading(trimmed)) {
        flushBlock();
        tcChildren.push(new Paragraph({
          children: [bold(trimmed, "111827", 18)],
          spacing: { before: 160, after: 60 },
        }));
      } else {
        currentBlock.push(trimmed);
      }
    }
    flushBlock();
  }

  // ── Pie ──────────────────────────────────────────────────────────────────
  const pieSection = [
    para([small("Documento generado por VIATIQ · © 2026 Nahdan", "9CA3AF")], AlignmentType.CENTER, 0),
  ];

  // ── Documento final ───────────────────────────────────────────────────────
  const doc2 = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 720, bottom: 720, left: 800, right: 800 } },
      },
      children: [
        // Portada
        ...coverLogoRow,
        coverTable,
        para([], AlignmentType.LEFT, 120),
        // Datos cliente
        infoTable,
        para([], AlignmentType.LEFT, 160),
        // Resumen ejecutivo
        ...resumenSection,
        // Cuadro técnico-comercial
        ...(cuadroRows.length > 0 ? [sectionHeading("CUADRO TÉCNICO-COMERCIAL DE LA OFERTA"), cuadroTable, para([], AlignmentType.LEFT, 160)] : []),
        // Descripción técnica por producto
        ...techChildren,
        // Precios
        ...priceChildren,
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
        ...tcChildren,
        // Pie
        para([], AlignmentType.LEFT, 80),
        ...pieSection,
      ],
    }],
  });

  const buffer = await Packer.toBlob(doc2);
  triggerDownload(buffer, `${c.numero}.docx`);
}
