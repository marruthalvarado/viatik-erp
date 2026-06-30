/**
 * edge-function-provider.ts — IA-3/IA-4
 *
 * Implementacion DocumentAIProvider que delega a la Supabase Edge Function
 * ai-document-extract. La API key de OpenAI NUNCA se expone en el cliente.
 *
 * Modos:
 *   - extractExpense(text)          → texto OCR / XML → gpt-4o-mini
 *   - extractExpenseFromPdf(base64) → PDF base64 → gpt-4o (vision)
 */
import { supabase } from "@/integrations/supabase/client";
import {
  DocumentAIError,
  type DocumentAIProvider,
  type ExpenseExtraction,
  type ExtractionContext,
} from "./document-ai-provider";

// ─── Validacion del response ──────────────────────────────────────────────────

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
    return this._invokeEdge({ text, context });
  }

  /**
   * Envia un PDF como base64 a la Edge Function para que OpenAI Vision lo lea.
   */
  async extractExpenseFromPdf(
    fileBase64: string,
    context?: ExtractionContext,
  ): Promise<ExpenseExtraction> {
    if (!fileBase64 || fileBase64.length < 100) {
      throw new DocumentAIError("PDF base64 vacio o invalido.", "TEXT_TOO_SHORT", this.name);
    }
    return this._invokeEdge({ fileBase64, mimeType: "application/pdf", context });
  }

  private async _invokeEdge(body: Record<string, unknown>): Promise<ExpenseExtraction> {
    const { data, error } = await supabase.functions.invoke<RawEdgeExtraction>(
      "ai-document-extract",
      { body },
    );

    if (error) {
      const msg = error.message ?? "Error de red con la Edge Function";
      const code =
        msg.includes("401") || msg.includes("autenticad") ? "AUTH_ERROR" : "PROVIDER_ERROR";
      throw new DocumentAIError(`[Edge Function] ${msg}`, code, this.name);
    }

    if (!data) {
      throw new DocumentAIError(
        "La Edge Function no devolvio datos",
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
