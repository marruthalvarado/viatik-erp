/**
 * Generador de RIDE (Representación Impresa del Documento Electrónico)
 * Formato PDF según especificación SRI Ecuador.
 * Usa jspdf (ya instalado como dependencia del proyecto).
 */
import { jsPDF } from "jspdf";
import type { FacturaEmitida } from "@/services/facturas-emitidas";
import type { ComprobanteElectronico } from "@/types/facturacion-sri";
import type { EmpresaFacConfig } from "@/types/facturacion-sri";
import { FORMAS_PAGO_SRI } from "@/types/facturacion-sri";

export interface RideData {
  factura: FacturaEmitida;
  comprobante: ComprobanteElectronico;
  config: EmpresaFacConfig;
  logoUrl?: string | null;
  descripcionServicio?: string;
}

/** Carga una imagen desde URL como base64, convirtiendo WebP → PNG vía canvas */
async function fetchImageAsBase64(
  url: string,
): Promise<{ data: string; format: "PNG" | "JPEG" } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const mime = blob.type; // "image/png", "image/jpeg", "image/webp", etc.

    // WebP → convertir a PNG via canvas (jsPDF no soporta WebP nativo)
    if (mime === "image/webp" || url.includes(".webp")) {
      return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(blob);
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d")?.drawImage(img, 0, 0);
          const pngData = canvas.toDataURL("image/png");
          URL.revokeObjectURL(objectUrl);
          resolve({ data: pngData, format: "PNG" });
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        };
        img.src = objectUrl;
      });
    }

    // SVG → jsPDF no soporta SVG; omitir logo
    if (mime === "image/svg+xml" || url.includes(".svg")) return null;

    // PNG / JPEG
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const b64 = reader.result as string;
        const fmt =
          mime === "image/jpeg" || url.includes(".jpg") || url.includes(".jpeg")
            ? "JPEG"
            : "PNG";
        resolve({ data: b64, format: fmt });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fmt(n: number | null | undefined, decimals = 2): string {
  return Number(n ?? 0).toFixed(decimals);
}

/** Parsea el código de forma de pago del XML */
function parsearFormaPago(
  xmlStr: string | null | undefined,
): { codigo: string; nombre: string } | null {
  if (!xmlStr) return null;
  const match = xmlStr.match(/<formaPago>(\d+)<\/formaPago>/);
  if (!match) return null;
  const codigo = match[1];
  const found = FORMAS_PAGO_SRI.find((fp) => fp.codigo === codigo);
  return { codigo, nombre: found?.nombre ?? `Código ${codigo}` };
}

/** Calcula la tasa IVA real desde los datos de la factura */
function calcularTasaIVA(subtotal: number, iva: number): string {
  if (!subtotal || !iva) return "0";
  const rate = Math.round((iva / subtotal) * 100);
  return String(rate);
}

/** Genera el PDF RIDE y lo descarga en el navegador */
export async function generarYDescargarRIDE(data: RideData): Promise<void> {
  const { factura, comprobante, config, logoUrl, descripcionServicio } = data;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210; // ancho A4
  const PH = 297; // alto A4
  const M = 10;   // margen exterior
  const CONTENT_W = PW - 2 * M;

  let y = M;

  // ── BORDE EXTERIOR ─────────────────────────────────────────────────────────
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(M, M, CONTENT_W, PH - 2 * M);

  // Padding interno (el contenido empieza dentro del borde)
  const P = 3; // padding interno
  const IX = M + P;   // x inicio contenido
  const IW = CONTENT_W - 2 * P; // ancho contenido interno

  y = M + P;

  // ── LOGO + CABECERA EMISOR ─────────────────────────────────────────────────
  const COL1_W = 62;               // columna logo/emisor
  const COL2_X = IX + COL1_W + 3;
  const COL2_W = IW - COL1_W - 3; // columna datos comprobante
  const HEADER_H = 44;             // altura del bloque cabecera

  // Caja del logo (borde visible)
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(IX, y, COL1_W, HEADER_H);

  // Logo
  let logoOk = false;
  if (logoUrl) {
    const imgResult = await fetchImageAsBase64(logoUrl);
    if (imgResult) {
      try {
        // Ajustar dimensiones manteniendo aspecto dentro de la caja
        const maxW = COL1_W - 4;
        const maxH = 20;
        doc.addImage(imgResult.data, imgResult.format, IX + 2, y + 2, maxW, maxH, undefined, "FAST");
        logoOk = true;
      } catch {
        // Si falla (SVG u otro), logoOk queda false
      }
    }
  }

  // Datos emisor (debajo del logo si hay logo, o centrado si no)
  const emisorTextY = logoOk ? y + 26 : y + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const rsLines = doc.splitTextToSize(config.razon_social, COL1_W - 4);
  doc.text(rsLines, IX + 2, emisorTextY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  let etY = emisorTextY + rsLines.length * 4;
  if (config.nombre_comercial && config.nombre_comercial !== config.razon_social) {
    const ncLines = doc.splitTextToSize(config.nombre_comercial, COL1_W - 4);
    doc.text(ncLines, IX + 2, etY);
    etY += ncLines.length * 4;
  }
  const dirMatrizLines = doc.splitTextToSize(`Dir: ${config.dir_matriz}`, COL1_W - 4);
  doc.text(dirMatrizLines, IX + 2, etY);
  etY += dirMatrizLines.length * 4;
  if (config.dir_establecimiento && config.dir_establecimiento !== config.dir_matriz) {
    const dirEstLines = doc.splitTextToSize(`Est: ${config.dir_establecimiento}`, COL1_W - 4);
    doc.text(dirEstLines, IX + 2, etY);
    etY += dirEstLines.length * 4;
  }
  doc.text(
    `Obligado contab.: ${config.obligado_contabilidad ? "SI" : "NO"}`,
    IX + 2, etY,
  );

  // Box datos comprobante (columna derecha)
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(COL2_X, y, COL2_W, HEADER_H);

  // Línea separadora horizontal: RUC | FACTURA | No.
  const LINE1_Y = y + 8;
  const LINE2_Y = y + 18;
  const LINE3_Y = y + 26;

  doc.setLineWidth(0.2);
  doc.line(COL2_X, LINE1_Y, COL2_X + COL2_W, LINE1_Y);
  doc.line(COL2_X, LINE2_Y, COL2_X + COL2_W, LINE2_Y);
  doc.line(COL2_X, LINE3_Y, COL2_X + COL2_W, LINE3_Y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("R.U.C:", COL2_X + 2, y + 5.5);
  doc.setFont("helvetica", "normal");
  doc.text(config.ruc, COL2_X + 18, y + 5.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("FACTURA", COL2_X + COL2_W / 2, LINE1_Y + 6, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `No. ${config.establecimiento}-${config.punto_emision}-${factura.numero.split("-").pop() ?? factura.numero}`,
    COL2_X + COL2_W / 2, LINE2_Y + 5, { align: "center" },
  );

  const autLabel = "NÚMERO DE AUTORIZACIÓN";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(autLabel, COL2_X + 2, LINE3_Y + 4);
  doc.setFont("courier", "normal");
  doc.setFontSize(6.5);
  const numAut = comprobante.numero_autorizacion ?? comprobante.clave_acceso ?? "—";
  const autLines = doc.splitTextToSize(numAut, COL2_W - 4);
  doc.text(autLines, COL2_X + 2, LINE3_Y + 9);

  const ambienteLabel = config.ambiente === "produccion" ? "PRODUCCIÓN" : "PRUEBAS";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(config.ambiente === "produccion" ? 0 : 180, 0, 0);
  doc.text(`AMBIENTE: ${ambienteLabel}`, COL2_X + COL2_W / 2, y + HEADER_H - 2, { align: "center" });
  doc.setTextColor(0, 0, 0);

  y += HEADER_H + 2;

  // ── CLAVE DE ACCESO ────────────────────────────────────────────────────────
  if (comprobante.clave_acceso) {
    const clave = comprobante.clave_acceso;
    const mid = Math.ceil(clave.length / 2);
    const BOX_H = 14;

    doc.setFillColor(242, 242, 242);
    doc.rect(IX, y, IW, BOX_H, "F");
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.rect(IX, y, IW, BOX_H);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text("CLAVE DE ACCESO", IX + 2, y + 3.5);

    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text(clave.substring(0, mid), IX + 2, y + 8);
    doc.text(clave.substring(mid), IX + 2, y + 13);

    y += BOX_H + 2;
  }

  // ── FECHA AUTORIZACIÓN ─────────────────────────────────────────────────────
  if (comprobante.fecha_autorizacion) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(
      `Fecha y hora de autorización: ${new Date(comprobante.fecha_autorizacion).toLocaleString("es-EC")}`,
      IX, y + 5,
    );
    doc.setTextColor(0, 0, 0);
    y += 9;
  }

  // ── DATOS COMPRADOR ────────────────────────────────────────────────────────
  y += 1;
  const BUYER_H = 20;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(IX, y, IW, BUYER_H);

  // Línea vertical a 2/3 del ancho para separar comprador / fecha
  const BUYER_DIV = Math.floor(IW * 0.65);
  doc.line(IX + BUYER_DIV, y, IX + BUYER_DIV, y + BUYER_H);
  // Línea horizontal separando labels de valores
  doc.line(IX, y + 10, IX + IW, y + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("RAZÓN SOCIAL / NOMBRES Y APELLIDOS:", IX + 2, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const rsClienteLines = doc.splitTextToSize(factura.razon_social ?? "—", BUYER_DIV - 4);
  doc.text(rsClienteLines, IX + 2, y + 15);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("FECHA EMISIÓN:", IX + BUYER_DIV + 2, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const fechaLabel = factura.fecha
    ? new Date(factura.fecha + "T00:00:00").toLocaleDateString("es-EC")
    : "—";
  doc.text(fechaLabel, IX + BUYER_DIV + 2, y + 15);

  y += BUYER_H + 2;

  // Fila IDENTIFICACIÓN
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(IX, y, IW, 8);
  doc.line(IX + BUYER_DIV, y, IX + BUYER_DIV, y + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("IDENTIFICACIÓN:", IX + 2, y + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(factura.ruc_cliente ?? "—", IX + 42, y + 5.5);

  y += 10;

  // ── TABLA DE DETALLE ───────────────────────────────────────────────────────
  const COL_CANT   = 18;
  const COL_DESC   = IW - 18 - 28 - 24 - 28; // resto
  const COL_PRECIO = 28;
  const COL_DSCTO  = 24;
  const COL_TOTAL  = 28;

  const colX = [
    IX,
    IX + COL_CANT,
    IX + COL_CANT + COL_DESC,
    IX + COL_CANT + COL_DESC + COL_PRECIO,
    IX + COL_CANT + COL_DESC + COL_PRECIO + COL_DSCTO,
  ];
  const tableRight = IX + IW;

  // Cabecera de la tabla
  doc.setFillColor(60, 60, 60);
  doc.rect(IX, y, IW, 7, "F");

  // Líneas verticales de la cabecera
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.2);
  for (let i = 1; i < colX.length; i++) {
    doc.line(colX[i], y, colX[i], y + 7);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("CANT.", colX[0] + 1, y + 5);
  doc.text("DESCRIPCIÓN", colX[1] + 1, y + 5);
  doc.text("P. UNITARIO", colX[2] + 1, y + 5);
  doc.text("DESCUENTO", colX[3] + 1, y + 5);
  doc.text("TOTAL", colX[4] + 1, y + 5);
  doc.setTextColor(0, 0, 0);
  y += 7;

  // Fila de detalle
  const baseImponible = Number(factura.subtotal ?? 0) - Number(factura.descuento ?? 0);
  const desc = descripcionServicio ?? factura.observacion ?? "Servicios profesionales";
  const descLines = doc.splitTextToSize(desc, COL_DESC - 2);
  const detH = Math.max(10, descLines.length * 5 + 4);

  // Fondo alternado de la fila
  doc.setFillColor(252, 252, 252);
  doc.rect(IX, y, IW, detH, "F");

  // Líneas verticales fila detalle
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.15);
  for (let i = 0; i < colX.length; i++) {
    doc.line(colX[i], y, colX[i], y + detH);
  }
  doc.line(tableRight, y, tableRight, y + detH);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("1", colX[0] + COL_CANT / 2, y + 6, { align: "center" });
  doc.text(descLines, colX[1] + 1, y + 6);
  doc.text(fmt(factura.subtotal), tableRight - 2, y + 6, { align: "right" });
  doc.text(fmt(factura.descuento), colX[4] - 2, y + 6, { align: "right" });
  doc.text(fmt(baseImponible), tableRight - 2, y + 6, { align: "right" });

  // Borde inferior de la fila
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(IX, y + detH, tableRight, y + detH);
  // Borde superior/izquierdo/derecho de la tabla
  doc.rect(IX, y - 7, IW, detH + 7);

  y += detH + 4;

  // ── FORMA DE PAGO + TOTALES ────────────────────────────────────────────────
  // Parsear forma de pago del XML
  const xmlStr = comprobante.xml_firmado ?? comprobante.xml_autorizado ?? factura.xml_content;
  const fpData = parsearFormaPago(xmlStr);

  const TOT_W = 80;
  const TOT_X = IX + IW - TOT_W;
  const FP_W = IW - TOT_W - 2;

  // Calcular tasa IVA real
  const tasaIVA = calcularTasaIVA(Number(factura.subtotal ?? 0), Number(factura.iva ?? 0));
  const hasIVA = Number(factura.iva ?? 0) > 0;

  const totRows: [string, string, boolean][] = [
    [`SUBTOTAL ${hasIVA ? tasaIVA + "%" : "0%"}`, fmt(hasIVA ? factura.subtotal : 0), false],
    [`SUBTOTAL 0%`, fmt(!hasIVA ? factura.subtotal : 0), false],
    ["DESCUENTO", fmt(factura.descuento), false],
    [`IVA ${hasIVA ? tasaIVA + "%" : "0%"}`, fmt(factura.iva), false],
    ["TOTAL", fmt(factura.total), true],
  ];

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  let ty = y;
  for (const [label, val, isBold] of totRows) {
    if (isBold) {
      doc.setFillColor(220, 220, 220);
      doc.rect(TOT_X, ty, TOT_W, 7, "F");
    }
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(8.5);
    doc.text(label, TOT_X + 2, ty + 5);
    doc.text(val, TOT_X + TOT_W - 2, ty + 5, { align: "right" });
    doc.rect(TOT_X, ty, TOT_W, 7);
    ty += 7;
  }

  // Forma de pago (izquierda, alineada verticalmente con los totales)
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(IX, y, FP_W, 7 * totRows.length);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("FORMA DE PAGO:", IX + 2, y + 5);
  doc.setFont("helvetica", "normal");
  if (fpData) {
    const fpNombreLines = doc.splitTextToSize(fpData.nombre, FP_W - 4);
    doc.setFontSize(8);
    doc.text(fpNombreLines, IX + 2, y + 12);
  }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`$${fmt(factura.total)}`, IX + 2, y + 19);
  doc.setFont("helvetica", "normal");

  y = ty + 4;

  // ── INFORMACIÓN ADICIONAL ──────────────────────────────────────────────────
  if (factura.observacion && !descripcionServicio) {
    // Solo mostrar si hay observación distinta a la descripción del servicio
  } else if (factura.observacion) {
    doc.setFillColor(248, 248, 248);
    doc.rect(IX, y, IW, 8, "F");
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.rect(IX, y, IW, 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("INFORMACIÓN ADICIONAL", IX + 2, y + 5.5);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const obsLines = doc.splitTextToSize(factura.observacion, IW - 4);
    doc.text(obsLines, IX + 2, y);
    y += obsLines.length * 4.5 + 2;
  }

  // ── PIE ────────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(
    "DOCUMENTO GENERADO POR VIATIQ ERP — Este documento es la representación impresa de un comprobante electrónico.",
    PW / 2, PH - M - 3, { align: "center" },
  );

  // Guardar
  const filename = `RIDE-${factura.numero ?? "factura"}-${config.ruc}.pdf`;
  doc.save(filename);
}

/** Descarga el XML firmado como archivo .xml */
export function descargarXML(xmlFirmado: string, numero: string, ruc: string): void {
  const blob = new Blob([xmlFirmado], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${numero}-${ruc}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}
