/**
 * sri-consultar-ruc — Edge Function
 *
 * Consulta información de un contribuyente en el SRI por número de RUC o cédula.
 * Usa el endpoint oficial: ConsultaRuc/obtenerPorNumerosRuc (el mismo que usa la app Angular del SRI).
 *
 * Request body (JSON):
 *   { ruc: string, debug?: boolean }
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

const HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "es-EC,es;q=0.9",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": "https://srienlinea.sri.gob.ec/",
  "Origin": "https://srienlinea.sri.gob.ec",
};

interface Contribuyente {
  numeroRuc?: string;
  razonSocial?: string;
  estadoContribuyenteRuc?: string;
  tipoContribuyente?: string;
  regimen?: string;
  actividadEconomicaPrincipal?: string;
  obligadoLlevarContabilidad?: string;
  agenteRetencion?: string;
  contribuyenteEspecial?: string;
  contribuyenteFantasma?: string;
  informacionFechasContribuyente?: {
    fechaInicioActividades?: string;
    fechaCese?: string;
    fechaActualizacion?: string;
  };
  representantesLegales?: Array<{ identificacion?: string; nombre?: string }>;
}

interface ConsultaRucResponse {
  contribuyentes?: Contribuyente[];
}

/** Llama a ConsultaRuc/obtenerPorNumerosRuc — el endpoint que usa la app Angular del SRI */
async function consultarPorNumerosRuc(ruc: string): Promise<Contribuyente | null> {
  const url = `${BASE}/ConsultaRuc/obtenerPorNumerosRuc?&ruc=${ruc}`;
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const data = await res.json() as ConsultaRucResponse;
    return data?.contribuyentes?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Fallback: endpoints legacy del catastro (ConsolidadoContribuyente, Persona, Ruc) */
async function consultarEndpointsLegacy(ruc: string): Promise<Contribuyente | null> {
  const ruc10 = ruc.length === 13 ? ruc.slice(0, 10) : ruc;

  const urls = [
    `${BASE}/ConsolidadoContribuyente/obtenerPorNumerRuc?numeroRuc=${ruc}`,
    `${BASE}/Persona/obtenerPorNumerRuc?numeroRuc=${ruc}`,
    `${BASE}/ConsolidadoContribuyente/obtenerPorNumeroRuc?numeroRuc=${ruc}`,
    `${BASE}/Ruc/obtenerPorNumeroRuc?numeroRuc=${ruc}`,
    ...(ruc !== ruc10 ? [
      `${BASE}/ConsolidadoContribuyente/obtenerPorNumerRuc?numeroRuc=${ruc10}`,
      `${BASE}/Persona/obtenerPorNumerRuc?numeroRuc=${ruc10}`,
    ] : []),
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const raw = await res.json();
      const item = Array.isArray(raw) ? raw[0] : raw;
      if (!item) continue;

      // Normalizar campos de distintos formatos de respuesta
      const c = (item.contribuyente as Record<string, unknown> | undefined) ?? item as Record<string, unknown>;
      const razonSocial =
        (c.razonSocial as string | undefined) ??
        (c.nombreRazonSocial as string | undefined) ?? "";
      if (!razonSocial) continue;

      return {
        razonSocial,
        estadoContribuyenteRuc:
          (c.estadoContribuyenteRuc as string | undefined) ??
          (c.estadoRuc as string | undefined) ?? "",
        tipoContribuyente: (c.tipoContribuyente as string | undefined) ?? "",
      };
    } catch {
      continue;
    }
  }
  return null;
}

function formatearDatos(ruc: string, c: Contribuyente) {
  return {
    ruc,
    razon_social: c.razonSocial ?? "",
    nombre_comercial: c.razonSocial ?? "",
    estado: (c.estadoContribuyenteRuc ?? "").toUpperCase(),
    tipo_contribuyente: c.tipoContribuyente ?? "",
    direccion: "",
    actividad: c.actividadEconomicaPrincipal ?? "",
    regimen: c.regimen ?? "",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" });

  let ruc: string;
  try {
    const body = await req.json();
    ruc = (body.ruc ?? "").trim().replace(/\s/g, "");
  } catch {
    return json({ ok: false, error: "Body JSON inválido" });
  }

  if (!ruc || (ruc.length !== 10 && ruc.length !== 13)) {
    return json({ ok: false, error: "RUC o cédula debe tener 10 o 13 dígitos" });
  }

  // 1) Endpoint principal: ConsultaRuc/obtenerPorNumerosRuc (el que usa la app Angular del SRI)
  const contribuyente = await consultarPorNumerosRuc(ruc);
  if (contribuyente?.razonSocial) {
    return json({ ok: true, datos: formatearDatos(ruc, contribuyente) });
  }

  // 2) Fallback: endpoints legacy
  const legacy = await consultarEndpointsLegacy(ruc);
  if (legacy?.razonSocial) {
    return json({ ok: true, datos: formatearDatos(ruc, legacy) });
  }

  return json({
    ok: false,
    error: "No se encontró información para este RUC en el SRI. Verifica que el número sea correcto.",
  });
});
