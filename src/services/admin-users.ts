/**
 * admin-users.ts
 * Servicio para operaciones administrativas de usuarios.
 * Las operaciones que requieren service_role se delegan a la Edge Function admin-create-user.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CrearUsuarioPayload {
  email: string;
  password: string;
  nombres: string;
  apellidos?: string;
  empresa_id: string;
  rol_id: string;
}

export interface CrearUsuarioResult {
  ok: boolean;
  usuario_id: string;
}

/**
 * Crea un usuario nuevo llamando a la Edge Function admin-create-user.
 * Requiere que el caller sea admin de la empresa indicada.
 */
export async function crearUsuario(payload: CrearUsuarioPayload): Promise<CrearUsuarioResult> {
  const { data, error } = await supabase.functions.invoke<CrearUsuarioResult>(
    "admin-create-user",
    { body: payload },
  );

  if (error) {
    // La Edge Function devuelve { error: string } en el body cuando falla.
    // supabase.functions.invoke lanza FunctionsHttpError cuando el status >= 400.
    // Intentamos parsear el mensaje del contexto.
    const msg = (error as { context?: Response }).context
      ? await (error as { context: Response }).context
          .json()
          .then((j: { error?: string }) => j.error ?? error.message)
          .catch(() => error.message)
      : error.message;
    throw new Error(msg);
  }

  if (!data?.ok) throw new Error("Respuesta inesperada del servidor");
  return data;
}

/**
 * Marca la clave del usuario actual como ya cambiada.
 * Llama a la RPC marcar_clave_cambiada() que usa SECURITY DEFINER.
 */
export async function marcarClaveCambiada(): Promise<void> {
  const { error } = await supabase.rpc("marcar_clave_cambiada");
  if (error) throw new Error(error.message);
}
