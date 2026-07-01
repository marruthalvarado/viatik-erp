/**
 * liquidacion-export.ts
 * Genera el Excel de Liquidación de Viáticos para una rendición.
 * Usa SheetJS (xlsx) con dynamic import (code-splitting).
 *
 * Secciones:
 *  A — Hospedaje
 *  B — Movilización (vehículo propio + facturas combustible/movilización)
 *  C — Alimentación (desayuno, almuerzo, cena)
 *  D — Misceláneos
 *  Resumen: anticipos, diferencia
 *  Área de firmas
 */

import { supabase } from "@/integrations/supabase/client";
import type { Gasto, Viaje, Politica, Rendicion } from "@/types/entities";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): number {
  return Number(n ?? 0);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function categoriaSeccion(
  nombre: string,
): "hospedaje" | "movilizacion" | "alimentacion" | "miscelaneos" {
  const n = normalizar(nombre);
  if (n.includes("hospedaje") || n.includes("alojamiento")) return "hospedaje";
  if (
    n.includes("combustible") ||
    n.includes("movilizacion") ||
    n.includes("movilización") ||
    n.includes("taxi") ||
    n.includes("peaje") ||
    n.includes("transporte")
  )
    return "movilizacion";
  if (
    n.includes("desayuno") ||
    n.includes("almuerzo") ||
    n.includes("cena") ||
    n.includes("alimentacion") ||
    n.includes("alimentación")
  )
    return "alimentacion";
  return "miscelaneos";
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchGastos(
  rendicionId: string,
): Promise<(Gasto & { categoria_nombre: string; proveedor_nombre: string })[]> {
  const { data } = await supabase
    .from("gastos")
    .select("*, categorias_gasto(nombre), proveedores(nombre)")
    .eq("rendicion_id", rendicionId)
    .is("deleted_at", null)
    .order("fecha");

  return (data ?? []).map((g) => ({
    ...(g as unknown as Gasto),
    categoria_nombre:
      (g as unknown as Record<string, unknown>)["categorias_gasto"] != null
        ? ((g as unknown as Record<string, { nombre: string }>)["categorias_gasto"]?.nombre ??
          "Misceláneos")
        : "Misceláneos",
    proveedor_nombre:
      (g as unknown as Record<string, unknown>)["proveedores"] != null
        ? ((g as unknown as Record<string, { nombre: string }>)["proveedores"]?.nombre ?? "—")
        : "—",
  }));
}

async function fetchViajes(rendicionId: string): Promise<Viaje[]> {
  const { data } = await supabase
    .from("viajes")
    .select("*")
    .eq("rendicion_id", rendicionId)
    .order("fecha_inicio");
  return (data ?? []) as unknown as Viaje[];
}

async function fetchPolitica(politicaId: string | null | undefined): Promise<Politica | null> {
  if (!politicaId) return null;
  const { data } = await supabase.from("politicas").select("*").eq("id", politicaId).single();
  return (data as unknown as Politica) ?? null;
}

async function fetchUsuarioNombre(usuarioId: string): Promise<string> {
  const { data } = await supabase
    .from("usuarios")
    .select("nombres, apellidos")
    .eq("id", usuarioId)
    .single();
  if (!data) return usuarioId;
  const d = data as unknown as { nombres: string; apellidos: string | null };
  return `${d.nombres} ${d.apellidos ?? ""}`.trim();
}

async function fetchEmpresaNombre(empresaId: string): Promise<string> {
  const { data } = await supabase.from("empresas").select("nombre").eq("id", empresaId).single();
  return (data as unknown as { nombre: string })?.nombre ?? "Empresa";
}

// ─── Main export function ─────────────────────────────────────────────────────

export async function exportarLiquidacion(rendicion: Rendicion): Promise<void> {
  const XLSX = await import("xlsx");

  // 1. Fetch data
  const [gastos, viajes, politica, empleadoNombre, empresaNombre] = await Promise.all([
    fetchGastos(rendicion.id),
    fetchViajes(rendicion.id),
    fetchPolitica(rendicion.politica_id),
    fetchUsuarioNombre(rendicion.usuario_id),
    fetchEmpresaNombre(rendicion.empresa_id),
  ]);

  const valorKm = fmt(politica?.valor_km);
  const kmCiudadDia = fmt(politica?.km_ciudad_por_dia);

  // Calcular días de viaje (del viaje principal con vehículo propio)
  const viajePropio = viajes.find((v) => v.vehiculo_propio);
  const diasViaje =
    viajePropio?.fecha_inicio && viajePropio?.fecha_fin
      ? Math.ceil(
          (new Date(viajePropio.fecha_fin).getTime() -
            new Date(viajePropio.fecha_inicio).getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1
      : 0;

  // 2. Clasificar gastos por sección
  const hospedajeGastos = gastos.filter(
    (g) => categoriaSeccion(g.categoria_nombre) === "hospedaje",
  );
  const movGastos = gastos.filter((g) => categoriaSeccion(g.categoria_nombre) === "movilizacion");
  const alimentGastos = gastos.filter(
    (g) => categoriaSeccion(g.categoria_nombre) === "alimentacion",
  );
  const miscGastos = gastos.filter((g) => categoriaSeccion(g.categoria_nombre) === "miscelaneos");

  // 3. Calcular km reembolsables de viajes en vehículo propio
  type KmRow = { trayecto: string; kmIda: number; kmTotal: number; valor: number };
  const kmRows: KmRow[] = viajes
    .filter((v) => v.vehiculo_propio && (v.distancia_km ?? 0) > 0)
    .map((v) => {
      const kmIda = fmt(v.distancia_km);
      const kmTotal = kmIda * 2; // ida y vuelta
      return {
        trayecto: `${v.origen ?? "Origen"} → ${v.destino}`,
        kmIda,
        kmTotal,
        valor: kmTotal * valorKm,
      };
    });

  const kmCiudadTotal = diasViaje > 0 && kmCiudadDia > 0 ? diasViaje * kmCiudadDia * valorKm : 0;

  // 4. Totales
  const totalHospedaje = hospedajeGastos.reduce((s, g) => s + fmt(g.valor_factura), 0);
  const totalKmViaje = kmRows.reduce((s, r) => s + r.valor, 0);
  const totalMovFacturas = movGastos.reduce((s, g) => s + fmt(g.valor_factura), 0);
  const totalMovilizacion = totalKmViaje + kmCiudadTotal + totalMovFacturas;
  const totalAlimentacion = alimentGastos.reduce((s, g) => s + fmt(g.valor_factura), 0);
  const totalMiscelaneos = miscGastos.reduce((s, g) => s + fmt(g.valor_factura), 0);
  const totalGeneral = totalHospedaje + totalMovilizacion + totalAlimentacion + totalMiscelaneos;
  const totalAnticipos = fmt(rendicion.anticipo_efectivo) + fmt(rendicion.anticipo_credito);
  const diferencia = totalGeneral - totalAnticipos;

  // 5. Build worksheet rows
  const aoa: (string | number)[][] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

  function addTitle(text: string) {
    aoa.push([text]);
    merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 5 } });
  }

  function addSectionHeader(text: string) {
    aoa.push([text, "", "", "", "", ""]);
    merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 5 } });
  }

  function addColHeader() {
    aoa.push(["Fecha", "Proveedor / Detalle", "N° Doc", "Descripción", "Km", "Valor ($)"]);
  }

  function addGastoRow(g: Gasto & { proveedor_nombre: string }, extra?: { km?: number }) {
    aoa.push([
      fmtDate(g.fecha),
      g.proveedor_nombre,
      g.numero_documento ?? "—",
      g.descripcion ?? "—",
      extra?.km ?? "",
      fmt(g.valor_factura),
    ]);
  }

  function addSubtotal(label: string, value: number) {
    aoa.push(["", "", "", "", label, value]);
  }

  function addBlank() {
    aoa.push([]);
  }

  // ── Encabezado del documento ─────────────────────────────────────────────
  addTitle("LIQUIDACIÓN DE VIÁTICOS");
  aoa.push(["Empresa:", empresaNombre, "", "", "Rendición N°:", rendicion.numero]);
  aoa.push(["Empleado:", empleadoNombre, "", "", "Fecha:", fmtDate(rendicion.fecha_rendicion)]);
  aoa.push(["Motivo:", rendicion.motivo ?? rendicion.descripcion ?? "—", "", "", "", ""]);
  merges.push({ s: { r: 3, c: 1 }, e: { r: 3, c: 3 } });
  aoa.push([
    "Período:",
    viajePropio ? `${fmtDate(viajePropio.fecha_inicio)} al ${fmtDate(viajePropio.fecha_fin)}` : "—",
    "",
    "",
    "",
    "",
  ]);
  merges.push({ s: { r: 4, c: 1 }, e: { r: 4, c: 3 } });
  addBlank();

  // ── SECCIÓN A: HOSPEDAJE ─────────────────────────────────────────────────
  addSectionHeader("A. HOSPEDAJE");
  addColHeader();
  if (hospedajeGastos.length > 0) {
    hospedajeGastos.forEach((g) => addGastoRow(g));
  } else {
    aoa.push(["—", "Sin gastos de hospedaje", "", "", "", 0]);
  }
  addSubtotal("SUBTOTAL HOSPEDAJE", totalHospedaje);
  addBlank();

  // ── SECCIÓN B: MOVILIZACIÓN ──────────────────────────────────────────────
  addSectionHeader("B. MOVILIZACIÓN");
  addColHeader();

  // Km vehículo propio
  if (kmRows.length > 0) {
    kmRows.forEach((r) => {
      aoa.push([
        "",
        r.trayecto,
        "",
        `${r.kmIda} km (ida) × 2 × $${valorKm}/km`,
        r.kmTotal,
        r.valor,
      ]);
    });
  }

  // Km ciudad
  if (kmCiudadTotal > 0) {
    aoa.push([
      "",
      "Movilización en ciudad",
      "",
      `${diasViaje} días × ${kmCiudadDia} km × $${valorKm}/km`,
      diasViaje * kmCiudadDia,
      kmCiudadTotal,
    ]);
  }

  // Facturas de movilización/combustible
  if (movGastos.length > 0) {
    movGastos.forEach((g) => addGastoRow(g));
  }

  if (kmRows.length === 0 && kmCiudadTotal === 0 && movGastos.length === 0) {
    aoa.push(["—", "Sin gastos de movilización", "", "", "", 0]);
  }

  addSubtotal("SUBTOTAL MOVILIZACIÓN", totalMovilizacion);
  addBlank();

  // ── SECCIÓN C: ALIMENTACIÓN ──────────────────────────────────────────────
  addSectionHeader("C. ALIMENTACIÓN");
  addColHeader();
  if (alimentGastos.length > 0) {
    alimentGastos.forEach((g) => addGastoRow(g));
  } else {
    aoa.push(["—", "Sin gastos de alimentación", "", "", "", 0]);
  }
  addSubtotal("SUBTOTAL ALIMENTACIÓN", totalAlimentacion);
  addBlank();

  // ── SECCIÓN D: MISCELÁNEOS ───────────────────────────────────────────────
  addSectionHeader("D. MISCELÁNEOS");
  addColHeader();
  if (miscGastos.length > 0) {
    miscGastos.forEach((g) => addGastoRow(g));
  } else {
    aoa.push(["—", "Sin gastos misceláneos", "", "", "", 0]);
  }
  addSubtotal("SUBTOTAL MISCELÁNEOS", totalMiscelaneos);
  addBlank();

  // ── RESUMEN ──────────────────────────────────────────────────────────────
  addSectionHeader("RESUMEN");
  aoa.push(["", "", "", "", "A. Hospedaje", totalHospedaje]);
  aoa.push(["", "", "", "", "B. Movilización", totalMovilizacion]);
  aoa.push(["", "", "", "", "C. Alimentación", totalAlimentacion]);
  aoa.push(["", "", "", "", "D. Misceláneos", totalMiscelaneos]);
  aoa.push(["", "", "", "", "TOTAL GENERAL", totalGeneral]);
  aoa.push(["", "", "", "", "Anticipo efectivo", fmt(rendicion.anticipo_efectivo)]);
  aoa.push(["", "", "", "", "Anticipo tarjeta", fmt(rendicion.anticipo_credito)]);
  aoa.push(["", "", "", "", "DIFERENCIA A PAGAR/DEVOLVER", diferencia]);
  addBlank();

  // ── FIRMAS ───────────────────────────────────────────────────────────────
  addBlank();
  aoa.push(["FIRMAS", "", "", "", "", ""]);
  merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 5 } });
  aoa.push(["___________________________", "", "", "___________________________", "", ""]);
  merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 2 } });
  merges.push({ s: { r: aoa.length - 1, c: 3 }, e: { r: aoa.length - 1, c: 5 } });
  aoa.push([empleadoNombre, "", "", "Aprobado por", "", ""]);
  merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 2 } });
  merges.push({ s: { r: aoa.length - 1, c: 3 }, e: { r: aoa.length - 1, c: 5 } });
  aoa.push(["Empleado", "", "", "Firma / Sello", "", ""]);
  merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 2 } });
  merges.push({ s: { r: aoa.length - 1, c: 3 }, e: { r: aoa.length - 1, c: 5 } });

  // 6. Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;
  ws["!cols"] = [
    { wch: 12 }, // Fecha
    { wch: 28 }, // Proveedor/Detalle
    { wch: 14 }, // N° Doc
    { wch: 30 }, // Descripción
    { wch: 10 }, // Km
    { wch: 14 }, // Valor
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Liquidación");

  const filename = `Liquidacion_${rendicion.numero.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
