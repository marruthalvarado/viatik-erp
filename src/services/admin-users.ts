/**
 * admin-users.ts
 * Servicio para operaciones administrativas de usuarios.
 * Las operaciones que requieren service_role se delegan a Edge Functions.
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

export interface EliminarUsuarioResult {
  ok: boolean;
  /** true = borrado completamente de auth + perfil; false = solo removido de esta empresa */
  full_delete: boolean;
}

/**
 * Elimina un usuario de la empresa llamando a la Edge Function admin-delete-user.
 * Si el usuario no tiene datos asociados ni otras membresías, se borra completamente.
 */
export async function eliminarUsuario(
  usuario_id: string,
  empresa_id: string,
): Promise<EliminarUsuarioResult> {
  const { data, error } = await supabase.functions.invoke<EliminarUsuarioResult>(
    "admin-delete-user",
    { body: { usuario_id, empresa_id } },
  );

  if (error) {
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
