import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCuentasBancarias,
  createCuentaBancaria,
  updateCuentaBancaria,
  deleteCuentaBancaria,
  getMovimientosBancarios,
  importarMovimientos,
  marcarConciliado,
  ignorarMovimiento,
  desconciliarMovimiento,
  getResumenConciliacion,
} from "@/services/conciliacion";
import type {
  CuentaBancaria,
  FiltrosMovimientos,
  MovimientoParaImportar,
  MatchTipo,
} from "@/services/conciliacion";

// ─── Cuentas ──────────────────────────────────────────────────────────────────

export function useCuentasBancarias(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["cuentas_bancarias", empresaId],
    queryFn: () => getCuentasBancarias(empresaId!),
    enabled: !!empresaId,
  });
}

export function useCreateCuenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<CuentaBancaria, "id" | "created_at" | "updated_at">) =>
      createCuentaBancaria(payload),
    onSuccess: (_data, payload) => {
      void qc.invalidateQueries({ queryKey: ["cuentas_bancarias", payload.empresa_id] });
    },
  });
}

export function useUpdateCuenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CuentaBancaria> }) =>
      updateCuentaBancaria(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cuentas_bancarias"] });
    },
  });
}

export function useDeleteCuenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCuentaBancaria(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cuentas_bancarias"] });
    },
  });
}

// ─── Movimientos ──────────────────────────────────────────────────────────────

export function useMovimientosBancarios(
  empresaId: string | null | undefined,
  filtros?: FiltrosMovimientos,
) {
  return useQuery({
    queryKey: ["movimientos_bancarios", empresaId, filtros],
    queryFn: () => getMovimientosBancarios(empresaId!, filtros),
    enabled: !!empresaId,
  });
}

export function useImportarMovimientos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cuentaId,
      empresaId,
      movimientos,
    }: {
      cuentaId: string;
      empresaId: string;
      movimientos: MovimientoParaImportar[];
    }) => importarMovimientos(cuentaId, empresaId, movimientos),
    onSuccess: (_data, { empresaId }) => {
      void qc.invalidateQueries({ queryKey: ["movimientos_bancarios", empresaId] });
      void qc.invalidateQueries({ queryKey: ["resumen_conciliacion", empresaId] });
    },
  });
}

// ─── Acciones de conciliación ─────────────────────────────────────────────────

export function useMarcarConciliado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      movimientoId,
      matchTipo,
      matchId,
      matchNota,
      crearCobro,
    }: {
      movimientoId: string;
      matchTipo: MatchTipo;
      matchId?: string | null;
      matchNota?: string | null;
      crearCobro?: boolean;
    }) => marcarConciliado(movimientoId, matchTipo, matchId, matchNota, crearCobro),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["movimientos_bancarios"] });
      void qc.invalidateQueries({ queryKey: ["resumen_conciliacion"] });
      void qc.invalidateQueries({ queryKey: ["cobros"] });
    },
  });
}

export function useIgnorarMovimiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ movimientoId, nota }: { movimientoId: string; nota?: string }) =>
      ignorarMovimiento(movimientoId, nota),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["movimientos_bancarios"] });
      void qc.invalidateQueries({ queryKey: ["resumen_conciliacion"] });
    },
  });
}

export function useDesconciliar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (movimientoId: string) => desconciliarMovimiento(movimientoId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["movimientos_bancarios"] });
      void qc.invalidateQueries({ queryKey: ["resumen_conciliacion"] });
    },
  });
}

// ─── Resumen ──────────────────────────────────────────────────────────────────

export function useResumenConciliacion(empresaId: string | null | undefined, cuentaId?: string) {
  return useQuery({
    queryKey: ["resumen_conciliacion", empresaId, cuentaId],
    queryFn: () => getResumenConciliacion(empresaId!, cuentaId),
    enabled: !!empresaId,
  });
}
