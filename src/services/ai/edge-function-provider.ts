/**
 * edge-function-provider.ts — IA-3
 *
 * Implementación `DocumentAIProvider` que delega la llamada a OpenAI
 * a través de la Supabase Edge Function `ai-document-extract`.
 *
 * Ventaja de seguridad: La API key de OpenAI NUNCA se expone en el bundle
 * del cliente. Solo vive como Supabase Secret en el servidor.
 *
 * Flujo:
 *   Frontend → supabase.functions.invoke('ai-document-extract') → Edge Function → OpenAI
 *
 * Para activar: en ai-service.ts, reemplazar OpenAIDocumentProvider por
 * EdgeFunctionDocumentProvider. El resto del código no cambia.
 *
 * Para deployar la Edge Function:
 *   supabase functions deploy ai-document-extract
 *   supabase secrets set OPENAI_API_KEY=sk-...
 */
import { supabase } from "@/integrations/supabase/client";
import {
  DocumentAIError,
  type DocumentAIProvider,
  type ExpenseExtraction,
  type ExtractionContext,
} from "./document-ai-provider";

// ─── Validación del response ──────────────────────────────────────────────────

interface RawEdgeExtraction {
  proveedor?: unknown;
  ruc?: unknown;
  numero_factura?: unknown;
  fecha?: unknown;
  moneda?: unknown;
  subtotal?: unknown;
  iva?: unknown;
  total?: unknown;
  categorias_sugeridas?: unknown;
  confianza?: unknown;
  observaciones?: unknown;
  inconsistencias?: unknown;
  error?: string;
}

function toStringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^\d.,-]/g, "").replace(",", "."));
    return isFinite(n) ? n : null;
  }
  return null;
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

function parseEdgeResponse(raw: RawEdgeExtraction): ExpenseExtraction {
  const confianzaRaw = toNumberOrNull(raw.confianza);
  return {
    proveedor: toStringOrNull(raw.proveedor),
    ruc: toStringOrNull(raw.ruc),
    numeroFactura: toStringOrNull(raw.numero_factura),
    fecha: toStringOrNull(raw.fecha),
    moneda: toStringOrNull(raw.moneda),
    subtotal: toNumberOrNull(raw.subtotal),
    iva: toNumberOrNull(raw.iva),
    total: toNumberOrNull(raw.total),
    categoriasSugeridas: toStringArray(raw.categorias_sugeridas),
    confianza: confianzaRaw !== null ? Math.max(0, Math.min(100, Math.round(confianzaRaw))) : 50,
    observaciones: toStringOrNull(raw.observaciones),
    inconsistencias: toStringArray(raw.inconsistencias),
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class EdgeFunctionDocumentProvider implements DocumentAIProvider {
  readonly name = "openai_via_edge";
  readonly model = "gpt-4o-mini";

  async extractExpense(text: string, context?: ExtractionContext): Promise<ExpenseExtraction> {
    if (text.trim().length < 20) {
      throw new DocumentAIError(
        `Texto OCR demasiado corto (${text.length} chars).`,
        "TEXT_TOO_SHORT",
        this.name,
      );
    }

    const { data, error } = await supabase.functions.invoke<RawEdgeExtraction>(
      "ai-document-extract",
      { body: { text, context } },
    );

    if (error) {
      const msg = error.message ?? "Error de red con la Edge Function";
      const code =
        msg.includes("401") || msg.includes("autenticad") ? "AUTH_ERROR" : "PROVIDER_ERROR";
      throw new DocumentAIError(`[Edge Function] ${msg}`, code, this.name);
    }

    if (!data) {
      throw new DocumentAIError(
        "La Edge Function no devolvió datos",
        "INVALID_RESPONSE",
        this.name,
      );
    }

    if (data.error) {
      const msg = data.error;
      if (msg.includes("429")) throw new DocumentAIError(msg, "RATE_LIMIT", this.name);
      if (msg.includes("401") || msg.includes("API key"))
        throw new DocumentAIError(msg, "AUTH_ERROR", this.name);
      throw new DocumentAIError(msg, "PROVIDER_ERROR", this.name);
    }

    return parseEdgeResponse(data);
  }

  async terminate(): Promise<void> {
    // No recursos que liberar
  }
}
