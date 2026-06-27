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

interface CompanyContextValue {
  empresas: EmpresaOpcion[];
  empresaActiva: EmpresaOpcion | null;
  empresaActivaId: string | null;
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

    // Lee empresas a las que pertenece el usuario vía empresas_usuarios.
    // RLS restringe filas; el join trae los datos de la empresa.
    const { data, error: err } = await supabase
      .from("empresas_usuarios")
      .select("empresa_id, activo, empresa:empresas(id, nombre, codigo, logo_url, deleted_at)")
      .eq("usuario_id", user.id)
      .eq("activo", true);

    if (err) {
      setError(new Error(err.message));
      setEmpresas([]);
      setLoading(false);
      return;
    }

    const rows: EmpresaOpcion[] = [];
    for (const r of data ?? []) {
      const raw = r.empresa as unknown;
      const e = (Array.isArray(raw) ? raw[0] : raw) as
        | (EmpresaOpcion & { deleted_at: string | null })
        | null;
      if (!e || e.deleted_at) continue;
      rows.push({ id: e.id, nombre: e.nombre, codigo: e.codigo, logo_url: e.logo_url });
    }

    setEmpresas(rows);

    // Restaurar empresa activa o auto-seleccionar primera
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const valid = rows.find((e) => e.id === stored);
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
    return {
      empresas,
      empresaActiva: activa,
      empresaActivaId,
      loading: authLoading || loading,
      error,
      setEmpresaActiva,
      refresh: fetchEmpresas,
    };
  }, [empresas, empresaActivaId, authLoading, loading, error, setEmpresaActiva, fetchEmpresas]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany debe usarse dentro de <CompanyProvider>");
  return ctx;
}
