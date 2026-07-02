/**
 * liquidacion-export.ts
 * Carga xlsx-js-style desde CDN (bypasea Vite CJS/ESM bundling en produccion).
 * Genera el Excel con AOA + estilos manuales cell.s
 */

import { supabase } from "@/integrations/supabase/client";
import type { Gasto, Viaje, Politica, Rendicion } from "@/types/entities";

// ---------------------------------------------------------------------------
// Cargar xlsx-js-style desde CDN (evita CJS interop en Rolldown/produccion)
// ---------------------------------------------------------------------------
async function cargarXLSX(): Promise<unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.XLSX) return w.XLSX;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js";
    s.onload = () => resolve(w.XLSX);
    s.onerror = () => reject(new Error("No se pudo cargar la libreria Excel"));
    document.head.appendChild(s);
  });
}

// ---------------------------------------------------------------------------
// Colores RGB (6 hex, sin # ni alpha)
// ---------------------------------------------------------------------------
const C_TEAL   = "0D4B60";
const C_TEAL2  = "2C4C66";
const C_GRAY_H = "BFC9D0";
const C_LIGHT  = "F6FAFB";
const C_WHITE  = "FFFFFF";
const C_DARK   = "1F2933";
const C_LABEL  = "0D4B60";

// ---------------------------------------------------------------------------
// Helpers de estilo
// ---------------------------------------------------------------------------
function mkFill(rgb: string) {
  return { patternType: "solid" as const, fgColor: { rgb }, bgColor: { rgb } };
}
function mkFont(rgb: string, sz: number, bold = false) {
  return { name: "Arial", sz, bold, color: { rgb } };
}
function mkAlign(h: "left" | "center" | "right") {
  return { horizontal: h, vertical: "center" as const };
}
const THIN = (rgb = "D0D7DE") => ({ style: "thin" as const, color: { rgb } });

type XStyle = Record<string, unknown>;
const S: Record<string, XStyle> = {
  title:        { fill: mkFill(C_TEAL),   font: mkFont(C_WHITE, 12, true), alignment: mkAlign("center") },
  secHdr:       { fill: mkFill(C_TEAL),   font: mkFont(C_WHITE, 9,  true), alignment: mkAlign("left") },
  colHdrL:      { fill: mkFill(C_GRAY_H), font: mkFont("12313F", 8, true), alignment: mkAlign("left"),
                  border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() } },
  colHdrR:      { fill: mkFill(C_GRAY_H), font: mkFont("12313F", 8, true), alignment: mkAlign("right"),
                  border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() } },
  infoLbl:      { fill: mkFill(C_LIGHT),  font: mkFont(C_LABEL, 9, true),  alignment: mkAlign("left") },
  infoVal:      { fill: mkFill(C_LIGHT),  font: mkFont(C_DARK,  9),        alignment: mkAlign("left") },
  infoRHdr:     { fill: mkFill(C_TEAL2),  font: mkFont(C_WHITE, 9, true),  alignment: mkAlign("left") },
  infoRLbl:     { fill: mkFill(C_LIGHT),  font: mkFont(C_LABEL, 9),        alignment: mkAlign("left") },
  infoRLblBold: { fill: mkFill(C_LIGHT),  font: mkFont(C_LABEL, 9, true),  alignment: mkAlign("left") },
  infoRVal:     { fill: mkFill(C_LIGHT),  font: mkFont(C_DARK,  9),        alignment: mkAlign("right") },
  infoRValBold: { fill: mkFill(C_LIGHT),  font: mkFont(C_DARK,  9, true),  alignment: mkAlign("right") },
  dataL:        { font: mkFont(C_DARK, 8), alignment: mkAlign("left"),
                  border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() } },
  dataR:        { font: mkFont(C_DARK, 8), alignment: mkAlign("right"),
                  border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() } },
  subtLbl:      { fill: mkFill(C_LIGHT),  font: mkFont(C_LABEL, 8, true),  alignment: mkAlign("right"),
                  border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() } },
  subtVal:      { fill: mkFill(C_LIGHT),  font: mkFont(C_DARK,  8, true),  alignment: mkAlign("right"),
                  border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() } },
  rfLbl:        { fill: mkFill(C_LIGHT),  font: mkFont(C_LABEL, 9),        alignment: mkAlign("right"),
                  border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() } },
  rfVal:        { fill: mkFill(C_LIGHT),  font: mkFont(C_DARK,  9),        alignment: mkAlign("right"),
                  border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() } },
  rfTotLbl:     { fill: mkFill(C_TEAL),   font: mkFont(C_WHITE, 9, true),  alignment: mkAlign("right"),
                  border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() } },
  rfTotVal:     { fill: mkFill(C_TEAL),   font: mkFont(C_WHITE, 9, true),  alignment: mkAlign("right"),
                  border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() } },
  rfTotFill:    { fill: mkFill(C_TEAL) },
};

// ---------------------------------------------------------------------------
// Tipos de datos
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
// Worksheet helpers
// ---------------------------------------------------------------------------
type WS = Record<string, unknown>;

function sc(ws: WS, col: string, row: number, style: XStyle) {
  const addr = `${col}${row}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cell = ws[addr] as any;
  if (cell) cell.s = style;
}
function scE(ws: WS, col: string, row: number, style: XStyle) {
  const addr = `${col}${row}`;
  if (!ws[addr]) ws[addr] = { t: "s", v: "" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ws[addr] as any).s = style;
}
function scN(ws: WS, col: string, row: number, style: XStyle) {
  const addr = `${col}${row}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cell = ws[addr] as any;
  if (cell) { cell.s = style; cell.z = '"$"#,##0.00'; }
}
function setF(ws: WS, col: string, row: number, f: string, v: number) {
  const addr = `${col}${row}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cell = ws[addr] as any;
  if (cell) { cell.t = "n"; cell.f = f; cell.v = v; cell.z = '"$"#,##0.00'; }
}

type AoaRow = (string | number)[];
function row(...cells: (string | number)[]): AoaRow { return cells; }

// ---------------------------------------------------------------------------
// Export principal
// ---------------------------------------------------------------------------
export async function exportarLiquidacion(rendicion: Rendicion): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (await cargarXLSX()) as any;

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

  const hospedajeG  = gastosEf.filter((g) => categoriaSeccion(g.categoria_nombre) === "hospedaje");
  const movG        = gastosEf.filter((g) => categoriaSeccion(g.categoria_nombre) === "movilizacion");
  const alimentG    = gastosEf.filter((g) => categoriaSeccion(g.categoria_nombre) === "alimentacion");
  const miscG       = gastosEf.filter((g) => categoriaSeccion(g.categoria_nombre) === "miscelaneos");

  type KmRow = { label: string; km: number; valor: number };
  const kmRows: KmRow[] = viajes
    .filter((v) => v.vehiculo_propio && (v.distancia_km ?? 0) > 0)
    .map((v) => {
      const kmIda   = n(v.distancia_km);
      const kmTotal = kmIda * 2;
      const tray    = v.origen ? `${v.origen} - ${v.destino}` : String(v.destino);
      return {
        label: `Vehiculo propio - ${tray} (${kmIda}km x2 x $${valorKm})`,
        km: kmTotal,
        valor: kmTotal * valorKm,
      };
    });

  const kmCiudadValor =
    diasViaje > 0 && kmCiudadDia > 0 ? diasViaje * kmCiudadDia * valorKm : 0;

  const toRow = (g: GastoEnriquecido): AoaRow =>
    row("", g.descripcion ?? g.categoria_nombre ?? "-",
        g.numero_documento ?? "-", g.proveedor_nombre, g.proveedor_ruc, "", n(g.valor_factura));

  const hosData: AoaRow[] = hospedajeG.length > 0
    ? hospedajeG.map(toRow)
    : [row("", "Sin gastos de hospedaje", "", "", "", "", 0)];

  const movData: AoaRow[] = (() => {
    const rows: AoaRow[] = [];
    kmRows.forEach((km) =>
      rows.push(row("", km.label, "-", "Vehiculo propio", "-", km.km, km.valor)));
    if (kmCiudadValor > 0)
      rows.push(row("",
        `Movilizacion en ciudad (${diasViaje} dias x ${kmCiudadDia} km x $${valorKm})`,
        "-", "Vehiculo propio", "-", diasViaje * kmCiudadDia, kmCiudadValor));
    movG.forEach((g) => rows.push(toRow(g)));
    if (rows.length === 0)
      rows.push(row("", "Sin gastos de movilizacion", "", "", "", "", 0));
    return rows;
  })();

  const alimentData: AoaRow[] = alimentG.length > 0
    ? alimentG.map(toRow)
    : [row("", "Sin gastos de alimentacion", "", "", "", "", 0)];
  const miscData: AoaRow[] = miscG.length > 0
    ? miscG.map(toRow)
    : [row("", "Sin gastos miscelaneos", "", "", "", "", 0)];

  const totA = hosData.reduce((s, r) => s + n(r[6] as number), 0);
  const totB = movData.reduce((s, r) => s + n(r[6] as number), 0);
  const totC = alimentData.reduce((s, r) => s + n(r[6] as number), 0);
  const totD = miscData.reduce((s, r) => s + n(r[6] as number), 0);
  const totalGeneral   = totA + totB + totC + totD;
  const antEfectivo    = n(rendicion.anticipo_efectivo);
  const antCredito     = n(rendicion.anticipo_credito);
  const totalAnticipos = antEfectivo + antCredito;
  const diferencia     = totalGeneral - totalAnticipos;

  // Numeros de fila (1-indexed)
  const hosLen     = hosData.length;
  const movLen     = movData.length;
  const alimentLen = alimentData.length;
  const miscLen    = miscData.length;

  const R_A_HDR  = 13;
  const R_A_COL  = 14;
  const R_A_DATA = 15;
  const R_A_SUBT = R_A_DATA + hosLen;
  const R_A_SPC  = R_A_SUBT + 1;
  const R_B_HDR  = R_A_SPC + 1;
  const R_B_COL  = R_B_HDR + 1;
  const R_B_DATA = R_B_COL + 1;
  const R_B_SUBT = R_B_DATA + movLen;
  const R_B_SPC  = R_B_SUBT + 1;
  const R_C_HDR  = R_B_SPC + 1;
  const R_C_COL  = R_C_HDR + 1;
  const R_C_DATA = R_C_COL + 1;
  const R_C_SUBT = R_C_DATA + alimentLen;
  const R_C_SPC  = R_C_SUBT + 1;
  const R_D_HDR  = R_C_SPC + 1;
  const R_D_COL  = R_D_HDR + 1;
  const R_D_DATA = R_D_COL + 1;
  const R_D_SUBT = R_D_DATA + miscLen;
  const R_D_SPC  = R_D_SUBT + 1;
  const R_RF_HDR = R_D_SPC + 1;
  const R_RF_A   = R_RF_HDR + 1;
  const R_RF_B   = R_RF_A + 1;
  const R_RF_C   = R_RF_A + 2;
  const R_RF_D   = R_RF_A + 3;
  const R_RF_TOT = R_RF_A + 4;
  const R_RF_AE  = R_RF_A + 5;
  const R_RF_AC  = R_RF_A + 6;
  const R_RF_DIF = R_RF_A + 7;

  // Info block (filas 2-11)
  const R_I_AE  = 3;
  const R_I_AC  = 4;
  const R_I_TAT = 5;
  const R_I_RA  = 7;
  const R_I_RB  = 8;
  const R_I_RC  = 9;
  const R_I_RD  = 10;
  const R_I_RT  = 11;

  // Construir AOA
  const aoa: AoaRow[] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  const rowHeights: { hpt?: number }[] = [];

  function pushRow(r: AoaRow, hpt: number) { aoa.push(r); rowHeights.push({ hpt }); }
  function merge(r: number, c1: number, c2: number) {
    merges.push({ s: { r: r - 1, c: c1 }, e: { r: r - 1, c: c2 } });
  }

  const COL_HDR: AoaRow = row(
    "", "CONCEPTO / DETALLE", "N FACTURA",
    "EMPRESA / PROVEEDOR", "RUC", "KM", "VALOR ($)",
  );

  // Row 1: Titulo
  pushRow(row("LIQUIDACION DE GASTOS DE VIAJE, HOSPEDAJE Y ALIMENTACION"), 24);
  merge(1, 0, 6);

  // Filas 2-11: Info block
  type IRow = {
    lbl: string; val: string;
    rlbl: string; rval: number | "";
    rhdr?: boolean; rbold?: boolean;
  };
  const infoRows: IRow[] = [
    { lbl: "EMPRESA:",   val: empresaNombre,  rlbl: "RESUMEN DE ANTICIPOS",  rval: "",             rhdr: true  },
    { lbl: "EMPLEADO:",  val: empleadoNombre, rlbl: "Anticipo efectivo:",    rval: antEfectivo                 },
    { lbl: "PROYECTO:",  val: proyectoNombre, rlbl: "Anticipo tarjeta:",     rval: antCredito                  },
    { lbl: "PERIODO:",   val: periodo,        rlbl: "TOTAL ANTICIPOS:",      rval: totalAnticipos, rbold: true  },
    { lbl: "DESTINO:",   val: destino,        rlbl: "RESUMEN POR CATEGORIA", rval: "",             rhdr: true   },
    { lbl: "MOTIVO:",    val: rendicion.motivo ?? (rendicion.descripcion ?? "-"),
                                              rlbl: "A. Hospedaje:",         rval: totA                        },
    { lbl: `RENDICION N: ${rendicion.numero}`, val: "",
                                              rlbl: "B. Movilizacion:",      rval: totB                        },
    { lbl: `FECHA: ${fmtDate(rendicion.fecha_rendicion)}`, val: "",
                                              rlbl: "C. Alimentacion:",      rval: totC                        },
    { lbl: "",           val: "",             rlbl: "D. Miscelaneos:",       rval: totD                        },
    { lbl: "",           val: "",             rlbl: "TOTAL GENERAL:",        rval: totalGeneral,   rbold: true  },
  ];
  infoRows.forEach((ir, i) => {
    const r = 2 + i;
    pushRow(row("", ir.lbl, "", ir.val, ir.rlbl, "", typeof ir.rval === "number" ? ir.rval : ""), 16.05);
    merge(r, 1, 2);
    merge(r, 4, 5);
  });

  // Row 12: spacer
  pushRow(row(), 6);

  // Seccion helper
  function addSec(title: string, data: AoaRow[], rHdr: number, rSubt: number, subtLabel: string, total: number) {
    pushRow(row(title), 18); merge(rHdr, 0, 6);
    pushRow(COL_HDR, 22);
    data.forEach((dr) => pushRow(dr, 14.25));
    pushRow(row("", "", "", "", subtLabel, "", total), 16.05);
    merge(rSubt, 1, 3); merge(rSubt, 4, 5);
    pushRow(row(), 6);
  }

  addSec("A. HOSPEDAJE",    hosData,    R_A_HDR, R_A_SUBT, "SUBTOTAL A - HOSPEDAJE",    totA);
  addSec("B. MOVILIZACION", movData,    R_B_HDR, R_B_SUBT, "SUBTOTAL B - MOVILIZACION", totB);
  addSec("C. ALIMENTACION", alimentData,R_C_HDR, R_C_SUBT, "SUBTOTAL C - ALIMENTACION", totC);
  addSec("D. MISCELANEOS",  miscData,   R_D_HDR, R_D_SUBT, "SUBTOTAL D - MISCELANEOS",  totD);

  // Resumen Final
  pushRow(row("RESUMEN FINAL"), 18); merge(R_RF_HDR, 0, 6);
  const rfItems: [string, number, boolean][] = [
    ["A. Hospedaje",                  totA,         false],
    ["B. Movilizacion",               totB,         false],
    ["C. Alimentacion",               totC,         false],
    ["D. Miscelaneos",                totD,         false],
    ["TOTAL GENERAL",                 totalGeneral, true ],
    ["Menos anticipo efectivo",       antEfectivo,  false],
    ["Menos anticipo tarjeta",        antCredito,   false],
    ["DIFERENCIA A PAGAR / DEVOLVER", diferencia,   true ],
  ];
  rfItems.forEach(([lbl, val]) => {
    const r2 = aoa.length + 1;
    pushRow(row("", "", "", "", lbl, "", val), 16.05);
    merge(r2, 1, 3); merge(r2, 4, 5);
  });

  // Firmas
  pushRow(row(), 8); pushRow(row(), 8);
  const LINE = "___________________________________";
  [
    {
      l: [LINE, empleadoNombre, "Empleado / Viajante"],
      r: [LINE, "Jefe inmediato", "Aprobado por / Firma"],
    },
    {
      l: [LINE, "Aprobado por / Cliente", "Firma / Sello"],
      r: [LINE, "Contabilidad", "Revisado / Firma"],
    },
  ].forEach((fb) => {
    for (let li = 0; li < 3; li++) {
      const r2 = aoa.length + 1;
      pushRow(row("", fb.l[li], "", "", fb.r[li]), li === 0 ? 20 : 13);
      merge(r2, 1, 3); merge(r2, 4, 6);
    }
    pushRow(row(), 10);
  });

  // Crear worksheet desde AOA
  const ws: WS = XLSX.utils.aoa_to_sheet(aoa) as WS;
  ws["!merges"] = merges;
  ws["!cols"]   = [
    { wch: 1.7 }, { wch: 26.8 }, { wch: 14.5 }, { wch: 18.7 },
    { wch: 12.9 }, { wch: 7.3 }, { wch: 6.6 },
  ];
  ws["!rows"]   = rowHeights;
  ws["!ref"]    = `A1:G${aoa.length}`;

  const COLS = ["A", "B", "C", "D", "E", "F", "G"];

  // Row 1: titulo
  COLS.forEach((c) => scE(ws, c, 1, S.title));

  // Info block estilos
  infoRows.forEach((ir, i) => {
    const r = 2 + i;
    scE(ws, "A", r, S.infoVal);
    sc(ws, "B", r, S.infoLbl); scE(ws, "C", r, S.infoLbl);
    sc(ws, "D", r, S.infoVal);
    const rs = ir.rhdr ? S.infoRHdr : (ir.rbold ? S.infoRLblBold : S.infoRLbl);
    sc(ws, "E", r, rs); scE(ws, "F", r, rs);
    if (ir.rhdr) scE(ws, "G", r, S.infoRHdr);
    else scN(ws, "G", r, ir.rbold ? S.infoRValBold : S.infoRVal);
  });

  // Info block formulas (vinculan subtotales)
  setF(ws, "G", R_I_TAT, `G${R_I_AE}+G${R_I_AC}`,                                     totalAnticipos);
  setF(ws, "G", R_I_RA,  `G${R_A_SUBT}`,                                               totA);
  setF(ws, "G", R_I_RB,  `G${R_B_SUBT}`,                                               totB);
  setF(ws, "G", R_I_RC,  `G${R_C_SUBT}`,                                               totC);
  setF(ws, "G", R_I_RD,  `G${R_D_SUBT}`,                                               totD);
  setF(ws, "G", R_I_RT,  `G${R_A_SUBT}+G${R_B_SUBT}+G${R_C_SUBT}+G${R_D_SUBT}`,      totalGeneral);

  // Spacer row 12
  COLS.forEach((c) => scE(ws, c, 12, {}));

  // Estilos por seccion
  function stySec(
    rHdr: number, rCol: number, rData: number, dataLen: number,
    rSubt: number, total: number, fml: string,
  ) {
    COLS.forEach((c) => scE(ws, c, rHdr, S.secHdr));
    COLS.forEach((c, i) => sc(ws, c, rCol, i === 6 ? S.colHdrR : S.colHdrL));
    for (let d = 0; d < dataLen; d++) {
      const dr = rData + d;
      ["A", "B", "C", "D", "E"].forEach((c) => sc(ws, c, dr, S.dataL));
      sc(ws, "F", dr, S.dataR);
      scN(ws, "G", dr, S.dataR);
    }
    scE(ws, "A", rSubt, {});
    scE(ws, "B", rSubt, S.subtLbl); scE(ws, "C", rSubt, S.subtLbl); scE(ws, "D", rSubt, S.subtLbl);
    sc(ws, "E", rSubt, S.subtLbl); scE(ws, "F", rSubt, S.subtLbl);
    scN(ws, "G", rSubt, S.subtVal);
    setF(ws, "G", rSubt, fml, total);
  }

  stySec(R_A_HDR, R_A_COL, R_A_DATA, hosLen,     R_A_SUBT, totA, `SUM(G${R_A_DATA}:G${R_A_DATA + hosLen - 1})`);
  stySec(R_B_HDR, R_B_COL, R_B_DATA, movLen,     R_B_SUBT, totB, `SUM(G${R_B_DATA}:G${R_B_DATA + movLen - 1})`);
  stySec(R_C_HDR, R_C_COL, R_C_DATA, alimentLen, R_C_SUBT, totC, `SUM(G${R_C_DATA}:G${R_C_DATA + alimentLen - 1})`);
  stySec(R_D_HDR, R_D_COL, R_D_DATA, miscLen,    R_D_SUBT, totD, `SUM(G${R_D_DATA}:G${R_D_DATA + miscLen - 1})`);

  // Resumen Final estilos
  COLS.forEach((c) => scE(ws, c, R_RF_HDR, S.secHdr));
  rfItems.forEach(([, , isDark], i) => {
    const r2 = R_RF_A + i;
    scE(ws, "A", r2, isDark ? S.rfTotFill : {});
    scE(ws, "B", r2, isDark ? S.rfTotFill : {});
    scE(ws, "C", r2, isDark ? S.rfTotFill : {});
    scE(ws, "D", r2, isDark ? S.rfTotFill : {});
    sc(ws, "E", r2, isDark ? S.rfTotLbl : S.rfLbl);
    scE(ws, "F", r2, isDark ? S.rfTotLbl : S.rfLbl);
    scN(ws, "G", r2, isDark ? S.rfTotVal : S.rfVal);
  });
  setF(ws, "G", R_RF_A,   `G${R_A_SUBT}`,                                               totA);
  setF(ws, "G", R_RF_B,   `G${R_B_SUBT}`,                                               totB);
  setF(ws, "G", R_RF_C,   `G${R_C_SUBT}`,                                               totC);
  setF(ws, "G", R_RF_D,   `G${R_D_SUBT}`,                                               totD);
  setF(ws, "G", R_RF_TOT, `G${R_RF_A}+G${R_RF_B}+G${R_RF_C}+G${R_RF_D}`,              totalGeneral);
  setF(ws, "G", R_RF_DIF, `G${R_RF_TOT}-G${R_RF_AE}-G${R_RF_AC}`,                      diferencia);

  // Generar y descargar
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Liquidacion Viaje");
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
