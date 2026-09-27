import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  calcularIvaPeriodo,
  calcularIrAnual,
  getDeclaracionesSri,
  saveDeclaracionSri,
  updateDeclaracionSri,
  getTipoContribuyente,
  setTipoContribuyente,
} from "@/services/impuestos";
import type { DeclaracionSri, TipoContribuyente } from "@/services/impuestos";

// ─── IVA ──────────────────────────────────────────────────────────────────────

export function useCalcularIva(
  empresaId: string | null | undefined,
  anio: number,
  mes?: number,
  semestre?: number,
) {
  return useQuery({
    queryKey: ["iva", empresaId, anio, mes, semestre],
    queryFn: () => calcularIvaPeriodo(empresaId!, anio, mes, semestre),
    enabled: !!empresaId && (mes !== undefined || semestre !== undefined),
  });
}

// ─── IR ───────────────────────────────────────────────────────────────────────

export function useCalcularIr(
  empresaId: string | null | undefined,
  anio: number,
  enabled = true,
) {
  return useQuery({
    queryKey: ["ir", empresaId, anio],
    queryFn: () => calcularIrAnual(empresaId!, anio),
    enabled: !!empresaId && enabled,
  });
}

// ─── Tipo contribuyente ───────────────────────────────────────────────────────

export function useTipoContribuyente(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["tipo_contribuyente", empresaId],
    queryFn: () => getTipoContribuyente(empresaId!),
    enabled: !!empresaId,
  });
}

export function useSetTipoContribuyente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ empresaId, tipo }: { empresaId: string; tipo: TipoContribuyente }) =>
      setTipoContribuyente(empresaId, tipo),
    onSuccess: (_data, { empresaId }) => {
      void qc.invalidateQueries({ queryKey: ["tipo_contribuyente", empresaId] });
      void qc.invalidateQueries({ queryKey: ["iva", empresaId] });
      void qc.invalidateQueries({ queryKey: ["ir", empresaId] });
    },
  });
}

// ─── Declaraciones ────────────────────────────────────────────────────────────

export function useDeclaracionesSri(
  empresaId: string | null | undefined,
  anio?: number,
) {
  return useQuery({
    queryKey: ["declaraciones_sri", empresaId, anio],
    queryFn: () => getDeclaracionesSri(empresaId!, anio),
    enabled: !!empresaId,
  });
}

export function useSaveDeclaracion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<DeclaracionSri, "id" | "created_at" | "updated_at">) =>
      saveDeclaracionSri(payload),
    onSuccess: (_data, payload) => {
      void qc.invalidateQueries({ queryKey: ["declaraciones_sri", payload.empresa_id] });
    },
  });
}

export function useUpdateDeclaracion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<DeclaracionSri> }) =>
      updateDeclaracionSri(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["declaraciones_sri"] });
    },
  });
}
