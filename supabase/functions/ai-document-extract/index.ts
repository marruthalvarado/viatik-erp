/**
 * ai-document-extract — Supabase Edge Function — IA-3/IA-4
 *
 * Proxy seguro entre el frontend y la API de OpenAI.
 * La API key NUNCA sale del servidor (Supabase Secret: OPENAI_API_KEY).
 *
 * Modos de operación:
 *   1. Texto (imágenes OCR, XML): body.text → OpenAI Chat Completions
 *   2. PDF base64:  body.fileBase64 + body.mimeType → OpenAI Vision (GPT-4o)
 *
 * Request body:
 *   { text: string, context?: ExtractionContext }
 *   { fileBase64: string, mimeType: "application/pdf", context?: ExtractionContext }
 *
 * Response: ExpenseExtraction (JSON)
 *
 * Errores manejados:
 *   - 401: No autenticado
 *   - 400: Payload vacío o inválido
 *   - 502: Error de OpenAI
 *   - 429: Rate limit de OpenAI
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o";          // gpt-4o soporta visión + PDFs
const MODEL_TEXT = "gpt-4o-mini"; // para texto puro (más barato)
const MIN_TEXT_LENGTH = 20;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

// ─── Prompt del sistema ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un asistente especializado en extracción de datos de documentos financieros (facturas, recibos, notas de crédito) para un sistema ERP de gestión de gastos corporativos.

Dado el documento proporcionado (texto OCR, XML o imagen/PDF), extrae la información y devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta:

{
  "proveedor": "Nombre del emisor/proveedor o null",
  "ruc": "RUC, NIF, CUIT, RFC u otro número fiscal del emisor, o null",
  "numero_factura": "Número de factura, recibo o comprobante, o null",
  "fecha": "Fecha en formato YYYY-MM-DD o null si no se puede determinar",
  "moneda": "Código ISO 4217 (USD, PEN, EUR, COP, ARS, MXN, CLP...) o null",
  "subtotal": número_decimal o null,
  "iva": número_decimal o null,
  "total": número_decimal o null,
  "categorias_sugeridas": ["array de categorías ordenadas por relevancia"],
  "confianza": número_entero_0_a_100,
  "observaciones": "Notas relevantes sobre el documento o null",
  "inconsistencias": ["array de inconsistencias detectadas, vacío si no hay"]
}

Categorías válidas: Alimentación, Transporte, Alojamiento, Combustible, Peajes, Material de Oficina, Telecomunicaciones, Representación, Misceláneos

Reglas:
- Usar null para campos ausentes, nunca strings vacíos
- Fechas en formato YYYY-MM-DD
- Números con punto decimal
- Confianza: 80-100 datos completos, 50-79 parciales, 0-49 ilegibles
- Responder SOLO con JSON válido, sin markdown`;

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido" }, 405);
  }

  // 1. Validar autenticación
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "No autenticado" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return json({ error: "Token inválido o expirado" }, 401);
  }

  // 2. Leer body
  let body: {
    text?: unknown;
    fileBase64?: unknown;
    mimeType?: unknown;
    context?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return json({ error: "OPENAI_API_KEY no configurada en el servidor" }, 500);
  }

  // ─── Modo 1: Texto (imágenes OCR o XML) ───────────────────────────────────
  if (typeof body.text === "string") {
    const text = body.text.trim();
    if (text.length < MIN_TEXT_LENGTH) {
      return json({ error: `Texto demasiado corto (mínimo ${MIN_TEXT_LENGTH} chars)` }, 400);
    }

    const userLines: string[] = [`Texto del documento:\n---\n${text}\n---`];
    appendContext(userLines, body.context);

    return await callOpenAI(apiKey, MODEL_TEXT, [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userLines.join("\n") },
    ]);
  }

  // ─── Modo 2: PDF en base64 ─────────────────────────────────────────────────
  if (typeof body.fileBase64 === "string" && body.mimeType === "application/pdf") {
    const base64 = body.fileBase64;
    if (!base64 || base64.length < 100) {
      return json({ error: "PDF base64 vacío o inválido" }, 400);
    }

    const contextLines: string[] = [];
    appendContext(contextLines, body.context);
    const contextText = contextLines.length ? "\n" + contextLines.join("\n") : "";

    // GPT-4o acepta PDFs como image_url con data URI
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extrae los datos de esta factura/documento.${contextText}`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:application/pdf;base64,${base64}`,
              detail: "high",
            },
          },
        ],
      },
    ];

    return await callOpenAI(apiKey, MODEL, messages);
  }

  return json({ error: "Body debe contener 'text' o 'fileBase64' + 'mimeType'" }, 400);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function appendContext(lines: string[], context: unknown): void {
  if (!context || typeof context !== "object") return;
  const ctx = context as Record<string, unknown>;
  if (typeof ctx["pais"] === "string") lines.push(`País: ${ctx["pais"]}`);
  if (typeof ctx["monedaPre