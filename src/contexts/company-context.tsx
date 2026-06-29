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
const LOG = (...args: unknown[]) => console.log("[CompanyCtx]", ...args);

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
    if (id === null) {
      LOG("⚠️  setEmpresaActiva(null) invocado");
      console.trace("[CompanyCtx] setEmpresaActiva(null) — traza de llamada");
    } else {
      LOG("setEmpresaActiva →", id);
    }
    setActivaId(id);
    if (typeof window === "undefined") return;
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const fetchEmpresas = useCallback(async () => {
    LOG("fetchEmpresas — inicio | user:", user?.id ?? "null");

    if (!user) {
      LOG("⚠️  sin usuario → vaciando estado");
      setEmpresas([]);
      LOG("⚠️  setActivaId(null) — sin usuario");
      console.trace("[CompanyCtx] setActivaId(null) sin usuario");
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
      .select(`
        empresa_id,
        activo,
        empresa:empresas(
        id,
        nombre,
        codigo,
        logo_url,
        deleted_at
      )
    `)
    .eq("usuario_id", user.id)
    .eq("activo", true);

    // ── (1) Respuesta completa de Supabase ────────────────────────────────
    LOG("Supabase respuesta completa →", { data, err });

    if (err) {
      LOG("❌ error Supabase:", err.message, err);
      setError(new Error(err.message));
      setEmpresas([]);
      setLoading(false);
      return;
    }

    LOG(`Filas recibidas: ${(data ?? []).length}`);

    const rows: EmpresaOpcion[] = [];
    for (const r of data ?? []) {
      // ── (2) Contenido de cada r.empresa ──────────────────────────────
      LOG("  fila empresas_usuarios →", JSON.stringify(r));
      LOG("  r.empresa (raw) →", r.empresa);

      const raw = r.empresa as unknown;
      const e = (Array.isArray(raw) ? raw[0] : raw) as
        | (EmpresaOpcion & { deleted_at: string | null })
        | null;

      LOG("  e resuelto →", e);

      if (!e) { LOG("  ⛔ e es null/undefined — fila descartada"); continue; }
      if (e.deleted_at) { LOG("  ⛔ empresa con deleted_at =", e.deleted_at, "— descartada"); continue; }

      rows.push({ id: e.id, nombre: e.nombre, codigo: e.codigo, logo_url: e.logo_url });
      LOG("  ✅ empresa agregada a rows →", e.id, e.nombre);
    }

    // ── (3) Arreglo rows construido ───────────────────────────────────────
    LOG("rows final →", JSON.stringify(rows));

    setEmpresas(rows);

    // Restaurar empresa activa o auto-seleccionar primera
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;

    // ── (4) Valor de localStorage ─────────────────────────────────────────
    LOG("localStorage[STORAGE_KEY] →", stored);

    const valid = rows.find((e) => e.id === stored);

    // ── (5) Empresa encontrada antes de setEmpresaActiva ─────────────────
    LOG("empresa válida encontrada en rows →", valid ?? "ninguna");

    if (valid) {
      LOG("Restaurando empresa desde localStorage:", valid.id);
      setActivaId(valid.id);
    } else if (rows.length > 0) {
      LOG("Sin match en localStorage → auto-seleccionando primera:", rows[0].id);
      setEmpresaActiva(rows[0].id);
    } else {
      // ── (6) setActivaId(null) ─────────────────────────────────────────
      LOG("⚠️  rows vacío → setActivaId(null)");
      console.trace("[CompanyCtx] setActivaId(null) — rows vacío");
      setActivaId(null);
    }

    setLoading(false);
    LOG("fetchEmpresas — fin | rows.length:", rows.length);
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
