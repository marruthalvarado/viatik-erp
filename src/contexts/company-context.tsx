import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import type { Tables } from "@/types/database";

const STORAGE_KEY = "viatik.empresa_activa_id";

export type EmpresaOpcion = Pick<Tables<"empresas">, "id" | "nombre" | "codigo" | "logo_url">;

export interface RolActivo {
  id: string;
  codigo: string;
  nombre: string;
  modulos_permitidos: string[] | null;
}

interface CompanyContextValue {
  empresas: EmpresaOpcion[];
  empresaActiva: EmpresaOpcion | null;
  empresaActivaId: string | null;
  /** Rol del usuario en la empresa activa. null = cargando o sin rol. */
  rolActivo: RolActivo | null;
  loading: boolean;
  error: Error | null;
  setEmpresaActiva: (id: string | null) => void;
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [empresas, setEmpresas] = useState<EmpresaOpcion[]>([]);
  const [empresaActivaId, setActivaId] = useState<string | null>(null);
  const [rolesMap, setRolesMap] = useState<Record<string, RolActivo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const setEmpresaActiva = useCallback((id: string | null) => {
    setActivaId(id);
    if (typeof window === "undefined") return;
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const fetchEmpresas = useCallback(async () => {
    if (!user) {
      setEmpresas([]);
      setActivaId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Lee las empresas activas del usuario usando un join explícito a empresas.
    // La cláusula .eq("usuario_id", user.id) garantiza que incluso sin RLS
    // configurado se filtran solo las filas del usuario autenticado.
    // RLS en empresas_usuarios (eu_select_own) refuerza esto a nivel BD.
    const { data, error: err } = await supabase
      .from("empresas_usuarios")
      .select(
        "empresa_id, activo, " +
          "empresa:empresas(id, nombre, codigo, logo_url, deleted_at), " +
          "rol:roles(id, codigo, nombre, modulos_permitidos)",
      )
      .eq("usuario_id", user.id)
      .eq("activo", true);

    if (err) {
      setError(new Error(err.message));
      setEmpresas([]);
      setLoading(false);
      return;
    }

    const rows: EmpresaOpcion[] = [];
    const newRolesMap: Record<string, RolActivo> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (data as any[]) ?? []) {
      const raw = r.empresa as unknown;
      const e = (Array.isArray(raw) ? raw[0] : raw) as
        (EmpresaOpcion & { deleted_at: string | null }) | null;
      if (!e || e.deleted_at) continue;
      rows.push({ id: e.id, nombre: e.nombre, codigo: e.codigo, logo_url: e.logo_url });

      const rawRol = r.rol as unknown;
      const rol = (Array.isArray(rawRol) ? rawRol[0] : rawRol) as RolActivo | null;
      if (rol) newRolesMap[e.id] = rol;
    }
    setRolesMap(newRolesMap);

    setEmpresas(rows);

    // Restaurar empresa activa desde localStorage o auto-seleccionar la primera.
    // Se usa setActivaId directamente para no alterar localStorage cuando la
    // empresa almacenada sigue siendo válida (evita el loop id→null→id).
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const valid = stored ? rows.find((e) => e.id === stored) : undefined;

    if (valid) {
      setActivaId(valid.id);
    } else if (rows.length > 0) {
      setEmpresaActiva(rows[0].id);
    } else {
      setActivaId(null);
    }

    setLoading(false);
  }, [user, setEmpresaActiva]);

  useEffect(() => {
    if (authLoading) return;
    void fetchEmpresas();
  }, [authLoading, fetchEmpresas]);

  const value = useMemo<CompanyContextValue>(() => {
    const activa = empresas.find((e) => e.id === empresaActivaId) ?? null;
    const rolActivo = empresaActivaId ? (rolesMap[empresaActivaId] ?? null) : null;
    return {
      empresas,
      empresaActiva: activa,
      empresaActivaId,
      rolActivo,
      loading: authLoading || loading,
      error,
      setEmpresaActiva,
      refresh: fetchEmpresas,
    };
  }, [
    empresas,
    empresaActivaId,
    rolesMap,
    authLoading,
    loading,
    error,
    setEmpresaActiva,
    fetchEmpresas,
  ]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany debe usarse dentro de <CompanyProvider>");
  return ctx;
}
