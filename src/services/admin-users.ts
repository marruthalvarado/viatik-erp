/**
 * admin-users.ts
 * Servicio para operaciones administrativas de usuarios.
 * Las operaciones que requieren service_role se delegan a Edge Functions.
 */
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

/** Extrae el mensaje de error de una Edge Function. */
async function parseFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };
      if (body.error) return body.error;
    } catch {
      // fall through to generic message
    }
  }
  if (error instanceof Error) return error.message;
  return "Error desconocido";
}

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
    throw new Error(await parseFunctionError(error));
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
    throw new Error(await parseFunctionError(error));
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
