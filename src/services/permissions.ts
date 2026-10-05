/**
 * permissions.ts
 * Toda la lógica de permisos del workflow centralizada aquí.
 * Los componentes UI nunca contienen lógica de permisos — solo consumen
 * los resultados de estas funciones a través de hooks.
 */

import { supabase } from "@/integrations/supabase/client";

export interface RolUsuarioEnEmpresa {
  rol_id: string;
  rol_codigo: string;
  rol_nombre: string;
}

/**
 * Obtiene TODOS los roles del usuario en la empresa activa.
 * Un usuario puede tener múltiples filas en empresas_usuarios (ej. Financiero + Aprobador).
 */
export async function getRolesUsuarioEnEmpresa(
  usuarioId: string,
  empresaId: string,
): Promise<RolUsuarioEnEmpresa[]> {
  const { data, error } = await supabase
    .from("empresas_usuarios")
    .select("rol_id, roles(id, codigo, nombre)")
    .eq("usuario_id", usuarioId)
    .eq("empresa_id", empresaId)
    .eq("activo", true);

  if (error || !data) return [];

  return data
    .map((row) => {
      const rol = row.roles as unknown as { id: string; codigo: string; nombre: string } | null;
      if (!rol) return null;
      return { rol_id: row.rol_id, rol_codigo: rol.codigo, rol_nombre: rol.nombre };
    })
    .filter(Boolean) as RolUsuarioEnEmpresa[];
}

/**
 * Obtiene el primer rol del usuario en la empresa activa (compatibilidad).
 * Prefer getRolesUsuarioEnEmpresa cuando se necesita verificar múltiples roles.
 */
export async function getRolUsuarioEnEmpresa(
  usuarioId: string,
  empresaId: string,
): Promise<RolUsuarioEnEmpresa | null> {
  const roles = await getRolesUsuarioEnEmpresa(usuarioId, empresaId);
  return roles[0] ?? null;
}

/**
 * Determina si el usuario puede enviar una rendición a aprobación.
 * Reglas:
 *  - La rendición debe estar en estado 'borrador' o 'devuelta'.
 *  - El usuario debe ser el propietario (usuario_id) de la rendición.
 *  - Debe existir un workflow activo en la empresa.
 */
export function canEnviarAprobacion(params: {
  estadoCodigo: string | null | undefined;
  rendicionUsuarioId: string | null | undefined;
  usuarioActualId: string | null | undefined;
  tieneWorkflowActivo: boolean;
}): boolean {
  const { estadoCodigo, rendicionUsuarioId, usuarioActualId, tieneWorkflowActivo } = params;
  if (!tieneWorkflowActivo) return false;
  if (rendicionUsuarioId !== usuarioActualId) return false;
  return estadoCodigo === "borrador" || estadoCodigo === "devuelta";
}

/**
 * Determina si el usuario puede aprobar/rechazar/devolver el paso actual.
 * Reglas:
 *  - La rendición debe estar en estado 'enviada' o 'en_revision'.
 *  - Al menos uno de los roles del usuario debe coincidir con workflow_pasos.rol_id del paso.
 *  - El usuario no puede aprobar su propia rendición.
 *
 * Acepta usuarioRolIds como array (soporta usuarios con múltiples roles).
 * Para compatibilidad también acepta usuarioRolId (string) — deprecated.
 */
export function canActuarEnPaso(params: {
  estadoCodigo: string | null | undefined;
  pasoRolId: string | null | undefined;
  usuarioRolIds?: string[];
  /** @deprecated Usar usuarioRolIds (array). Mantenido para compatibilidad. */
  usuarioRolId?: string | null | undefined;
  rendicionUsuarioId: string | null | undefined;
  usuarioActualId: string | null | undefined;
}): boolean {
  const { estadoCodigo, pasoRolId, rendicionUsuarioId, usuarioActualId } = params;
  if (!estadoCodigo || !pasoRolId) return false;
  if (!["enviada", "en_revision"].includes(estadoCodigo)) return false;

  // Soporte multi-rol: verificar si alguno de los roles del usuario coincide
  const rolIds = params.usuarioRolIds ?? (params.usuarioRolId ? [params.usuarioRolId] : []);
  if (rolIds.length === 0) return false;
  if (!rolIds.includes(pasoRolId)) return false;

  // No puede aprobar su propia rendición
  if (rendicionUsuarioId === usuarioActualId) return false;
  return true;
}

/**
 * Determina si el usuario puede agregar comentarios a una rendición.
 * Reglas: propietario o aprobador activo (cualquier estado excepto borrador).
 */
export function canAgregarComentario(params: {
  estadoCodigo: string | null | undefined;
  rendicionUsuarioId: string | null | undefined;
  usuarioActualId: string | null | undefined;
  esAprobadorEnEmpresa: boolean;
}): boolean {
  const { estadoCodigo, rendicionUsuarioId, usuarioActualId, esAprobadorEnEmpresa } = params;
  if (!estadoCodigo || estadoCodigo === "borrador") return false;
  if (rendicionUsuarioId === usuarioActualId) return true;
  return esAprobadorEnEmpresa;
}
