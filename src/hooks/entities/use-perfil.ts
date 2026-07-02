/**
 * Hooks para actualizar perfil de usuario (propio y admin).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useCompany } from "@/contexts/company-context";

export interface PerfilData {
  nombres: string;
  apellidos?: string;
  cargo?: string;
}

/** Usuario actualiza su propio perfil. */
export function useActualizarPerfilPropio() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { empresaActivaId } = useCompany();

  return useMutation({
    mutationFn: async (data: PerfilData) => {
      const { error } = await supabase.rpc("actualizar_perfil_propio", {
        p_nombres: data.nombres,
        p_apellidos: data.apellidos ?? null,
        p_cargo: data.cargo ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["empresa_usuarios", empresaActivaId] });
      void qc.invalidateQueries({ queryKey: ["perfil", user?.id] });
    },
  });
}

/** Admin actualiza perfil de cualquier miembro de la empresa. */
export function useAdminActualizarPerfil() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();

  return useMutation({
    mutationFn: async ({ usuarioId, data }: { usuarioId: string; data: PerfilData }) => {
      const { error } = await supabase.rpc("admin_actualizar_perfil_usuario", {
        p_usuario_id: usuarioId,
        p_nombres: data.nombres,
        p_apellidos: data.apellidos ?? null,
        p_cargo: data.cargo ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["empresa_usuarios", empresaActivaId] });
    },
  });
}
