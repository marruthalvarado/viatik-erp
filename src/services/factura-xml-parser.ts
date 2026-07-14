/**
 * Parser de comprobantes electrónicos SRI Ecuador.
 * Soporta: Factura (tipo 01), Nota de Crédito (tipo 04).
 * Formato: XML firmado electrónicamente por el SRI.
 */

export interface FacturaXmlData {
  numero: string; // ej: 001-001-000000042
  fecha: string; // ISO yyyy-MM-dd
  tipo: "factura" | "nota_credito";
  ruc_cliente: string | null;
  razon_social: string;
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
  clave_acceso: string | null;
  estado_sri: string;
  xml_content: string;
  observacion: string | null;
}

/**
 * Convierte "DD/MM/YYYY" → "YYYY-MM-DD"
 */
function parseFechaEcuador(raw: string): string {
  const parts = raw.trim().split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Si ya viene en otro formato, devolverlo tal cual
  return raw;
}

function getText(doc: Document, ...selectors: string[]): string {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return "";
}

function getNumber(doc: Document, ...selectors: string[]): number {
  const t = getText(doc, ...selectors);
  return t ? parseFloat(t) : 0;
}

export function parseFacturaXml(xmlString: string): FacturaXmlData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");

  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error("XML inválido: " + parserError.textContent);
  }

  // ── Tipo de comprobante ──────────────────────────────────────────────────
  const codDoc = getText(doc, "codDoc", "infoTributaria > codDoc");
  const tipo: "factura" | "nota_credito" = codDoc === "04" ? "nota_credito" : "factura";

  // ── Clave de acceso ──────────────────────────────────────────────────────
  const clave_acceso = getText(doc, "claveAcceso", "infoTributaria > claveAcceso") || null;

  // ── Número de comprobante ────────────────────────────────────────────────
  const estab = getText(doc, "estab", "infoTributaria > estab");
  const ptoEmi = getText(doc, "ptoEmi", "infoTributaria > ptoEmi");
  const secuencial = getText(doc, "secuencial", "infoTributaria > secuencial");
  const numero =
    estab && ptoEmi && secuencial
      ? `${estab}-${ptoEmi}-${secuencial}`
      : getText(doc, "numeroComprobante");

  // ── Fecha ────────────────────────────────────────────────────────────────
  const fechaRaw = getText(
    doc,
    "fechaEmision",
    "infoFactura > fechaEmision",
    "infoNotaCredito > fechaEmision",
    "infoLiquidacionCompra > fechaEmision",
  );
  const fecha = parseFechaEcuador(fechaRaw);

  // ── Receptor (cliente) ───────────────────────────────────────────────────
  const ruc_cliente =
    getText(doc, "identificacionComprador", "infoFactura > identificacionComprador") ||
    getText(doc, "identificacionCompradorNC", "infoNotaCredito > identificacionCompradorNC") ||
    null;

  const razon_social =
    getText(doc, "razonSocialComprador", "infoFactura > razonSocialComprador") ||
    getText(doc, "razonSocialCompradorNC", "infoNotaCredito > razonSocialCompradorNC") ||
    getText(doc, "razonSocialComprador") ||
    "Sin nombre";

  // ── Montos ───────────────────────────────────────────────────────────────
  const subtotal = getNumber(
    doc,
    "totalSinImpuestos",
    "infoFactura > totalSinImpuestos",
    "infoNotaCredito > totalSinImpuestos",
  );

  const descuento = getNumber(
    doc,
    "totalDescuento",
    "infoFactura > totalDescuento",
    "infoNotaCredito > totalDescuento",
  );

  // IVA: buscar en totalConImpuestos → totalImpuesto donde codigo = 2
  let iva = 0;
  const impuestos = doc.querySelectorAll("totalImpuesto");
  impuestos.forEach((imp) => {
    const codigo = imp.querySelector("codigo")?.textContent?.trim();
    if (codigo === "2") {
      iva += parseFloat(imp.querySelector("valor")?.textContent?.trim() ?? "0");
    }
  });

  const total =
    getNumber(
      doc,
      "importeTotal",
      "infoFactura > importeTotal",
      "infoNotaCredito > importeTotal",
    ) || subtotal + iva - descuento;

  // ── Observación (primer detalle como referencia) ─────────────────────────
  const primerDetalle = doc.querySelector("detalle > descripcion");
  const observacion = primerDetalle?.textContent?.trim() ?? null;

  return {
    numero,
    fecha,
    tipo,
    ruc_cliente,
    razon_social,
    subtotal,
    descuento,
    iva,
    total,
    clave_acceso,
    estado_sri: "AUTORIZADO",
    xml_content: xmlString,
    observacion,
  };
}

/**
 * Lee un File XML y retorna los datos parseados.
 */
export async function readFacturaXmlFile(file: File): Promise<FacturaXmlData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xml = e.target?.result as string;
        resolve(parseFacturaXml(xml));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo XML"));
    reader.readAsText(file, "utf-8");
  });
}
