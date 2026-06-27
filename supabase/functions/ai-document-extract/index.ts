/**
 * ai-document-extract — Supabase Edge Function — IA-3
 *
 * Proxy seguro entre el frontend y la API de OpenAI.
 * La API key NUNCA sale del servidor (Supabase Secret: OPENAI_API_KEY).
 *
 * Requisito de seguridad:
 *   - Frontend → esta Edge Function → OpenAI
 *   - `OPENAI_API_KEY` se configura como secret: `supabase secrets set OPENAI_API_KEY=sk-...`
 *   - El frontend solo usa el JWT de Supabase (no necesita la API key de OpenAI)
 *
 * Request body: { text: string, context?: ExtractionContext }
 * Response:     ExpenseExtraction (JSON)
 *
 * Errores manejados:
 *   - 401: No autenticado
 *   - 400: Texto vacío o demasiado corto
 *   - 502: Error de OpenAI (se reenvía el detalle)
 *   - 429: Rate limit de OpenAI
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const MIN_TEXT_LENGTH = 20;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

// ─── Prompt del sistema ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un asistente especializado en extracción de datos de documentos financieros (facturas, recibos, notas de crédito) para un sistema ERP de gestión de gastos corporativos.

Dado el texto extraído por OCR de un documento, extrae la información y devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta:

{
  "proveedor": "Nombre del emisor/proveedor o null",
  "ruc": "RUC, NIF, CUIT u otro número fiscal del emisor, o null",
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
  let body: { text?: unknown; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < MIN_TEXT_LENGTH) {
    return json({ error: `Texto demasiado corto (mínimo ${MIN_TEXT_LENGTH} chars)` }, 400);
  }

  // 3. Construir mensaje al usuario con contexto opcional
  const userLines: string[] = [`Texto OCR:\n---\n${text}\n---`];
  if (body.context && typeof body.context === "object") {
    const ctx = body.context as Record<string, unknown>;
    if (typeof ctx["pais"] === "string") userLines.push(`País: ${ctx["pais"]}`);
    if (typeof ctx["monedaPredeterminada"] === "string")
      userLines.push(`Moneda habitual: ${ctx["monedaPredeterminada"]}`);
    if (Array.isArray(ctx["categoriasDisponibles"]))
      userLines.push(
        `Categorías disponibles: ${(ctx["categoriasDisponibles"] as string[]).join(", ")}`,
      );
    if (typeof ctx["nombreArchivo"] === "string")
      userLines.push(`Archivo: ${ctx["nombreArchivo"]}`);
  }

  // 4. Llamar a OpenAI
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return json({ error: "OPENAI_API_KEY no configurada en el servidor" }, 500);
  }

  let openAiRes: Response;
  try {
    openAiRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userLines.join("\n") },
        ],
        temperature: 0.1,
        max_tokens: 800,
      }),
    });
  } catch (err) {
    return json({ error: `Error de red hacia OpenAI: ${String(err)}` }, 502);
  }

  const openAiData = await openAiRes.json();

  if (!openAiRes.ok) {
    const status = openAiRes.status === 429 ? 429 : 502;
    return json({ error: openAiData?.error?.message ?? "Error de OpenAI" }, status);
  }

  const rawJson: string = openAiData?.choices?.[0]?.message?.content ?? "{}";

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return json({ error: "OpenAI devolvió JSON inválido", raw: rawJson }, 502);
  }

  return new Response(JSON.stringify(parsed), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
