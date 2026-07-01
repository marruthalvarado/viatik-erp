/**
 * use-empresa-usuarios.ts
 * Hooks para gestión de usuarios dentro de la empresa activa.
 * Usa la vista vw_empresa_usuarios y la RPC es_admin_empresa.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/company-context";
import { useAuth } from "@/contexts/auth-context";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface EmpresaUsuario {
  id: string;
  empresa_id: string;
  usuario_id: string;
  rol_id: string;
  activo: boolean | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  nombres: string;
  apellidos: string | null;
  cargo: string | null;
  estado: string | null;
  rol_codigo: string;
  rol_nombre: string;
}

// ─── Hook: ¿es admin? ────────────────────────────────────────────────────────

export function useEsAdmin() {
  const { empresaActivaId } = useCompany();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["es_admin", empresaActivaId, user?.id],
    queryFn: async () => {
      if (!empresaActivaId || !user?.id) return false;
      const { data, error } = await supabase.rpc("es_admin_empresa", {
        p_empresa_id: empresaActivaId,
      });
      if (error) return false;
      return data as boolean;
    },
    enabled: !!empresaActivaId && !!user?.id,
    staleTime: 60_000,
  });
}

// ─── Hook: listar usuarios de la empresa ────────────────────────────────────

export function useEmpresaUsuarios() {
  const { empresaActivaId } = useCompany();

  return useQuery({
    queryKey: ["empresa_usuarios", empresaActivaId],
    queryFn: async () => {
      if (!empresaActivaId) return [] as EmpresaUsuario[];
      const { data, error } = await supabase
        .from("vw_empresa_usuarios")
        .select("*")
        .eq("empresa_id", empresaActivaId)
        .order("nombres");
      if (error) throw error;
      return (data ?? []) as EmpresaUsuario[];
    },
    enabled: !!empresaActivaId,
  });
}

// ─── Hook: cambiar rol de un usuario ─────────────────────────────────────────

export function useCambiarRolUsuario() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();

  return useMutation({
    mutationFn: async ({ miembroId, rolId }: { miembroId: string; rolId: string }) => {
      const { error } = await supabase
        .from("empresas_usuarios")
        .update({ rol_id: rolId })
        .eq("id", miembroId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["empresa_usuarios", empresaActivaId] });
    },
  });
}

// ─── Hook: desactivar usuario de la empresa ──────────────────────────────────

export function useDesactivarUsuario() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();

  return useMutation({
    mutationFn: async (miembroId: string) => {
      const { error } = await supabase
        .from("empresas_usuarios")
        .update({ activo: false })
        .eq("id", miembroId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["empresa_usuarios", empresaActivaId] });
    },
  });
}

// ─── Hook: reactivar usuario ─────────────────────────────────────────────────

export function useReactivarUsuario() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();

  return useMutation({
    mutationFn: async (miembroId: string) => {
      const { error } = await supabase
        .from("empresas_usuarios")
        .update({ activo: true })
        .eq("id", miembroId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["empresa_usuarios", empresaActivaId] });
    },
  });
}
