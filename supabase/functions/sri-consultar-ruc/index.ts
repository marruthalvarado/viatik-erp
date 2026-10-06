/**
 * sri-consultar-ruc — Edge Function
 *
 * Consulta información de un contribuyente en el SRI por número de RUC o cédula.
 * Usa el endpoint público del SRI (no requiere autenticación).
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

// Endpoint público del SRI para consulta de contribuyentes
const SRI_RUC_URL =
  "https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumerRuc";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);

  let ruc: string;
  try {
    const body = await req.json();
    ruc = (body.ruc ?? "").trim();
  } catch {
    return json({ ok: false, error: "Body JSON inválido" }, 400);
  }

  if (!ruc || (ruc.length !== 10 && ruc.length !== 13)) {
    return json({ ok: false, error: "RUC o cédula debe tener 10 o 13 dígitos" }, 400);
  }

  try {
    const sriRes = await fetch(`${SRI_RUC_URL}?numeroRuc=${encodeURIComponent(ruc)}`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "VIATIQ-ERP/1.0",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!sriRes.ok) {
      return json({ ok: false, error: `SRI respondió con estado ${sriRes.status}` }, 502);
    }

    const data = await sriRes.json();

    // El SRI devuelve null cuando el RUC no existe
    if (!data) {
      return json({ ok: false, error: "RUC no encontrado en el SRI" }, 404);
    }

    // Extraer campos relevantes de la respuesta del SRI
    const razon_social: string =
      data.contribuyente?.razonSocial ??
      data.razonSocial ??
      "";

    const nombre_comercial: string =
      data.contribuyente?.nombreComercial ??
      data.nombreComercial ??
      razon_social;

    const estado: string =
      data.contribuyente?.estadoContribuyenteRuc ??
      data.estadoContribuyenteRuc ??
      data.estado ??
      "";

    const tipo_contribuyente: string =
      data.contribuyente?.tipoContribuyente ??
      data.tipoContribuyente ??
      "";

    // Construir dirección desde los campos disponibles
    const dir = data.contribuyente ?? data;
    const partesDireccion: string[] = [];
    if (dir.nombreProvinciaEstablecimiento) partesDireccion.push(dir.nombreProvinciaEstablecimiento);
    if (dir.nombreCantonEstablecimiento) partesDireccion.push(dir.nombreCantonEstablecimiento);
    if (dir.nombreParroquiaEstablecimiento) partesDireccion.push(dir.nombreParroquiaEstablecimiento);
    if (dir.calleEstablecimiento) partesDireccion.push(dir.calleEstablecimiento);
    if (dir.numeroEstablecimiento) partesDireccion.push(dir.numeroEstablecimiento);
    const direccion = partesDireccion.join(", ");

    return json({
      ok: true,
      datos: {
        ruc,
        razon_social,
        nombre_comercial,
        estado: estado.toUpperCase(),
        tipo_contribuyente,
        direccion,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timed out") || msg.includes("timeout")) {
      return json({ ok: false, error: "El SRI no respondió a tiempo. Intenta de nuevo." }, 504);
    }
    return json({ ok: false, error: `Error al consultar el SRI: ${msg}` }, 500);
  }
});
