/**
 * liquidacion-export.ts
 * Genera el Excel de liquidacion usando un template pre-formateado.
 * Solo escribe valores en celdas fijas  - estilos vienen del template.
 *
 * Estructura del template (public/liquidacion-template.xlsx):
 *   Rows  1-11 : Titulo + bloque info
 *   Rows 15-34 : A. Hospedaje data (20 filas)
 *   Row  35    : SUBTOTAL A
 *   Rows 39-58 : B. Movilizacion data (20 filas)
 *   Row  59    : SUBTOTAL B
 *   Rows 63-82 : C. Alimentacion data (20 filas)
 *   Row  83    : SUBTOTAL C
 *   Rows 87-106: D. Miscelaneos data (20 filas)
 *   Row  107   : SUBTOTAL D
 *   Row  109   : RESUMEN FINAL header
 *   Rows 110-117: Resumen final + anticipos + diferencia
 *   Rows 120-126: Firmas
 */

import { supabase } from "@/integrations/supabase/client";
import type { Gasto, Viaje, Politica, Rendicion } from "@/types/entities";

// Posiciones fijas del template (1-indexed, identicas al xlsx generado por openpyxl)
const RA1 = 15;  // A. Hospedaje data start (end: 34)
const RB1 = 39;  // B. Movilizacion data start (end: 58)
const RC1 = 63;  // C. Alimentacion data start (end: 82)
const RD1 = 87;  // D. Miscelaneos data start (end: 106)
const MAX_ROWS = 20;  // filas maximas por seccion

const ROW_RF_AE = 115;   // Menos anticipo efectivo (Resumen Final)
const ROW_RF_AC = 116;   // Menos anticipo tarjeta  (Resumen Final)
const ROW_SIG   = 121;   // Nombre empleado en firma

// ---------------------------------------------------------------------------
// Tipos y helpers
// ---------------------------------------------------------------------------
type GastoEnriquecido = Gasto & {
  categoria_nombre: string;
  proveedor_nombre: string;
  proveedor_ruc:    string;
};

function n(v: number | null | undefined) { return Number(v ?? 0); }

function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("es-EC", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function normalizar(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function categoriaSeccion(
  nombre: string,
): "hospedaje" | "movilizacion" | "alimentacion" | "miscelaneos" {
  const s = normalizar(nombre);
  if (s.includes("hospedaje") || s.includes("alojamiento")) return "hospedaje";
  if (
    s.includes("combustible") || s.includes("movilizacion") ||
    s.includes("taxi") || s.includes("peaje") || s.includes("transporte")
  ) return "movilizacion";
  if (
    s.includes("desayuno") || s.includes("almuerzo") ||
    s.includes("cena") || s.includes("alimentacion")
  ) return "alimentacion";
  return "miscelaneos";
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------
async function fetchGastos(rendicionId: string): Promise<GastoEnriquecido[]> {
  const { data } = await supabase
    .from("gastos")
    .select("*, categorias_gasto(nombre), proveedores(nombre, identificacion)")
    .eq("rendicion_id", rendicionId)
    .is("deleted_at", null)
    .order("fecha");
  return (data ?? []).map((g) => {
    const raw  = g as unknown as Record<string, unknown>;
    const cat  = raw["categorias_gasto"] as { nombre: string } | null;
    const prov = raw["proveedores"] as { nombre: string; identificacion: string | null } | null;
    return {
      ...(g as unknown as Gasto),
      categoria_nombre: cat?.nombre ?? "Miscelaneos",
      proveedor_nombre: prov?.nombre ?? "-",
      proveedor_ruc:    prov?.identificacion ?? "-",
    };
  });
}

async function fetchViajes(rendicionId: string): Promise<Viaje[]> {
  const { data } = await supabase
    .from("viajes").select("*")
    .eq("rendicion_id", rendicionId).order("fecha_inicio");
  return (data ?? []) as unknown as Viaje[];
}

async function fetchPolitica(
  politicaId: string | null | undefined,
  empresaId: string,
): Promise<Politica | null> {
  if (politicaId) {
    const { data } = await supabase
      .from("politicas").select("*").eq("id", politicaId).single();
    if (data) return data as unknown as Politica;
  }
  const { data } = await supabase
    .from("politicas").select("*").eq("empresa_id", empresaId)
    .order("created_at").limit(1).single();
  return (data as unknown as Politica) ?? null;
}

async function fetchUsuarioNombre(uid: string): Promise<string> {
  const { data } = await supabase
    .from("usuarios").select("nombres, apellidos").eq("id", uid).single();
  if (!data) return uid;
  const d = data as unknown as { nombres: string; apellidos: string | null };
  return `${d.nombres} ${d.apellidos ?? ""}`.trim();
}

async function fetchEmpresaNombre(eid: string): Promise<string> {
  const { data } = await supabase
    .from("empresas").select("nombre").eq("id", eid).single();
  return (data as unknown as { nombre: string })?.nombre ?? "Empresa";
}

async function fetchProyectoNombre(pid: string): Promise<string> {
  const { data } = await supabase
    .from("proyectos").select("nombre").eq("id", pid).single();
  return (data as unknown as { nombre: string })?.nombre ?? "-";
}

function aplicarPolitica(
  gastos: GastoEnriquecido[], pol: Politica | null,
): GastoEnriquecido[] {
  if (!pol) return gastos;
  return gastos.map((g) => {
    if (pol.paga_combustible === false && g.categoria_nombre === "Combustible")
      return { ...g, valor_factura: 0 };
    if (pol.paga_peajes === false && g.categoria_nombre === "Peaje")
      return { ...g, valor_factura: 0 };
    return g;
  });
}

// ---------------------------------------------------------------------------
// Export principal
// ---------------------------------------------------------------------------
export async function exportarLiquidacion(rendicion: Rendicion): Promise<void> {
  // 1. Cargar xlsx-js-style y template
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX: any = await import("xlsx-js-style").then((m) => (m as any).default ?? m);

  const tplRes = await fetch("/liquidacion-template.xlsx");
  if (!tplRes.ok) throw new Error("No se pudo cargar el template de liquidacion");
  const tplBuf = await tplRes.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(tplBuf), { type: "array", cellStyles: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ws: Record<string, any> = wb.Sheets["Liquidacion Viaje"];

  // 2. Fetch de datos
  const [gastos, viajes, politica, empleadoNombre, empresaNombre, proyectoNombre] =
    await Promise.all([
      fetchGastos(rendicion.id),
      fetchViajes(rendicion.id),
      fetchPolitica(rendicion.politica_id, rendicion.empresa_id),
      fetchUsuarioNombre(rendicion.usuario_id),
      fetchEmpresaNombre(rendicion.empresa_id),
      fetchProyectoNombre(rendicion.proyecto_id),
    ]);

  const gastosEf    = aplicarPolitica(gastos, politica);
  const valorKm     = n(politica?.valor_km);
  const kmCiudadDia = n(politica?.km_ciudad_por_dia);

  const viajePropio = viajes.find((v) => v.vehiculo_propio) ?? viajes[0] ?? null;
  const destino     = viajePropio?.destino ?? "-";
  const periodo     = viajePropio?.fecha_inicio
    ? `${fmtDate(viajePropio.fecha_inicio)} al ${fmtDate(viajePropio.fecha_fin)}`
    : "-";
  const diasViaje   = viajePropio?.fecha_inicio && viajePropio?.fecha_fin
    ? Math.ceil(
        (new Date(viajePropio.fecha_fin).getTime() -
         new Date(viajePropio.fecha_inicio).getTime()) / 86400000,
      ) + 1
    : 0;

  const hospedajeG = gastosEf.filter((g) => categoriaSeccion(g.categoria_nombre) === "hospedaje");
  const movG       = gastosEf.filter((g) => categoriaSeccion(g.categoria_nombre) === "movilizacion");
  const alimentG   = gastosEf.filter((g) => categoriaSeccion(g.categoria_nombre) === "alimentacion");
  const miscG      = gastosEf.filter((g) => categoriaSeccion(g.categoria_nombre) === "miscelaneos");

  // Filas de km propio
  type KmRow = { concepto: string; km: number; valor: number };
  const kmRows: KmRow[] = viajes
    .filter((v) => v.vehiculo_propio && (v.distancia_km ?? 0) > 0)
    .map((v) => {
      const kmIda   = n(v.distancia_km);
      const kmTotal = kmIda * 2;
      const tray    = v.origen ? `${v.origen} - ${v.destino}` : String(v.destino);
      return {
        concepto: `Vehiculo propio - ${tray} (${kmIda}km x2 x $${valorKm})`,
        km: kmTotal,
        valor: kmTotal * valorKm,
      };
    });

  const kmCiudadValor =
    diasViaje > 0 && kmCiudadDia > 0 ? diasViaje * kmCiudadDia * valorKm : 0;

  // Construir array de filas para seccion B
  type BRow = { concepto: string; ndoc: string; proveedor: string; ruc: string; km: number | ""; valor: number };
  const movRows: BRow[] = [
    ...kmRows.map((kr) => ({
      concepto: kr.concepto, ndoc: "-", proveedor: "Vehiculo propio",
      ruc: "-", km: kr.km, valor: kr.valor,
    })),
    ...(kmCiudadValor > 0
      ? [{
          concepto: `Movilizacion en ciudad (${diasViaje} dias x ${kmCiudadDia} km x $${valorKm})`,
          ndoc: "-", proveedor: "Vehiculo propio",
          ruc: "-", km: diasViaje * kmCiudadDia, valor: kmCiudadValor,
        }]
      : []),
    ...movG.map((g) => ({
      concepto: g.descripcion ?? g.categoria_nombre ?? "-",
      ndoc: g.numero_documento ?? "-",
      proveedor: g.proveedor_nombre,
      ruc: g.proveedor_ruc,
      km: "" as "",
      valor: n(g.valor_factura),
    })),
  ];

  const antEfectivo    = n(rendicion.anticipo_efectivo);
  const antCredito     = n(rendicion.anticipo_credito);

  // 3. Helper: escribir valor en celda preservando estilo existente
  function set(col: string, row: number, val: string | number) {
    const addr = `${col}${row}`;
    const existing = ws[addr] ?? {};
    ws[addr] =
      typeof val === "number"
        ? { ...existing, v: val, t: "n", z: '"$"#,##0.00' }
        : { ...existing, v: val, t: val === "" ? "z" : "s" };
  }

  // 4. Llenar bloque de info
  set("D", 2, empresaNombre);
  set("D", 3, empleadoNombre);
  set("D", 4, proyectoNombre);
  set("D", 5, periodo);
  set("D", 6, destino);
  set("D", 7, rendicion.motivo ?? (rendicion.descripcion ?? "-"));
  set("B", 8, `RENDICION N: ${rendicion.numero}`);
  set("B", 9, `FECHA: ${fmtDate(rendicion.fecha_rendicion)}`);
  set("G", 3, antEfectivo);
  set("G", 4, antCredito);

  // 5. Llenar secciones A / C / D (gastos simples)
  function fillGastos(data: GastoEnriquecido[], r1: number) {
    for (let i = 0; i < MAX_ROWS; i++) {
      const r = r1 + i;
      if (i < data.length) {
        const g = data[i];
        set("B", r, g.descripcion ?? g.categoria_nombre ?? "-");
        set("C", r, g.numero_documento ?? "-");
        set("D", r, g.proveedor_nombre);
        set("E", r, g.proveedor_ruc);
        set("F", r, "");
        set("G", r, n(g.valor_factura));
      } else {
        ["B","C","D","E","F"].forEach((col) => set(col, r, ""));
        set("G", r, 0);
      }
    }
  }

  fillGastos(hospedajeG, RA1);
  fillGastos(alimentG, RC1);
  fillGastos(miscG, RD1);

  // 6. Llenar seccion B (movilizacion con km)
  for (let i = 0; i < MAX_ROWS; i++) {
    const r = RB1 + i;
    if (i < movRows.length) {
      const m = movRows[i];
      set("B", r, m.concepto);
      set("C", r, m.ndoc);
      set("D", r, m.proveedor);
      set("E", r, m.ruc);
      set("F", r, m.km === "" ? "" : m.km);
      set("G", r, m.valor);
    } else {
      ["B","C","D","E","F"].forEach((col) => set(col, r, ""));
      set("G", r, 0);
    }
  }

  // 7. Resumen final  - anticipos (las formulas ya estan en el template)
  set("G", ROW_RF_AE, antEfectivo);
  set("G", ROW_RF_AC, antCredito);

  // 8. Firma empleado
  set("B", ROW_SIG, empleadoNombre);

  // 9. Generar y descargar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf: ArrayBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = `Liquidacion_${rendicion.numero.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
