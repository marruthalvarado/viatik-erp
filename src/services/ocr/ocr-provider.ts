/**
 * ocr-provider.ts — IA-1
 *
 * Interfaz `IOcrProvider` + implementación `TesseractOcrProvider`.
 *
 * Diseño para intercambiabilidad:
 *   - Cambiar de proveedor = pasar un `IOcrProvider` diferente a `OcrService`.
 *   - Los componentes y hooks nunca conocen el proveedor concreto.
 *
 * Proveedor implementado: Tesseract.js v5 (client-side WASM)
 *   Razón:     Gratuito, sin API key, funciona offline, swappable.
 *   Precisión: ~80% en facturas limpias, ~60% en fotos de baja calidad.
 *   Costo:     $0.
 *   Límites:   No procesa PDFs directamente; requiere canvas. Ver OcrService.
 *   Tamaño:    ~10 MB WASM (carga lazy en primer uso).
 *
 * Alternativas documentadas (para producción):
 *   - GoogleVisionProvider:  ~95% precisión, $1.50/1000 imgs, requiere backend.
 *   - AwsTextractProvider:   ~93% precisión, $1.50/1000 imgs, requiere backend.
 *   - AzureComputerVision:   ~92% precisión, $1.00/1000 imgs, requiere backend.
 */
import { createWorker } from "tesseract.js";

// ─── Tipos compartidos ────────────────────────────────────────────────────────

/** Resultado normalizado de cualquier proveedor OCR. */
export interface OcrResult {
  /** Texto extraído completo. */
  textoCompleto: string;
  /** Confianza promedio 0–100. */
  confianza: number;
  /** Identificador del proveedor (para auditoría). */
  proveedor: string;
  /** Payload JSON raw del proveedor (para debugging o IA futura). */
  jsonRaw: Record<string, unknown>;
  /** Tiempo de procesamiento en ms. */
  tiempoMs: number;
}

/** Tipos de archivo que el proveedor puede recibir. */
export type OcrInput = File | Blob | HTMLCanvasElement;

/** Interfaz que todo proveedor OCR debe implementar. */
export interface IOcrProvider {
  /** Nombre del proveedor (se guarda en `ocr_proveedor`). */
  readonly name: string;
  /** Extrae texto de un archivo de imagen. NO soporta PDF directamente. */
  extractText(input: OcrInput): Promise<OcrResult>;
  /** Libera recursos (worker threads, etc.). */
  terminate(): Promise<void>;
}

// ─── Tesseract.js Provider ────────────────────────────────────────────────────

/**
 * Implementación con Tesseract.js v5.
 *
 * Carga lazy: el worker WASM se inicializa en el primer uso.
 * Soporta: image/jpeg, image/png, image/bmp, image/webp.
 * No soporta: application/pdf (ver OcrService para el manejo de PDFs).
 *
 * Idiomas incluidos: español (spa) + inglés (eng).
 * Los language packs se descargan desde CDN en el primer uso (~4 MB).
 */
export class TesseractOcrProvider implements IOcrProvider {
  readonly name = "tesseract_5";

  private worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  private initPromise: Promise<void> | null = null;

  private async init(): Promise<void> {
    if (this.worker) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.worker = await createWorker(["spa", "eng"], 1, {
        // Logger desactivado en producción; activar en dev si se necesita debug
        logger: () => undefined,
      });
    })();

    return this.initPromise;
  }

  async extractText(input: OcrInput): Promise<OcrResult> {
    const t0 = Date.now();
    await this.init();

    if (!this.worker) {
      throw new Error("[TesseractOcrProvider] Worker no inicializado");
    }

    const { data } = await this.worker.recognize(input);

    const confianza = Math.round(data.confidence);
    const tiempoMs = Date.now() - t0;

    return {
      textoCompleto: data.text.trim(),
      confianza,
      proveedor: this.name,
      jsonRaw: {
        confidence: data.confidence,
        words: data.words.map((w) => ({ text: w.text, confidence: w.confidence })),
        lines: data.lines.map((l) => ({ text: l.text, confidence: l.confidence })),
      },
      tiempoMs,
    };
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initPromise = null;
    }
  }
}

// ─── Singleton exportado ──────────────────────────────────────────────────────

/**
 * Instancia singleton del proveedor activo.
 * Para cambiar de proveedor: reemplazar esta exportación en un único lugar.
 * Los hooks y servicios importan `activeOcrProvider`, nunca la clase concreta.
 */
export const activeOcrProvider: IOcrProvider = new TesseractOcrProvider();
