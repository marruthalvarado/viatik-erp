/**
 * document-ai-provider.ts — IA-2
 *
 * Contrato de tipos e interfaz para el motor de interpretación inteligente.
 *
 * Toda implementación concreta (OpenAI, Claude, Gemini, Mistral, etc.)
 * debe implementar `DocumentAIProvider`. Los servicios y hooks NUNCA
 * referencian la clase concreta; solo esta interfaz y `activeDocumentAIProvider`.
 *
 * ─── Flujo de datos ────────────────────────────────────────────────────────
 * OCR (texto) → DocumentAIProvider.extractExpense() → ExpenseExtraction
 *                                                      ↓
 *                                            Propuesta al formulario
 *                                            (sin escritura en DB)
 */

// ─── Resultado estructurado ────────────────────────────────────────────────────

/**
 * Propuesta de gasto extraída por IA de un texto OCR.
 *
 * Todos los campos son opcionales: la IA devuelve lo que puede inferir.
 * El formulario usa esta propuesta como valor inicial editable por el usuario.
 * NUNCA se persiste directamente; el usuario confirma antes de guardar.
 */
export interface ExpenseExtraction {
  /** Nombre del proveedor/emisor del documento. */
  proveedor: string | null;
  /** RUC, NIF, CUIT u otro número fiscal del emisor. */
  ruc: string | null;
  /** Número de factura, recibo o nota. */
  numeroFactura: string | null;
  /** Fecha del documento en formato ISO 8601 (YYYY-MM-DD). */
  fecha: string | null;
  /** Código ISO 4217 de la moneda detectada (USD, PEN, EUR, COP…). */
  moneda: string | null;
  /** Subtotal antes de impuestos. */
  subtotal: number | null;
  /** Monto de IVA / IGV / VAT detectado. */
  iva: number | null;
  /** Total del documento. */
  total: number | null;
  /**
   * Categorías de gasto sugeridas ordenadas por relevancia.
   * Valores estándar del ERP:
   * Alimentación, Transporte, Alojamiento, Combustible, Peajes,
   * Material de Oficina, Telecomunicaciones, Representación, Misceláneos.
   */
  categoriasSugeridas: string[];
  /**
   * Nivel de confianza global de la extracción, 0-100.
   * Refleja calidad del OCR + completitud de los datos encontrados.
   */
  confianza: number;
  /** Observaciones adicionales relevantes (ej: tipo de documento, notas especiales). */
  observaciones: string | null;
  /**
   * Posibles inconsistencias detectadas.
   * Ej: ["Total no coincide con subtotal + IVA", "Fecha fuera de rango plausible"].
   */
  inconsistencias: string[];
}

// ─── Metadatos de contexto ────────────────────────────────────────────────────

/**
 * Contexto opcional que el llamador puede proveer para mejorar la extracción.
 * El proveedor puede usarlo o ignorarlo.
 */
export interface ExtractionContext {
  /** País de la empresa (ayuda a interpretar formatos fiscales y moneda). */
  pais?: string;
  /** Moneda habitual de la empresa (pista para resolver ambigüedades). */
  monedaPredeterminada?: string;
  /** Categorías disponibles en la empresa (limita las sugerencias al catálogo real). */
  categoriasDisponibles?: string[];
  /** Nombre de archivo original (da contexto adicional al modelo). */
  nombreArchivo?: string;
}

// ─── Interfaz del proveedor ───────────────────────────────────────────────────

/**
 * Contrato que toda implementación de IA debe cumplir.
 *
 * Invariantes:
 * - `extractExpense` NUNCA escribe en base de datos.
 * - `extractExpense` siempre retorna un `ExpenseExtraction` completo
 *   (campos desconocidos = null, inconsistencias vacías si no hay).
 * - Los errores se propagan como excepciones tipadas (`DocumentAIError`).
 */
export interface DocumentAIProvider {
  /** Identificador del proveedor para logs y auditoría. */
  readonly name: string;
  /** Modelo concreto utilizado (ej: "gpt-4o-mini", "claude-haiku-4-5"). */
  readonly model: string;

  /**
   * Extrae información estructurada de gasto desde texto OCR.
   *
   * @param text     Texto crudo extraído por OCR del documento.
   * @param context  Contexto opcional de la empresa/documento.
   * @returns        Propuesta estructurada de gasto.
   * @throws         `DocumentAIError` si el proveedor falla o devuelve formato inválido.
   */
  extractExpense(text: string, context?: ExtractionContext): Promise<ExpenseExtraction>;
}

// ─── Error tipado ─────────────────────────────────────────────────────────────

export type DocumentAIErrorCode =
  | "PROVIDER_ERROR" // Error de red / API del proveedor
  | "INVALID_RESPONSE" // El proveedor no devolvió JSON válido
  | "RATE_LIMIT" // Límite de solicitudes alcanzado
  | "AUTH_ERROR" // API key inválida o ausente
  | "TEXT_TOO_SHORT" // Texto OCR insuficiente para extraer datos
  | "UNKNOWN";

export class DocumentAIError extends Error {
  constructor(
    message: string,
    public readonly code: DocumentAIErrorCode,
    public readonly providerName?: string,
  ) {
    super(message);
    this.name = "DocumentAIError";
  }
}
