/**
 * Servicio de Conciliación Bancaria.
 * Gestiona cuentas bancarias y movimientos importados de extractos.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/types/database";

export type CuentaBancaria = Tables<"cuentas_bancarias">;
export type MovimientoBancario = Tables<"movimientos_bancarios">;

export type EstadoMovimiento = "sin_conciliar" | "conciliado" | "ignorado";
export type TipoMovimiento = "DEBITO" | "CREDITO";
export type MatchTipo = "factura" | "gasto" | "cobro" | "manual";

// ─── Cuentas bancarias ────────────────────────────────────────────────────────

export async function getCuentasBancarias(empresaId: string): Promise<CuentaBancaria[]> {
  const { data, error } = await supabase
    .from("cuentas_bancarias")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as CuentaBancaria[];
}

export async function createCuentaBancaria(
  payload: Omit<CuentaBancaria, "id" | "created_at" | "updated_at">,
): Promise<CuentaBancaria> {
  const { data, error } = await supabase
    .from("cuentas_bancarias")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CuentaBancaria;
}

export async function updateCuentaBancaria(
  id: string,
  payload: Partial<CuentaBancaria>,
): Promise<void> {
  const { error } = await supabase
    .from("cuentas_bancarias")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCuentaBancaria(id: string): Promise<void> {
  const { error } = await supabase
    .from("cuentas_bancarias")
    .update({ activa: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Movimientos bancarios ────────────────────────────────────────────────────

export interface FiltrosMovimientos {
  cuentaId?: string;
  estado?: EstadoMovimiento;
  tipo?: TipoMovimiento;
  desde?: string;
  hasta?: string;
}

export async function getMovimientosBancarios(
  empresaId: string,
  filtros?: FiltrosMovimientos,
): Promise<MovimientoBancario[]> {
  let q = supabase
    .from("movimientos_bancarios")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  if (filtros?.cuentaId) q = q.eq("cuenta_id", filtros.cuentaId);
  if (filtros?.estado) q = q.eq("estado", filtros.estado);
  if (filtros?.tipo) q = q.eq("tipo", filtros.tipo);
  if (filtros?.desde) q = q.gte("fecha", filtros.desde);
  if (filtros?.hasta) q = q.lte("fecha", filtros.hasta);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as MovimientoBancario[];
}

// ─── Importar movimientos via RPC ────────────────────────────────────────────

export interface MovimientoParaImportar {
  fecha: string; // YYYY-MM-DD
  descripcion?: string;
  referencia?: string;
  tipo: TipoMovimiento;
  monto: number;
  saldo?: number;
}

export interface ResultadoImportacion {
  insertados: number;
  duplicados: number;
}

export async function importarMovimientos(
  cuentaId: string,
  empresaId: string,
  movimientos: MovimientoParaImportar[],
): Promise<ResultadoImportacion> {
  const { data, error } = await supabase.rpc("importar_movimientos_bancarios", {
    p_cuenta_id: cuentaId,
    p_empresa_id: empresaId,
    p_movimientos: movimientos,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    insertados: Number(row?.insertados ?? 0),
    duplicados: Number(row?.duplicados ?? 0),
  };
}

// ─── Conciliar / ignorar / deshacer ──────────────────────────────────────────

export async function marcarConciliado(
  movimientoId: string,
  matchTipo: MatchTipo,
  matchId?: string | null,
  matchNota?: string | null,
  crearCobro = false,
): Promise<void> {
  const { error } = await supabase.rpc("marcar_movimiento_conciliado", {
    p_movimiento_id: movimientoId,
    p_match_tipo: matchTipo,
    p_match_id: matchId ?? null,
    p_match_nota: matchNota ?? null,
    p_crear_cobro: crearCobro,
  });
  if (error) throw new Error(error.message);
}

export async function ignorarMovimiento(movimientoId: string, nota?: string): Promise<void> {
  const { error } = await supabase.rpc("ignorar_movimiento_bancario", {
    p_movimiento_id: movimientoId,
    p_nota: nota ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function desconciliarMovimiento(movimientoId: string): Promise<void> {
  const { error } = await supabase.rpc("desconciliar_movimiento", {
    p_movimiento_id: movimientoId,
  });
  if (error) throw new Error(error.message);
}

// ─── Resumen de conciliación ──────────────────────────────────────────────────

export interface ResumenConciliacion {
  sin_conciliar: number;
  conciliados: number;
  ignorados: number;
  total: number;
  monto_pendiente: number;
}

export async function getResumenConciliacion(
  empresaId: string,
  cuentaId?: string,
): Promise<ResumenConciliacion> {
  let q = supabase
    .from("movimientos_bancarios")
    .select("estado, tipo, monto")
    .eq("empresa_id", empresaId);
  if (cuentaId) q = q.eq("cuenta_id", cuentaId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { estado: string; tipo: string; monto: number }[];
  const sin = rows.filter((r) => r.estado === "sin_conciliar");
  const conc = rows.filter((r) => r.estado === "conciliado");
  const ign = rows.filter((r) => r.estado === "ignorado");

  return {
    sin_conciliar: sin.length,
    conciliados: conc.length,
    ignorados: ign.length,
    total: rows.length,
    monto_pendiente: sin.reduce((s, r) => s + Number(r.monto), 0),
  };
}
