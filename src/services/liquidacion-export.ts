/**
 * liquidacion-export.ts
 * Excel de Liquidacion de Viaticos con colores y fuentes completos.
 * Usa xlsx-js-style (fork browser-compatible de SheetJS con soporte de estilos).
 * Columnas: A(spacer) B(Concepto) C(N Doc) D(Proveedor) E(RUC) F(Km) G(Valor)
 */

import { supabase } from "@/integrations/supabase/client";
import type { Gasto, Viaje, Politica, Rendicion } from "@/types/entities";

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
// Definiciones de estilo (xlsx-js-style usa patternType, sz, rgb)
// ---------------------------------------------------------------------------
function makeFill(rgb: string) {
  return { patternType: "solid" as const, fgColor: { rgb }, bgColor: { rgb } };
}
function makeFont(rgb: string, sz: number, bold = false) {
  return { name: "Arial", sz, bold, color: { rgb } };
}
function makeAlign(h: "left" | "center" | "right") {
  return { horizontal: h, vertical: "center" as const, wrapText: false };
}
const THIN = (rgb = "D0D7DE") => ({ style: "thin" as const, color: { rgb } });

type XStyle = Record<string, unknown>;

const S: Record<string, XStyle> = {
  title: {
    fill: makeFill(C_TEAL),
    font: makeFont(C_WHITE, 12, true),
    alignment: makeAlign("center"),
  },
  secHdr: {
    fill: makeFill(C_TEAL),
    font: makeFont(C_WHITE, 9, true),
    alignment: makeAlign("left"),
  },
  colHdrL: {
    fill: makeFill(C_GRAY_H),
    font: makeFont("12313F", 8, true),
    alignment: makeAlign("left"),
    border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() },
  },
  colHdrR: {
    fill: makeFill(C_GRAY_H),
    font: makeFont("12313F", 8, true),
    alignment: makeAlign("right"),
    border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() },
  },
  infoLbl: {
    fill: makeFill(C_LIGHT),
    font: makeFont(C_LABEL, 9, true),
    alignment: makeAlign("left"),
  },
  infoVal: {
    fill: makeFill(C_LIGHT),
    font: makeFont(C_DARK, 9),
    alignment: makeAlign("left"),
  },
  infoRHdr: {
    fill: makeFill(C_TEAL2),
    font: makeFont(C_WHITE, 9, true),
    alignment: makeAlign("left"),
  },
  infoRLbl: {
    fill: makeFill(C_LIGHT),
    font: makeFont(C_LABEL, 9),
    alignment: makeAlign("left"),
  },
  infoRLblBold: {
    fill: makeFill(C_LIGHT),
    font: makeFont(C_LABEL, 9, true),
    alignment: makeAlign("left"),
  },
  infoRVal: {
    fill: makeFill(C_LIGHT),
    font: makeFont(C_DARK, 9),
    alignment: makeAlign("right"),
  },
  infoRValBold: {
    fill: makeFill(C_LIGHT),
    font: makeFont(C_DARK, 9, true),
    alignment: makeAlign("right"),
  },
  dataL: {
    font: makeFont(C_DARK, 8),
    alignment: makeAlign("left"),
    border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() },
  },
  dataR: {
    font: makeFont(C_DARK, 8),
    alignment: makeAlign("right"),
    border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() },
  },
  subtLbl: {
    fill: makeFill(C_LIGHT),
    font: makeFont(C_LABEL, 8, true),
    alignment: makeAlign("right"),
    border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() },
  },
  subtVal: {
    fill: makeFill(C_LIGHT),
    font: makeFont(C_DARK, 8, true),
    alignment: makeAlign("right"),
    border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() },
  },
  rfLbl: {
    fill: makeFill(C_LIGHT),
    font: makeFont(C_LABEL, 9),
    alignment: makeAlign("right"),
    border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() },
  },
  rfVal: {
    fill: makeFill(C_LIGHT),
    font: makeFont(C_DARK, 9),
    alignment: makeAlign("right"),
    border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() },
  },
  rfTotLbl: {
    fill: makeFill(C_TEAL),
    font: makeFont(C_WHITE, 9, true),
    alignment: makeAlign("right"),
    border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() },
  },
  rfTotVal: {
    fill: makeFill(C_TEAL),
    font: makeFont(C_WHITE, 9, true),
    alignment: makeAlign("right"),
    border: { top: THIN(), bottom: THIN(), left: THIN(), right: THIN() },
  },
  rfTotFill: {
    fill: makeFill(C_TEAL),
  },
};

// ---------------------------------------------------------------------------
// Helpers de worksheet
// ---------------------------------------------------------------------------
type WS = Record<string, unknown>;

function sc(ws: WS, col: string, row: number, style: XStyle) {
  const addr = `${col}${row}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cell = ws[addr] as any;
  if (cell) cell.s = style;
}

function scEmpty(ws: WS, col: string, row: number, style: XStyle) {
  const addr = `${col}${row}`;
  if (!ws[addr]) ws[addr] = { t: "s", v: "" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ws[addr] as any).s = style;
}

function scNum(ws: WS, col: string, row: number, style: XStyle, fmt = '"$"#,##0.00') {
  const addr = `${col}${row}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cell = ws[addr] as any;
  if (cell) { cell.s = style; cell.z = fmt; }
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------
type GastoEnriquecido = Gasto & {
  categoria_nombre: string;
  proveedor_nombre: string;
  proveedor_ruc:    string;
};

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
    const { data } = await supabase.from("politicas").select("*").eq("id", politicaId).single();
    if (data) return data as unknown as Politica;
  }
  const { data } = await supabase
    .from("politicas").select("*").eq("empresa_id", empresaId)
    .order("created_at").limit(1).single();
  return (data as unknown as Politica) ?? null;
}

async function fetchUsuarioNombre(usuarioId: string): Promise<string> {
  const { data } = await supabase
    .from("usuarios").select("nombres, apellidos").eq("id", usuarioId).single();
  if (!data) return usuarioId;
  const d = data as unknown as { nombres: string; apellidos: string | null };
  return `${d.nombres} ${d.apellidos ?? ""}`.trim();
}

async function fetchEmpresaNombre(empresaId: string): Promise<string> {
  const { data } = await supabase.from("empresas").select("nombre").eq("id", empresaId).single();
  return (data as unknown as { nombre: string })?.nombre ?? "Empresa";
}

async function fetchProyectoNombre(proyectoId: string): Promise<string> {
  const { data } = await supabase.from("proyectos").select("nombre").eq("id", proyectoId).single();
  return (data as unknown as { nombre: string })?.nombre ?? "-";
}

function aplicarPolitica(gastos: GastoEnriquecido[], pol: Politica | null): GastoEnriquecido[] {
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
// Utilitarios
// ---------------------------------------------------------------------------
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

function categoriaSeccion(nombre: string): "hospedaje" | "movilizacion" | "alimentacion" | "miscelaneos" {
  const s = normalizar(nombre);
  if (s.includes("hospedaje") || s.includes("alojamiento")) return "hospedaje";
  if (s.includes("combustible") || s.includes("movilizacion") || s.includes("taxi") ||
      s.includes("peaje") || s.includes("transporte")) return "movilizacion";
  if (s.includes("desayuno") || s.includes("almuerzo") || s.includes("cena") ||
      s.includes("alimentacion")) return "alimentacion";
  return "miscelaneos";
}

type Cell = string | number;
type AoaRow = Cell[];

function row(...cells: Cell[]): AoaRow { return cells; }

// ---------------------------------------------------------------------------
// Export principal
// ---------------------------------------------------------------------------
export async function exportarLiquidacion(rendicion: Rendicion): Promise<void> {
  // Importacion dinamica para no inflar el bundle principal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX: any = await import("xlsx-js-style").then((m) => (m as any).default ?? m);

  const [gastos, viajes, politica, empleadoNombre, empresaNombre, proyectoNombre] =
    await Promise.all([
      fetchGastos(rendicion.id),
      fetchViajes(rendicion.id),
      fetchPolitica(rendicion.politica_id, rendicion.empresa_id),
      fetchUsuarioNombre(rendicion.usuario_id),
      fetchEmpresaNombre(rendicion.empresa_id),
      fetchProyectoNombre(rendicion.proyecto_id),
    ]);

  const gastosEf     = aplicarPolitica(gastos, politica);
  const valorKm      = n(politica?.valor_km);
  const kmCiudadDia  = n(politica?.km_ciudad_por_dia);

  const viajePropio  = viajes.find((v) => v.vehiculo_propio) ?? viajes[0] ?? null;
  const destino      = viajePropio?.destino ?? "-";
  const periodo      = viajePropio?.fecha_inicio
    ? `${fmtDate(viajePropio.fecha_inicio)} al ${fmtDate(viajePropio.fecha_fin)}`
    : "-";
  const diasViaje    = viajePropio?.fecha_inicio && viajePropio?.fecha_fin
    ? Math.ceil((new Date(viajePropio.fecha_fin).getTime() -
        new Date(viajePropio.fecha_inicio).getTime()) / 86400000) + 1
    : 0;

  const hospedajeG   = gastosEf.filter((g) => categoriaSeccion(g.categoria_nombre) === "hospedaje");
  const movG         = gastosEf.filter((g) => categoriaSeccion(g.categoria_nombre) === "movilizacion");
  const alimentG     = gastosEf.filter((g) => categoriaSeccion(g.categoria_nombre) === "alimentacion");
  const miscG        = gastosEf.filter((g) => categoriaSeccion(g.categoria_nombre) === "miscelaneos");

  type KmRow = { label: string; km: number; valor: number };
  const kmRows: KmRow[] = viajes
    .filter((v) => v.vehiculo_propio && (v.distancia_km ?? 0) > 0)
    .map((v) => {
      const kmIda = n(v.distancia_km);
      const kmTotal = kmIda * 2;
      const trayecto = v.origen ? `${v.origen} - ${v.destino}` : String(v.destino);
      return { label: `Vehiculo propio - ${trayecto} (${kmIda}km x2 x $${valorKm})`, km: kmTotal, valor: kmTotal * valorKm };
    });

  const kmCiudadValor = diasViaje > 0 && kmCiudadDia > 0 ? diasViaje * kmCiudadDia * valorKm : 0;

  const toRow = (g: GastoEnriquecido): AoaRow =>
    row("", g.descripcion ?? g.categoria_nombre ?? "-", g.numero_documento ?? "-",
        g.proveedor_nombre, g.proveedor_ruc, "", n(g.valor_factura));

  const hosData: AoaRow[]  = hospedajeG.length > 0 ? hospedajeG.map(toRow)
    : [row("", "Sin gastos de hospedaje", "", "", "", "", 0)];
  const movData: AoaRow[]  = (() => {
    const rows: AoaRow[] = [];
    kmRows.forEach((km) => rows.push(row("", km.label, "-", "Vehiculo propio", "-", km.km, km.valor)));
    if (kmCiudadValor > 0)
      rows.push(row("", `Movilizacion en ciudad (${diasViaje} dias x ${kmCiudadDia} km x $${valorKm})`,
                    "-", "Vehiculo propio", "-", diasViaje * kmCiudadDia, kmCiudadValor));
    movG.forEach((g) => rows.push(toRow(g)));
    if (rows.length === 0) rows.push(row("", "Sin gastos de movilizacion", "", "", "", "", 0));
    return rows;
  })();
  const alimentData: AoaRow[] = alimentG.length > 0 ? alimentG.map(toRow)
    : [row("", "Sin gastos de alimentacion", "", "", "", "", 0)];
  const miscData: AoaRow[]    = miscG.length > 0 ? miscG.map(toRow)
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

  // ---------------------------------------------------------------------------
  // Pre-calcular numeros de fila (1-indexed para formulas)
  // ---------------------------------------------------------------------------
  const hosLen    = hosData.length;
  const movLen    = movData.length;
  const alimentLen = alimentData.length;
  const miscLen   = miscData.length;

  const R_TITLE    = 1;
  const R_INFO_1   = 2;                        // filas 2..11 (10 filas)
  const R_SPACER_1 = 12;

  const R_A_HDR   = 13;
  const R_A_COL   = 14;
  const R_A_DATA  = 15;
  const R_A_SUBT  = R_A_DATA + hosLen;
  const R_A_SPC   = R_A_SUBT + 1;

  const R_B_HDR   = R_A_SPC + 1;
  const R_B_COL   = R_B_HDR + 1;
  const R_B_DATA  = R_B_COL + 1;
  const R_B_SUBT  = R_B_DATA + movLen;
  const R_B_SPC   = R_B_SUBT + 1;

  const R_C_HDR   = R_B_SPC + 1;
  const R_C_COL   = R_C_HDR + 1;
  const R_C_DATA  = R_C_COL + 1;
  const R_C_SUBT  = R_C_DATA + alimentLen;
  const R_C_SPC   = R_C_SUBT + 1;

  const R_D_HDR   = R_C_SPC + 1;
  const R_D_COL   = R_D_HDR + 1;
  const R_D_DATA  = R_D_COL + 1;
  const R_D_SUBT  = R_D_DATA + miscLen;
  const R_D_SPC   = R_D_SUBT + 1;

  const R_RF_HDR  = R_D_SPC + 1;
  const R_RF_A    = R_RF_HDR + 1;
  const R_RF_B    = R_RF_A + 1;
  const R_RF_C    = R_RF_A + 2;
  const R_RF_D    = R_RF_A + 3;
  const R_RF_TOT  = R_RF_A + 4;
  const R_RF_AE   = R_RF_A + 5;
  const R_RF_AC   = R_RF_A + 6;
  const R_RF_DIF  = R_RF_A + 7;

  // Filas fijas del bloque de info
  const R_I_ANT_EF  = 3;
  const R_I_ANT_CR  = 4;
  const R_I_TOT_ANT = 5;
  const R_I_RES_A   = 7;
  const R_I_RES_B   = 8;
  const R_I_RES_C   = 9;
  const R_I_RES_D   = 10;
  const R_I_RES_T   = 11;

  // ---------------------------------------------------------------------------
  // Construir AOA
  // ---------------------------------------------------------------------------
  const aoa: AoaRow[] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  const rowHeights: { hpt?: number }[] = [];

  function pushRow(r: AoaRow, hpt: number) {
    aoa.push(r);
    rowHeights.push({ hpt });
  }

  function mergeRange(r: number, c1: number, c2: number) {
    merges.push({ s: { r: r - 1, c: c1 }, e: { r: r - 1, c: c2 } });
  }

  const COL_HDR: AoaRow = row("", "CONCEPTO / DETALLE", "N FACTURA",
                               "EMPRESA / PROVEEDOR", "RUC", "KM", "VALOR ($)");

  // Fila 1: titulo
  pushRow(row("LIQUIDACION DE GASTOS DE VIAJE, HOSPEDAJE Y ALIMENTACION"), 24);
  mergeRange(R_TITLE, 0, 6);

  // Info block: filas 2..11
  type InfoDef = { lbl: string; val: string; rLbl: string; rVal: number | ""; rHdr?: boolean; rBold?: boolean };
  const infoBlock: InfoDef[] = [
    { lbl: "EMPRESA:",   val: empresaNombre,       rLbl: "RESUMEN DE ANTICIPOS",  rVal: "", rHdr: true },
    { lbl: "EMPLEADO:",  val: empleadoNombre,       rLbl: "Anticipo efectivo:",    rVal: antEfectivo },
    { lbl: "PROYECTO:",  val: proyectoNombre,       rLbl: "Anticipo tarjeta:",     rVal: antCredito },
    { lbl: "PERIODO:",   val: periodo,              rLbl: "TOTAL ANTICIPOS:",      rVal: totalAnticipos, rBold: true },
    { lbl: "DESTINO:",   val: destino,              rLbl: "RESUMEN POR CATEGORIA", rVal: "", rHdr: true },
    { lbl: "MOTIVO:",    val: rendicion.motivo ?? (rendicion.descripcion ?? "-"),
                                                    rLbl: "A. Hospedaje:",         rVal: totA },
    { lbl: `RENDICION N: ${rendicion.numero}`, val: "",
                                                    rLbl: "B. Movilizacion:",      rVal: totB },
    { lbl: `FECHA: ${fmtDate(rendicion.fecha_rendicion)}`, val: "",
                                                    rLbl: "C. Alimentacion:",      rVal: totC },
    { lbl: "",           val: "",                   rLbl: "D. Miscelaneos:",       rVal: totD },
    { lbl: "",           val: "",                   rLbl: "TOTAL GENERAL:",        rVal: totalGeneral, rBold: true },
  ];
  for (const info of infoBlock) {
    const exRow = aoa.length + 1;
    pushRow(row("", info.lbl, "", info.val, info.rLbl, "", typeof info.rVal === "number" ? info.rVal : ""), 16.05);
    mergeRange(exRow, 1, 2);   // B:C
    mergeRange(exRow, 4, 5);   // E:F
  }

  // Fila 12: espaciador
  pushRow(row(), 6);

  // ---- Helper para secciones ----
  function addSection(
    title: string, data: AoaRow[],
    rHdr: number, rCol: number, rData: number, rSubt: number, rSpc: number,
    subtLabel: string, total: number,
  ) {
    pushRow(row(title), 18);             // header
    mergeRange(rHdr, 0, 6);
    pushRow(COL_HDR, 22);                // col headers
    data.forEach((dr) => pushRow(dr, 14.25));
    // Subtotal
    const idx = aoa.length;
    pushRow(row("", "", "", "", subtLabel, "", total), 16.05);
    mergeRange(rSubt, 1, 3);
    mergeRange(rSubt, 4, 5);
    void idx;
    pushRow(row(), 6);                   // spacer
  }

  addSection("A. HOSPEDAJE", hosData,  R_A_HDR, R_A_COL, R_A_DATA, R_A_SUBT, R_A_SPC, "SUBTOTAL A - HOSPEDAJE", totA);
  addSection("B. MOVILIZACION", movData, R_B_HDR, R_B_COL, R_B_DATA, R_B_SUBT, R_B_SPC, "SUBTOTAL B - MOVILIZACION", totB);
  addSection("C. ALIMENTACION", alimentData, R_C_HDR, R_C_COL, R_C_DATA, R_C_SUBT, R_C_SPC, "SUBTOTAL C - ALIMENTACION", totC);
  addSection("D. MISCELANEOS", miscData, R_D_HDR, R_D_COL, R_D_DATA, R_D_SUBT, R_D_SPC, "SUBTOTAL D - MISCELANEOS", totD);

  // Resumen final
  pushRow(row("RESUMEN FINAL"), 18);
  mergeRange(R_RF_HDR, 0, 6);
  const rfItems: [string, number, boolean][] = [
    ["A. Hospedaje",                totA,         false],
    ["B. Movilizacion",             totB,         false],
    ["C. Alimentacion",             totC,         false],
    ["D. Miscelaneos",              totD,         false],
    ["TOTAL GENERAL",               totalGeneral, true],
    ["Menos anticipo efectivo",     antEfectivo,  false],
    ["Menos anticipo tarjeta",      antCredito,   false],
    ["DIFERENCIA A PAGAR / DEVOLVER", diferencia, true],
  ];
  for (const [lbl, val] of rfItems) {
    const exRow = aoa.length + 1;
    pushRow(row("", "", "", "", lbl, "", val), 16.05);
    mergeRange(exRow, 1, 3);
    mergeRange(exRow, 4, 5);
  }

  // Espaciadores y firmas
  pushRow(row(), 8);
  pushRow(row(), 8);
  const LINE = "___________________________________";
  type FirmaBlock = { left: string[]; right: string[] };
  const firmaBlocks: FirmaBlock[] = [
    { left: [LINE, empleadoNombre, "Empleado / Viajante"],
      right: [LINE, "Jefe inmediato", "Aprobado por / Firma"] },
    { left: [LINE, "Aprobado por Cliente", "Firma / Sello"],
      right: [LINE, "Contabilidad", "Revisado / Firma"] },
  ];
  for (const fb of firmaBlocks) {
    for (let li = 0; li < 3; li++) {
      const exRow = aoa.length + 1;
      pushRow(row("", fb.left[li], "", "", fb.right[li]), li === 0 ? 20 : 13);
      mergeRange(exRow, 1, 3);
      mergeRange(exRow, 4, 6);
    }
    pushRow(row(), 10);
  }

  // ---------------------------------------------------------------------------
  // Crear worksheet y aplicar estilos
  // ---------------------------------------------------------------------------
  const ws: WS = XLSX.utils.aoa_to_sheet(aoa) as WS;

  ws["!merges"]  = merges;
  ws["!cols"]    = [
    { wch: 1.7 }, { wch: 26.8 }, { wch: 14.5 }, { wch: 18.7 },
    { wch: 12.9 }, { wch: 7.3 }, { wch: 6.6 },
  ];
  ws["!rows"] = rowHeights;

  // Ajustar ref del rango si es necesario (xlsx-js-style lo necesita)
  const lastRow = aoa.length;
  ws["!ref"] = `A1:G${lastRow}`;

  const COLS = ["A","B","C","D","E","F","G"];

  // ROW 1: Titulo
  COLS.forEach((col) => scEmpty(ws, col, R_TITLE, S.title));

  // Rows 2-11: Bloque de info
  infoBlock.forEach((info, i) => {
    const r = R_INFO_1 + i;
    scEmpty(ws, "A", r, S.infoVal);
    sc(ws, "B", r, S.infoLbl);
    scEmpty(ws, "C", r, S.infoLbl);
    sc(ws, "D", r, S.infoVal);
    const rStyle = info.rHdr ? S.infoRHdr : (info.rBold ? S.infoRLblBold : S.infoRLbl);
    sc(ws, "E", r, rStyle);
    scEmpty(ws, "F", r, rStyle);
    if (info.rHdr) {
      scEmpty(ws, "G", r, S.infoRHdr);
    } else {
      scNum(ws, "G", r, info.rBold ? S.infoRValBold : S.infoRVal);
    }
  });

  // Formulas para bloque de info
  function setF(col: string, row2: number, formula: string, v: number) {
    const addr = `${col}${row2}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cell = ws[addr] as any;
    if (cell) { cell.t = "n"; cell.f = formula; cell.v = v; cell.z = '"$"#,##0.00'; }
  }
  setF("G", R_I_TOT_ANT, `G${R_I_ANT_EF}+G${R_I_ANT_CR}`, totalAnticipos);
  setF("G", R_I_RES_A, `G${R_A_SUBT}`, totA);
  setF("G", R_I_RES_B, `G${R_B_SUBT}`, totB);
  setF("G", R_I_RES_C, `G${R_C_SUBT}`, totC);
  setF("G", R_I_RES_D, `G${R_D_SUBT}`, totD);
  setF("G", R_I_RES_T, `G${R_A_SUBT}+G${R_B_SUBT}+G${R_C_SUBT}+G${R_D_SUBT}`, totalGeneral);

  // Espaciador row 12
  COLS.forEach((col) => scEmpty(ws, col, R_SPACER_1, {}));

  // Helper: estilar una seccion completa
  function stySec(
    rHdr: number, rCol: number, rData: number, dataLen: number,
    rSubt: number, total: number, subtFml: string,
  ) {
    // Section header
    COLS.forEach((col) => scEmpty(ws, col, rHdr, S.secHdr));
    // Column headers
    COLS.forEach((col, i) => sc(ws, col, rCol, i === 6 ? S.colHdrR : S.colHdrL));
    // Data rows
    for (let d = 0; d < dataLen; d++) {
      const dr = rData + d;
      sc(ws, "A", dr, S.dataL);
      ["B","C","D","E"].forEach((col) => sc(ws, col, dr, S.dataL));
      sc(ws, "F", dr, S.dataR);
      scNum(ws, "G", dr, S.dataR);
    }
    // Subtotal
    scEmpty(ws, "A", rSubt, {});
    scEmpty(ws, "B", rSubt, S.subtLbl);
    scEmpty(ws, "C", rSubt, S.subtLbl);
    scEmpty(ws, "D", rSubt, S.subtLbl);
    sc(ws, "E", rSubt, S.subtLbl);
    scEmpty(ws, "F", rSubt, S.subtLbl);
    scNum(ws, "G", rSubt, S.subtVal);
    // Formula para subtotal
    setF("G", rSubt, subtFml, total);
  }

  stySec(R_A_HDR, R_A_COL, R_A_DATA, hosLen, R_A_SUBT, totA,
    `SUM(G${R_A_DATA}:G${R_A_DATA + hosLen - 1})`);
  stySec(R_B_HDR, R_B_COL, R_B_DATA, movLen, R_B_SUBT, totB,
    `SUM(G${R_B_DATA}:G${R_B_DATA + movLen - 1})`);
  stySec(R_C_HDR, R_C_COL, R_C_DATA, alimentLen, R_C_SUBT, totC,
    `SUM(G${R_C_DATA}:G${R_C_DATA + alimentLen - 1})`);
  stySec(R_D_HDR, R_D_COL, R_D_DATA, miscLen, R_D_SUBT, totD,
    `SUM(G${R_D_DATA}:G${R_D_DATA + miscLen - 1})`);

  // Resumen Final: header
  COLS.forEach((col) => scEmpty(ws, col, R_RF_HDR, S.secHdr));

  // Resumen Final: items
  rfItems.forEach(([, , isDark], i) => {
    const r = R_RF_A + i;
    scEmpty(ws, "A", r, isDark ? S.rfTotFill : {});
    scEmpty(ws, "B", r, isDark ? S.rfTotFill : {});
    scEmpty(ws, "C", r, isDark ? S.rfTotFill : {});
    scEmpty(ws, "D", r, isDark ? S.rfTotFill : {});
    sc(ws, "E", r, isDark ? S.rfTotLbl : S.rfLbl);
    scEmpty(ws, "F", r, isDark ? S.rfTotLbl : S.rfLbl);
    scNum(ws, "G", r, isDark ? S.rfTotVal : S.rfVal);
  });

  // Formulas resumen final
  setF("G", R_RF_A, `G${R_A_SUBT}`, totA);
  setF("G", R_RF_B, `G${R_B_SUBT}`, totB);
  setF("G", R_RF_C, `G${R_C_SUBT}`, totC);
  setF("G", R_RF_D, `G${R_D_SUBT}`, totD);
  setF("G", R_RF_TOT, `G${R_RF_A}+G${R_RF_B}+G${R_RF_C}+G${R_RF_D}`, totalGeneral);
  setF("G", R_RF_DIF, `G${R_RF_TOT}-G${R_RF_AE}-G${R_RF_AC}`, diferencia);

  // ---------------------------------------------------------------------------
  // Generar y descargar
  // ---------------------------------------------------------------------------
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
