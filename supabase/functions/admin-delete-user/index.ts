/**
 * admin-delete-user — Supabase Edge Function
 *
 * Elimina un usuario de la empresa. Si no tiene datos asociados ni otras
 * membresías, también elimina su cuenta de Supabase Auth.
 *
 * Request body:
 *   { usuario_id: string, empresa_id: string }
 *
 * Response:
 *   { ok: true, full_delete: boolean }
 *   full_delete = true  → usuario borrado completamente (auth + perfil + empresa)
 *   full_delete = false → solo removido de esta empresa (tenía datos asociados)
 *
 * Errores:
 *   401 — sin sesión
 *   403 — caller no es admin, o intenta eliminarse a sí mismo
 *   400 — campos faltantes
 *   500 — error interno
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

  // Leer body
  let body: { usuario_id: string; empresa_id: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const { usuario_id, empresa_id } = body;
  if (!usuario_id || !empresa_id) {
    return json({ error: "Faltan campos: usuario_id, empresa_id" }, 400);
  }

  // No puede eliminarse a sí mismo
  if (caller.id === usuario_id) {
    return json({ error: "No puedes eliminarte a ti mismo." }, 403);
  }

  // Verificar que el caller es admin de esa empresa
  const { data: euCaller } = await supabaseAdmin
    .from("empresas_usuarios")
    .select("roles!inner(codigo)")
    .eq("empresa_id", empresa_id)
    .eq("usuario_id", caller.id)
    .eq("activo", true)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((euCaller as any)?.roles?.codigo !== "admin") {
    return json({ error: "Sin permisos de administrador para esta empresa" }, 403);
  }

  // Remover de empresas_usuarios
  const { error: euError } = await supabaseAdmin
    .from("empresas_usuarios")
    .delete()
    .eq("empresa_id", empresa_id)
    .eq("usuario_id", usuario_id);

  if (euError) {
    return json({ error: `Error al remover de la empresa: ${euError.message}` }, 500);
  }

  // Verificar si el usuario tiene otras membresías en otras empresas
  const { count: otrasEmpresas } = await supabaseAdmin
    .from("empresas_usuarios")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", usuario_id);

  if ((otrasEmpresas ?? 0) > 0) {
    // Pertenece a otras empresas — solo lo removemos de esta
    return json({ ok: true, full_delete: false });
  }

  // Verificar si tiene datos asociados (rendiciones, gastos, viajes, documentos)
  const checks = await Promise.all([
    supabaseAdmin.from("rendiciones").select("id", { count: "exact", head: true }).eq("usuario_id", usuario_id),
    supabaseAdmin.from("gastos").select("id", { count: "exact", head: true }).eq("usuario_id", usuario_id),
    supabaseAdmin.from("viajes").select("id", { count: "exact", head: true }).eq("usuario_id", usuario_id),
  ]);

  const tieneDatos = checks.some((r) => (r.count ?? 0) > 0);

  if (tieneDatos) {
    // Tiene registros — solo lo removemos de la empresa, conservamos perfil
    return json({ ok: true, full_delete: false });
  }

  // Sin datos y sin otras empresas → eliminar completamente
  // 1. Borrar perfil público
  await supabaseAdmin.from("usuarios").delete().eq("id", usuario_id);

  // 2. Borrar de Supabase Auth
  const { error: authDelError } = await supabaseAdmin.auth.admin.deleteUser(usuario_id);
  if (authDelError) {
    return json({ error: `Error al eliminar cuenta: ${authDelError.message}` }, 500);
  }

  return json({ ok: true, full_delete: true });
});
