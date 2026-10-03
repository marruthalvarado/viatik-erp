/**
 * orden-servicio-export.ts
 * Exporta el Reporte de Servicio Técnico a PDF (jsPDF) y Word (.docx).
 *
 * Estructura del reporte (número único = OS-YYYY-NNNN):
 *   1. Encabezado — logo empresa, título, número OS, fecha emisión
 *   2. Datos del cliente
 *   3. Datos del equipo instalado
 *   4. Información de la orden (tipo, técnico, fechas, modalidad cobro)
 *   5. Descripción del problema / diagnóstico
 *   6. Trabajos realizados
 *   7. Repuestos utilizados (tabla)
 *   8. Costos (mano de obra + repuestos + total)
 *   9. Observaciones
 *  10. Galería de fotos (antes / durante / después)
 *  11. Firmas — Técnico + Cliente
 */
import type { OrdenConRelaciones, OsActividad } from "@/services/servicio-tecnico/ordenes-servicio";
import { LOGO_VIATIQ_PNG_B64, LOGO_VIATIQ_W, LOGO_VIATIQ_H } from "@/assets/branding/logo-viatiq-b64";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export interface OsExportOptions {
  empresa?: {
    nombre: string;
    ruc?: string | null;
    telefono?: string | null;
    correo?: string | null;
    direccion?: string | null;
    logo_url?: string | null;
  };
  actividades?: OsActividad[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmtFecha = (d: string | null | undefined) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(day)} ${meses[parseInt(m) - 1]} ${y}`;
};

const fmtMoney = (n: number) =>
  "$" + n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TIPO_LABEL: Record<string, string> = {
  preventivo:    "Preventivo",
  correctivo:    "Correctivo",
  instalacion:   "Instalación",
  actualizacion: "Actualización",
  repuesto:      "Reemplazo de repuesto",
};

const COBRO_LABEL: Record<string, string> = {
  garantia:   "Garantía",
  contrato:   "Contrato",
  por_visita: "Por visita",
  sin_costo:  "Sin costo",
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente:  "Pendiente",
  en_proceso: "En proceso",
  completada: "Completada",
  cancelada:  "Cancelada",
};

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

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

async function fetchImageBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function exportOrdenServicioPdf(
  os: OrdenConRelaciones,
  opts: OsExportOptions = {},
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");

  // Pre-cargar imágenes
  const urlsRaw = [
    opts.empresa?.logo_url,
    ...(os.fotos ?? []).map((f) => f.url),
  ].filter(Boolean) as string[];
  const uniqueUrls = [...new Set(urlsRaw)];
  const fetchResults = await Promise.allSettled(uniqueUrls.map(fetchImageBase64));
  const imgCache = new Map<string, { b64: string; mime: "PNG" | "JPEG" } | null>();
  uniqueUrls.forEach((url, i) => {
    const r = fetchResults[i];
    imgCache.set(url, r.status === "fulfilled" ? r.value : null);
  });
  const getImg = (url: string | null | undefined) => url ? (imgCache.get(url) ?? null) : null;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W  = doc.internal.pageSize.width;
  const H  = doc.internal.pageSize.height;
  const ML = 14;
  const MR = 14;
  const CW = W - ML - MR;

  const NAVY   = [15, 40, 100]   as const;
  const BGNAVY = [235, 240, 255] as const;
  const GRAY   = [100, 116, 139] as const;
  const DARK   = [15, 23, 42]    as const;
  const WHITE  = [255, 255, 255] as const;
  const BORDER = [226, 232, 240] as const;
  const BGROW  = [248, 250, 252] as const;

  type JsPDFImg = { addImage: (img: string, fmt: string, x: number, y: number, w: number, h: number) => void };
  const addImg = (img: { b64: string; mime: "PNG" | "JPEG" } | null, x: number, y: number, mW: number, mH: number) => {
    if (!img) return;
    try {
      (doc as unknown as JsPDFImg).addImage(
        `data:image/${img.mime.toLowerCase()};base64,${img.b64}`,
        img.mime, x, y, mW, mH,
      );
    } catch { /* ignorar */ }
  };

  // Fecha local (evita desfase UTC)
  const hoy = (() => {
    const d = new Date();
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  })();

  // ── ENCABEZADO ───────────────────────────────────────────────────────────────
  const HDR_H = 36;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, HDR_H, "F");

  // Logo empresa (izquierda) — se escala manteniendo proporción dentro de un área fija
  const empresaImg = getImg(opts.empresa?.logo_url);
  const LOGO_AREA_W = 52;
  const LOGO_AREA_H = 28;
  const LOGO_Y      = (HDR_H - LOGO_AREA_H) / 2;   // centrado vertical en el header
  if (empresaImg) {
    addImg(empresaImg, ML, LOGO_Y, LOGO_AREA_W, LOGO_AREA_H);
  } else {
    addImg({ b64: LOGO_VIATIQ_PNG_B64, mime: "PNG" }, ML, LOGO_Y + 4, LOGO_VIATIQ_W * 0.09, LOGO_VIATIQ_H * 0.09);
  }

  // Título y N° a la derecha del logo
  const TITLE_X = ML + LOGO_AREA_W + 6;
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("REPORTE DE SERVICIO TÉCNICO", W / 2 + 10, 13, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`N° ${os.numero ?? "—"}`, W - MR, 22, { align: "right" });
  doc.text(fmtFecha(hoy), W - MR, 29, { align: "right" });

  // Sin franja de empresa bajo el header — los datos van al pie de página
  let y = HDR_H + 4;
  void TITLE_X; // evitar warning "declared but never read"

  // ── GRILLA COMPACTA DE DATOS ──────────────────────────────────────────────
  const BDRCLR = [203, 213, 225] as const;
  const CELLBG = [252, 253, 254] as const;

  const drawCompactCell = (
    cx: number, cy: number, cw: number, ch: number,
    label: string, value: string,
  ) => {
    doc.setFillColor(...CELLBG);
    doc.setDrawColor(...BDRCLR);
    doc.rect(cx, cy, cw, ch, "FD");
    // Etiqueta
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...GRAY);
    doc.text(label.toUpperCase(), cx + 2.5, cy + 4);
    // Valor (hasta 2 líneas)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...DARK);
    const valLines = doc.splitTextToSize(value || "—", cw - 5);
    doc.text((valLines as string[]).slice(0, 2), cx + 2.5, cy + 9);
  };

  const col4 = CW / 4;
  const col2 = CW / 2;
  const GH1 = 16;
  const GH2 = 12;
  const GH3 = 12;
  const GX  = ML;

  const tecnicoStr = os.tecnico
    ? `${os.tecnico.nombres} ${os.tecnico.apellidos}${os.tecnico.cargo ? ", " + os.tecnico.cargo : ""}`
    : "—";
  const clienteNombreStr = os.cliente?.nombre ?? os.equipo?.cliente?.nombre ?? "—";
  const contactoStr = [os.cliente?.contacto_nombre, os.cliente?.contacto_cargo].filter(Boolean).join(" · ");
  const fabModStr   = [os.equipo?.fabricante, os.equipo?.modelo].filter(Boolean).join(" / ") || "—";

  // Fila 1: Fecha | Técnico | Tipo | Cobro
  drawCompactCell(GX,             y, col4, GH1, "Fecha de servicio",  fmtFecha(os.fecha_programada));
  drawCompactCell(GX + col4,      y, col4, GH1, "Ingeniero / FE",     tecnicoStr);
  drawCompactCell(GX + 2 * col4,  y, col4, GH1, "Tipo de servicio",   TIPO_LABEL[os.tipo ?? ""] ?? "—");
  drawCompactCell(GX + 3 * col4,  y, col4, GH1, "Modalidad de cobro", COBRO_LABEL[os.modalidad_cobro ?? ""] ?? "—");
  y += GH1;

  // Fila 2: Cliente (span 2) | Contrato | Estado
  drawCompactCell(GX,             y, col2,       GH2, "Cliente", clienteNombreStr + (contactoStr ? "  ·  " + contactoStr : ""));
  drawCompactCell(GX + col2,      y, col4,       GH2, "Contrato", os.contrato?.numero ?? "—");
  drawCompactCell(GX + col2 + col4, y, col4,     GH2, "Estado de la orden", ESTADO_LABEL[os.estado ?? ""] ?? "—");
  y += GH2;

  // Fila 3: Equipo | Fab/Modelo | N° Serie | Ubicación
  drawCompactCell(GX,             y, col4, GH3, "Equipo",              os.equipo?.nombre ?? "—");
  drawCompactCell(GX + col4,      y, col4, GH3, "Fabricante / Modelo", fabModStr);
  drawCompactCell(GX + 2 * col4,  y, col4, GH3, "N° de serie",         os.equipo?.numero_serie ?? "—");
  drawCompactCell(GX + 3 * col4,  y, col4, GH3, "Dirección",           os.equipo?.ubicacion_instalacion ?? "—");
  y += GH3 + 5;

  // ── Helpers de sección ────────────────────────────────────────────────────
  let secNum = 0;

  const drawSection = (title: string) => {
    secNum++;
    doc.setFillColor(...BGNAVY);
    doc.rect(ML, y, CW, 6.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text(`${secNum}. ${title.toUpperCase()}`, ML + 3, y + 4.5);
    y += 10;
  };

  const drawText = (label: string, value: string | null | undefined) => {
    if (!value) return;
    if (label) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY);
      doc.text(label, ML, y);
      y += 4.5;
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(value, CW);
    doc.text(lines, ML, y);
    y += (lines as string[]).length * 4.5 + 4;
  };

  const hr = () => {
    doc.setDrawColor(...BORDER);
    doc.line(ML, y - 2, ML + CW, y - 2);
  };

  const checkNewPage = (needed = 30) => {
    if (y + needed > H - 20) {
      doc.addPage();
      y = 16;
    }
  };

  // ── DESCRIPCIÓN DEL PROBLEMA (condicional) ────────────────────────────────
  const mostrarProblema = os.tipo === "correctivo"
    || os.tipo === "instalacion"
    || os.tipo === "actualizacion"
    || os.tipo === "repuesto"
    || (os.tipo === "preventivo" && !!os.incluye_correctivo);

  if (mostrarProblema) {
    checkNewPage(30);
    drawSection("Descripción del problema y diagnóstico");
    if (os.tipo === "preventivo") {
      drawText("", os.descripcion_correctivo ?? os.descripcion_problema);
    } else {
      drawText("Descripción:", os.descripcion_problema);
      drawText("Diagnóstico:", os.diagnostico);
    }
  }

  // ── TRABAJOS REALIZADOS ───────────────────────────────────────────────────
  if (os.trabajos_realizados) {
    checkNewPage(30);
    hr();
    drawSection("Trabajos realizados");
    drawText("", os.trabajos_realizados);
  }

  // ── ACTIVIDADES DE MANTENIMIENTO ─────────────────────────────────────────
  const actividades = opts.actividades ?? [];
  if (actividades.length > 0) {
    checkNewPage(40);
    hr();
    drawSection("Actividades de mantenimiento");

    const actSecciones = actividades.reduce<Record<string, OsActividad[]>>((acc, a) => {
      const key = a.seccion_titulo ?? "Sin sección";
      if (!acc[key]) acc[key] = [];
      acc[key].push(a);
      return acc;
    }, {});

    // Sin caracteres Unicode especiales — jsPDF Helvetica no los soporta
    const RES_LABEL: Record<string, string> = { ok: "OK", no_ok: "No OK", na: "N/A" };
    const ACT_GREEN   = [220, 252, 231] as const;
    const ACT_RED     = [254, 226, 226] as const;
    const ACT_RED_TXT = [185, 28, 28]   as const;
    const SUB_FILL    = [245, 247, 250] as const;
    const SUB_TXT     = [100, 116, 139] as const;

    for (const [titulo, acts] of Object.entries(actSecciones)) {
      const actsFiltradas = acts.filter((a) => a.resultado !== "na");
      if (actsFiltradas.length === 0) continue;

      checkNewPage(25);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...NAVY);
      doc.text(titulo.toUpperCase(), ML + 2, y);
      y += 5;

      type AnyCell = string | { content: string; colSpan?: number; styles?: Record<string, unknown> };
      const body: AnyCell[][] = [];
      const rowMeta: (OsActividad | null)[] = [];

      for (const a of actsFiltradas) {
        // Descripción (sin caracteres especiales; (*) para crítico)
        let desc = a.descripcion + (a.es_critico ? "  (*)" : "");
        if (a.modelo_seleccionado) {
          desc = desc.replace(/\s*\(.*?\)\s*$/, "").trim() + " " + a.modelo_seleccionado;
        }

        // Resultado
        let resultado = RES_LABEL[a.resultado ?? ""] ?? "—";
        if (a.tipo_campo === "medicion") {
          if (a.etiquetas_medicion && a.etiquetas_medicion.length > 1) {
            resultado = a.resultado === "ok" ? "OK" : a.resultado === "no_ok" ? "No OK" : "—";
          } else if (a.valor_medido !== null && a.valor_medido !== undefined) {
            resultado = `${a.valor_medido}${a.unidad ? " " + a.unidad : ""}\n(${RES_LABEL[a.resultado ?? ""] ?? "—"})`;
          }
        }

        body.push([desc, resultado]);
        rowMeta.push(a);

        // Sub-fila de valores medidos (multi-medición)
        if (a.etiquetas_medicion && a.valores_medidos && a.etiquetas_medicion.length > 1) {
          const partes = a.etiquetas_medicion.map((etq, i) => {
            const val = (a.valores_medidos as (number | null)[])[i];
            if (val === null || val === undefined) return `${etq}: —`;
            const rango = a.rangos_medicion?.[i];
            const inRange = rango
              ? ((rango.min === null || val >= rango.min) && (rango.max === null || val <= rango.max))
              : true;
            const unit = a.unidad ? " " + a.unidad : "";
            return `${etq}: ${val}${unit}  ${inRange ? "OK" : "NO OK"}`;
          });
          body.push([{
            content: partes.join("     "),
            colSpan: 2,
            styles: {
              fontSize: 6.5,
              textColor: SUB_TXT,
              fillColor: SUB_FILL,
              fontStyle: "italic",
              halign: "left",
              cellPadding: { top: 2, bottom: 3, left: 8, right: 4 },
            },
          }]);
          rowMeta.push(null);
        }
      }

      autoTable(doc, {
        startY: y,
        margin: { left: ML, right: MR },
        head: [["Actividad", "Resultado"]],
        body,
        headStyles: { fillColor: NAVY as unknown as [number,number,number], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
        bodyStyles: { fontSize: 7.5, textColor: DARK as unknown as [number,number,number] },
        columnStyles: {
          0: { cellWidth: "auto" as unknown as number },
          1: { cellWidth: 30, halign: "center" as const },
        },
        didParseCell: (data) => {
          if (data.section !== "body") return;
          const act = rowMeta[data.row.index];
          if (!act) return;
          // Sin color verde para OK — solo rojo para No OK
          if (act.resultado === "no_ok") {
            data.cell.styles.fillColor = ACT_RED as unknown as [number,number,number];
            if (act.es_critico) {
              data.cell.styles.textColor = ACT_RED_TXT as unknown as [number,number,number];
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }
  }

  // ── REPUESTOS ─────────────────────────────────────────────────────────────
  const repuestos = os.repuestos ?? [];
  if (repuestos.length > 0) {
    checkNewPage(50);
    hr();
    drawSection("Repuestos / materiales utilizados");

    const totalRepuestos = repuestos.reduce(
      (s, r) => s + (r.cantidad ?? 0) * (r.precio_unitario ?? 0), 0,
    );

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [["Descripción", "Cant.", "P. Unitario", "Subtotal"]],
      body: repuestos.map((r) => [
        r.descripcion,
        String(r.cantidad ?? 1),
        fmtMoney(r.precio_unitario ?? 0),
        fmtMoney((r.cantidad ?? 1) * (r.precio_unitario ?? 0)),
      ]),
      foot: [["", "", "TOTAL", fmtMoney(totalRepuestos)]],
      headStyles:  { fillColor: NAVY as unknown as [number,number,number], textColor: 255, fontSize: 8, fontStyle: "bold" },
      footStyles:  { fillColor: BGNAVY as unknown as [number,number,number], textColor: NAVY as unknown as [number,number,number], fontSize: 8, fontStyle: "bold" },
      alternateRowStyles: { fillColor: BGROW as unknown as [number,number,number] },
      bodyStyles:  { fontSize: 8, textColor: DARK as unknown as [number,number,number] },
      columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── CONCLUSIONES Y OBSERVACIONES ─────────────────────────────────────────
  if (os.observaciones) {
    checkNewPage(25);
    hr();
    drawSection("Conclusiones y observaciones");
    drawText("", os.observaciones);
  }

  // ── REGISTRO FOTOGRÁFICO ─────────────────────────────────────────────────
  const fotos = (os.fotos ?? []).filter((f) => f.url);
  if (fotos.length > 0) {
    checkNewPage(70);
    hr();
    drawSection("Anexo de imágenes");

    const momentoLabel: Record<string, string> = { antes: "ANTES", durante: "DURANTE", despues: "DESPUES" };
    let col = 0;
    const fotoW = (CW - 8) / 3;
    const fotoH = 44;

    for (const foto of fotos) {
      const imgData = getImg(foto.url);
      if (!imgData) continue;
      if (col === 0) checkNewPage(fotoH + 18);

      const x = ML + col * (fotoW + 4);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      const lbl = momentoLabel[foto.momento ?? ""] ?? (foto.momento ?? "").toUpperCase();
      doc.text(lbl, x + fotoW / 2, y, { align: "center" });
      addImg(imgData, x, y + 2, fotoW, fotoH);
      if (foto.descripcion) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...GRAY);
        doc.text(foto.descripcion, x + fotoW / 2, y + fotoH + 5, { align: "center", maxWidth: fotoW });
      }
      col++;
      if (col >= 3) { col = 0; y += fotoH + 14; }
    }
    if (col > 0) y += fotoH + 14;
  }

  // ── FIRMAS ───────────────────────────────────────────────────────────────
  checkNewPage(52);
  y += 4;
  hr();
  y += 5;

  const sigW  = (CW - 10) / 2;
  const sigH  = 24;
  const sigX2 = ML + sigW + 10;

  doc.setDrawColor(...BDRCLR);
  doc.setFillColor(...BGROW);
  doc.rect(ML, y, sigW, sigH, "FD");
  doc.rect(sigX2, y, sigW, sigH, "FD");

  const firmaT = getImg(os.firma_tecnico_url);
  const firmaC = getImg(os.firma_cliente_url);
  if (firmaT) addImg(firmaT, ML + 4, y + 2, sigW - 8, sigH - 4);
  if (firmaC) addImg(firmaC, sigX2 + 4, y + 2, sigW - 8, sigH - 4);

  y += sigH + 3;
  const tecnicoNombre = os.tecnico ? `${os.tecnico.nombres} ${os.tecnico.apellidos}` : "Técnico";
  const clienteNombreSig = os.cliente?.nombre ?? os.equipo?.cliente?.nombre ?? "Cliente";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  doc.text(tecnicoNombre, ML + sigW / 2, y, { align: "center" });
  doc.text(clienteNombreSig, sigX2 + sigW / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text("Responsable de mantenimiento", ML + sigW / 2, y + 4, { align: "center" });
  doc.text("Cliente / Responsable", sigX2 + sigW / 2, y + 4, { align: "center" });

  // ── PIE DE PÁGINA ─────────────────────────────────────────────────────────
  const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);

    // Línea separadora del pie
    doc.setDrawColor(...BORDER);
    doc.line(ML, H - 16, W - MR, H - 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);

    // Datos de empresa (izquierda)
    if (opts.empresa) {
      const empresaFooter = [opts.empresa.nombre, opts.empresa.telefono, opts.empresa.correo]
        .filter(Boolean).join("  ·  ");
      const dirFooter = opts.empresa.direccion ?? "";
      doc.text(empresaFooter, ML, H - 11);
      if (dirFooter) doc.text(dirFooter, ML, H - 7);
    }

    // N° + paginación (centro)
    doc.text(`${os.numero ?? ""} · Pág. ${pg} / ${totalPages}`, W / 2, H - 7, { align: "center" });

    // Fecha (derecha)
    doc.text(fmtFecha(hoy), W - MR, H - 11, { align: "right" });
    doc.text("Generado con VIATIQ ERP", W - MR, H - 7, { align: "right" });
  }

  triggerDownload(
    doc.output("blob"),
    `Reporte_OS_${os.numero ?? os.id.slice(0, 8)}.pdf`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WORD (.docx)
// ─────────────────────────────────────────────────────────────────────────────

export async function exportOrdenServicioDocx(
  os: OrdenConRelaciones,
  opts: OsExportOptions = {},
): Promise<void> {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, BorderStyle, AlignmentType, ShadingType, convertInchesToTwip,
  } = await import("docx");

  // Fecha local
  const hoyDocx = (() => {
    const d = new Date();
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  })();

  // Pre-cargar imágenes
  const fotoUrls = (os.fotos ?? []).map((f) => f.url).filter(Boolean) as string[];
  const logoUrl  = opts.empresa?.logo_url ?? null;
  const allUrls  = [...new Set([logoUrl, ...fotoUrls].filter(Boolean))] as string[];
  const bufMap   = new Map<string, ArrayBuffer | null>();
  await Promise.all(allUrls.map(async (url) => {
    bufMap.set(url, await fetchImageBuffer(url));
  }));

  const makeImg = async (url: string | null | undefined, widthPx: number, heightPx: number) => {
    if (!url) return null;
    const buf = bufMap.get(url);
    if (!buf) return null;
    const { ImageRun } = await import("docx");
    try { return new ImageRun({ data: buf, transformation: { width: widthPx, height: heightPx } } as never); }
    catch { return null; }
  };

  const NAVY_HEX  = "0F2864";
  const LIGHT_HEX = "EBF0FF";
  const GRAY_HEX  = "64748B";
  const BDR_HEX   = "CBD5E1";
  const BDR       = { style: BorderStyle.SINGLE, size: 4, color: BDR_HEX } as const;

  // ── Helpers ──
  let secNumDocx = 0;
  const sectionTitle = (title: string) => {
    secNumDocx++;
    return new Paragraph({
      children: [new TextRun({ text: `${secNumDocx}. ${title.toUpperCase()}`, bold: true, color: NAVY_HEX, size: 18 })],
      shading:  { type: ShadingType.CLEAR, fill: LIGHT_HEX },
      spacing:  { before: 240, after: 80 },
      border:   { bottom: { style: BorderStyle.SINGLE, size: 4, color: NAVY_HEX } },
    });
  };

  const bodyPara = (text: string | null | undefined) =>
    new Paragraph({
      children: [new TextRun({ text: text || "—", size: 18 })],
      spacing:  { after: 100 },
    });

  const boldLabel = (label: string) =>
    new Paragraph({
      children: [new TextRun({ text: label, bold: true, size: 17, color: GRAY_HEX })],
      spacing: { after: 20 },
    });

  // Celda de grilla compacta (etiqueta + valor)
  const gridCell = (label: string, value: string, widthPct: number) =>
    new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      borders: { top: BDR, bottom: BDR, left: BDR, right: BDR },
      shading: { type: ShadingType.CLEAR, fill: "FCFDFE" },
      children: [
        new Paragraph({
          children: [new TextRun({ text: label.toUpperCase(), bold: true, size: 13, color: GRAY_HEX })],
          spacing: { after: 20 },
        }),
        new Paragraph({
          children: [new TextRun({ text: value || "—", size: 17, color: "0F172A" })],
        }),
      ],
    });

  const tecnicoDocx = os.tecnico
    ? `${os.tecnico.nombres} ${os.tecnico.apellidos}`
    : "—";
  const clienteDocx   = os.cliente?.nombre ?? os.equipo?.cliente?.nombre ?? "—";
  const contactoDocx  = [os.cliente?.contacto_nombre, os.cliente?.contacto_cargo].filter(Boolean).join(" · ");
  const fabModDocx    = [os.equipo?.fabricante, os.equipo?.modelo].filter(Boolean).join(" / ") || "—";

  // ── Grilla compacta 3 filas × 4 columnas ──
  const dataGrid = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      // Fila 1: Fecha | Ingeniero/FE | Tipo | Cobro
      new TableRow({ children: [
        gridCell("Fecha de servicio",  fmtFecha(os.fecha_programada), 25),
        gridCell("Ingeniero / FE",     tecnicoDocx, 25),
        gridCell("Tipo de servicio",   TIPO_LABEL[os.tipo ?? ""] ?? "—", 25),
        gridCell("Modalidad de cobro", COBRO_LABEL[os.modalidad_cobro ?? ""] ?? "—", 25),
      ]}),
      // Fila 2: Cliente (50%) | Contrato | Estado
      new TableRow({ children: [
        gridCell("Cliente",            clienteDocx + (contactoDocx ? "  ·  " + contactoDocx : ""), 50),
        gridCell("Contrato",           os.contrato?.numero ?? "—", 25),
        gridCell("Estado de la orden", ESTADO_LABEL[os.estado ?? ""] ?? "—", 25),
      ]}),
      // Fila 3: Equipo | Fab/Modelo | N° Serie | Dirección
      new TableRow({ children: [
        gridCell("Equipo",              os.equipo?.nombre ?? "—", 25),
        gridCell("Fabricante / Modelo", fabModDocx, 25),
        gridCell("N° de serie",         os.equipo?.numero_serie ?? "—", 25),
        gridCell("Dirección",           os.equipo?.ubicacion_instalacion ?? "—", 25),
      ]}),
    ],
  });

  // ── Tabla de repuestos ──
  const repuestos = os.repuestos ?? [];
  const repuestosTable = repuestos.length > 0
    ? new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [["Descripción", 55], ["Cant.", 10], ["P. Unitario", 17], ["Subtotal", 18]].map(([h, w]) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h as string, bold: true, color: "FFFFFF", size: 17 })] })],
                shading:  { type: ShadingType.CLEAR, fill: NAVY_HEX },
                width:    { size: w as number, type: WidthType.PERCENTAGE },
              }),
            ),
          }),
          ...repuestos.map((r, i) =>
            new TableRow({
              children: [
                r.descripcion,
                String(r.cantidad ?? 1),
                fmtMoney(r.precio_unitario ?? 0),
                fmtMoney((r.cantidad ?? 1) * (r.precio_unitario ?? 0)),
              ].map((val) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: val, size: 17 })] })],
                  shading:  { type: ShadingType.CLEAR, fill: i % 2 === 0 ? "F8FAFC" : "FFFFFF" },
                }),
              ),
            }),
          ),
          new TableRow({ children: [
            new TableCell({ children: [new Paragraph("")], columnSpan: 2 }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TOTAL", bold: true, size: 17, color: "FFFFFF" })] })], shading: { type: ShadingType.CLEAR, fill: NAVY_HEX } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: fmtMoney(repuestos.reduce((s, r) => s + (r.cantidad ?? 0) * (r.precio_unitario ?? 0), 0)), bold: true, size: 17, color: "FFFFFF" })] })], shading: { type: ShadingType.CLEAR, fill: NAVY_HEX } }),
          ]}),
        ],
      })
    : null;

  // ── Actividades ──
  const actividades = opts.actividades ?? [];
  const actItems: unknown[] = [];
  if (actividades.length > 0) {
    actItems.push(sectionTitle("Actividades de mantenimiento"));

    const actSecciones = actividades.reduce<Record<string, OsActividad[]>>((acc, a) => {
      const key = a.seccion_titulo ?? "Sin sección";
      if (!acc[key]) acc[key] = [];
      acc[key].push(a);
      return acc;
    }, {});

    const RES_LABEL: Record<string, string> = { ok: "OK", no_ok: "No OK", na: "N/A" };
    const ACT_RED_HEX = "FEE2E2";

    for (const [titulo, acts] of Object.entries(actSecciones)) {
      const actsFiltradas = acts.filter((a) => a.resultado !== "na");
      if (actsFiltradas.length === 0) continue;

      actItems.push(new Paragraph({
        children: [new TextRun({ text: titulo.toUpperCase(), bold: true, size: 17, color: GRAY_HEX })],
        spacing: { before: 120, after: 60 },
      }));

      const headerRow = new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Actividad", bold: true, color: "FFFFFF", size: 17 })] })], shading: { type: ShadingType.CLEAR, fill: NAVY_HEX }, width: { size: 78, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Resultado", bold: true, color: "FFFFFF", size: 17 })] })], shading: { type: ShadingType.CLEAR, fill: NAVY_HEX }, width: { size: 22, type: WidthType.PERCENTAGE } }),
        ],
      });

      const bodyRows = actsFiltradas.map((a) => {
        // Descripción
        let desc = a.descripcion + (a.es_critico ? "  (*)" : "");
        if (a.modelo_seleccionado) desc = desc.replace(/\s*\(.*?\)\s*$/, "").trim() + " " + a.modelo_seleccionado;

        // Resultado
        let resultado = RES_LABEL[a.resultado ?? ""] ?? "—";
        if (a.tipo_campo === "medicion") {
          if (a.etiquetas_medicion && a.etiquetas_medicion.length > 1) {
            resultado = a.resultado === "ok" ? "OK" : a.resultado === "no_ok" ? "No OK" : "—";
          } else if (a.valor_medido !== null && a.valor_medido !== undefined) {
            resultado = `${a.valor_medido}${a.unidad ? " " + a.unidad : ""}\n(${RES_LABEL[a.resultado ?? ""] ?? "—"})`;
          }
        }

        const isNoOk   = a.resultado === "no_ok";
        const fillColor = isNoOk ? ACT_RED_HEX : "FFFFFF";
        const textColor = (isNoOk && a.es_critico) ? "B91C1C" : "0F172A";
        const cellStyle = { type: ShadingType.CLEAR as typeof ShadingType.CLEAR, fill: fillColor };

        const descChildren: unknown[] = [new TextRun({ text: desc, size: 17, color: textColor, bold: isNoOk && a.es_critico })];

        // Sub-fila de medición múltiple inline (en el mismo párrafo, línea siguiente)
        if (a.etiquetas_medicion && a.valores_medidos && a.etiquetas_medicion.length > 1) {
          const partes = a.etiquetas_medicion.map((etq, i) => {
            const val = (a.valores_medidos as (number | null)[])[i];
            if (val === null || val === undefined) return `${etq}: —`;
            const rango = a.rangos_medicion?.[i];
            const inRange = rango ? ((rango.min === null || val >= rango.min) && (rango.max === null || val <= rango.max)) : true;
            return `${etq}: ${val}${a.unidad ? " " + a.unidad : ""}  ${inRange ? "OK" : "NO OK"}`;
          });
          descChildren.push(new TextRun({ text: "\n" + partes.join("     "), size: 14, color: GRAY_HEX, italics: true }));
        }

        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: descChildren as never })], shading: cellStyle }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: resultado, size: 17, color: textColor, bold: isNoOk && a.es_critico })], alignment: AlignmentType.CENTER })], shading: cellStyle }),
          ],
        });
      });

      actItems.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...bodyRows],
      }), new Paragraph(""));
    }
  }

  // ── Fotos ──
  const fotoParagraphs: unknown[] = [];
  for (const foto of (os.fotos ?? [])) {
    if (!foto.url) continue;
    const img = await makeImg(foto.url, 200, 130);
    if (!img) continue;
    const momentoLabel: Record<string, string> = { antes: "ANTES", durante: "DURANTE", despues: "DESPUES" };
    fotoParagraphs.push(
      new Paragraph({ children: [new TextRun({ text: momentoLabel[foto.momento ?? ""] ?? (foto.momento ?? "").toUpperCase(), bold: true, size: 16, color: GRAY_HEX })] }),
      new Paragraph({ children: [img as never] }),
    );
    if (foto.descripcion) fotoParagraphs.push(new Paragraph({ children: [new TextRun({ text: foto.descripcion, size: 15, color: GRAY_HEX })] }));
    fotoParagraphs.push(new Paragraph(""));
  }

  // ── Firmas ──
  const firmaT = await makeImg(os.firma_tecnico_url, 160, 70);
  const firmaC = await makeImg(os.firma_cliente_url, 160, 70);
  const firmasTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [
      new TableCell({
        children: [
          firmaT ? new Paragraph({ children: [firmaT as never], alignment: AlignmentType.CENTER }) : new Paragraph({ text: "", spacing: { before: convertInchesToTwip(0.8) } }),
          new Paragraph({ children: [new TextRun({ text: os.tecnico ? `${os.tecnico.nombres} ${os.tecnico.apellidos}` : "Técnico", bold: true, size: 18 })], alignment: AlignmentType.CENTER }),
          new Paragraph({ children: [new TextRun({ text: "Responsable de mantenimiento", size: 16, color: GRAY_HEX })], alignment: AlignmentType.CENTER }),
        ],
        shading: { type: ShadingType.CLEAR, fill: "F8FAFC" },
        borders: { top: BDR, bottom: BDR, left: BDR, right: BDR },
      }),
      new TableCell({
        children: [
          firmaC ? new Paragraph({ children: [firmaC as never], alignment: AlignmentType.CENTER }) : new Paragraph({ text: "", spacing: { before: convertInchesToTwip(0.8) } }),
          new Paragraph({ children: [new TextRun({ text: os.cliente?.nombre ?? os.equipo?.cliente?.nombre ?? "Cliente", bold: true, size: 18 })], alignment: AlignmentType.CENTER }),
          new Paragraph({ children: [new TextRun({ text: "Cliente / Responsable", size: 16, color: GRAY_HEX })], alignment: AlignmentType.CENTER }),
        ],
        shading: { type: ShadingType.CLEAR, fill: "F8FAFC" },
        borders: { top: BDR, bottom: BDR, left: BDR, right: BDR },
      }),
    ]})],
  });

  // ── Logo ──
  const logoImg = await makeImg(logoUrl, 120, 60);

  // ── HEADER del documento ──
  const headerPara = new Paragraph({
    children: [
      ...(logoImg ? [logoImg as never] : []),
      new TextRun({ text: "  REPORTE DE SERVICIO TÉCNICO", bold: true, size: 28, color: NAVY_HEX }),
      new TextRun({ text: `\t\tN° ${os.numero ?? "—"}  ·  ${fmtFecha(hoyDocx)}`, size: 17, color: GRAY_HEX }),
    ],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY_HEX } },
    spacing: { after: 160 },
  });

  // ── SECCIÓN 4 condicional ──
  const mostrarProblemaDocx = os.tipo === "correctivo"
    || os.tipo === "instalacion"
    || os.tipo === "actualizacion"
    || os.tipo === "repuesto"
    || (os.tipo === "preventivo" && !!os.incluye_correctivo);

  const children: unknown[] = [
    headerPara,
    dataGrid,
    new Paragraph(""),

    // Empresa info
    ...(opts.empresa ? [
      new Paragraph({
        children: [
          new TextRun({ text: opts.empresa.nombre, bold: true, size: 17, color: NAVY_HEX }),
          ...([opts.empresa.ruc, opts.empresa.telefono, opts.empresa.correo].filter(Boolean).length > 0
            ? [new TextRun({ text: "  ·  " + [opts.empresa.ruc, opts.empresa.telefono, opts.empresa.correo].filter(Boolean).join("  ·  "), size: 15, color: GRAY_HEX })]
            : []),
        ],
        spacing: { after: 40 },
      }),
      ...(opts.empresa.direccion ? [new Paragraph({ children: [new TextRun({ text: opts.empresa.direccion, size: 15, color: GRAY_HEX })], spacing: { after: 160 } })] : []),
    ] : [new Paragraph({ spacing: { after: 80 } })]),

    // Descripción del problema (condicional)
    ...(mostrarProblemaDocx ? [
      sectionTitle("Descripción del problema y diagnóstico"),
      ...(os.tipo === "preventivo"
        ? [bodyPara(os.descripcion_correctivo ?? os.descripcion_problema)]
        : [boldLabel("Descripción:"), bodyPara(os.descripcion_problema), boldLabel("Diagnóstico:"), bodyPara(os.diagnostico)]),
    ] : []),

    // Trabajos realizados
    ...(os.trabajos_realizados ? [sectionTitle("Trabajos realizados"), bodyPara(os.trabajos_realizados)] : []),

    // Actividades
    ...actItems,

    // Repuestos
    ...(repuestos.length > 0 ? [sectionTitle("Repuestos / materiales utilizados"), repuestosTable!, new Paragraph("")] : []),

    // Conclusiones
    ...(os.observaciones ? [sectionTitle("Conclusiones y observaciones"), bodyPara(os.observaciones)] : []),

    // Fotos
    ...(fotoParagraphs.length > 0 ? [sectionTitle("Anexo de imágenes"), ...fotoParagraphs] : []),

    // Firmas
    sectionTitle("Firmas"),
    firmasTable,
    new Paragraph(""),
    new Paragraph({
      children: [new TextRun({ text: `Generado con VIATIQ ERP  ·  ${fmtFecha(hoyDocx)}`, size: 14, color: GRAY_HEX })],
      alignment: AlignmentType.CENTER,
    }),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 18, color: "0F172A" } } } },
    sections: [{
      properties: { page: { margin: { top: convertInchesToTwip(0.75), bottom: convertInchesToTwip(0.75), left: convertInchesToTwip(0.9), right: convertInchesToTwip(0.9) } } },
      children: children as never,
    }],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `Reporte_OS_${os.numero ?? os.id.slice(0, 8)}.docx`);
}
