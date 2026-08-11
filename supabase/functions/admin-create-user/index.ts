/**
 * admin-create-user — Supabase Edge Function
 *
 * Crea un usuario nuevo en auth + public.usuarios + empresas_usuarios.
 * Requiere service_role para llamar a supabase.auth.admin.createUser().
 *
 * Request body:
 *   { email, password, nombres, apellidos?, empresa_id, rol_id }
 *
 * Response:
 *   { ok: true, usuario_id: string }
 *
 * Errores:
 *   401 — sin sesión o no autenticado
 *   403 — el caller no es admin de la empresa
 *   400 — campos faltantes o email ya registrado
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

  // Verificar sesión del caller usando el token JWT
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !caller) return json({ error: "Sesión inválida" }, 401);

  // Leer y validar body
  let body: {
    email: string;
    password: string;
    nombres: string;
    apellidos?: string;
    empresa_id: string;
    rol_id: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const { email, password, nombres, apellidos, empresa_id, rol_id } = body;
  if (!email || !password || !nombres || !empresa_id || !rol_id) {
    return json({ error: "Faltan campos requeridos: email, password, nombres, empresa_id, rol_id" }, 400);
  }

  // Verificar que el caller es admin de esa empresa
  const { data: euData } = await supabaseAdmin
    .from("empresas_usuarios")
    .select("roles!inner(codigo)")
    .eq("empresa_id", empresa_id)
    .eq("usuario_id", caller.id)
    .eq("activo", true)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rolCodigo = (euData as any)?.roles?.codigo;
  if (rolCodigo !== "admin") {
    return json({ error: "Sin permisos de administrador para esta empresa" }, 403);
  }

  // Crear usuario en Supabase Auth
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no requiere verificación por email
  });

  if (createError) {
    const msg = createError.message.includes("already been registered")
      ? "Ya existe un usuario con ese correo electrónico."
      : createError.message;
    return json({ error: msg }, 400);
  }

  const userId = newUser.user.id;

  // Upsert en public.usuarios — el trigger on_auth_user_created ya insertó la fila
  // con el prefijo del email como nombre; aquí la actualizamos con los datos reales.
  const { error: usuarioError } = await supabaseAdmin
    .from("usuarios")
    .upsert({
      id: userId,
      nombres,
      apellidos: apellidos?.trim() || null,
      debe_cambiar_clave: true,
    } as never, { onConflict: "id" });

  if (usuarioError) {
    // Revertir: eliminar usuario de auth
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return json({ error: `Error al crear perfil: ${usuarioError.message}` }, 500);
  }

  // Insertar en empresas_usuarios
  const { error: euError } = await supabaseAdmin
    .from("empresas_usuarios")
    .insert({
      empresa_id,
      usuario_id: userId,
      rol_id,
      activo: true,
    } as never);

  if (euError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return json({ error: `Error al vincular usuario a empresa: ${euError.message}` }, 500);
  }

  return json({ ok: true, usuario_id: userId });
});
