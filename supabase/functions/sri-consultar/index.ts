/**
 * sri-consultar — Edge Function
 *
 * Consulta el estado de autorización de un comprobante electrónico en el SRI.
 *
 * Request body (JSON):
 *   { empresa_id: string, clave_acceso: string }
 *
 * Response:
 *   { ok: true, estado, numero_autorizacion?, fecha_autorizacion?, mensajes? }
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

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

const SRI_AUTORIZACION = {
  pruebas: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline",
  produccion: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autorizado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !caller) return json({ error: "Sesión inválida" }, 401);

  let body: { empresa_id: string; clave_acceso: string };
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const { empresa_id, clave_acceso } = body;
  if (!empresa_id || !clave_acceso) return json({ error: "empresa_id y clave_acceso son obligatorios" }, 400);

  // Verificar membresía
  const { data: mem } = await supabase
    .from("empresas_usuarios")
    .select("id")
    .eq("empresa_id", empresa_id)
    .eq("usuario_id", caller.id)
    .maybeSingle();
  if (!mem) return json({ error: "Acceso denegado" }, 403);

  // Cargar config para saber el ambiente
  const { data: config } = await supabase
    .from("empresa_facturacion_config")
    .select("ambiente")
    .eq("empresa_id", empresa_id)
    .maybeSingle();
  const ambiente = (config?.ambiente ?? "pruebas") as "pruebas" | "produccion";
  const url = SRI_AUTORIZACION[ambiente];

  // Consultar SRI
  const soapEnv = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:autorizacionComprobante>
      <claveAccesoComprobante>${clave_acceso}</claveAccesoComprobante>
    </ec:autorizacionComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

  let estado = "DESCONOCIDO";
  let numeroAutorizacion = "";
  let fechaAutorizacion = "";
  let mensajes = "";

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": "" },
      body: soapEnv,
    });
    const text = await resp.text();

    estado = text.match(/<estado>([^<]+)<\/estado>/)?.[1] ?? "DESCONOCIDO";
    numeroAutorizacion = text.match(/<numeroAutorizacion>([^<]+)<\/numeroAutorizacion>/)?.[1] ?? "";
    fechaAutorizacion = text.match(/<fechaAutorizacion>([^<]+)<\/fechaAutorizacion>/)?.[1] ?? "";
    const msgs = text.match(/<mensaje>([^<]*)<\/mensaje>/g) ?? [];
    mensajes = msgs.map((m) => m.replace(/<\/?mensaje>/g, "").trim()).filter(Boolean).join("; ");
  } catch (e) {
    return json({ error: `Error consultando SRI: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }

  // Actualizar comprobante en DB si fue autorizado
  if (estado === "AUTORIZADO") {
    await supabase
      .from("comprobantes_electronicos")
      .update({
        estado: "autorizado",
        numero_autorizacion: numeroAutorizacion || clave_acceso,
        fecha_autorizacion: fechaAutorizacion || new Date().toISOString(),
        mensaje_sri: mensajes || "Autorizado",
        updated_at: new Date().toISOString(),
      })
      .eq("clave_acceso", clave_acceso);
  }

  return json({
    ok: true,
    estado,
    numero_autorizacion: numeroAutorizacion,
    fecha_autorizacion: fechaAutorizacion,
    mensajes,
  });
});
