/**
 * Servicio de Contabilidad / NIIF.
 * Plan de cuentas, asientos contables y reportes financieros.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/types/database";

export type PlanCuenta = Tables<"plan_cuentas">;
export type ConfigContable = Tables<"config_contable">;
export type AsientoContable = Tables<"asientos_contables">;
export type AsientoLinea = Tables<"asiento_lineas">;

export type TipoCuenta = PlanCuenta["tipo"];
export type NaturalezaCuenta = PlanCuenta["naturaleza"];
export type EstadoAsiento = AsientoContable["estado"];
export type RefTipoAsiento = NonNullable<AsientoContable["referencia_tipo"]>;

export interface SaldoCuenta {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  naturaleza: string;
  nivel: number;
  acepta_movimientos: boolean;
  total_debe: number;
  total_haber: number;
  saldo: number;
}

export interface MovimientoMayor {
  asiento_id: string;
  numero: string;
  fecha: string;
  descripcion: string;
  debe: number;
  haber: number;
  saldo_acum: number;
}

export interface LineaAsiento {
  cuenta_id: string;
  descripcion?: string;
  debe: number;
  haber: number;
}

export interface AsientoConLineas extends AsientoContable {
  lineas: (AsientoLinea & { cuenta: Pick<PlanCuenta, "codigo" | "nombre"> | null })[];
}

// ─── Plan de cuentas ─────────────────────────────────────────────────────────

export async function getPlanCuentas(empresaId: string): Promise<PlanCuenta[]> {
  const { data, error } = await supabase
    .from("plan_cuentas")
    .select("*")
    .or(`empresa_id.is.null,empresa_id.eq.${empresaId}`)
    .eq("activa", true)
    .order("codigo");
  if (error) throw new Error(error.message);
  return (data ?? []) as PlanCuenta[];
}

export async function createPlanCuenta(
  payload: Omit<PlanCuenta, "id" | "created_at">,
): Promise<PlanCuenta> {
  const { data, error } = await supabase.from("plan_cuentas").insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data as PlanCuenta;
}

export async function updatePlanCuenta(id: string, payload: Partial<PlanCuenta>): Promise<void> {
  const { error } = await supabase.from("plan_cuentas").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePlanCuenta(id: string): Promise<void> {
  const { error } = await supabase.from("plan_cuentas").update({ activa: false }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Config contable ──────────────────────────────────────────────────────────

export async function getConfigContable(empresaId: string): Promise<ConfigContable[]> {
  const { data, error } = await supabase
    .from("config_contable")
    .select("*")
    .eq("empresa_id", empresaId);
  if (error) throw new Error(error.message);
  return (data ?? []) as ConfigContable[];
}

export async function upsertConfigContable(
  empresaId: string,
  clave: string,
  cuentaId: string,
): Promise<void> {
  const { error } = await supabase
    .from("config_contable")
    .upsert(
      { empresa_id: empresaId, clave, cuenta_id: cuentaId },
      { onConflict: "empresa_id,clave" },
    );
  if (error) throw new Error(error.message);
}

// ─── Asientos contables ───────────────────────────────────────────────────────

export interface FiltrosAsientos {
  desde?: string;
  hasta?: string;
  estado?: EstadoAsiento;
  referencia_tipo?: RefTipoAsiento;
}

export async function getAsientos(
  empresaId: string,
  filtros?: FiltrosAsientos,
): Promise<AsientoContable[]> {
  let q = supabase
    .from("asientos_contables")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false });

  if (filtros?.desde) q = q.gte("fecha", filtros.desde);
  if (filtros?.hasta) q = q.lte("fecha", filtros.hasta);
  if (filtros?.estado) q = q.eq("estado", filtros.estado);
  if (filtros?.referencia_tipo) q = q.eq("referencia_tipo", filtros.referencia_tipo);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as AsientoContable[];
}

export async function getAsientoConLineas(asientoId: string): Promise<AsientoConLineas> {
  const { data, error } = await supabase
    .from("asientos_contables")
    .select(`*, lineas:asiento_lineas(*, cuenta:plan_cuentas(codigo, nombre))`)
    .eq("id", asientoId)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as AsientoConLineas;
}

export async function crearAsiento(
  empresaId: string,
  fecha: string,
  descripcion: string,
  lineas: LineaAsiento[],
  refTipo?: RefTipoAsiento | null,
  refId?: string | null,
  confirmar = false,
): Promise<string> {
  const { data, error } = await supabase.rpc("crear_asiento", {
    p_empresa_id: empresaId,
    p_fecha: fecha,
    p_descripcion: descripcion,
    p_lineas: lineas,
    p_ref_tipo: refTipo ?? null,
    p_ref_id: refId ?? null,
    p_confirmar: confirmar,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function confirmarAsiento(asientoId: string): Promise<void> {
  const { error } = await supabase.rpc("confirmar_asiento", {
    p_asiento_id: asientoId,
  });
  if (error) throw new Error(error.message);
}

export async function reversarAsiento(
  asientoId: string,
  fecha: string,
  descripcion: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("reversar_asiento", {
    p_asiento_id: asientoId,
    p_fecha: fecha,
    p_descripcion: descripcion,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

// ─── Auto-asientos ────────────────────────────────────────────────────────────

export async function generarAsientoFactura(facturaId: string, empresaId: string): Promise<string> {
  const { data, error } = await supabase.rpc("generar_asiento_factura", {
    p_factura_id: facturaId,
    p_empresa_id: empresaId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function generarAsientoGasto(gastoId: string, empresaId: string): Promise<string> {
  const { data, error } = await supabase.rpc("generar_asiento_gasto", {
    p_gasto_id: gastoId,
    p_empresa_id: empresaId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function generarAsientoCobro(cobroId: string, empresaId: string): Promise<string> {
  const { data, error } = await supabase.rpc("generar_asiento_cobro", {
    p_cobro_id: cobroId,
    p_empresa_id: empresaId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

// ─── Reportes NIIF ───────────────────────────────────────────────────────────

export async function getSaldosCuentas(
  empresaId: string,
  desde: string,
  hasta: string,
): Promise<SaldoCuenta[]> {
  const { data, error } = await supabase.rpc("get_saldos_cuentas", {
    p_empresa_id: empresaId,
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as SaldoCuenta[];
}

export async function getLibroMayor(
  empresaId: string,
  cuentaId: string,
  desde: string,
  hasta: string,
): Promise<MovimientoMayor[]> {
  const { data, error } = await supabase.rpc("get_libro_mayor", {
    p_empresa_id: empresaId,
    p_cuenta_id: cuentaId,
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as MovimientoMayor[];
}
