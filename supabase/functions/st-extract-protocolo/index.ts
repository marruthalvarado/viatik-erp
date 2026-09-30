/**
 * st-extract-protocolo — Supabase Edge Function
 *
 * Recibe el texto extraído de un PDF de protocolo de mantenimiento
 * y utiliza GPT-4o-mini para estructurarlo en secciones + actividades,
 * traduciendo al español y mapeando al modelo de datos de VIATIQ.
 *
 * Request body: { text: string }
 * Response: { secciones: SeccionIA[] }
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

const SYSTEM_PROMPT = `Eres un experto en mantenimiento de equipos médicos de imagen.
Tu tarea es extraer y estructurar las actividades de mantenimiento preventivo desde el texto de un manual/checklist de servicio técnico.

REGLAS OBLIGATORIAS:
1. Traduce TODO al español, incluyendo títulos de secciones y descripciones de actividades.
2. Agrupa las actividades en secciones según su intervalo de mantenimiento.
3. Detecta el intervalo de cada sección (en meses): 6, 12, 24, 60 o null (null = aplica en cada visita).
4. Para manuales estilo "PM block" (como ECAM): el bloque "Basic Maintenance every 6 months" → intervalo_meses=6, "ev. 12 months" → 12, "24-Month" → 24, "60-Month" → 60, "Final Check" → null.
5. Para manuales estilo "columna M" (como SCINTRON): agrupa las actividades por valor de M. Cada grupo de actividades con M=6 forma una sección con intervalo_meses=6, las de M=12 otra sección, etc.
6. Clasifica cada actividad:
   - "check3": verificación visual o funcional (OK / No OK / N.A.) — la mayoría
   - "medicion": cuando menciona voltajes, valores numéricos con rangos tolerables, presión, temperatura
   - "texto": cuando pide anotaciones, comentarios o números de serie
   - "foto": raramente, si pide documentar visualmente
7. Marca es_critico=true para actividades de seguridad eléctrica, paros de emergencia, frenos, fusibles de alta tensión.
8. Incluye el número de paso original (ej: "2.1.3") en numero_paso.
9. No incluyas las filas de encabezado, firmas, ni información de la portada.
10. Si hay voltajes o rangos mencionados en la descripción (ej: "+5.15 V / -5.20 V"), ponlos como valor_min y valor_max usando el primer rango, y la unidad correspondiente.

RESPONDE ÚNICAMENTE con JSON válido, sin texto adicional, con esta estructura exacta:
{
  "secciones": [
    {
      "numero": 1,
      "titulo": "Mantenimiento Básico — cada 6 meses",
      "intervalo_meses": 6,
      "descripcion_frecuencia": "Cada 6 meses desde la instalación",
      "actividades": [
        {
          "numero_paso": "2.1.1",
          "descripcion": "Limpieza de polvo en detectores",
          "tipo_campo": "check3",
          "es_critico": false,
          "valor_min": null,
          "valor_max": null,
          "unidad": null,
          "referencia_proc": "1.1.1"
        }
      ]
    }
  ]
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY no configurada" }), {
        status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const text: string = body?.text ?? "";

    if (!text || text.trim().length < 50) {
      return new Response(JSON.stringify({ error: "Texto del PDF demasiado corto o vacío" }), {
        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Limitar texto a ~12k chars para no exceder tokens (los manuales suelen ser compactos)
    const truncated = text.slice(0, 12000);

    const openaiRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Extrae y estructura las actividades de mantenimiento del siguiente documento:\n\n${truncated}` },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(JSON.stringify({ error: `OpenAI error: ${openaiRes.status}`, detail: errText }), {
        status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const openaiData = await openaiRes.json();
    const content = openaiData.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
      status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
