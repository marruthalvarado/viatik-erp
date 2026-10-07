/**
 * importaciones-pdf-parser.ts
 * Extrae datos de la Liquidación Aduanera PDF del SENAE Ecuador.
 *
 * El PDF se carga vía CDN pdfjs-dist en runtime (igual que factura-pdf-parser.ts).
 * Campos extraídos:
 *   - numero_liquidacion  (ej. "51783166")
 *   - fecha               (ej. "2026-07-25")
 *   - arancel             (ARANCEL ADVALOREM, USD)
 *   - fodinfa             (FONDINFA, USD)
 *   - iva_importacion     (IVA, USD)
 *   - total_liquidado     (TOTAL, USD)
 */

export interface LiquidacionParsed {
  numero_liquidacion: string | null;
  fecha: string | null;         // ISO date YYYY-MM-DD
  arancel: number | null;
  fodinfa: number | null;
  iva_importacion: number | null;
  total_liquidado: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convierte "6.280" o "344.060" al número float (Ecuador usa "." como decimal) */
function parseEc(s: string): number {
  // Elimina espacios y caracteres raros
  const clean = s.trim().replace(/\s/g, "");
  // Si tiene más de un punto → separadores de miles (ej. "1.234.567,89")
  // pero en el PDF del SENAE el formato es simple: "361.730" = 361.73
  return parseFloat(clean) || 0;
}

/** Extrae el número que sigue a una etiqueta en el texto plano */
function extractAfterLabel(text: string, label: string): number | null {
  const rx = new RegExp(label + "[\\s\\S]{0,60}?(\\d+\\.\\d+)", "i");
  const m = text.match(rx);
  return m ? parseEc(m[1]) : null;
}

function extractStringAfterLabel(text: string, label: string): string | null {
  const rx = new RegExp(label + "[\\s:]*([\\w/\\-]+)", "i");
  const m = text.match(rx);
  return m ? m[1].trim() : null;
}

/** Convierte "25/07/2026" → "2026-07-25" */
function parseFechaEc(s: string): string | null {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// ── Carga dinámica de PDF.js (igual que factura-pdf-parser.ts) ─────────────

declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (opts: { data: ArrayBuffer }) => { promise: Promise<PDFDocProxy> };
    };
  }
}

interface PDFDocProxy {
  numPages: number;
  getPage(n: number): Promise<PDFPageProxy>;
}
interface PDFPageProxy {
  getTextContent(): Promise<{ items: Array<{ str: string }> }>;
}

async function loadPdfJs(): Promise<NonNullable<Window["pdfjsLib"]>> {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => res();
    s.onerror = () => rej(new Error("No se pudo cargar pdf.js"));
    document.head.appendChild(s);
  });
  const lib = window.pdfjsLib!;
  lib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return lib;
}

// ── Parser principal ──────────────────────────────────────────────────────────

export async function parseLiquidacionPdf(file: File): Promise<LiquidacionParsed> {
  const lib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const doc = await lib.getDocument({ data: buf }).promise;

  let fullText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((it) => it.str).join(" ") + "\n";
  }

  // ── Número de liquidación ────────────────────────────────────────────────
  let numero_liquidacion: string | null = null;
  const numM = fullText.match(/Numero\s+de\s+la\s+liquidacion\s+(\d+)/i);
  if (numM) numero_liquidacion = numM[1];

  // ── Fecha de liquidación ─────────────────────────────────────────────────
  let fecha: string | null = null;
  const fechaM = fullText.match(/Fecha\/Hora\s+de\s+liquidaci[oó]n\s+([\d/]+)/i);
  if (fechaM) fecha = parseFechaEc(fechaM[1]);
  // fallback: primera fecha del documento
  if (!fecha) {
    const fallM = fullText.match(/Fecha\s*:\s*([\d/]+)/i);
    if (fallM) fecha = parseFechaEc(fallM[1]);
  }

  // ── Valores numéricos ─────────────────────────────────────────────────────
  // El PDF lista: "ARANCEL ADVALOREM  0  6.280  6.280"
  // Tomamos la columna "Valor a Pagar" (3er número en la fila)
  const arancel      = extractAfterLabel(fullText, "ARANCEL ADVALOREM");
  const fodinfa      = extractAfterLabel(fullText, "FONDINFA");
  const iva_importacion = extractAfterLabel(fullText, "\\bIVA\\b");

  // TOTAL aparece como "TOTAL: ... 361.730 361.730"
  let total_liquidado: number | null = null;
  const totalM = fullText.match(/TOTAL[:\s]+[\d\s.]*?([\d]+\.[\d]+)\s+([\d]+\.[\d]+)/i);
  if (totalM) total_liquidado = parseEc(totalM[2]); // último valor
  if (!total_liquidado) {
    const t2 = fullText.match(/Valor\s+liquidado[\s\S]{0,40}?([\d]+\.[\d]+)/i);
    if (t2) total_liquidado = parseEc(t2[1]);
  }

  return {
    numero_liquidacion,
    fecha,
    arancel,
    fodinfa,
    iva_importacion,
    total_liquidado,
  };
}
