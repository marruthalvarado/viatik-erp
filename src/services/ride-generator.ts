/**
 * Generador de RIDE (Representación Impresa del Documento Electrónico)
 * Formato PDF según especificación SRI Ecuador.
 * Usa jspdf (ya instalado como dependencia del proyecto).
 */
import { jsPDF } from "jspdf";
import type { FacturaEmitida } from "@/services/facturas-emitidas";
import type { ComprobanteElectronico, EmpresaFacConfig } from "@/types/facturacion-sri";
import { FORMAS_PAGO_SRI } from "@/types/facturacion-sri";

export interface RideData {
  factura: FacturaEmitida;
  comprobante: ComprobanteElectronico;
  config: EmpresaFacConfig;
  logoUrl?: string | null;
  descripcionServicio?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

async function fetchImageAsBase64(
  url: string,
): Promise<{ data: string; format: "PNG" | "JPEG" } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const mime = blob.type;

    if (mime === "image/svg+xml" || url.split("?")[0].endsWith(".svg")) return null;

    if (mime === "image/webp" || url.split("?")[0].endsWith(".webp")) {
      return new Promise((resolve) => {
        const img = new Image();
        const objUrl = URL.createObjectURL(blob);
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || 200;
          canvas.height = img.naturalHeight || 80;
          canvas.getContext("2d")?.drawImage(img, 0, 0);
          URL.revokeObjectURL(objUrl);
          resolve({ data: canvas.toDataURL("image/png"), format: "PNG" });
        };
        img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(null); };
        img.src = objUrl;
      });
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const b64 = reader.result as string;
        const isJpeg = mime === "image/jpeg" || /\.(jpg|jpeg)(\?|$)/i.test(url);
        resolve({ data: b64, format: isJpeg ? "JPEG" : "PNG" });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function generarCodigoBarras(texto: string): Promise<string | null> {
  try {
    if (typeof window !== "undefined" && !(window as unknown as Record<string, unknown>)["JsBarcode"]) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js";
        script.onload = () => resolve();
        script.onerror = () => reject();
        document.head.appendChild(script);
      });
    }
    const canvas = document.createElement("canvas");
    const JsBarcode = (window as unknown as Record<string, unknown>)["JsBarcode"] as (
      el: HTMLCanvasElement,
      text: string,
      opts: Record<string, unknown>
    ) => void;
    JsBarcode(canvas, texto, {
      format: "CODE128",
      displayValue: false,
      width: 2,
      height: 60,
      margin: 0,
      background: "#ffffff",
    });
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function fmt(n: number | null | undefined, decimals = 2): string {
  return Number(n ?? 0).toFixed(decimals);
}

function parsearFormaPago(xml: string | null | undefined): { codigo: string; nombre: string } | null {
  if (!xml) return null;
  const m = xml.match(/<formaPago>(\d+)<\/formaPago>/);
  if (!m) return null;
  const codigo = m[1];
  const found = FORMAS_PAGO_SRI.find((fp) => fp.codigo === codigo);
  return { codigo, nombre: found?.nombre ?? `Código ${codigo}` };
}

function calcularTasaIVA(subtotal: number, iva: number): number {
  if (!subtotal || !iva) return 0;
  return Math.round((iva / subtotal) * 100);
}

// Dibuja una línea horizontal
function hline(doc: jsPDF, x1: number, y: number, x2: number) {
  doc.line(x1, y, x2, y);
}
// Dibuja una línea vertical
function vline(doc: jsPDF, x: number, y1: number, y2: number) {
  doc.line(x, y1, x, y2);
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERADOR PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export async function generarYDescargarRIDE(data: RideData): Promise<void> {
  const { factura, comprobante, config, logoUrl, descripcionServicio } = data;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210;
  const PH = 297;
  const M = 8;
  const CW = PW - 2 * M; // content width = 194mm

  // ── BORDE EXTERIOR ─────────────────────────────────────────────────────────
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(M, M, CW, PH - 2 * M);

  let y = M;

  // ─────────────────────────────────────────────────────────────────────────
  // BLOQUE 1: CABECERA (2 columnas)
  // Izquierda: logo + datos emisor
  // Derecha: RUC / FACTURA / No. / Autorización / Fecha / Ambiente
  // ─────────────────────────────────────────────────────────────────────────
  const COL1_W = 65;
  const COL2_X = M + COL1_W;
  const COL2_W = CW - COL1_W;

  // Medir altura de columna izquierda para determinar HDR_H
  // Logo: ~20mm + datos emisor ~35mm = ~55mm mínimo
  const HDR_H = 58;

  // Borde columna izquierda + divisor vertical + borde inferior
  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.2);
  doc.rect(M, y, COL1_W, HDR_H);          // caja del emisor con borde
  vline(doc, COL2_X, y, y + HDR_H);       // divisor (ya incluido en rect pero refuerza)
  hline(doc, M, y + HDR_H, PW - M);       // borde inferior cabecera

  // ── Columna izquierda ──
  let lY = y + 3;

  // Logo (sin borde, flota libre)
  if (logoUrl) {
    const img = await fetchImageAsBase64(logoUrl);
    if (img) {
      try {
        doc.addImage(img.data, img.format, M + 3, lY, COL1_W - 6, 18, undefined, "FAST");
        lY += 21;
      } catch { /* sin logo */ }
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  const rsLines = doc.splitTextToSize(config.razon_social.toUpperCase(), COL1_W - 6);
  doc.text(rsLines, M + 3, lY);
  lY += rsLines.length * 4.5 + 1;

  if (config.nombre_comercial && config.nombre_comercial !== config.razon_social) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(config.nombre_comercial, M + 3, lY);
    lY += 5;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);

  // Dir. Matriz con etiqueta en negrita
  lY += 1;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("Dirección", M + 3, lY);
  doc.text("Matriz:", M + 3, lY + 3.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const dmLines = doc.splitTextToSize(config.dir_matriz, COL1_W - 20);
  doc.text(dmLines, M + 19, lY);
  lY += Math.max(7.5, dmLines.length * 4) + 1;

  // Dir. Sucursal (si aplica)
  if (config.dir_establecimiento && config.dir_establecimiento !== config.dir_matriz) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("Dirección", M + 3, lY);
    doc.text("Sucursal:", M + 3, lY + 3.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const dsLines = doc.splitTextToSize(config.dir_establecimiento, COL1_W - 20);
    doc.text(dsLines, M + 19, lY);
    lY += Math.max(7.5, dsLines.length * 4) + 1;
  }

  lY += 1;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  const obLabel = "OBLIGADO A LLEVAR CONTABILIDAD";
  const obVal = config.obligado_contabilidad ? "SI" : "NO";
  doc.text(obLabel, M + 3, lY);
  doc.text(obVal, COL2_X - 3, lY, { align: "right" });

  // ── Columna derecha ──
  const R = COL2_X + 3;
  const RW = COL2_W - 5;
  let rY = y;

  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.2);

  // Fila RUC (h=9)
  hline(doc, COL2_X, rY + 9, PW - M);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text("R.U.C.:", R, rY + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(config.ruc, R + 15, rY + 6);
  rY += 9;

  // Fila FACTURA (h=10)
  hline(doc, COL2_X, rY + 10, PW - M);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("FACTURA", COL2_X + COL2_W / 2, rY + 7.5, { align: "center" });
  rY += 10;

  // Fila No. (h=8)
  hline(doc, COL2_X, rY + 8, PW - M);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const noFactura = `No. ${config.establecimiento}-${config.punto_emision}-${factura.numero.split("-").pop() ?? factura.numero}`;
  doc.text(noFactura, COL2_X + COL2_W / 2, rY + 5.5, { align: "center" });
  rY += 8;

  // Fila NÚMERO DE AUTORIZACIÓN (h=12)
  hline(doc, COL2_X, rY + 12, PW - M);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("NÚMERO DE AUTORIZACIÓN", R, rY + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const numAut = comprobante.numero_autorizacion ?? comprobante.clave_acceso ?? "—";
  const autLines = doc.splitTextToSize(numAut, RW);
  doc.text(autLines, R, rY + 8.5);
  rY += 12;

  // Fila FECHA Y HORA DE AUTORIZACIÓN (h=9)
  hline(doc, COL2_X, rY + 9, PW - M);
  // Divisor vertical central
  const fechaMid = COL2_X + COL2_W * 0.42;
  vline(doc, fechaMid, rY, rY + 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("FECHA Y HORA DE", R, rY + 3.5);
  doc.text("AUTORIZACIÓN:", R, rY + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const fechaAut = comprobante.fecha_autorizacion
    ? new Date(comprobante.fecha_autorizacion).toLocaleString("es-EC")
    : "—";
  doc.text(fechaAut, fechaMid + 2, rY + 5.5);
  rY += 9;

  // Fila AMBIENTE / EMISIÓN (h=10)
  // (última fila antes del borde inferior)
  const ambMid = COL2_X + COL2_W / 2;
  vline(doc, ambMid, rY, y + HDR_H);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("AMBIENTE:", R, rY + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const ambLabel = config.ambiente === "produccion" ? "PRODUCCIÓN" : "PRUEBAS";
  if (config.ambiente !== "produccion") doc.setTextColor(160, 0, 0);
  doc.text(ambLabel, R + 22, rY + 4);
  doc.setTextColor(0, 0, 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("EMISIÓN:", ambMid + 3, rY + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("NORMAL", ambMid + 25, rY + 4);

  y += HDR_H;

  // ─────────────────────────────────────────────────────────────────────────
  // BLOQUE 2: CLAVE DE ACCESO (sección propia, full width, debajo de cabecera)
  // ─────────────────────────────────────────────────────────────────────────
  const clave = comprobante.clave_acceso ?? numAut;
  const barcodeImg = await generarCodigoBarras(clave);
  const CLAVE_H = barcodeImg ? 26 : 15;

  hline(doc, M, y + CLAVE_H, PW - M);
  doc.setDrawColor(160, 160, 160);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text("CLAVE DE ACCESO", M + 3, y + 4.5);

  if (barcodeImg) {
    const bW = CW - 6;
    const bH = 12;
    doc.addImage(barcodeImg, "PNG", M + 3, y + 6, bW, bH, undefined, "FAST");
    // Número debajo del barcode con espacio suficiente
    doc.setFont("courier", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(60, 60, 60);
    const mid = Math.ceil(clave.length / 2);
    doc.text(clave.substring(0, mid), PW / 2, y + 20.5, { align: "center" });
    doc.text(clave.substring(mid), PW / 2, y + 24.5, { align: "center" });
  } else {
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    const mid = Math.ceil(clave.length / 2);
    doc.text(clave.substring(0, mid), M + 3, y + 8);
    doc.text(clave.substring(mid), M + 3, y + 12.5);
  }

  doc.setTextColor(0, 0, 0);
  y += CLAVE_H;

  // ─────────────────────────────────────────────────────────────────────────
  // BLOQUE 3: DATOS COMPRADOR
  // ─────────────────────────────────────────────────────────────────────────

  // Fila 1: Razón Social | Identificación | Fecha
  const col_id_x = M + CW * 0.50;
  const col_fe_x = M + CW * 0.75;

  const F1_H = 14;
  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.2);
  doc.rect(M, y, CW, F1_H);
  vline(doc, col_id_x, y, y + F1_H);
  vline(doc, col_fe_x, y, y + F1_H);
  hline(doc, M, y + 7, PW - M); // separador label/valor

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Razón Social / Nombres y Apellidos:", M + 2, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const rsClient = doc.splitTextToSize(factura.razon_social ?? "—", col_id_x - M - 4);
  doc.text(rsClient, M + 2, y + 11.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Identificación", col_id_x + 2, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(factura.ruc_cliente ?? "—", col_id_x + 2, y + 11.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Fecha", col_fe_x + 2, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const fechaEmision = factura.fecha
    ? new Date(factura.fecha + "T00:00:00").toLocaleDateString("es-EC")
    : "—";
  doc.text(fechaEmision, col_fe_x + 2, y + 11.5);
  y += F1_H;

  // Fila 2: Dirección | Placa/Matrícula | Guía
  const F2_H = 8;
  doc.rect(M, y, CW, F2_H);
  vline(doc, col_id_x, y, y + F2_H);
  vline(doc, col_fe_x, y, y + F2_H);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Dirección:", M + 2, y + 5.5);
  doc.text("Placa / Matrícula:", col_id_x + 2, y + 5.5);
  doc.text("Guía", col_fe_x + 2, y + 5.5);
  y += F2_H + 2;

  // ─────────────────────────────────────────────────────────────────────────
  // BLOQUE 4: TABLA DE DETALLE
  // ─────────────────────────────────────────────────────────────────────────
  // Columnas: CodP | CodA | Cant | Descripción | DetAd | PUnit | Sub | PSub | Dscto | Total
  const TC = {
    codP: 14, codA: 12, cant: 12,
    desc: 42, detAd: 16,
    pUnit: 22, sub: 13, pSub: 17, dscto: 15,
    // total = CW - suma anterior
  };
  const totalW = CW - TC.codP - TC.codA - TC.cant - TC.desc - TC.detAd - TC.pUnit - TC.sub - TC.pSub - TC.dscto;
  const tx: number[] = [];
  tx[0] = M;                              // Cod. Principal
  tx[1] = tx[0] + TC.codP;               // Cod. Auxiliar
  tx[2] = tx[1] + TC.codA;               // Cantidad
  tx[3] = tx[2] + TC.cant;               // Descripción
  tx[4] = tx[3] + TC.desc;               // Detalle Adicional
  tx[5] = tx[4] + TC.detAd;              // Precio Unitario
  tx[6] = tx[5] + TC.pUnit;              // Subsidio
  tx[7] = tx[6] + TC.sub;               // Precio sin Subsidio
  tx[8] = tx[7] + TC.pSub;              // Descuento
  tx[9] = tx[8] + TC.dscto;             // Precio Total
  const TR = M + CW;                     // right edge

  // Cabecera tabla (2 líneas de texto)
  const TH_H = 10;
  doc.setFillColor(55, 55, 55);
  doc.rect(M, y, CW, TH_H, "F");
  doc.setDrawColor(90, 90, 90);
  doc.setLineWidth(0.15);
  for (let i = 1; i < tx.length; i++) vline(doc, tx[i], y, y + TH_H);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text("Cod.", tx[0] + 1, y + 4);      doc.text("Principal", tx[0] + 1, y + 8);
  doc.text("Cod.", tx[1] + 1, y + 4);      doc.text("Auxiliar", tx[1] + 1, y + 8);
  doc.text("Cantidad", tx[2] + 1, y + 6.5);
  doc.text("Descripción", tx[3] + 1, y + 6.5);
  doc.text("Det.", tx[4] + 1, y + 4);       doc.text("Adicional", tx[4] + 1, y + 8);
  doc.text("Precio", tx[5] + 1, y + 4);   doc.text("Unitario", tx[5] + 1, y + 8);
  doc.text("Subsidio", tx[6] + 1, y + 6.5);
  doc.text("Precio sin", tx[7] + 1, y + 4); doc.text("Subsidio", tx[7] + 1, y + 8);
  doc.text("Descuento", tx[8] + 1, y + 6.5);
  doc.text("Precio Total", tx[9] + 1, y + 6.5);
  doc.setTextColor(0, 0, 0);
  y += TH_H;

  // Fila de detalle
  const precioUnit = Number(factura.subtotal ?? 0);
  const descuento  = Number(factura.descuento ?? 0);
  const precioTotal = precioUnit - descuento;
  const descServicio = descripcionServicio ?? factura.observacion ?? "Servicios profesionales";
  const descLines = doc.splitTextToSize(descServicio, TC.desc - 2);
  const TD_H = Math.max(11, descLines.length * 4.5 + 4);

  doc.setFillColor(252, 252, 252);
  doc.rect(M, y, CW, TD_H, "F");
  doc.setDrawColor(190, 190, 190);
  doc.setLineWidth(0.15);
  doc.rect(M, y, CW, TD_H); // borde exterior fila
  for (let i = 1; i < tx.length; i++) vline(doc, tx[i], y, y + TD_H);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("PR-001", tx[0] + 1, y + 7);
  // tx[1] (CodA) vacío
  doc.text("1.00", tx[2] + 1, y + 7);
  doc.text(descLines, tx[3] + 1, y + 7);
  // tx[4] (DetAd) vacío
  // Precio Unitario — right-aligned dentro de su columna (tx[5]→tx[6])
  doc.text(fmt(precioUnit), tx[6] - 1, y + 7, { align: "right" });
  // Subsidio
  doc.text(fmt(0), tx[6] + 2, y + 7);
  // Precio sin Subsidio
  doc.text(fmt(0), tx[7] + 1, y + 7);
  // Descuento
  doc.text(fmt(descuento), tx[8] + 1, y + 7);
  // Precio Total — right-aligned
  doc.text(fmt(precioTotal), TR - 2, y + 7, { align: "right" });

  y += TD_H;

  // ─────────────────────────────────────────────────────────────────────────
  // BLOQUE 5: INFORMACIÓN ADICIONAL (banner)
  // ─────────────────────────────────────────────────────────────────────────
  const IA_H = 7;
  doc.setFillColor(235, 235, 235);
  doc.rect(M, y, CW, IA_H, "F");
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(M, y, CW, IA_H);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Información Adicional", M + CW / 2, y + 5, { align: "center" });
  y += IA_H;

  // ─────────────────────────────────────────────────────────────────────────
  // BLOQUE 6: FORMA DE PAGO (izq) + TOTALES (der)
  // ─────────────────────────────────────────────────────────────────────────
  const xmlStr = comprobante.xml_firmado ?? comprobante.xml_autorizado ?? factura.xml_content;
  const fpData = parsearFormaPago(xmlStr);

  const tasaIVA = calcularTasaIVA(Number(factura.subtotal ?? 0), Number(factura.iva ?? 0));
  const hasIVA  = Number(factura.iva ?? 0) > 0;

  const TOT_W = 75;
  const FP_W  = CW - TOT_W;
  const DIV_X = M + FP_W;

  // Filas de totales
  const totRows: [string, string, boolean][] = [
    [`SUBTOTAL ${hasIVA ? tasaIVA + "%" : "0%"}`,  fmt(hasIVA ? factura.subtotal : 0), false],
    ["SUBTOTAL NO OBJETO DE IVA",                   "0.00",                             false],
    ["SUBTOTAL EXENTO DE IVA",                      "0.00",                             false],
    ["SUBTOTAL SIN IMPUESTOS",                      fmt(!hasIVA ? factura.subtotal : 0), false],
    ["TOTAL DESCUENTO",                             fmt(factura.descuento),              false],
    ["ICE",                                         "0.00",                             false],
    [`IVA ${hasIVA ? tasaIVA + "%" : "0%"}`,       fmt(factura.iva),                   false],
    ["IRBPNR",                                      "0.00",                             false],
    ["PROPINA",                                     "0.00",                             false],
    ["VALOR TOTAL",                                 fmt(factura.total),                 true ],
  ];

  const TR_H = 6; // altura de cada fila de total
  const totBlockH = totRows.length * TR_H;

  // Borde bloque totales
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(DIV_X, y, TOT_W, totBlockH);
  const valColX = DIV_X + TOT_W - 23; // columna de valores
  vline(doc, valColX, y, y + totBlockH);

  let ty = y;
  for (const [label, val, bold] of totRows) {
    if (bold) {
      doc.setFillColor(210, 210, 210);
      doc.rect(DIV_X, ty, TOT_W, TR_H, "F");
      doc.setDrawColor(180, 180, 180);
    }
    hline(doc, DIV_X, ty + TR_H, DIV_X + TOT_W);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(7);
    doc.text(label, DIV_X + 2, ty + 4.3);
    doc.text(val, DIV_X + TOT_W - 2, ty + 4.3, { align: "right" });
    ty += TR_H;
  }

  // Forma de pago (izquierda)
  // Header
  const fpLabelW = FP_W * 0.62;
  const FP_HDR_H = 7;
  doc.setFillColor(235, 235, 235);
  doc.rect(M, y, FP_W, FP_HDR_H, "F");
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(M, y, FP_W, FP_HDR_H);
  vline(doc, M + fpLabelW, y, y + FP_HDR_H);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Forma de pago", M + fpLabelW / 2, y + 5, { align: "center" });
  doc.text("Valor", M + fpLabelW + (FP_W - fpLabelW) / 2, y + 5, { align: "center" });
  const fpBodyY = y + FP_HDR_H;

  // Fila forma de pago
  const fpText = fpData
    ? `${fpData.codigo} - ${fpData.nombre.toUpperCase()}`
    : "01 - SIN UTILIZACIÓN DEL SISTEMA FINANCIERO";
  const fpLines = doc.splitTextToSize(fpText, fpLabelW - 4);
  const FP_ROW_H = Math.max(8, fpLines.length * 4.5 + 3);
  doc.rect(M, fpBodyY, FP_W, FP_ROW_H);
  vline(doc, M + fpLabelW, fpBodyY, fpBodyY + FP_ROW_H);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(fpLines, M + 2, fpBodyY + 5);
  doc.text(fmt(factura.total), M + fpLabelW + (FP_W - fpLabelW) - 2, fpBodyY + 5, { align: "right" });

  y = Math.max(ty, fpBodyY + FP_ROW_H) + 2;

  // Filas extra de totales (VALOR TOTAL SIN SUBSIDIO, AHORRO)
  const extra: [string, string][] = [
    ["VALOR TOTAL SIN SUBSIDIO", "0.00"],
    ["AHORRO POR SUBSIDIO:", "0.00"],
  ];
  for (const [label, val] of extra) {
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.15);
    doc.rect(DIV_X, y, TOT_W, TR_H);
    hline(doc, DIV_X, y + TR_H, DIV_X + TOT_W);
    vline(doc, valColX, y, y + TR_H);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(label, DIV_X + 2, y + 4.3);
    doc.text(val, DIV_X + TOT_W - 2, y + 4.3, { align: "right" });
    y += TR_H;
  }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6);
  doc.setTextColor(80, 80, 80);
  doc.text("(Incluye IVA cuando corresponda)", DIV_X + 2, y + 4);
  doc.setTextColor(0, 0, 0);
  y += 8;

  // ─────────────────────────────────────────────────────────────────────────
  // BLOQUE 7: OBSERVACIÓN (si hay)
  // ─────────────────────────────────────────────────────────────────────────
  if (factura.observacion) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    const obsLines = doc.splitTextToSize(`Obs: ${factura.observacion}`, CW - 4);
    doc.text(obsLines, M + 2, y + 4);
    y += obsLines.length * 4 + 4;
    doc.setTextColor(0, 0, 0);
  }

  // ── PIE ────────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(130, 130, 130);
  doc.text(
    "DOCUMENTO GENERADO POR VIATIQ ERP — Este documento es la representación impresa de un comprobante electrónico.",
    PW / 2, PH - M - 3, { align: "center" },
  );

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
