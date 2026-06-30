/**
 * xml-extractor.ts — IA-4
 *
 * Parser client-side para facturas electrónicas XML.
 * Soporta:
 *   - CFDI 3.3 / 4.0  (México)
 *   - UBL 2.1          (Perú, Colombia, Ecuador, genérico)
 *   - XML genérico     (fallback: extrae todo el texto visible)
 *
 * No requiere dependencias externas. Usa DOMParser nativo del navegador.
 * El resultado se convierte a texto estructurado para enviar al AI provider.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface XmlExtractionResult {
  /** Texto estructurado para enviar a la IA. */
  textoParaIA: string;
  /** Datos directamente parseados (para pre-llenar sin IA cuando sea posible). */
  datos: XmlDatosFactura;
  /** Formato detectado. */
  formato: "cfdi" | "ubl" | "generico";
  /** Confianza de la extracción directa (0-100). */
  confianza: number;
}

export interface XmlDatosFactura {
  emisor?: string;
  rfc?: string;
  receptor?: string;
  fecha?: string;
  moneda?: string;
  subtotal?: number | null;
  iva?: number | null;
  total?: number | null;
  numeroFactura?: string;
  serie?: string;
  folio?: string;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Extrae datos de una factura XML.
 * Retorna texto estructurado + datos parseados directamente.
 *
 * @throws Error si el archivo no es XML válido.
 */
export async function extractFromXml(file: File): Promise<XmlExtractionResult> {
  const text = await file.text();

  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(text, "application/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      throw new Error("XML malformado: " + parseError.textContent?.substring(0, 100));
    }
  } catch (err) {
    throw new Error(`[xml-extractor] No se pudo parsear el XML: ${String(err)}`);
  }

  // Detectar formato
  const rootName = doc.documentElement.localName.toLowerCase();
  const ns = doc.documentElement.namespaceURI ?? "";

  if (rootName === "comprobante" || ns.includes("cfdi") || text.includes("xmlns:cfdi")) {
    return parseCfdi(doc);
  }

  if (
    rootName === "invoice" ||
    ns.includes("urn:oasis:names:specification:ubl") ||
    text.includes("xmlns:cbc")
  ) {
    return parseUbl(doc);
  }

  // SRI Ecuador - wrapper autorizacion con CDATA
  // El XML autorizado por SRI tiene <autorizacion><comprobante><!CDATA[<factura...>]></comprobante></autorizacion>
  if (rootName === "autorizacion") {
    const comprobanteEl = doc.getElementsByTagName("comprobante")[0];
    if (comprobanteEl?.textContent) {
      // El textContent ya decodifica el CDATA
      const innerXml = comprobanteEl.textContent.trim();
      if (innerXml.length > 10) {
        const parser2 = new DOMParser();
        const innerDoc = parser2.parseFromString(innerXml, "application/xml");
        if (!innerDoc.querySelector("parsererror")) {
          return parseSri(innerDoc, innerXml);
        }
      }
    }
  }

  // SRI Ecuador directo (sin wrapper autorizacion)
  const SRI_ROOTS = ["factura", "notacredito", "notadebito", "liquidacion", "comprobanteRetencion"];
  if (SRI_ROOTS.includes(rootName) || doc.getElementsByTagName("infoTributaria").length > 0) {
    return parseSri(doc, text);
  }

  return parseGenerico(doc, text);
}

// --- Parser SRI Ecuador -------------------------------------------------------

function parseSri(doc: Document, rawText: string): XmlExtractionResult {
  const getTag = (tag: string): string | undefined =>
    doc.getElementsByTagName(tag)[0]?.textContent?.trim() ?? undefined;

  const razonSocial = getTag("razonSocial");
  const ruc = getTag("ruc");
  const estab = getTag("estab");
  const ptoEmi = getTag("ptoEmi");
  const secuencial = getTag("secuencial");
  const fechaRaw = getTag("fechaEmision"); // DD/MM/YYYY en SRI
  const monedaRaw = getTag("moneda"); // "DOLAR", "USD", etc.
  const totalSinImpuestosStr = getTag("totalSinImpuestos");
  const importeTotalStr = getTag("importeTotal");

  // IVA: buscar en totalConImpuestos > totalImpuesto > valor
  let iva: number | null = null;
  const impuestos = doc.getElementsByTagName("totalImpuesto");
  for (const imp of Array.from(impuestos)) {
    const codigo = imp.getElementsByTagName("codigo")[0]?.textContent?.trim();
    if (codigo === "2") {
      // IVA
      const valor = imp.getElementsByTagName("valor")[0]?.textContent?.trim();
      if (valor) iva = parseFloat(valor);
    }
  }

  // Numero de factura: estab-ptoEmi-secuencial
  const numeroFactura =
    estab && ptoEmi && secuencial ? estab + "-" + ptoEmi + "-" + secuencial : undefined;

  // Normalizar moneda SRI: "DOLAR" -> "USD"
  const monedaMap: Record<string, string> = {
    DOLAR: "USD", USD: "USD", SOLES: "PEN", PEN: "PEN",
    PESOS: "COP", COP: "COP", EUR: "EUR",
  };
  const moneda = monedaRaw ? (monedaMap[monedaRaw.toUpperCase()] ?? monedaRaw) : undefined;

  // Fecha SRI viene como DD/MM/YYYY -> normalizar
  let fecha: string | undefined;
  if (fechaRaw) {
    const parts = fechaRaw.split("/");
    if (parts.length === 3) {
      fecha = parts[2] + "-" + parts[1].padStart(2, "0") + "-" + parts[0].padStart(2, "0");
    } else {
      fecha = normalizarFecha(fechaRaw);
    }
  }

  const datos: XmlDatosFactura = {
    emisor: razonSocial,
    rfc: ruc,
    fecha,
    moneda,
    subtotal: totalSinImpuestosStr ? parseFloat(totalSinImpuestosStr) : null,
    iva,
    total: importeTotalStr ? parseFloat(importeTotalStr) : null,
    numeroFactura,
  };

  const textoParaIA = buildTextoParaIA(datos, "SRI-Ecuador");
  const confianza = calcularConfianza(datos);

  return { textoParaIA, datos, formato: "ubl", confianza };

  void rawText; // fallback no necesario para SRI estructurado
}

// ─── Parser CFDI (México) ─────────────────────────────────────────────────────

function parseCfdi(doc: Document): XmlExtractionResult {
  const ns = "http://www.sat.gob.mx/cfd/4";
  const ns3 = "http://www.sat.gob.mx/cfd/3";

  const get = (tag: string, attr: string): string | undefined => {
    const el =
      doc.getElementsByTagNameNS(ns, tag)[0] ??
      doc.getElementsByTagNameNS(ns3, tag)[0] ??
      doc.getElementsByTagName(tag)[0];
    return el?.getAttribute(attr) ?? undefined;
  };

  const comprobante =
    doc.getElementsByTagNameNS(ns, "Comprobante")[0] ??
    doc.getElementsByTagNameNS(ns3, "Comprobante")[0] ??
    doc.getElementsByTagName("Comprobante")[0];

  const fecha = comprobante?.getAttribute("Fecha") ?? undefined;
  const moneda = comprobante?.getAttribute("Moneda") ?? undefined;
  const subtotalStr = comprobante?.getAttribute("SubTotal");
  const totalStr = comprobante?.getAttribute("Total");

  // IVA del nodo Impuestos
  const impuestos =
    doc.getElementsByTagNameNS(ns, "Traslados")[0] ??
    doc.getElementsByTagNameNS(ns3, "Traslados")[0] ??
    doc.getElementsByTagName("Traslados")[0];
  let iva: number | null = null;
  if (impuestos) {
    const traslados = impuestos.getElementsByTagName("Traslado");
    for (const t of Array.from(traslados)) {
      const impuesto = t.getAttribute("Impuesto");
      if (impuesto === "002") {
        // IVA
        const imp = t.getAttribute("Importe");
        if (imp) iva = parseFloat(imp);
      }
    }
  }

  const datos: XmlDatosFactura = {
    emisor: get("Emisor", "Nombre"),
    rfc: get("Emisor", "Rfc"),
    receptor: get("Receptor", "Nombre"),
    fecha: normalizarFecha(fecha),
    moneda: normalizarMoneda(moneda),
    subtotal: subtotalStr ? parseFloat(subtotalStr) : null,
    iva,
    total: totalStr ? parseFloat(totalStr) : null,
    numeroFactura: buildNumeroFactura(
      comprobante?.getAttribute("Serie") ?? undefined,
      comprobante?.getAttribute("Folio") ?? undefined,
    ),
    serie: comprobante?.getAttribute("Serie") ?? undefined,
    folio: comprobante?.getAttribute("Folio") ?? undefined,
  };

  const textoParaIA = buildTextoParaIA(datos, "CFDI");
  const confianza = calcularConfianza(datos);

  return { textoParaIA, datos, formato: "cfdi", confianza };
}

// ─── Parser UBL (Perú, Colombia, Ecuador) ────────────────────────────────────

function parseUbl(doc: Document): XmlExtractionResult {
  const getTagText = (tag: string): string | undefined => {
    const el = doc.getElementsByTagName(tag)[0] ?? doc.getElementsByTagName(`cbc:${tag}`)[0];
    return el?.textContent?.trim() ?? undefined;
  };

  const getTagAttr = (tag: string, attr: string): string | undefined => {
    const el = doc.getElementsByTagName(tag)[0] ?? doc.getElementsByTagName(`cac:${tag}`)[0];
    return el?.getAttribute(attr) ?? undefined;
  };

  // Proveedor
  const supplierParty =
    doc.getElementsByTagName("AccountingSupplierParty")[0] ??
    doc.getElementsByTagName("cac:AccountingSupplierParty")[0];
  const emisor =
    supplierParty?.getElementsByTagName("Name")[0]?.textContent?.trim() ??
    supplierParty?.getElementsByTagName("cbc:Name")[0]?.textContent?.trim();

  const ruc =
    supplierParty?.getElementsByTagName("ID")[0]?.textContent?.trim() ??
    supplierParty?.getElementsByTagName("cbc:ID")[0]?.textContent?.trim();

  // Totales
  const legalMonetaryTotal =
    doc.getElementsByTagName("LegalMonetaryTotal")[0] ??
    doc.getElementsByTagName("cac:LegalMonetaryTotal")[0];
  const totalStr =
    legalMonetaryTotal?.getElementsByTagName("PayableAmount")[0]?.textContent?.trim() ??
    legalMonetaryTotal?.getElementsByTagName("cbc:PayableAmount")[0]?.textContent?.trim();

  const taxTotalEl =
    doc.getElementsByTagName("TaxAmount")[0] ??
    doc.getElementsByTagName("cbc:TaxAmount")[0];
  const ivaStr = taxTotalEl?.textContent?.trim();

  const lineExtAmt =
    doc.getElementsByTagName("LineExtensionAmount")[0]?.textContent?.trim() ??
    doc.getElementsByTagName("cbc:LineExtensionAmount")[0]?.textContent?.trim();

  const datos: XmlDatosFactura = {
    emisor,
    rfc: ruc,
    fecha: normalizarFecha(getTagText("IssueDate")),
    moneda: normalizarMoneda(getTagAttr("DocumentCurrencyCode", "listID") ?? getTagText("DocumentCurrencyCode")),
    subtotal: lineExtAmt ? parseFloat(lineExtAmt) : null,
    iva: ivaStr ? parseFloat(ivaStr) : null,
    total: totalStr ? parseFloat(totalStr) : null,
    numeroFactura: getTagText("ID"),
  };

  const textoParaIA = buildTextoParaIA(datos, "UBL");
  const confianza = calcularConfianza(datos);

  return { textoParaIA, datos, formato: "ubl", confianza };
}

// ─── Parser genérico (fallback) ───────────────────────────────────────────────

function parseGenerico(doc: Document, rawText: string): XmlExtractionResult {
  // Extraer todo el texto visible del XML (sin tags)
  const textoVisible = doc.documentElement.textContent
    ?.replace(/\s+/g, " ")
    .trim()
    .substring(0, 3000) ?? "";

  // Intentar extraer algunos valores comunes por regex
  const montoMatch = rawText.match(/[Tt]otal[^>]*>[\s]*([\d,.]+)/);
  const fechaMatch = rawText.match(/\d{4}-\d{2}-\d{2}/);
  const monedaMatch = rawText.match(/\b(USD|MXN|PEN|COP|ARS|CLP|EUR)\b/);

  const datos: XmlDatosFactura = {
    fecha: fechaMatch ? fechaMatch[0] : undefined,
    moneda: monedaMatch ? monedaMatch[1] : undefined,
    total: montoMatch ? parseFloat(montoMatch[1].replace(",", "")) : null,
  };

  const textoParaIA = `Factura XML (formato genérico):\n${textoVisible}`;

  return { textoParaIA, datos, formato: "generico", confianza: 40 };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildNumeroFactura(serie?: string, folio?: string): string | undefined {
  if (!serie && !folio) return undefined;
  if (serie && folio) return `${serie}-${folio}`;
  return serie ?? folio;
}

function normalizarFecha(raw?: string): string | undefined {
  if (!raw) return undefined;
  // CFDI: "2024-01-15T12:00:00" → "2024-01-15"
  const iso = raw.substring(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return raw;
}

function normalizarMoneda(raw?: string): string | undefined {
  if (!raw) return undefined;
  const mapa: Record<string, string> = {
    MXN: "MXN",
    USD: "USD",
    PEN: "PEN",
    COP: "COP",
    ARS: "ARS",
    CLP: "CLP",
    EUR: "EUR",
    PES: "COP",
  };
  return mapa[raw.toUpperCase()] ?? raw;
}

function calcularConfianza(datos: XmlDatosFactura): number {
  let score = 0;
  if (datos.emisor) score += 20;
  if (datos.rfc) score += 15;
  if (datos.fecha) score += 15;
  if (datos.total !== null && datos.total !== undefined) score += 25;
  if (datos.moneda) score += 10;
  if (datos.numeroFactura) score += 15;
  return score;
}

function buildTextoParaIA(datos: XmlDatosFactura, formato: string): string {
  const lineas = [`Factura electrónica XML (${formato}):`];
  if (datos.emisor) lineas.push(`Emisor: ${datos.emisor}`);
  if (datos.rfc) lineas.push(`RFC/RUC/NIT: ${datos.rfc}`);
  if (datos.receptor) lineas.push(`Receptor: ${datos.receptor}`);
  if (datos.numeroFactura) lineas.push(`Número de comprobante: ${datos.numeroFactura}`);
  if (datos.fecha) lineas.push(`Fecha: ${datos.fecha}`);
  if (datos.moneda) lineas.push(`Moneda: ${datos.moneda}`);
  if (datos.subtotal !== null && datos.subtotal !== undefined)
    lineas.push(`Subtotal: ${datos.subtotal}`);
  if (datos.iva !== null && datos.iva !== undefined) lineas.push(`IVA/IGV: ${datos.iva}`);
  if (datos.total !== null && datos.total !== undefined) lineas.push(`Total: ${datos.total}`);
  return lineas.join("\n");
}
