/**
 * use-admin-users.ts
 * Hooks para operaciones administrativas de usuarios.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/contexts/company-context";
import { crearUsuario, marcarClaveCambiada } from "@/services/admin-users";
import type { CrearUsuarioPayload } from "@/services/admin-users";

/**
 * Mutación para crear un usuario nuevo con clave temporal.
 * Invalida la lista de usuarios de la empresa al completar.
 */
export function useCrearUsuario() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();

  return useMutation({
    mutationFn: (payload: CrearUsuarioPayload) => crearUsuario(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["empresa_usuarios", empresaActivaId] });
    },
  });
}

/**
 * Mutación para que el usuario actual marque su clave como ya cambiada.
 * Se llama desde la ruta /cambiar-clave tras actualizar la contraseña.
 */
export function useMarcarClaveCambiada() {
  return useMutation({
    mutationFn: () => marcarClaveCambiada(),
  });
}
