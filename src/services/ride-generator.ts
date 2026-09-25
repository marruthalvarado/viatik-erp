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

    // WebP → convertir a PNG via canvas
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

/** Genera imagen de código de barras Code 128 en canvas y devuelve base64 */
async function generarCodigoBarras(texto: string): Promise<string | null> {
  try {
    // Cargar JsBarcode desde CDN si no está disponible
    if (typeof window !== "undefined" && !(window as unknown as Record<string, unknown>)["JsBarcode"]) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("No se pudo cargar JsBarcode"));
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
      height: 50,
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

function parsearFormaPago(xmlStr: string | null | undefined): { codigo: string; nombre: string } | null {
  if (!xmlStr) return null;
  const match = xmlStr.match(/<formaPago>(\d+)<\/formaPago>/);
  if (!match) return null;
  const codigo = match[1];
  const found = FORMAS_PAGO_SRI.find((fp) => fp.codigo === codigo);
  return { codigo, nombre: found?.nombre ?? `Código ${codigo}` };
}

function calcularTasaIVA(subtotal: number, iva: number): number {
  if (!subtotal || !iva) return 0;
  return Math.round((iva / subtotal) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERADOR PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export async function generarYDescargarRIDE(data: RideData): Promise<void> {
  const { factura, comprobante, config, logoUrl, descripcionServicio } = data;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210;
  const PH = 297;
  const M = 8; // margen

  // Helpers de dibujo
  const lw = (w: number) => { doc.setLineWidth(w); };
  const gray = (g: number) => { doc.setDrawColor(g, g, g); };
  const fillGray = (g: number) => { doc.setFillColor(g, g, g); };
  const textColor = (r: number, g: number, b: number) => { doc.setTextColor(r, g, b); };
  const font = (style: "normal" | "bold" | "italic", size: number, family: "helvetica" | "courier" = "helvetica") => {
    doc.setFont(family, style);
    doc.setFontSize(size);
  };

  let y = M;

  // ── BORDE EXTERIOR ─────────────────────────────────────────────────────────
  gray(0); lw(0.5);
  doc.rect(M, M, PW - 2 * M, PH - 2 * M);

  // ── CABECERA: 2 COLUMNAS ──────────────────────────────────────────────────
  const COL1_W = 65;
  const COL2_X = M + COL1_W;
  const COL2_W = PW - M - COL2_X - M;
  const HDR_H = 70; // altura total bloque cabecera

  // Línea vertical divisoria de columnas
  gray(160); lw(0.2);
  doc.line(COL2_X, y, COL2_X, y + HDR_H);
  // Borde inferior de cabecera
  doc.line(M, y + HDR_H, PW - M, y + HDR_H);

  // — COLUMNA IZQUIERDA: logo + datos emisor —————————————————————————————
  let leftY = y + 3;

  // Logo (sin caja, flota libre)
  if (logoUrl) {
    const imgResult = await fetchImageAsBase64(logoUrl);
    if (imgResult) {
      try {
        const maxW = COL1_W - 6;
        const maxH = 18;
        doc.addImage(imgResult.data, imgResult.format, M + 3, leftY, maxW, maxH, undefined, "FAST");
        leftY += 21;
      } catch {
        // Si falla el logo, continúa sin él
      }
    }
  }

  // Razón social en negrita
  font("bold", 10);
  textColor(0, 0, 0);
  const rsLines = doc.splitTextToSize(config.razon_social.toUpperCase(), COL1_W - 6);
  doc.text(rsLines, M + 3, leftY);
  leftY += rsLines.length * 4.5;

  // Nombre comercial
  if (config.nombre_comercial && config.nombre_comercial !== config.razon_social) {
    font("bold", 9);
    const ncLines = doc.splitTextToSize(config.nombre_comercial, COL1_W - 6);
    doc.text(ncLines, M + 3, leftY);
    leftY += ncLines.length * 4;
  }

  font("normal", 7.5);
  textColor(50, 50, 50);

  // Dirección Matriz
  leftY += 1;
  font("bold", 7);
  doc.text("Dirección", M + 3, leftY);
  doc.text("Matriz:", M + 3, leftY + 3.5);
  font("normal", 7);
  const dmLines = doc.splitTextToSize(config.dir_matriz, COL1_W - 22);
  doc.text(dmLines, M + 20, leftY);
  leftY += Math.max(7, dmLines.length * 3.5 + 3);

  // Dirección Establecimiento/Sucursal
  if (config.dir_establecimiento) {
    font("bold", 7);
    doc.text("Dirección", M + 3, leftY);
    doc.text("Sucursal:", M + 3, leftY + 3.5);
    font("normal", 7);
    const dsLines = doc.splitTextToSize(config.dir_establecimiento, COL1_W - 22);
    doc.text(dsLines, M + 20, leftY);
    leftY += Math.max(7, dsLines.length * 3.5 + 3);
  }

  leftY += 2;
  font("bold", 7.5);
  textColor(0, 0, 0);
  doc.text("OBLIGADO A LLEVAR CONTABILIDAD", M + 3, leftY);
  font("normal", 7.5);
  doc.text(config.obligado_contabilidad ? "SI" : "NO", COL1_W - 5, leftY, { align: "right" });

  // — COLUMNA DERECHA: datos comprobante ————————————————————————————————
  const R = COL2_X + 3;
  const RW = COL2_W - 4;
  let rightY = y + 3;

  // Fila RUC
  gray(180); lw(0.2);
  doc.line(COL2_X, rightY + 8, PW - M, rightY + 8);
  font("bold", 8);
  textColor(0, 0, 0);
  doc.text("R.U.C.:", R, rightY + 5.5);
  font("normal", 9);
  doc.text(config.ruc, R + 16, rightY + 5.5);
  rightY += 8;

  // FACTURA
  doc.line(COL2_X, rightY + 10, PW - M, rightY + 10);
  font("bold", 12);
  doc.text("FACTURA", COL2_X + COL2_W / 2, rightY + 7, { align: "center" });
  rightY += 10;

  // No.
  doc.line(COL2_X, rightY + 8, PW - M, rightY + 8);
  font("normal", 9);
  doc.text(
    `No. ${config.establecimiento}-${config.punto_emision}-${factura.numero.split("-").pop() ?? factura.numero}`,
    COL2_X + COL2_W / 2, rightY + 5.5, { align: "center" },
  );
  rightY += 8;

  // NÚMERO DE AUTORIZACIÓN
  doc.line(COL2_X, rightY + 15, PW - M, rightY + 15);
  font("bold", 7.5);
  doc.text("NÚMERO DE AUTORIZACIÓN", R, rightY + 4);
  font("normal", 7);
  const numAut = comprobante.numero_autorizacion ?? comprobante.clave_acceso ?? "—";
  const autLines = doc.splitTextToSize(numAut, RW);
  doc.text(autLines, R, rightY + 9);
  rightY += 15;

  // FECHA Y HORA DE AUTORIZACIÓN
  doc.line(COL2_X, rightY + 8, PW - M, rightY + 8);
  font("bold", 7);
  doc.text("FECHA Y HORA DE", R, rightY + 3.5);
  doc.text("AUTORIZACIÓN:", R, rightY + 7);
  font("normal", 7.5);
  const fechaAut = comprobante.fecha_autorizacion
    ? new Date(comprobante.fecha_autorizacion).toLocaleString("es-EC")
    : "—";
  doc.text(fechaAut, R + 35, rightY + 5);
  rightY += 8;

  // AMBIENTE / EMISIÓN
  doc.line(COL2_X, rightY + 8, PW - M, rightY + 8);
  const ambienteMid = COL2_X + COL2_W / 2;
  doc.line(ambienteMid, rightY, ambienteMid, rightY + 8);
  font("bold", 7);
  doc.text("AMBIENTE:", R, rightY + 3.5);
  font("normal", 7.5);
  const ambLabel = config.ambiente === "produccion" ? "PRODUCCIÓN" : "PRUEBAS";
  if (config.ambiente !== "produccion") {
    textColor(180, 0, 0);
  }
  doc.text(ambLabel, R + 20, rightY + 3.5);
  textColor(0, 0, 0);
  font("bold", 7);
  doc.text("EMISIÓN:", ambienteMid + 3, rightY + 3.5);
  font("normal", 7.5);
  doc.text(config.nombre_comercial ?? "NORMAL", ambienteMid + 20, rightY + 3.5);
  rightY += 8;

  // CLAVE DE ACCESO + código de barras
  font("bold", 7.5);
  textColor(0, 0, 0);
  doc.text("CLAVE DE ACCESO", R, rightY + 4);
  rightY += 5;

  // Intentar código de barras
  const barcodeImg = await generarCodigoBarras(comprobante.clave_acceso ?? numAut);
  if (barcodeImg) {
    const barW = RW;
    const barH = 10;
    doc.addImage(barcodeImg, "PNG", R, rightY, barW, barH, undefined, "FAST");
    rightY += barH + 1;
  }
  // Número de clave debajo del barcode (o solo texto si no hay barcode)
  font("normal", 6.5, "courier");
  textColor(40, 40, 40);
  const clave = comprobante.clave_acceso ?? numAut;
  const mid = Math.ceil(clave.length / 2);
  doc.text(clave.substring(0, mid), R, rightY + 3);
  doc.text(clave.substring(mid), R, rightY + 7);
  textColor(0, 0, 0);
  rightY += 9;

  y += HDR_H + 2;

  // ── DATOS COMPRADOR ────────────────────────────────────────────────────────
  const IWALL = PW - 2 * M; // ancho total del contenido

  // Fila 1: Razón social | Identificación | Fecha
  const B1_H = 9;
  gray(180); lw(0.2);
  doc.rect(M, y, IWALL, B1_H);
  const colIdX = M + IWALL * 0.5;
  const colFechaX = M + IWALL * 0.75;
  doc.line(colIdX, y, colIdX, y + B1_H);
  doc.line(colFechaX, y, colFechaX, y + B1_H);

  font("bold", 7.5);
  textColor(0, 0, 0);
  doc.text("Razón Social / Nombres y Apellidos:", M + 2, y + 4);
  font("normal", 8.5);
  const rsCliente = doc.splitTextToSize(factura.razon_social ?? "—", colIdX - M - 4);
  doc.text(rsCliente, M + 2, y + 8);

  font("bold", 7.5);
  doc.text("Identificación", colIdX + 2, y + 4);
  font("normal", 8);
  doc.text(factura.ruc_cliente ?? "—", colIdX + 2, y + 8);

  font("bold", 7.5);
  doc.text("Fecha", colFechaX + 2, y + 4);
  font("normal", 8);
  const fechaEmision = factura.fecha
    ? new Date(factura.fecha + "T00:00:00").toLocaleDateString("es-EC")
    : "—";
  doc.text(fechaEmision, colFechaX + 2, y + 8);

  y += B1_H;

  // Fila 2: segunda línea cliente si es larga
  const B2_H = 7;
  doc.rect(M, y, IWALL, B2_H);
  doc.line(colIdX, y, colIdX, y + B2_H);
  doc.line(colFechaX, y, colFechaX, y + B2_H);
  font("bold", 7.5);
  doc.text("Guía", colFechaX + 2, y + 5);
  // dirección (opcional - dejar en blanco)
  font("normal", 7.5);
  doc.text("Dirección:", M + 2, y + 5);

  y += B2_H + 2;

  // ── TABLA DE DETALLE ───────────────────────────────────────────────────────
  // Columnas igual que la referencia: Cod.Princ | Cod.Aux | Cant | Descripción | Det.Adic | P.Unitario | Subsidio | P.sinSubsidio | Descuento | P.Total
  const C = {
    codP: 16,
    codA: 12,
    cant: 12,
    desc: 44,
    detAd: 18,
    pUnit: 22,
    sub: 14,
    pSub: 18,
    dscto: 16,
    // total = resto
  };
  const detTotalW = IWALL - C.codP - C.codA - C.cant - C.desc - C.detAd - C.pUnit - C.sub - C.pSub - C.dscto;
  const cx: Record<string, number> = {};
  cx.codP = M;
  cx.codA = cx.codP + C.codP;
  cx.cant = cx.codA + C.codA;
  cx.desc = cx.cant + C.cant;
  cx.detAd = cx.desc + C.desc;
  cx.pUnit = cx.detAd + C.detAd;
  cx.sub = cx.pUnit + C.pUnit;
  cx.pSub = cx.sub + C.sub;
  cx.dscto = cx.pSub + C.pSub;
  cx.total = cx.dscto + C.dscto;
  const tableR = M + IWALL;

  const HDR_ROW_H = 8;
  fillGray(55);
  doc.rect(M, y, IWALL, HDR_ROW_H, "F");
  gray(90); lw(0.15);
  // Líneas verticales cabecera
  for (const x of [cx.codA, cx.cant, cx.desc, cx.detAd, cx.pUnit, cx.sub, cx.pSub, cx.dscto, cx.total]) {
    doc.line(x, y, x, y + HDR_ROW_H);
  }

  font("bold", 6.5);
  textColor(255, 255, 255);
  doc.text("Cod.", cx.codP + 1, y + 3);
  doc.text("Principal", cx.codP + 1, y + 6.5);
  doc.text("Cantidad", cx.cant + 1, y + 5);
  doc.text("Descripción", cx.desc + 1, y + 5);
  doc.text("Detalle Adicional", cx.detAd + 1, y + 5);
  doc.text("Precio Unitario", cx.pUnit + 1, y + 5);
  doc.text("Subsidio", cx.sub + 1, y + 5);
  doc.text("Precio sin", cx.pSub + 1, y + 3);
  doc.text("Subsidio", cx.pSub + 1, y + 6.5);
  doc.text("Descuento", cx.dscto + 1, y + 5);
  doc.text("Precio Total", cx.total + 1, y + 5);
  doc.text("Cod.", cx.codA + 1, y + 3);
  doc.text("Auxiliar", cx.codA + 1, y + 6.5);
  textColor(0, 0, 0);
  y += HDR_ROW_H;

  // Fila de detalle
  const precioUnit = Number(factura.subtotal ?? 0);
  const descuento = Number(factura.descuento ?? 0);
  const precioTotal = precioUnit - descuento;
  const descServicio = descripcionServicio ?? factura.observacion ?? "Servicios profesionales";
  const descLines = doc.splitTextToSize(descServicio, C.desc - 2);
  const DET_H = Math.max(10, descLines.length * 4.5 + 4);

  fillGray(252);
  doc.rect(M, y, IWALL, DET_H, "F");
  gray(190); lw(0.15);
  for (const x of [cx.codA, cx.cant, cx.desc, cx.detAd, cx.pUnit, cx.sub, cx.pSub, cx.dscto, cx.total]) {
    doc.line(x, y, x, y + DET_H);
  }
  doc.line(M, y, tableR, y);
  doc.line(M, y + DET_H, tableR, y + DET_H);
  doc.line(M, y, M, y + DET_H);
  doc.line(tableR, y, tableR, y + DET_H);

  font("normal", 8);
  doc.text("PR-001", cx.codP + 1, y + 6);
  doc.text("1.00", cx.cant + 1, y + 6);
  doc.text(descLines, cx.desc + 1, y + 6);
  doc.text(fmt(precioUnit), tableR - 2, y + 6, { align: "right" });
  doc.text("0.00", cx.sub + 1, y + 6);
  doc.text("0.00", cx.pSub + 1, y + 6);
  doc.text(fmt(descuento), cx.dscto + 1, y + 6);
  doc.text(fmt(precioTotal), tableR - 2, y + 6, { align: "right" });

  y += DET_H + 3;

  // ── INFORMACIÓN ADICIONAL ──────────────────────────────────────────────────
  const INFO_H = 6;
  fillGray(240);
  doc.rect(M, y, IWALL, INFO_H, "F");
  gray(180); lw(0.2);
  doc.rect(M, y, IWALL, INFO_H);
  font("bold", 7.5);
  textColor(0, 0, 0);
  doc.text("Información Adicional", M + IWALL / 2, y + 4.5, { align: "center" });
  y += INFO_H;

  // Parsear forma de pago
  const xmlStr = comprobante.xml_firmado ?? comprobante.xml_autorizado ?? factura.xml_content;
  const fpData = parsearFormaPago(xmlStr);

  // Área de info adicional: izquierda observación + forma de pago, derecha totales
  const TOT_W = 75;
  const LEFT_W = IWALL - TOT_W;
  const DIVX = M + LEFT_W;

  // Calcular tasa IVA real
  const tasaIVA = calcularTasaIVA(Number(factura.subtotal ?? 0), Number(factura.iva ?? 0));
  const hasIVA = Number(factura.iva ?? 0) > 0;
  const subtotalConIVA = hasIVA ? Number(factura.subtotal ?? 0) : 0;
  const subtotalSinIVA = hasIVA ? 0 : Number(factura.subtotal ?? 0);

  // Filas de totales (igual que la referencia)
  const totRows: [string, string, boolean][] = [
    [`SUBTOTAL ${hasIVA ? tasaIVA + "%" : "0%"}`, fmt(subtotalConIVA), false],
    ["SUBTOTAL NO OBJETO DE IVA", "0.00", false],
    ["SUBTOTAL EXENTO DE IVA", "0.00", false],
    ["SUBTOTAL SIN IMPUESTOS", fmt(subtotalSinIVA), false],
    ["TOTAL DESCUENTO", fmt(factura.descuento), false],
    ["ICE", "0.00", false],
    [`IVA ${hasIVA ? tasaIVA + "%" : "0%"}`, fmt(factura.iva), false],
    ["IRBPNR", "0.00", false],
    ["PROPINA", "0.00", false],
    ["VALOR TOTAL", fmt(factura.total), true],
  ];

  const TOT_ROW_H = 6;
  const totalBlockH = totRows.length * TOT_ROW_H;

  // Borde bloque totales
  gray(180); lw(0.2);
  doc.rect(DIVX, y, TOT_W, totalBlockH);

  // Filas totales
  let ty = y;
  for (const [label, val, isBold] of totRows) {
    if (isBold) {
      fillGray(220);
      doc.rect(DIVX, ty, TOT_W, TOT_ROW_H, "F");
      gray(180); lw(0.2);
    }
    // Línea separadora entre label y valor
    const valColW = 22;
    const labelColW = TOT_W - valColW;
    doc.line(DIVX + labelColW, ty, DIVX + labelColW, ty + TOT_ROW_H);
    doc.line(DIVX, ty + TOT_ROW_H, DIVX + TOT_W, ty + TOT_ROW_H);

    font(isBold ? "bold" : "normal", 7);
    textColor(0, 0, 0);
    doc.text(label, DIVX + 2, ty + 4.2);
    doc.text(val, DIVX + TOT_W - 2, ty + 4.2, { align: "right" });
    ty += TOT_ROW_H;
  }

  // Bloque izquierdo: observación + forma de pago
  const leftBlockY = y;

  // Email y descripción de info adicional
  let leftInfoY = leftBlockY + 2;
  font("normal", 7.5);
  if (factura.observacion) {
    font("bold", 7.5);
    doc.text("Descripción:", M + 2, leftInfoY + 4);
    font("normal", 7.5);
    const obsLines = doc.splitTextToSize(factura.observacion, LEFT_W - 8);
    doc.text(obsLines, M + 25, leftInfoY + 4);
    leftInfoY += obsLines.length * 4 + 2;
  }

  // Tabla forma de pago
  leftInfoY += 2;
  const FP_HEADER_H = 6;
  // Header dos columnas
  fillGray(240);
  const fpLabelW = LEFT_W * 0.6;
  doc.rect(M, leftInfoY, LEFT_W, FP_HEADER_H, "F");
  gray(180); lw(0.15);
  doc.rect(M, leftInfoY, LEFT_W, FP_HEADER_H);
  doc.line(M + fpLabelW, leftInfoY, M + fpLabelW, leftInfoY + FP_HEADER_H);
  font("bold", 7.5);
  textColor(0, 0, 0);
  doc.text("Forma de pago", M + fpLabelW / 2, leftInfoY + 4.2, { align: "center" });
  doc.text("Valor", M + fpLabelW + (LEFT_W - fpLabelW) / 2, leftInfoY + 4.2, { align: "center" });
  leftInfoY += FP_HEADER_H;

  // Fila forma de pago
  const FP_ROW_H = 6;
  gray(180); lw(0.15);
  doc.rect(M, leftInfoY, LEFT_W, FP_ROW_H);
  doc.line(M + fpLabelW, leftInfoY, M + fpLabelW, leftInfoY + FP_ROW_H);
  font("normal", 7.5);
  const fpText = fpData
    ? `${fpData.codigo} - ${fpData.nombre.toUpperCase()}`
    : "01 - SIN UTILIZACIÓN DEL SISTEMA FINANCIERO";
  const fpLines = doc.splitTextToSize(fpText, fpLabelW - 4);
  doc.text(fpLines, M + 2, leftInfoY + 4.2);
  doc.text(fmt(factura.total), M + fpLabelW + (LEFT_W - fpLabelW) - 2, leftInfoY + 4.2, { align: "right" });

  y = Math.max(ty, leftInfoY + FP_ROW_H) + 3;

  // Fila VALOR TOTAL SIN SUBSIDIO + AHORRO POR SUBSIDIO (como en la referencia)
  const extraRows: [string, string][] = [
    ["VALOR TOTAL SIN SUBSIDIO", "0.00"],
    ["AHORRO POR SUBSIDIO:", "0.00"],
  ];
  const extraH = 7;
  for (const [label, val] of extraRows) {
    const labelColW2 = TOT_W - 22;
    gray(180); lw(0.15);
    doc.rect(DIVX, y, TOT_W, extraH);
    doc.line(DIVX + labelColW2, y, DIVX + labelColW2, y + extraH);
    font("normal", 6.5);
    doc.text(label, DIVX + 2, y + 4.5);
    doc.text(val, DIVX + TOT_W - 2, y + 4.5, { align: "right" });
    y += extraH;
  }
  // Nota "(Incluye IVA cuando corresponda)"
  font("italic", 6);
  textColor(80, 80, 80);
  doc.text("(Incluye IVA cuando corresponda)", DIVX + 2, y + 4);
  textColor(0, 0, 0);
  y += 8;

  // ── PIE ────────────────────────────────────────────────────────────────────
  font("italic", 6.5);
  textColor(130, 130, 130);
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
