/**
 * sri-receipt-parser.ts — IA-4b
 *
 * Parsea texto OCR de comprobantes electrónicos Ecuador (formato SRI)
 * usando regex. Sin llamadas a API externas, costo $0.
 *
 * Compatible con:
 *   - Facturas electrónicas RIDE (numeración 001-XXX-XXXXXXXXX)
 *   - Notas de venta / tickets de caja
 *   - Recibos de farmacia, supermercado, restaurante, etc.
 *
 * Puntuación de confianza (0–100):
 *   RUC emisor encontrado       → +30
 *   Número de factura           → +25
 *   Valor total encontrado      → +25
 *   Fecha encontrada            → +15
 *   Razón social detectada      → +5
 *
 * Un resultado con confianza ≥ 40 contiene al menos RUC + un campo clave,
 * suficiente para prellenar el formulario de gasto.
 */

// ─── Resultado del parser ─────────────────────────────────────────────────────

export interface SriParseResult {
  /** RUC del emisor (13 dígitos). */
  ruc: string | null;
  /** Nombre o razón social del proveedor. */
  razonSocial: string | null;
  /** Número de comprobante, ej: 001-025-000257842. */
  numeroFactura: string | null;
  /** Fecha en formato YYYY-MM-DD. */
  fecha: string | null;
  /** Total a pagar (USD). */
  total: number | null;
  /** Subtotal antes de IVA. */
  subtotal: number | null;
  /** IVA. */
  iva: number | null;
  /** Moneda (siempre "USD" en Ecuador). */
  moneda: string;
  /** Clave de acceso (49 dígitos). */
  claveAcceso: string | null;
  /** Líneas de descripción de ítems encontradas. */
  items: string[];
  /** Categoría de gasto inferida del tipo de negocio. */
  categoriaInferida: string | null;
  /** Puntuación de confianza del parseo (0–100). */
  confianza: number;
}

// ─── Patrones regex ───────────────────────────────────────────────────────────

// RUC Ecuador: exactamente 13 dígitos
const RE_RUC_LABELED = /(?:R\.?\s*U\.?\s*C\.?|RUC)\s*[:\-#]?\s*(\d{13})/i;
const RE_RUC_STANDALONE = /\b(\d{13})\b/;

// Número de comprobante SRI: 3-3-9 dígitos (ej: 001-025-000257842)
// Acepta guiones o espacios como separador (OCR a veces inserta espacios)
const RE_FACTURA = /\b(\d{3})[\s\-](\d{3})[\s\-](\d{9})\b/;

// Fecha: DD/MM/YYYY o DD-MM-YYYY
const RE_FECHA = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/;

// Totales — búsqueda global para capturar último valor
const RE_VALOR_PAGAR_SRC =
  /(?:VALOR\s+A\s+PAGAR|VALOR\s+TOTAL)\s*[:\-]?\s*\$?\s*([\d,\.]+)/i;

// Subtotal base 0% IVA (farmacia/exento) y subtotal genérico
const RE_SUBTOTAL_0 = /SUBTOTAL\s+0\s*%\s*[:\-]?\s*\$?\s*([\d,\.]+)/i;
const RE_SUBTOTAL = /\bSUBTOTAL\b\s*[:\-]?\s*\$?\s*([\d,\.]+)/i;

// IVA: acepta "IVA 15%:", "IVA 12%:", "IVA15%:" etc.
const RE_IVA = /\bIVA\s*[\d,\.]+\s*%\s*[:\-]?\s*\$?\s*([\d,\.]+)/i;

// Clave de acceso: 49 dígitos contiguos
const RE_CLAVE = /\b(\d{49})\b/;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convierte string con posible coma decimal a número. */
function parseNum(s: string): number | null {
  if (!s) return null;
  // "60.08" → 60.08  |  "60,08" → 60.08  |  "1.234,56" → 1234.56
  let clean = s.trim().replace(/\s/g, "");
  // Si hay coma Y punto, el punto es separador de miles y la coma es decimal
  if (clean.includes(",") && clean.includes(".")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (clean.includes(",")) {
    // Solo coma: ¿decimal o miles?
    const parts = clean.split(",");
    if (parts[parts.length - 1].length === 2) {
      // "60,08" → decimal
      clean = clean.replace(",", ".");
    } else {
      // "1,234" → miles, ignorar
      clean = clean.replace(",", "");
    }
  }
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

/** Normaliza DD/MM/YYYY → YYYY-MM-DD. */
function isoDate(d: string, m: string, y: string): string {
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// ─── Razón social ─────────────────────────────────────────────────────────────

/** Palabras que indican que una línea es dirección, no nombre de empresa. */
const ADDR_TOKENS =
  /\b(CALLE|AV\.|AVDA|KM\b|LOCAL|PISO|OFIC|URB\.|BARRIO|PARROQUIA|CANTON|CIUDAD|SUCURSAL|VENTA\s+POR|PUNT[OA]\s+(DE\s+)?(VENTA|FISICO)|MOSTRADOR|PLAZA|MALL|CENTRO\s+COMERC)\b/i;

/**
 * Extrae la razón social buscando en las líneas anteriores al RUC.
 * Heurística: primera línea corta (3–60 chars) sin tokens de dirección ni dígitos iniciales.
 */
function extractRazonSocial(lines: string[], rucLineIdx: number): string | null {
  const ventana = lines.slice(Math.max(0, rucLineIdx - 8), rucLineIdx);

  // Candidatos: sin dirección, sin número inicial, sin @, sin URL
  const candidatos = ventana.filter(
    (l) =>
      l.length >= 3 &&
      l.length <= 70 &&
      !ADDR_TOKENS.test(l) &&
      !/^\d/.test(l) &&
      !l.includes("@") &&
      !/https?:\/\//i.test(l),
  );

  // Preferir línea que sea mayúsculas y letras (nombre de empresa estilo SRI)
  const empresa = candidatos.find((c) => /^[A-ZÁÉÍÓÚÑÜ\s\.&,'"()\-\/]{3,60}$/.test(c));
  return empresa ?? candidatos[candidatos.length - 1] ?? null;
}

// ─── Categoría por tipo de negocio ───────────────────────────────────────────

function inferCategoria(razonSocial: string | null, texto: string): string | null {
  const t = `${razonSocial ?? ""} ${texto}`;
  if (/farmacia|pharmacy|drogueria|botica|medicamento|clinica|hospital|salud/i.test(t))
    return "Salud";
  if (/restaurant|restaurante|cafeteria|comida|alimentos|panaderia|cevicheria|marisqueria/i.test(t))
    return "Alimentación";
  if (/supermercado|supermaxi|tia\b|aki\b|megamaxi|coral|gran\s+aki/i.test(t))
    return "Alimentación";
  if (/hotel|hostal|hospedaje|motel|apart/i.test(t)) return "Hospedaje";
  if (/combustible|gasolina|petroleo|diesel|estaci[oó]n\s+de\s+servicio/i.test(t))
    return "Combustible";
  if (/taxi|uber|cabify|transporte|bus\b|peaje|cooperativa/i.test(t)) return "Transporte";
  if (/telefon|celular|internet|claro\b|movistar|cnt\b|telecomunicac/i.test(t))
    return "Telecomunicaciones";
  if (/papeler[ií]a|impresi[oó]n|copias|librer[ií]a|officemax|kywi/i.test(t))
    return "Papelería";
  if (/consultor[ií]a|asesor[ií]a|servicio\s+de|consultora/i.test(t)) return "Servicios";
  return null;
}

// ─── Parser principal ─────────────────────────────────────────────────────────

/**
 * Parsea el texto OCR de un comprobante Ecuador y retorna los campos
 * estructurados con una puntuación de confianza.
 *
 * @param texto Texto completo extraído por OCR (Tesseract u otro).
 * @returns `SriParseResult` con los campos encontrados y confianza 0–100.
 */
export function parseSriReceipt(texto: string): SriParseResult {
  const lines = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let confianza = 0;

  // ─── 1. RUC del emisor ──────────────────────────────────────────────────
  let ruc: string | null = null;
  let rucLineIdx = -1;

  const rucLabelMatch = RE_RUC_LABELED.exec(texto);
  if (rucLabelMatch) {
    ruc = rucLabelMatch[1];
    // Encontrar línea del RUC para buscar razón social
    rucLineIdx = lines.findIndex((l) => l.includes(ruc!));
    confianza += 30;
  } else {
    // Sin etiqueta: buscar primer número de 13 dígitos en las primeras líneas
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const m = RE_RUC_STANDALONE.exec(lines[i]);
      if (m) {
        ruc = m[1];
        rucLineIdx = i;
        confianza += 15; // Menos confianza sin etiqueta explícita
        break;
      }
    }
  }

  // ─── 2. Razón social ────────────────────────────────────────────────────
  let razonSocial: string | null = null;
  if (rucLineIdx >= 0) {
    razonSocial = extractRazonSocial(lines, rucLineIdx);
  } else {
    // Fallback: primera línea no vacía que no sea número
    razonSocial = lines.find((l) => l.length > 3 && !/^\d/.test(l)) ?? null;
  }
  if (razonSocial) confianza += 5;

  // ─── 3. Número de factura ───────────────────────────────────────────────
  let numeroFactura: string | null = null;
  const facturaMatch = RE_FACTURA.exec(texto);
  if (facturaMatch) {
    numeroFactura = `${facturaMatch[1]}-${facturaMatch[2]}-${facturaMatch[3]}`;
    confianza += 25;
  }

  // ─── 4. Fecha ───────────────────────────────────────────────────────────
  let fecha: string | null = null;
  const fechaMatch = RE_FECHA.exec(texto);
  if (fechaMatch) {
    const [, d, m, y] = fechaMatch;
    // Validar que sea fecha real (día 1–31, mes 1–12)
    if (parseInt(d) <= 31 && parseInt(m) <= 12 && parseInt(y) >= 2000) {
      fecha = isoDate(d, m, y);
      confianza += 15;
    }
  }

  // ─── 5. Valor total ─────────────────────────────────────────────────────
  let total: number | null = null;
  const allTotalMatches = [...texto.matchAll(new RegExp(RE_VALOR_PAGAR_SRC.source, "gi"))];
  if (allTotalMatches.length > 0) {
    // Tomar el ÚLTIMO match (el valor final, no subtotales intermedios)
    const lastMatch = allTotalMatches[allTotalMatches.length - 1];
    total = parseNum(lastMatch[1]);
    if (total !== null) confianza += 25;
  }

  // ─── 6. Subtotal ────────────────────────────────────────────────────────
  let subtotal: number | null = null;
  const sub0Match = RE_SUBTOTAL_0.exec(texto);
  if (sub0Match) {
    subtotal = parseNum(sub0Match[1]);
  } else {
    const subMatch = RE_SUBTOTAL.exec(texto);
    if (subMatch) subtotal = parseNum(subMatch[1]);
  }

  // ─── 7. IVA ─────────────────────────────────────────────────────────────
  let iva: number | null = null;
  const ivaMatch = RE_IVA.exec(texto);
  if (ivaMatch) {
    const ivaVal = parseNum(ivaMatch[1]);
    // Ignorar si el IVA es 0 (comprobante exento), guardarlo como null
    if (ivaVal !== null && ivaVal > 0) iva = ivaVal;
  }

  // ─── 8. Clave de acceso ─────────────────────────────────────────────────
  let claveAcceso: string | null = null;
  // OCR puede insertar espacios — removerlos para buscar la secuencia
  const textoSinEspacios = texto.replace(/\s/g, "");
  const claveMatch = RE_CLAVE.exec(textoSinEspacios);
  if (claveMatch) claveAcceso = claveMatch[1];

  // ─── 9. Ítems (descripciones de productos) ──────────────────────────────
  const items: string[] = [];
  const descIdx = lines.findIndex((l) => /descripci[oó]n/i.test(l));
  const totalIdx = lines.findIndex((l) => /valor\s+(bruto|total|a\s+pagar)/i.test(l));
  if (descIdx >= 0 && totalIdx > descIdx + 1) {
    for (let i = descIdx + 2; i < totalIdx; i++) {
      const l = lines[i];
      // Líneas de producto: tienen texto, no son solo dígitos ni separadores
      if (
        l.length > 4 &&
        !/^[\-=*]+$/.test(l) &&
        !/^[\d\s,\.]+$/.test(l) &&
        !/^(IVA|SUBTOTAL|TOTAL|VALOR|CANT|LAB|P\.V\.P)/i.test(l)
      ) {
        items.push(l);
      }
    }
  }

  // ─── 10. Categoría inferida ─────────────────────────────────────────────
  const categoriaInferida = inferCategoria(razonSocial, texto);

  return {
    ruc,
    razonSocial,
    numeroFactura,
    fecha,
    total,
    subtotal,
    iva,
    moneda: "USD",
    claveAcceso,
    items,
    categoriaInferida,
    confianza: Math.min(100, confianza),
  };
}
