/**
 * cobros.ts - Pagos recibidos por factura emitida.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Cobro, CobroInsert } from "@/types/entities";

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/** Lista todos los cobros de una factura, ordenados por fecha desc. */
export async function listarCobros(facturaId: string): Promise<Cobro[]> {
  const { data, error } = await supabase
    .from("cobros")
    .select("*")
    .eq("factura_id", facturaId)
    .order("fecha_cobro", { ascending: false });
  if (error) throw new Error(`[cobros] ${error.message}`);
  return data ?? [];
}

/** Registra un nuevo cobro. */
export async function crearCobro(payload: CobroInsert): Promise<Cobro> {
  const { data, error } = await supabase
    .from("cobros")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`[cobros] ${error.message}`);
  return data;
}

/** Elimina un cobro por id. */
export async function eliminarCobro(id: string): Promise<void> {
  const { error } = await supabase.from("cobros").delete().eq("id", id);
  if (error) throw new Error(`[cobros] ${error.message}`);
}

/**
 * Agrega todos los cobros de la empresa en un mapa facturaId -> monto_cobrado.
 * Permite calcular saldo y estado en la tabla de facturas sin N+1 queries.
 */
export async function getCobrosAgregadosPorEmpresa(
  empresaId: string,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("cobros")
    .select("factura_id, monto")
    .eq("empresa_id", empresaId);
  if (error) throw new Error(`[cobros] ${error.message}`);
  const map = new Map<string, number>();
  for (const r of data ?? []) {
    map.set(r.factura_id, (map.get(r.factura_id) ?? 0) + Number(r.monto));
  }
  return map;
}

// ─── Cuentas por cobrar ────────────────────────────────────────────────────────

export interface CuentaPorCobrar {
  factura_id: string;
  numero: string;
  fecha: string;
  razon_social: string;
  ruc_cliente: string | null;
  total: number;
  monto_cobrado: number;
  saldo_pendiente: number;
  dias_emitida: number;
}

export type RangoAging = "0-30" | "31-60" | "61-90" | "+90";

export interface ResumenCobros {
  total_pendiente: number;
  total_cobrado: number;
  aging: Record<RangoAging, { count: number; monto: number }>;
  top_clientes: { razon_social: string; ruc_cliente: string | null; saldo: number }[];
  cuentas: CuentaPorCobrar[];
}

function getRangoAging(dias: number): RangoAging {
  if (dias <= 30) return "0-30";
  if (dias <= 60) return "31-60";
  if (dias <= 90) return "61-90";
  return "+90";
}

/**
 * Calcula el resumen de cuentas por cobrar para el dashboard BI.
 * Incluye aging (0-30 / 31-60 / 61-90 / +90 dias desde emision),
 * top clientes con mayor saldo y lista detallada de facturas pendientes.
 */
export async function getResumenCobros(empresaId: string): Promise<ResumenCobros> {
  const [{ data: facturas, error: e1 }, cobrosMap] = await Promise.all([
    supabase
      .from("facturas_emitidas")
      .select("id, numero, fecha, razon_social, ruc_cliente, total")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null),
    getCobrosAgregadosPorEmpresa(empresaId),
  ]);
  if (e1) throw new Error(`[cobros] ${e1.message}`);

  const hoy = new Date();
  const aging: Record<RangoAging, { count: number; monto: number }> = {
    "0-30": { count: 0, monto: 0 },
    "31-60": { count: 0, monto: 0 },
    "61-90": { count: 0, monto: 0 },
    "+90": { count: 0, monto: 0 },
  };

  let total_pendiente = 0;
  let total_cobrado = 0;
  const clienteMap = new Map<string, { razon_social: string; ruc_cliente: string | null; saldo: number }>();
  const cuentas: CuentaPorCobrar[] = [];

  for (const f of facturas ?? []) {
    const monto_cobrado = cobrosMap.get(f.id) ?? 0;
    const saldo_pendiente = Math.max(0, Number(f.total) - monto_cobrado);
    total_cobrado += monto_cobrado;
    total_pendiente += saldo_pendiente;

    if (saldo_pendiente <= 0.001) continue;

    const msDay = 86_400_000;
    const dias = Math.floor((hoy.getTime() - new Date(f.fecha + "T00:00:00").getTime()) / msDay);
    const rango = getRangoAging(dias);
    aging[rango].count += 1;
    aging[rango].monto += saldo_pendiente;

    const key = f.ruc_cliente ?? f.razon_social;
    const prev = clienteMap.get(key);
    if (prev) {
      prev.saldo += saldo_pendiente;
    } else {
      clienteMap.set(key, {
        razon_social: f.razon_social,
        ruc_cliente: f.ruc_cliente ?? null,
        saldo: saldo_pendiente,
      });
    }

    cuentas.push({
      factura_id: f.id,
      numero: f.numero,
      fecha: f.fecha,
      razon_social: f.razon_social,
      ruc_cliente: f.ruc_cliente ?? null,
      total: Number(f.total),
      monto_cobrado,
      saldo_pendiente,
      dias_emitida: dias,
    });
  }

  const top_clientes = Array.from(clienteMap.values())
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 5);

  cuentas.sort((a, b) => b.dias_emitida - a.dias_emitida);

  return { total_pendiente, total_cobrado, aging, top_clientes, cuentas };
}
