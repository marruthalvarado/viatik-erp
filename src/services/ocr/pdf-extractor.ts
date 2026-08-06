/**
 * pdf-extractor.ts — IA-4
 *
 * Dos modos:
 *   1. extractPdfTextLocal — extrae texto con PDF.js (CDN). Funciona offline,
 *      solo sirve para PDFs digitales con capa de texto.
 *   2. readPdfAsBase64 — convierte el PDF a base64 para enviarlo a la Edge
 *      Function (OpenAI Vision). Necesario para PDFs escaneados.
 *
 * Límite: 20 MB (mismo que el upload general).
 */

// ─── PDF.js CDN ───────────────────────────────────────────────────────────────

const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfjsLib = any;

async function loadPdfjs(): Promise<PdfjsLib> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  if (win.pdfjsLib?.getDocument) return win.pdfjsLib;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar pdf.js desde CDN"));
    document.head.appendChild(script);
  });
  const lib: PdfjsLib = win.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
  return lib;
}

/**
 * Extrae todo el texto de un PDF usando PDF.js (sin backend).
 * Retorna string vacío si el PDF es solo imágenes (escaneado).
 */
export async function extractPdfTextLocal(file: File): Promise<string> {
  const pdfjsLib = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageText = content.items.map((i: any) => i.str ?? "").join(" ");
    if (pageText.trim()) lines.push(pageText.trim());
  }
  return lines.join("\n");
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface PdfExtractionResult {
  /** Base64 del PDF para enviar al provider IA. */
  base64: string;
  /** MIME type para el API. */
  mimeType: "application/pdf";
  /** Tamaño del archivo en bytes. */
  size: number;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Lee un archivo PDF y retorna su contenido en base64.
 * El base64 se envía a la Edge Function, que lo pasa a OpenAI Vision.
 *
 * @throws Error si el archivo no es un PDF válido.
 */
export async function readPdfAsBase64(file: File): Promise<PdfExtractionResult> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("[pdf-extractor] El archivo no es un PDF.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Verificar magic bytes PDF (%PDF-)
  if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    throw new Error("[pdf-extractor] El archivo no tiene firma PDF válida.");
  }

  // Convertir a base64
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);

  return {
    base64,
    mimeType: "application/pdf",
    size: file.size,
  };
}
