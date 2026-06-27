/**
 * ai-service.ts — IA-2
 *
 * Punto de entrada único al motor de IA de documentos.
 *
 * Responsabilidades:
 *   - Exponer `activeDocumentAIProvider` (singleton intercambiable)
 *   - Validar pre-condiciones antes de llamar al proveedor
 *   - Reintentar una vez ante errores de red transitorios
 *
 * Para cambiar de proveedor (OpenAI → Claude, Gemini, etc.):
 *   Reemplazar la asignación de `activeDocumentAIProvider`.
 *   Ningún otro archivo necesita cambiar.
 *
 * Arquitectura: Hook → ExpenseAIService → AiService → DocumentAIProvider → API IA
 */
import { OpenAIDocumentProvider } from "./openai-provider";
import {
  DocumentAIError,
  type DocumentAIProvider,
  type ExpenseExtraction,
  type ExtractionContext,
} from "./document-ai-provider";

// ─── Proveedor activo ─────────────────────────────────────────────────────────

/**
 * Instancia singleton del proveedor de IA activo.
 *
 * La inicialización es lazy: si VITE_OPENAI_API_KEY no está configurada,
 * el error se lanza al primer uso (no al importar el módulo).
 * Esto evita romper el bundle en entornos sin la variable configurada.
 */
let _provider: DocumentAIProvider | null = null;

function getProvider(): DocumentAIProvider {
  if (!_provider) {
    _provider = new OpenAIDocumentProvider();
  }
  return _provider;
}

/** Exportado para testing y para permitir inyección de proveedor alternativo. */
export function setDocumentAIProvider(provider: DocumentAIProvider): void {
  _provider = provider;
}

// ─── API pública ──────────────────────────────────────────────────────────────

export interface ExtractExpenseOptions {
  /** Contexto de empresa/documento para mejorar la extracción. */
  context?: ExtractionContext;
  /** Si true, reintenta una vez ante error de red transitorio. Default: true. */
  retry?: boolean;
}

/**
 * Extrae información estructurada de gasto desde texto OCR.
 *
 * @param text    Texto OCR del documento (mínimo 20 caracteres).
 * @param options Opciones opcionales de contexto y reintento.
 * @returns       Propuesta de gasto sin escritura en base de datos.
 * @throws        `DocumentAIError` tipado con código de error.
 */
export async function extractExpense(
  text: string,
  options: ExtractExpenseOptions = {},
): Promise<ExpenseExtraction> {
  const { context, retry = true } = options;
  const provider = getProvider();

  try {
    return await provider.extractExpense(text, context);
  } catch (err) {
    // Reintento único para errores de red (no para auth o texto corto)
    if (retry && err instanceof DocumentAIError && err.code === "PROVIDER_ERROR") {
      return await provider.extractExpense(text, context);
    }
    throw err;
  }
}

/**
 * Retorna el nombre y modelo del proveedor activo (para UI de auditoría).
 * No lanza errores aunque la API key no esté configurada.
 */
export function getProviderInfo(): { name: string; model: string } | null {
  try {
    const p = getProvider();
    return { name: p.name, model: p.model };
  } catch {
    return null;
  }
}
