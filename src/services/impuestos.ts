/**
 * Servicio de Impuestos SRI Ecuador.
 * Calcula IVA e IR usando RPCs de Supabase, guarda historial de declaraciones.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/types/database";

export type DeclaracionSri = Tables<"declaraciones_sri">;
export type AnticipoIr = Tables<"anticipos_ir">;

export type TipoContribuyente =
  | "sociedad"
  | "persona_natural_obligada"
  | "persona_natural_no_obligada"
  | "rise";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface DetalleVenta {
  numero: string;
  razon_social: string;
  fecha: string;
  subtotal: number;
  iva: number;
  ret_iva_pct: number;
  ret_iva_monto: number;
}

export interface DetalleCompra {
  descripcion: string;
  fecha: string;
  subtotal: number;
  iva: number;
  ruc_emisor: string | null;
  numero_doc: string | null;
}

export interface ResultadoIva {
  iva_ventas: number;
  retenciones_iva_recibidas: number;
  credito_tributario_compras: number;
  credito_tributario_anterior: number; // arrastre de meses previos (LRTI Art. 69)
  iva_a_pagar: number;
  num_facturas: number;
  num_compras: number;
  detalle_ventas: DetalleVenta[];
  detalle_compras: DetalleCompra[];
}

export interface RetencionesMes {
  mes: number;
  monto: number;
}

export interface ResultadoIr {
  tipo_contribuyente: TipoContribuyente;
  ingresos_gravables: number;
  gastos_deducibles: number;
  utilidad_gravable: number;
  ir_causado: number;
  retenciones_ir_recibidas: number;
  anticipos_pagados: number;
  ir_a_pagar: number;
  anticipo_siguiente: number;
  retenciones_por_mes: RetencionesMes[];
}

// ─── Tipo de contribuyente ────────────────────────────────────────────────────

export const TIPO_CONTRIBUYENTE_LABELS: Record<TipoContribuyente, string> = {
  sociedad: "Sociedad (Cía. Ltda. / SA / SAS)",
  persona_natural_obligada: "Persona Natural Obligada a llevar Contabilidad",
  persona_natural_no_obligada: "Persona Natural No Obligada",
  rise: "RISE — Régimen Simplificado",
};

/** Determina si la empresa declara IVA mensual o semestral según tipo. */
export function periodoIva(tipo: TipoContribuyente): "mensual" | "semestral" {
  return tipo === "persona_natural_no_obligada" || tipo === "rise"
    ? "semestral"
    : "mensual";
}

// ─── Empresa ──────────────────────────────────────────────────────────────────

export async function getTipoContribuyente(empresaId: string): Promise<TipoContribuyente> {
  const { data, error } = await supabase
    .from("empresas")
    .select("tipo_contribuyente")
    .eq("id", empresaId)
    .single();
  if (error) throw new Error(error.message);
  return (data?.tipo_contribuyente as TipoContribuyente) ?? "sociedad";
}

export async function setTipoContribuyente(
  empresaId: string,
  tipo: TipoContribuyente,
): Promise<void> {
  const { error } = await supabase
    .from("empresas")
    .update({ tipo_contribuyente: tipo })
    .eq("id", empresaId);
  if (error) throw new Error(error.message);
}

// ─── IVA ──────────────────────────────────────────────────────────────────────

export async function calcularIvaPeriodo(
  empresaId: string,
  anio: number,
  mes?: number,
  semestre?: number,
): Promise<ResultadoIva> {
  const { data, error } = await supabase.rpc("calcular_iva_periodo", {
    p_empresa_id: empresaId,
    p_anio: anio,
    p_mes: mes ?? null,
    p_semestre: semestre ?? null,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    iva_ventas: Number(row?.iva_ventas ?? 0),
    retenciones_iva_recibidas: Number(row?.retenciones_iva_recibidas ?? 0),
    credito_tributario_compras: Number(row?.credito_tributario_compras ?? 0),
    credito_tributario_anterior: Number(row?.credito_tributario_anterior ?? 0),
    iva_a_pagar: Number(row?.iva_a_pagar ?? 0),
    num_facturas: Number(row?.num_facturas ?? 0),
    num_compras: Number(row?.num_compras ?? 0),
    detalle_ventas: (row?.detalle_ventas ?? []) as DetalleVenta[],
    detalle_compras: (row?.detalle_compras ?? []) as DetalleCompra[],
  };
}

// ─── IR ───────────────────────────────────────────────────────────────────────

export async function calcularIrAnual(
  empresaId: string,
  anio: number,
): Promise<ResultadoIr> {
  const { data, error } = await supabase.rpc("calcular_ir_anual", {
    p_empresa_id: empresaId,
    p_anio: anio,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    tipo_contribuyente: (row?.tipo_contribuyente ?? "sociedad") as TipoContribuyente,
    ingresos_gravables: Number(row?.ingresos_gravables ?? 0),
    gastos_deducibles: Number(row?.gastos_deducibles ?? 0),
    utilidad_gravable: Number(row?.utilidad_gravable ?? 0),
    ir_causado: Number(row?.ir_causado ?? 0),
    retenciones_ir_recibidas: Number(row?.retenciones_ir_recibidas ?? 0),
    anticipos_pagados: Number(row?.anticipos_pagados ?? 0),
    ir_a_pagar: Number(row?.ir_a_pagar ?? 0),
    anticipo_siguiente: Number(row?.anticipo_siguiente ?? 0),
    retenciones_por_mes: (row?.retenciones_por_mes ?? []) as RetencionesMes[],
  };
}

// ─── Topes partes relacionadas ────────────────────────────────────────────────

export interface TopesPartesRelacionadas {
  gastos_royalties_servicios: number;
  limite_royalties_servicios: number;
  exceso_royalties_servicios: number;
  pct_usado_royalties: number;
  gastos_indirectos: number;
  limite_indirectos: number;
  exceso_indirectos: number;
  pct_usado_indirectos: number;
  base_imponible_referencia: number;
}

export async function calcularTopesPartesRelacionadas(
  empresaId: string,
  anio: number,
): Promise<TopesPartesRelacionadas | null> {
  const { data, error } = await supabase.rpc("calcular_topes_partes_relacionadas", {
    p_empresa_id: empresaId,
    p_anio: anio,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    gastos_royalties_servicios: Number(row.gastos_royalties_servicios ?? 0),
    limite_royalties_servicios: Number(row.limite_royalties_servicios ?? 0),
    exceso_royalties_servicios: Number(row.exceso_royalties_servicios ?? 0),
    pct_usado_royalties: Number(row.pct_usado_royalties ?? 0),
    gastos_indirectos: Number(row.gastos_indirectos ?? 0),
    limite_indirectos: Number(row.limite_indirectos ?? 0),
    exceso_indirectos: Number(row.exceso_indirectos ?? 0),
    pct_usado_indirectos: Number(row.pct_usado_indirectos ?? 0),
    base_imponible_referencia: Number(row.base_imponible_referencia ?? 0),
  };
}

// ─── Anticipos IR ─────────────────────────────────────────────────────────────

export async function getAnticiposIr(
  empresaId: string,
  anio: number,
): Promise<AnticipoIr[]> {
  const { data, error } = await supabase
    .from("anticipos_ir")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("anio", anio)
    .order("cuota");
  if (error) throw new Error(error.message);
  return (data ?? []) as AnticipoIr[];
}

export async function upsertAnticipoIr(
  empresaId: string,
  anio: number,
  cuota: 1 | 2,
  monto: number,
  fechaPago?: string | null,
  comprobante?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("upsert_anticipo_ir", {
    p_empresa_id: empresaId,
    p_anio: anio,
    p_cuota: cuota,
    p_monto: monto,
    p_fecha: fechaPago ?? null,
    p_comprobante: comprobante ?? null,
  });
  if (error) throw new Error(error.message);
}

// ─── Declaraciones (historial) ────────────────────────────────────────────────

export async function getDeclaracionesSri(
  empresaId: string,
  anio?: number,
): Promise<DeclaracionSri[]> {
  let q = supabase
    .from("declaraciones_sri")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("anio", { ascending: false })
    .order("periodo", { ascending: false });
  if (anio) q = q.eq("anio", anio);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as DeclaracionSri[];
}

export async function saveDeclaracionSri(
  payload: Omit<DeclaracionSri, "id" | "created_at" | "updated_at">,
): Promise<DeclaracionSri> {
  const { data, error } = await supabase
    .from("declaraciones_sri")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as DeclaracionSri;
}

export async function updateDeclaracionSri(
  id: string,
  payload: Partial<DeclaracionSri>,
): Promise<void> {
  const { error } = await supabase
    .from("declaraciones_sri")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
