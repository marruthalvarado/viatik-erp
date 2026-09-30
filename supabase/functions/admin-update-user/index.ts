/**
 * admin-update-user — Supabase Edge Function
 *
 * Actualiza datos de un usuario: email (en Auth), nombre y/o cargo (en perfil público).
 *
 * Request body:
 *   { usuario_id: string, empresa_id: string, email?: string, nombre?: string, cargo?: string }
 *
 * Response:
 *   { ok: true }
 *
 * Errores:
 *   401 — sin sesión
 *   403 — caller no es admin
 *   400 — campos faltantes o email ya en uso
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
  let body: { usuario_id: string; empresa_id: string; email?: string; nombre?: string; cargo?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const { usuario_id, empresa_id, email, nombre, cargo } = body;
  if (!usuario_id || !empresa_id) {
    return json({ error: "Faltan campos: usuario_id, empresa_id" }, 400);
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

  // Actualizar email en Auth si se proporcionó
  if (email) {
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      usuario_id,
      { email },
    );
    if (authUpdateError) {
      // El error más común es que el email ya esté en uso
      return json({ error: authUpdateError.message }, 400);
    }
  }

  // Actualizar perfil público si se proporcionó nombre o cargo
  // NOTA: public.usuarios NO tiene columna email — el email solo vive en auth.users
  const perfilUpdate: Record<string, string> = {};
  if (nombre) perfilUpdate.nombres = nombre;
  if (cargo !== undefined) perfilUpdate.cargo = cargo;

  if (Object.keys(perfilUpdate).length > 0) {
    const { error: perfilError } = await supabaseAdmin
      .from("usuarios")
      .update(perfilUpdate)
      .eq("id", usuario_id);

    if (perfilError) {
      return json({ error: `Error al actualizar perfil: ${perfilError.message}` }, 500);
    }
  }

  return json({ ok: true });
});
