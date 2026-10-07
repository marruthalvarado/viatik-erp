/**
 * sri-consultar-ruc — Edge Function
 *
 * Consulta información de un contribuyente en el SRI por número de RUC o cédula.
 * Prueba múltiples endpoints del SRI para cubrir todos los tipos de contribuyente.
 *
 * Request body (JSON):
 *   { ruc: string }
 *
 * Response:
 *   { ok: true, datos: { ruc, razon_social, nombre_comercial, estado, tipo_contribuyente, direccion } }
 *   { ok: false, error: string }
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

/** Intenta fetch con timeout; devuelve null en error de red/timeout */
async function tryFetch(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (compatible; VIATIQ-ERP/1.0)",
        "Referer": "https://srienlinea.sri.gob.ec/",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim() === "null" || text.trim() === "") return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Extrae datos normalizados desde cualquier forma que devuelva el SRI */
function extraerDatos(ruc: string, raw: unknown): {
  razon_social: string;
  nombre_comercial: string;
  estado: string;
  tipo_contribuyente: string;
  direccion: string;
} | null {
  if (!raw || typeof raw !== "object") return null;

  // El SRI puede devolver el objeto directamente o envuelto en .contribuyente
  const r = raw as Record<string, unknown>;
  const c = (r.contribuyente as Record<string, unknown> | undefined) ?? r;

  const razon_social =
    (c.razonSocial as string | undefined) ??
    (c.nombreRazonSocial as string | undefined) ??
    (r.razonSocial as string | undefined) ??
    "";

  if (!razon_social) return null; // objeto vacío / sin datos útiles

  const nombre_comercial =
    (c.nombreComercial as string | undefined) ??
    (r.nombreComercial as string | undefined) ??
    razon_social;

  const estado =
    (c.estadoContribuyenteRuc as string | undefined) ??
    (c.estadoRuc as string | undefined) ??
    (r.estadoContribuyenteRuc as string | undefined) ??
    (r.estado as string | undefined) ??
    "";

  const tipo_contribuyente =
    (c.tipoContribuyente as string | undefined) ??
    (r.tipoContribuyente as string | undefined) ??
    "";

  // Dirección: intentamos varios patrones de campos
  const partes: string[] = [];
  for (const campo of [
    "nombreProvinciaEstablecimiento", "provincia",
    "nombreCantonEstablecimiento", "canton",
    "nombreParroquiaEstablecimiento", "parroquia",
    "calleEstablecimiento", "calle", "direccionMatriz",
    "numeroEstablecimiento",
  ]) {
    const val = (c[campo] ?? r[campo]) as string | undefined;
    if (val && typeof val === "string") {
      partes.push(val);
      break; // tomar solo el primer campo de cada par
    }
  }
  // Construcción de dirección más completa
  const camposDireccion = [
    ["nombreProvinciaEstablecimiento", "provincia"],
    ["nombreCantonEstablecimiento", "canton"],
    ["nombreParroquiaEstablecimiento", "parroquia"],
    ["calleEstablecimiento", "calle", "direccionMatriz"],
    ["numeroEstablecimiento"],
  ];
  const partesDir: string[] = [];
  for (const grupo of camposDireccion) {
    for (const campo of grupo) {
      const val = (c[campo] ?? r[campo]) as string | undefined;
      if (val && typeof val === "string") {
        partesDir.push(val);
        break;
      }
    }
  }
  const direccion = partesDir.join(", ");

  return {
    razon_social,
    nombre_comercial,
    estado: estado.toUpperCase(),
    tipo_contribuyente,
    direccion,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);

  let ruc: string;
  try {
    const body = await req.json();
    ruc = (body.ruc ?? "").trim().replace(/\s/g, "");
  } catch {
    return json({ ok: false, error: "Body JSON inválido" }, 400);
  }

  if (!ruc || (ruc.length !== 10 && ruc.length !== 13)) {
    return json({ ok: false, error: "RUC o cédula debe tener 10 o 13 dígitos" }, 400);
  }

  // Lista de endpoints a intentar en orden
  const endpoints = [
    `${BASE}/ConsolidadoContribuyente/obtenerPorNumerRuc?numeroRuc=${ruc}`,
    `${BASE}/Persona/obtenerPorNumerRuc?numeroRuc=${ruc}`,
    `${BASE}/ConsolidadoContribuyente/obtenerPorNumeroRuc?numeroRuc=${ruc}`,
    `${BASE}/Ruc/obtenerPorNumeroRuc?numeroRuc=${ruc}`,
  ];

  for (const url of endpoints) {
    const raw = await tryFetch(url);

    if (!raw) continue; // null, vacío o error de red

    // El SRI a veces devuelve un array
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (!item) continue;

    const datos = extraerDatos(ruc, item);
    if (datos) {
      return json({ ok: true, datos: { ruc, ...datos } });
    }
  }

  return json({
    ok: false,
    error: "No se encontró información para este RUC en el SRI. Verifica que el número sea correcto.",
  }, 404);
});
