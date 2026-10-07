/**
 * sri-consultar-ruc — Edge Function
 *
 * Consulta información de un contribuyente en el SRI por número de RUC o cédula.
 * Prueba múltiples endpoints del SRI para cubrir todos los tipos de contribuyente.
 *
 * Request body (JSON):
 *   { ruc: string, debug?: boolean }
 *
 * Response:
 *   { ok: true, datos: { ruc, razon_social, nombre_comercial, estado, tipo_contribuyente, direccion } }
 *   { ok: false, error: string, intentos?: DebugIntento[] }  (debug=true expone intentos)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const BASE = "https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest";

interface FetchResult {
  url: string;
  status: number | null;
  body: string | null;
  parsed: unknown;
  error: string | null;
}

/** Intenta fetch con timeout; siempre retorna resultado (nunca lanza) */
async function tryFetch(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "es-EC,es;q=0.9",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://srienlinea.sri.gob.ec/",
        "Origin": "https://srienlinea.sri.gob.ec",
      },
      signal: AbortSignal.timeout(10000),
    });

    const body = await res.text();
    let parsed: unknown = null;
    if (body && body.trim() !== "null" && body.trim() !== "") {
      try { parsed = JSON.parse(body); } catch { /* no JSON */ }
    }

    return { url, status: res.status, body, parsed, error: null };
  } catch (e) {
    return { url, status: null, body: null, parsed: null, error: String(e) };
  }
}

/** Extrae datos normalizados desde cualquier forma que devuelva el SRI */
function extraerDatos(raw: unknown): {
  razon_social: string;
  nombre_comercial: string;
  estado: string;
  tipo_contribuyente: string;
  direccion: string;
} | null {
  if (!raw || typeof raw !== "object") return null;

  const r = raw as Record<string, unknown>;
  // El SRI puede envolver en .contribuyente
  const c = (r.contribuyente as Record<string, unknown> | undefined) ?? r;

  const razon_social =
    (c.razonSocial as string | undefined) ??
    (c.nombreRazonSocial as string | undefined) ??
    (r.razonSocial as string | undefined) ??
    (r.nombreRazonSocial as string | undefined) ??
    "";

  if (!razon_social) return null;

  const nombre_comercial =
    (c.nombreComercial as string | undefined) ??
    (r.nombreComercial as string | undefined) ??
    razon_social;

  const estado =
    (c.estadoContribuyenteRuc as string | undefined) ??
    (c.estadoRuc as string | undefined) ??
    (r.estadoContribuyenteRuc as string | undefined) ??
    (r.estadoRuc as string | undefined) ??
    (r.estado as string | undefined) ??
    "";

  const tipo_contribuyente =
    (c.tipoContribuyente as string | undefined) ??
    (r.tipoContribuyente as string | undefined) ??
    (r.tipo as string | undefined) ??
    "";

  const camposDireccion = [
    ["nombreProvinciaEstablecimiento", "provincia", "nombreProvincia"],
    ["nombreCantonEstablecimiento", "canton", "nombreCanton"],
    ["nombreParroquiaEstablecimiento", "parroquia", "nombreParroquia"],
    ["calleEstablecimiento", "calle", "direccionMatriz", "direccion"],
    ["numeroEstablecimiento", "numero"],
  ];
  const partesDir: string[] = [];
  for (const grupo of camposDireccion) {
    for (const campo of grupo) {
      const val = (c[campo] ?? r[campo]) as string | undefined;
      if (val && typeof val === "string" && val.trim()) {
        partesDir.push(val.trim());
        break;
      }
    }
  }

  return {
    razon_social,
    nombre_comercial,
    estado: estado.toUpperCase(),
    tipo_contribuyente,
    direccion: partesDir.join(", "),
  };
}

/** Extrae texto entre dos marcadores HTML (muy simple, sin DOM) */
function entre(html: string, antes: string, despues: string): string {
  const idx = html.indexOf(antes);
  if (idx === -1) return "";
  const start = idx + antes.length;
  const end = html.indexOf(despues, start);
  if (end === -1) return "";
  return html.slice(start, end).replace(/<[^>]+>/g, "").trim();
}

/**
 * Scraping del portal público HTML del SRI.
 * URL: https://srienlinea.sri.gob.ec/sri-en-linea/SriRucWeb/ConsultaRuc/Consultas/consultaRuc
 * Parámetro POST: nrRuc
 */
async function scrapearPortalSri(ruc: string): Promise<{
  razon_social: string;
  nombre_comercial: string;
  estado: string;
  tipo_contribuyente: string;
  direccion: string;
} | null> {
  const portales = [
    // Portal principal con POST
    {
      url: "https://srienlinea.sri.gob.ec/sri-en-linea/SriRucWeb/ConsultaRuc/Consultas/consultaRuc",
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://srienlinea.sri.gob.ec/sri-en-linea/SriRucWeb/ConsultaRuc/Consultas/consultaRuc",
          "Origin": "https://srienlinea.sri.gob.ec",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        body: `nrRuc=${ruc}`,
        signal: AbortSignal.timeout(12000),
      } as RequestInit,
    },
    // GET alternativo
    {
      url: `https://srienlinea.sri.gob.ec/sri-en-linea/SriRucWeb/ConsultaRuc/Consultas/consultaRuc?nrRuc=${ruc}`,
      init: {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Referer": "https://srienlinea.sri.gob.ec/",
        },
        signal: AbortSignal.timeout(12000),
      } as RequestInit,
    },
  ];

  for (const { url, init } of portales) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) continue;
      const html = await res.text();
      if (!html || html.length < 100) continue;

      // Buscar razón social en el HTML (distintos patrones del SRI)
      let razon_social =
        entre(html, "Razón Social</label>", "</") ||
        entre(html, "Razón social</label>", "</") ||
        entre(html, "razonSocial\">", "<") ||
        entre(html, "Nombre / Razón Social</td>", "</td>") ||
        entre(html, "id=\"razonSocial\"", "<").replace(/^[^>]*>/, "").trim() ||
        "";

      // Alternativa: buscar el patrón de nombre en tabla
      if (!razon_social) {
        const m = html.match(/Raz[oó]n\s*[Ss]ocial[^:]*:?\s*<\/[^>]+>\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9\s.,'-]+)/u);
        if (m) razon_social = m[1].trim();
      }

      if (!razon_social) continue;

      const estado =
        entre(html, "Estado contribuyente en el RUC</label>", "</") ||
        entre(html, "estadoContribuyente\">", "<") ||
        (html.includes("ACTIVO") ? "ACTIVO" : html.includes("SUSPENDIDO") ? "SUSPENDIDO" : "");

      const tipo_contribuyente =
        entre(html, "Tipo contribuyente</td>", "</td>") ||
        entre(html, "tipoContribuyente\">", "<") ||
        "";

      return {
        razon_social,
        nombre_comercial: razon_social,
        estado: estado.toUpperCase(),
        tipo_contribuyente,
        direccion: "",
      };
    } catch {
      continue;
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);

  let ruc: string;
  let debug = false;
  try {
    const body = await req.json();
    ruc = (body.ruc ?? "").trim().replace(/\s/g, "");
    debug = body.debug === true;
  } catch {
    return json({ ok: false, error: "Body JSON inválido" }, 400);
  }

  if (!ruc || (ruc.length !== 10 && ruc.length !== 13)) {
    return json({ ok: false, error: "RUC o cédula debe tener 10 o 13 dígitos" }, 400);
  }

  // RUC base de 10 dígitos (sin código de establecimiento)
  const ruc10 = ruc.length === 13 ? ruc.slice(0, 10) : ruc;

  // 1) Intentar REST API del catastro SRI
  const restUrls = [
    `${BASE}/ConsolidadoContribuyente/obtenerPorNumerRuc?numeroRuc=${ruc}`,
    `${BASE}/Persona/obtenerPorNumerRuc?numeroRuc=${ruc}`,
    `${BASE}/ConsolidadoContribuyente/obtenerPorNumeroRuc?numeroRuc=${ruc}`,
    `${BASE}/Ruc/obtenerPorNumeroRuc?numeroRuc=${ruc}`,
    ...(ruc !== ruc10 ? [
      `${BASE}/ConsolidadoContribuyente/obtenerPorNumerRuc?numeroRuc=${ruc10}`,
      `${BASE}/Persona/obtenerPorNumerRuc?numeroRuc=${ruc10}`,
    ] : []),
  ];

  const intentos: FetchResult[] = [];

  for (const url of restUrls) {
    const result = await tryFetch(url);
    intentos.push(result);
    if (result.parsed === null) continue;
    const item = Array.isArray(result.parsed) ? result.parsed[0] : result.parsed;
    if (!item) continue;
    const datos = extraerDatos(item);
    if (datos) return json({ ok: true, datos: { ruc, ...datos } });
  }

  // 2) Fallback: scraping del portal público HTML del SRI
  const htmlDatos = await scrapearPortalSri(ruc);
  if (htmlDatos) {
    return json({ ok: true, datos: { ruc, ...htmlDatos } });
  }

  // No encontrado — retornar diagnóstico si debug=true
  const errorResponse: Record<string, unknown> = {
    ok: false,
    error: "No se encontró información para este RUC en el SRI. Verifica que el número sea correcto.",
  };

  if (debug) {
    errorResponse.intentos = intentos.map((i) => ({
      url: i.url.replace(BASE, ""),
      status: i.status,
      bodySnippet: i.body ? i.body.slice(0, 500) : null,
      error: i.error,
    }));
  }

  return json(errorResponse, 200);
});
