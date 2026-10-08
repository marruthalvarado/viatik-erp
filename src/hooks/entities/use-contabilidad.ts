/**
 * Hook de Contabilidad / NIIF.
 * Cubre plan de cuentas, asientos y reportes financieros.
 */
import { useState, useEffect, useCallback } from "react";
import {
  getPlanCuentas,
  createPlanCuenta,
  updatePlanCuenta,
  deletePlanCuenta,
  getConfigContable,
  upsertConfigContable,
  getAsientos,
  getAsientoConLineas,
  crearAsiento,
  confirmarAsiento,
  reversarAsiento,
  generarAsientoFactura,
  generarAsientoGasto,
  generarAsientoCobro,
  getSaldosCuentas,
  getLibroMayor,
  type PlanCuenta,
  type ConfigContable,
  type AsientoContable,
  type AsientoConLineas,
  type SaldoCuenta,
  type MovimientoMayor,
  type FiltrosAsientos,
  type LineaAsiento,
  type TipoCuenta,
  type NaturalezaCuenta,
  type RefTipoAsiento,
} from "@/services/contabilidad";

export type {
  PlanCuenta,
  ConfigContable,
  AsientoContable,
  AsientoConLineas,
  SaldoCuenta,
  MovimientoMayor,
  FiltrosAsientos,
  LineaAsiento,
  TipoCuenta,
  NaturalezaCuenta,
  RefTipoAsiento,
};

// ─── Plan de cuentas ──────────────────────────────────────────────────────────

export function usePlanCuentas(empresaId: string | null) {
  const [cuentas, setCuentas] = useState<PlanCuenta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      setCuentas(await getPlanCuentas(empresaId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar plan de cuentas");
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    load();
  }, [load]);

  const crear = useCallback(
    async (payload: Omit<PlanCuenta, "id" | "created_at">) => {
      await createPlanCuenta(payload);
      await load();
    },
    [load],
  );

  const actualizar = useCallback(
    async (id: string, payload: Partial<PlanCuenta>) => {
      await updatePlanCuenta(id, payload);
      await load();
    },
    [load],
  );

  const eliminar = useCallback(
    async (id: string) => {
      await deletePlanCuenta(id);
      await load();
    },
    [load],
  );

  return { cuentas, loading, error, reload: load, crear, actualizar, eliminar };
}

// ─── Config contable ──────────────────────────────────────────────────────────

export function useConfigContable(empresaId: string | null) {
  const [config, setConfig] = useState<ConfigContable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      setConfig(await getConfigContable(empresaId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar configuración contable");
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    load();
  }, [load]);

  const guardar = useCallback(
    async (clave: string, cuentaId: string) => {
      if (!empresaId) return;
      await upsertConfigContable(empresaId, clave, cuentaId);
      await load();
    },
    [empresaId, load],
  );

  return { config, loading, error, reload: load, guardar };
}

// ─── Asientos contables ───────────────────────────────────────────────────────

export function useAsientos(empresaId: string | null, filtros?: FiltrosAsientos) {
  const [asientos, setAsientos] = useState<AsientoContable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      setAsientos(await getAsientos(empresaId, filtros));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar asientos");
    } finally {
      setLoading(false);
    }
  }, [empresaId, filtros]);

  useEffect(() => {
    load();
  }, [load]);

  const crear = useCallback(
    async (
      fecha: string,
      descripcion: string,
      lineas: LineaAsiento[],
      refTipo?: RefTipoAsiento | null,
      refId?: string | null,
      confirmar = false,
    ) => {
      if (!empresaId) throw new Error("Sin empresa activa");
      const id = await crearAsiento(
        empresaId,
        fecha,
        descripcion,
        lineas,
        refTipo,
        refId,
        confirmar,
      );
      await load();
      return id;
    },
    [empresaId, load],
  );

  const confirmar = useCallback(
    async (asientoId: string) => {
      await confirmarAsiento(asientoId);
      await load();
    },
    [load],
  );

  const reversar = useCallback(
    async (asientoId: string, fecha: string, descripcion: string) => {
      const id = await reversarAsiento(asientoId, fecha, descripcion);
      await load();
      return id;
    },
    [load],
  );

  return { asientos, loading, error, reload: load, crear, confirmar, reversar };
}

export function useAsientoDetalle(asientoId: string | null) {
  const [asiento, setAsiento] = useState<AsientoConLineas | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!asientoId) return;
    setLoading(true);
    setError(null);
    try {
      setAsiento(await getAsientoConLineas(asientoId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar asiento");
    } finally {
      setLoading(false);
    }
  }, [asientoId]);

  useEffect(() => {
    load();
  }, [load]);

  return { asiento, loading, error, reload: load };
}

// ─── Auto-asientos ────────────────────────────────────────────────────────────

export function useAutoAsiento() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generarFactura = useCallback(
    async (facturaId: string, empresaId: string): Promise<string | null> => {
      setLoading(true);
      setError(null);
      try {
        return await generarAsientoFactura(facturaId, empresaId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al generar asiento de factura";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const generarGasto = useCallback(
    async (gastoId: string, empresaId: string): Promise<string | null> => {
      setLoading(true);
      setError(null);
      try {
        return await generarAsientoGasto(gastoId, empresaId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al generar asiento de gasto";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const generarCobro = useCallback(
    async (cobroId: string, empresaId: string): Promise<string | null> => {
      setLoading(true);
      setError(null);
      try {
        return await generarAsientoCobro(cobroId, empresaId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al generar asiento de cobro";
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, error, generarFactura, generarGasto, generarCobro };
}

// ─── Reportes NIIF ───────────────────────────────────────────────────────────

export function useSaldosCuentas(empresaId: string | null, desde: string, hasta: string) {
  const [saldos, setSaldos] = useState<SaldoCuenta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!empresaId || !desde || !hasta) return;
    setLoading(true);
    setError(null);
    try {
      setSaldos(await getSaldosCuentas(empresaId, desde, hasta));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar saldos");
    } finally {
      setLoading(false);
    }
  }, [empresaId, desde, hasta]);

  useEffect(() => {
    load();
  }, [load]);

  return { saldos, loading, error, reload: load };
}

export function useLibroMayor(
  empresaId: string | null,
  cuentaId: string | null,
  desde: string,
  hasta: string,
) {
  const [movimientos, setMovimientos] = useState<MovimientoMayor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!empresaId || !cuentaId || !desde || !hasta) return;
    setLoading(true);
    setError(null);
    try {
      setMovimientos(await getLibroMayor(empresaId, cuentaId, desde, hasta));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar libro mayor");
    } finally {
      setLoading(false);
    }
  }, [empresaId, cuentaId, desde, hasta]);

  useEffect(() => {
    load();
  }, [load]);

  return { movimientos, loading, error, reload: load };
}
