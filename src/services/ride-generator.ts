/**
 * Generador de RIDE (Representación Impresa del Documento Electrónico)
 * Formato PDF según especificación SRI Ecuador.
 * Usa jspdf (ya instalado como dependencia del proyecto).
 */
import { jsPDF } from "jspdf";
import type { FacturaEmitida } from "@/services/facturas-emitidas";
import type { ComprobanteElectronico } from "@/types/facturacion-sri";
import type { EmpresaFacConfig } from "@/types/facturacion-sri";

export interface RideData {
  factura: FacturaEmitida;
  comprobante: ComprobanteElectronico;
  config: EmpresaFacConfig;
  logoUrl?: string | null;
  descripcionServicio?: string;
}

/** Carga una imagen desde URL como base64 para jsPDF */
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
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

/** Genera el PDF RIDE y lo descarga en el navegador */
export async function generarYDescargarRIDE(data: RideData): Promise<void> {
  const { factura, comprobante, config, logoUrl, descripcionServicio } = data;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210; // ancho A4
  const M = 10;  // margen

  let y = M;

  // ── LOGO + CABECERA EMISOR ─────────────────────────────────────────────────
  const COL1_W = 60;   // columna logo
  const COL2_X = M + COL1_W + 4;
  const COL2_W = PW - M - COL2_X - M; // columna datos comprobante

  // Logo
  if (logoUrl) {
    const logoB64 = await fetchImageAsBase64(logoUrl);
    if (logoB64) {
      // Detectar formato
      const fmt_ = logoUrl.includes(".png") || logoB64.startsWith("data:image/png") ? "PNG" : "JPEG";
      try {
        doc.addImage(logoB64, fmt_, M, y, COL1_W, 22);
      } catch {
        // Si falla el logo (SVG, etc.) simplemente no lo muestra
      }
    }
  }

  // Datos emisor (columna izquierda, debajo del logo o en su lugar)
  const emisorY = y + (logoUrl ? 24 : 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(config.razon_social, M, emisorY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (config.nombre_comercial && config.nombre_comercial !== config.razon_social) {
    doc.text(config.nombre_comercial, M, emisorY + 5);
  }
  doc.text(`Dir. Matriz: ${config.dir_matriz}`, M, emisorY + 10);
  if (config.dir_establecimiento) {
    doc.text(`Dir. Establecimiento: ${config.dir_establecimiento}`, M, emisorY + 15);
    doc.text(
      `Obligado a llevar contabilidad: ${config.obligado_contabilidad ? "SI" : "NO"}`,
      M, emisorY + 20,
    );
  } else {
    doc.text(
      `Obligado a llevar contabilidad: ${config.obligado_contabilidad ? "SI" : "NO"}`,
      M, emisorY + 15,
    );
  }

  // Box datos comprobante (columna derecha)
  doc.setDrawColor(180, 180, 180);
  doc.rect(COL2_X, y, COL2_W, 40);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("R.U.C:", COL2_X + 2, y + 7);
  doc.setFont("helvetica", "normal");
  doc.text(config.ruc, COL2_X + 20, y + 7);

  doc.setFont("helvetica", "bold");
  doc.text("FACTURA", COL2_X + COL2_W / 2, y + 14, { align: "center" });

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(
    `No. ${config.establecimiento}-${config.punto_emision}-${factura.numero.split("-").pop() ?? factura.numero}`,
    COL2_X + COL2_W / 2, y + 20, { align: "center" },
  );

  doc.text(
    `NÚMERO DE AUTORIZACIÓN`,
    COL2_X + 2, y + 27,
  );
  doc.setFontSize(6.5);
  const numAut = comprobante.numero_autorizacion ?? comprobante.clave_acceso ?? "—";
  // Wrap largo número de autorización
  const autLines = doc.splitTextToSize(numAut, COL2_W - 4);
  doc.text(autLines, COL2_X + 2, y + 32);

  const ambienteLabel = config.ambiente === "produccion" ? "PRODUCCIÓN" : "PRUEBAS";
  doc.text(`AMBIENTE: ${ambienteLabel}`, COL2_X + 2, y + 39);

  y = Math.max(y + 42, emisorY + 26);

  // ── CLAVE DE ACCESO ────────────────────────────────────────────────────────
  if (comprobante.clave_acceso) {
    doc.setFillColor(240, 240, 240);
    doc.rect(M, y, PW - 2 * M, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("CLAVE DE ACCESO", M + 2, y + 3.5);
    doc.setFont("courier", "normal");
    doc.setFontSize(6.5);
    // Mostrar clave en dos líneas de 25 chars
    const clave = comprobante.clave_acceso;
    const mid = Math.ceil(clave.length / 2);
    doc.text(clave.substring(0, mid), M + 2, y + 7);
    y += 8;
    doc.text(clave.substring(mid), M + 2, y);
    y += 5;
  }

  // ── FECHA AUTORIZACIÓN ─────────────────────────────────────────────────────
  if (comprobante.fecha_autorizacion) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      `Fecha y hora de autorización: ${new Date(comprobante.fecha_autorizacion).toLocaleString("es-EC")}`,
      M, y + 5,
    );
    y += 8;
  }

  // ── DATOS COMPRADOR ────────────────────────────────────────────────────────
  y += 2;
  doc.setDrawColor(180, 180, 180);
  doc.rect(M, y, PW - 2 * M, 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("RAZÓN SOCIAL / NOMBRES Y APELLIDOS:", M + 2, y + 6);
  doc.setFont("helvetica", "normal");
  doc.text(factura.razon_social ?? "—", M + 2, y + 12);

  doc.setFont("helvetica", "bold");
  doc.text("IDENTIFICACIÓN:", M + 2, y + 18);
  doc.setFont("helvetica", "normal");
  doc.text(factura.ruc_cliente ?? "—", M + 40, y + 18);

  const fechaLabel = factura.fecha
    ? new Date(factura.fecha + "T00:00:00").toLocaleDateString("es-EC")
    : "—";
  doc.setFont("helvetica", "bold");
  doc.text("FECHA EMISIÓN:", PW - M - 80, y + 6);
  doc.setFont("helvetica", "normal");
  doc.text(fechaLabel, PW - M - 80, y + 12);

  y += 24;

  // ── DETALLE ────────────────────────────────────────────────────────────────
  // Cabecera tabla
  const COL_CANT  = 18;
  const COL_DESC  = 80;
  const COL_PRECIO = 28;
  const COL_DSCTO  = 22;
  const COL_TOTAL  = 28;
  const colX = [
    M,
    M + COL_CANT,
    M + COL_CANT + COL_DESC,
    M + COL_CANT + COL_DESC + COL_PRECIO,
    M + COL_CANT + COL_DESC + COL_PRECIO + COL_DSCTO,
  ];

  doc.setFillColor(220, 220, 220);
  doc.rect(M, y, PW - 2 * M, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("CANT.", colX[0] + 1, y + 5);
  doc.text("DESCRIPCIÓN", colX[1] + 1, y + 5);
  doc.text("P. UNITARIO", colX[2] + 1, y + 5);
  doc.text("DESCUENTO", colX[3] + 1, y + 5);
  doc.text("TOTAL", colX[4] + 1, y + 5);
  y += 9;

  // Fila de detalle (una sola línea de servicio)
  const baseImponible = Number(factura.subtotal ?? 0) - Number(factura.descuento ?? 0);
  const desc = descripcionServicio ?? factura.observacion ?? "Servicios profesionales";
  const descLines = doc.splitTextToSize(desc, COL_DESC - 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("1.000000", colX[0] + 1, y + 5);
  doc.text(descLines, colX[1] + 1, y + 5);
  doc.text(fmt(baseImponible), colX[2] + 1, y + 5);
  doc.text(fmt(factura.descuento), colX[3] + 1, y + 5);
  doc.text(fmt(baseImponible), colX[4] + 1, y + 5);

  const detH = Math.max(8, descLines.length * 5 + 3);
  doc.setDrawColor(200, 200, 200);
  doc.line(M, y + detH, PW - M, y + detH);
  y += detH + 4;

  // ── TOTALES + FORMA DE PAGO ────────────────────────────────────────────────
  const TOT_X = PW - M - 80;
  const TOT_W = 80;

  // Tabla totales (derecha)
  const totRows = [
    ["SUBTOTAL 12%", fmt(baseImponible)],
    ["SUBTOTAL 0%", "0.00"],
    ["DESCUENTO", fmt(factura.descuento)],
    ["IVA", fmt(factura.iva)],
    ["TOTAL", fmt(factura.total)],
  ];

  doc.setDrawColor(180, 180, 180);
  let ty = y;
  totRows.forEach(([label, val], i) => {
    const isBold = i === totRows.length - 1;
    if (isBold) {
      doc.setFillColor(220, 220, 220);
      doc.rect(TOT_X, ty, TOT_W, 6, "F");
    }
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(8);
    doc.text(label, TOT_X + 2, ty + 4.5);
    doc.text(val, TOT_X + TOT_W - 2, ty + 4.5, { align: "right" });
    doc.rect(TOT_X, ty, TOT_W, 6);
    ty += 6;
  });

  // Forma de pago (izquierda)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("FORMA DE PAGO:", M, y + 5);
  doc.setFont("helvetica", "normal");
  doc.text(fmt(factura.total), M + 2, y + 11);

  y = ty + 8;

  // ── INFORMACIÓN ADICIONAL ──────────────────────────────────────────────────
  if (factura.observacion) {
    doc.setFillColor(240, 240, 240);
    doc.rect(M, y, PW - 2 * M, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("INFORMACIÓN ADICIONAL", M + 2, y + 5);
    y += 9;
    doc.setFont("helvetica", "normal");
    const obsLines = doc.splitTextToSize(factura.observacion, PW - 2 * M - 4);
    doc.text(obsLines, M + 2, y);
    y += obsLines.length * 4 + 2;
  }

  // ── PIE ────────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "DOCUMENTO GENERADO POR VIATIQ ERP — Este documento es la representación impresa de un comprobante electrónico.",
    PW / 2, 287, { align: "center" },
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
