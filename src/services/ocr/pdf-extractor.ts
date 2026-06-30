/**
 * pdf-extractor.ts — IA-4
 *
 * Extrae texto de PDFs enviándolos como base64 a la Edge Function,
 * donde OpenAI Vision (GPT-4o) los lee directamente con comprensión de layout.
 *
 * Ventajas sobre PDF.js + Tesseract:
 *   - Lee PDFs escaneados (imágenes dentro del PDF)
 *   - Comprende tablas y estructura visual
 *   - No requiere WASM ni workers adicionales
 *
 * Límite: 20 MB (mismo que el upload general).
 */

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
  if (
    bytes[0] !== 0x25 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x44 ||
    bytes[3] !== 0x46
  ) {
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
