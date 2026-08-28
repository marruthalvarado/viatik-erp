/**
 * sri-upload-cert — Edge Function
 *
 * Sube el certificado .p12 de firma electrónica a storage privado
 * y guarda la configuración de facturación de la empresa.
 *
 * Request: multipart/form-data
 *   - cert (File): el archivo .p12
 *   - clave (string): contraseña del .p12
 *   - empresa_id (string): UUID de la empresa
 *   - ruc, razon_social, dir_matriz, establecimiento, punto_emision,
 *     nombre_comercial?, dir_establecimiento?, obligado_contabilidad?,
 *     contribuyente_especial?, ambiente?
 *
 * Response: { ok: true, cert_vigencia: string | null }
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
// @ts-ignore — npm compat
import forge from "npm:node-forge@1.3.1";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autorizado" }, 401);

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Verificar sesión del caller
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !caller) return json({ error: "Sesión inválida" }, 401);

  // Parsear multipart
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json({ error: "Se esperaba multipart/form-data" }, 400);
  }

  const empresa_id = formData.get("empresa_id") as string;
  const clave = formData.get("clave") as string;
  const certFile = formData.get("cert") as File | null;
  const ruc = formData.get("ruc") as string;
  const razon_social = formData.get("razon_social") as string;
  const dir_matriz = formData.get("dir_matriz") as string;
  const establecimiento = (formData.get("establecimiento") as string) || "001";
  const punto_emision = (formData.get("punto_emision") as string) || "001";
  const nombre_comercial = formData.get("nombre_comercial") as string | null;
  const dir_establecimiento = formData.get("dir_establecimiento") as string | null;
  const obligado_contabilidad = formData.get("obligado_contabilidad") !== "false";
  const contribuyente_especial = formData.get("contribuyente_especial") as string | null;
  const ambiente = (formData.get("ambiente") as string) || "pruebas";

  if (!empresa_id || !ruc || !razon_social || !dir_matriz) {
    return json({ error: "Faltan campos obligatorios: empresa_id, ruc, razon_social, dir_matriz" }, 400);
  }

  // Verificar que el caller es miembro de la empresa
  const { data: membership } = await supabaseAdmin
    .from("empresas_usuarios")
    .select("id")
    .eq("empresa_id", empresa_id)
    .eq("usuario_id", caller.id)
    .maybeSingle();
  if (!membership) return json({ error: "No eres miembro de esta empresa" }, 403);

  let cert_storage_path: string | null = null;
  let cert_vigencia: string | null = null;

  // Si viene un certificado, validarlo y subirlo
  if (certFile && certFile.size > 0) {
    if (!clave) return json({ error: "La clave del certificado es obligatoria" }, 400);

    const certBytes = await certFile.arrayBuffer();
    const certBuffer = new Uint8Array(certBytes);

    // Validar el .p12 con node-forge
    try {
      const p12Der = forge.util.binary.raw.encode(certBuffer);
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, clave);

      // Extraer fecha de vigencia del certificado
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const bag = certBags[forge.pki.oids.certBag]?.[0];
      if (bag?.cert) {
        const notAfter = bag.cert.validity.notAfter;
        cert_vigencia = notAfter.toISOString().split("T")[0];
      }
    } catch {
      return json({ error: "El certificado .p12 no es válido o la clave es incorrecta" }, 400);
    }

    // Subir a storage
    const path = `${empresa_id}/firma.p12`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("certificados-sri")
      .upload(path, certBuffer, {
        contentType: "application/x-pkcs12",
        upsert: true,
      });
    if (upErr) return json({ error: `Error subiendo certificado: ${upErr.message}` }, 500);
    cert_storage_path = path;
  }

  // Upsert configuración
  const configPayload: Record<string, unknown> = {
    empresa_id,
    ruc,
    razon_social,
    nombre_comercial: nombre_comercial || null,
    dir_matriz,
    dir_establecimiento: dir_establecimiento || null,
    obligado_contabilidad,
    contribuyente_especial: contribuyente_especial || null,
    ambiente,
    establecimiento,
    punto_emision,
    updated_at: new Date().toISOString(),
  };
  if (cert_storage_path) {
    configPayload.cert_storage_path = cert_storage_path;
    configPayload.cert_clave = clave;
    configPayload.cert_vigencia = cert_vigencia;
  }

  const { error: upsertErr } = await supabaseAdmin
    .from("empresa_facturacion_config")
    .upsert(configPayload, { onConflict: "empresa_id" });

  if (upsertErr) return json({ error: `Error guardando config: ${upsertErr.message}` }, 500);

  return json({ ok: true, cert_vigencia });
});
