/**
 * liquidacion-export.ts
 * Genera el Excel de Liquidacion de Viaticos (formato template de referencia).
 * Usa ExcelJS (browser-compatible) para colores, fuentes y merges exactos.
 * Columnas: A(spacer) B(Concepto/Detalle) C(N Doc) D(Empresa/Proveedor) E(RUC) F(Km) G(Valor)
 * SECURITY: ninguna API Key expuesta; datos via Supabase con RLS.
 */

import type * as ExcelJSTypes from "exceljs";
import { supabase } from "@/integrations/supabase/client";
import type { Gasto, Viaje, Politica, Rendicion } from "@/types/entities";

// ---------------------------------------------------------------------------
// Colores (ARGB - sin #, con FF de opacidad completa)
// ---------------------------------------------------------------------------
const C_TEAL   = "FF0D4B60"; // titulo + encabezados de seccion
const C_TEAL2  = "FF2C4C66"; // encabezado resumen anticipos (derecha)
const C_GRAY_H = "FFBFC9D0"; // fondo encabezado de columnas
const C_LIGHT  = "FFF6FAFB"; // fondo celdas de informacion
const C_WHITE  = "FFFFFFFF";
const C_DARK   = "FF1F2933";
const C_LABEL  = "FF0D4B60"; // texto etiquetas izquierda

// ---------------------------------------------------------------------------
// Helpers genericos
// ---------------------------------------------------------------------------
function n(v: number | null | undefined): number {
  return Number(v ?? 0);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("es-EC", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function categoriaSeccion(
  nombre: string,
): "hospedaje" | "movilizacion" | "alimentacion" | "miscelaneos" {
  const s = normalizar(nombre);
  if (s.includes("hospedaje") || s.includes("alojamiento")) return "hospedaje";
  if (
    s.includes("combustible") ||
    s.includes("movilizacion") ||
    s.includes("taxi") ||
    s.includes("peaje") ||
    s.includes("transporte")
  ) return "movilizacion";
  if (
    s.includes("desayuno") ||
    s.includes("almuerzo") ||
    s.includes("cena") ||
    s.includes("alimentacion")
  ) return "alimentacion";
  return "miscelaneos";
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------
type GastoEnriquecido = Gasto & {
  categoria_nombre: string;
  proveedor_nombre: string;
  proveedor_ruc: string;
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
// Tipos de fila de datos (para secciones A-D)
// ---------------------------------------------------------------------------
type DataRow = {
  concepto:  string;
  factura:   string;
  proveedor: string;
  ruc:       string;
  km:        number | "";
  valor:     number;
};

// ---------------------------------------------------------------------------
// Helpers de estilo ExcelJS
// ---------------------------------------------------------------------------
type ECell = ExcelJSTypes.Cell;

function fill(cell: ECell, argb: string) {
  (cell as unknown as {
    fill: { type: string; pattern: string; fgColor: { argb: string } };
  }).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function font(
  cell: ECell,
  opts: { size?: number; bold?: boolean; color?: string; name?: string },
) {
  (cell as unknown as {
    font: { name: string; size: number; bold: boolean; color: { argb: string } };
  }).font = {
    name:  opts.name  ?? "Arial",
    size:  opts.size  ?? 8,
    bold:  opts.bold  ?? false,
    color: { argb: opts.color ?? C_DARK },
  };
}

function align(
  cell: ECell,
  horizontal: "left" | "center" | "right" = "left",
  vertical: "top" | "middle" | "bottom" = "middle",
  wrapText = false,
) {
  (cell as unknown as {
    alignment: { horizontal: string; vertical: string; wrapText: boolean };
  }).alignment = { horizontal, vertical, wrapText };
}

function numFmt(cell: ECell, fmt: string) {
  (cell as unknown as { numFmt: string }).numFmt = fmt;
}

const FMT_CURRENCY = '"$"#,##0.00';

function setCurrency(cell: ECell, value: number) {
  (cell as unknown as { value: number }).value = value;
  numFmt(cell, FMT_CURRENCY);
}

function setFormula(cell: ECell, formula: string, result: number) {
  (cell as unknown as { value: { formula: string; result: number } }).value = { formula, result };
  numFmt(cell, FMT_CURRENCY);
}

function thinBorder(cell: ECell) {
  const s = { style: "thin" as const, color: { argb: "FFCDD5DC" } };
  (cell as unknown as {
    border: { top: typeof s; left: typeof s; bottom: typeof s; right: typeof s };
  }).border = { top: s, left: s, bottom: s, right: s };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export async function exportarLiquidacion(rendicion: Rendicion): Promise<void> {
  // Carga dinamica: ExcelJS es grande, no va en el bundle principal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ExcelJSMod = await import("exceljs") as any;
  // Maneja tanto ESM namespace como CJS interop de Vite (default vs named exports)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const ExcelJS = ExcelJSMod.default ?? ExcelJSMod;

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

  type KmRow = { label: string; km: number; valor: number };
  const kmRows: KmRow[] = viajes
    .filter((v) => v.vehiculo_propio && (v.distancia_km ?? 0) > 0)
    .map((v) => {
      const kmIda    = n(v.distancia_km);
      const kmTotal  = kmIda * 2;
      const trayecto = v.origen ? `${v.origen} - ${v.destino}` : String(v.destino);
      return {
        label: `Vehiculo propio - ${trayecto} (${kmIda}km x2 x $${valorKm})`,
        km:    kmTotal,
        valor: kmTotal * valorKm,
      };
    });

  const kmCiudadValor = diasViaje > 0 && kmCiudadDia > 0
    ? diasViaje * kmCiudadDia * valorKm : 0;

  const toDataRow = (g: GastoEnriquecido): DataRow => ({
    concepto:  g.descripcion ?? g.categoria_nombre ?? "-",
    factura:   g.numero_documento ?? "-",
    proveedor: g.proveedor_nombre,
    ruc:       g.proveedor_ruc,
    km:        "",
    valor:     n(g.valor_factura),
  });

  const hosRows: DataRow[] = hospedajeG.map(toDataRow);
  const movRows: DataRow[] = [
    ...kmRows.map((km): DataRow => ({
      concepto:  km.label,
      factura:   "-",
      proveedor: "Vehiculo propio",
      ruc:       "-",
      km:        km.km,
      valor:     km.valor,
    })),
    ...(kmCiudadValor > 0 ? [{
      concepto:  `Movilizacion en ciudad (${diasViaje} dias x ${kmCiudadDia} km x $${valorKm})`,
      factura:   "-",
      proveedor: "Vehiculo propio",
      ruc:       "-",
      km:        diasViaje * kmCiudadDia,
      valor:     kmCiudadValor,
    }] : []),
    ...movG.map(toDataRow),
  ];
  const alimentRows: DataRow[] = alimentG.map(toDataRow);
  const miscRows:    DataRow[] = miscG.map(toDataRow);

  // Totales calculados (para cache de resultados de formulas)
  const totA = hosRows.reduce((s, r) => s + r.valor, 0);
  const totB = movRows.reduce((s, r) => s + r.valor, 0);
  const totC = alimentRows.reduce((s, r) => s + r.valor, 0);
  const totD = miscRows.reduce((s, r) => s + r.valor, 0);
  const totalGeneral   = totA + totB + totC + totD;
  const antEfectivo    = n(rendicion.anticipo_efectivo);
  const antCredito     = n(rendicion.anticipo_credito);
  const totalAnticipos = antEfectivo + antCredito;
  const diferencia     = totalGeneral - totalAnticipos;

  // -------------------------------------------------------------------------
  // Pre-calcular todos los numeros de fila (1-indexed, Excel)
  // -------------------------------------------------------------------------
  const hosLen    = Math.max(hosRows.length, 1);
  const movLen    = Math.max(movRows.length, 1);
  const alimentLen = Math.max(alimentRows.length, 1);
  const miscLen   = Math.max(miscRows.length, 1);

  // Bloque titulo + info
  const R_TITLE    = 1;
  const R_INFO_1   = 2;   // filas 2..11 = bloque info (10 filas)
  const R_SPACER_1 = 12;

  // Seccion A
  const R_A_HDR   = 13;
  const R_A_COL   = 14;
  const R_A_DATA  = 15;
  const R_A_SUBT  = R_A_DATA + hosLen;       // subtotal A
  const R_A_SPC   = R_A_SUBT + 1;

  // Seccion B
  const R_B_HDR   = R_A_SPC + 1;
  const R_B_COL   = R_B_HDR + 1;
  const R_B_DATA  = R_B_COL + 1;
  const R_B_SUBT  = R_B_DATA + movLen;
  const R_B_SPC   = R_B_SUBT + 1;

  // Seccion C
  const R_C_HDR   = R_B_SPC + 1;
  const R_C_COL   = R_C_HDR + 1;
  const R_C_DATA  = R_C_COL + 1;
  const R_C_SUBT  = R_C_DATA + alimentLen;
  const R_C_SPC   = R_C_SUBT + 1;

  // Seccion D
  const R_D_HDR   = R_C_SPC + 1;
  const R_D_COL   = R_D_HDR + 1;
  const R_D_DATA  = R_D_COL + 1;
  const R_D_SUBT  = R_D_DATA + miscLen;
  const R_D_SPC   = R_D_SUBT + 1;

  // Resumen final
  const R_RF_HDR  = R_D_SPC + 1;
  const R_RF_A    = R_RF_HDR + 1;
  const R_RF_B    = R_RF_A + 1;
  const R_RF_C    = R_RF_A + 2;
  const R_RF_D    = R_RF_A + 3;
  const R_RF_TOT  = R_RF_A + 4;
  const R_RF_AE   = R_RF_A + 5;
  const R_RF_AC   = R_RF_A + 6;
  const R_RF_DIF  = R_RF_A + 7;

  // Filas del bloque de info (fijas, no dependen de datos)
  const R_I_ANT_EF = R_INFO_1 + 1; // fila 3: anticipo efectivo (G)
  const R_I_ANT_CR = R_INFO_1 + 2; // fila 4: anticipo tarjeta  (G)
  const R_I_TOT_ANT = R_INFO_1 + 3; // fila 5: total anticipos  (G)
  const R_I_RES_A  = R_INFO_1 + 5; // fila 7: A. Hospedaje      (G)
  const R_I_RES_B  = R_INFO_1 + 6; // fila 8: B. Movilizacion   (G)
  const R_I_RES_C  = R_INFO_1 + 7; // fila 9: C. Alimentacion   (G)
  const R_I_RES_D  = R_INFO_1 + 8; // fila 10: D. Miscelaneos   (G)
  const R_I_RES_T  = R_INFO_1 + 9; // fila 11: TOTAL GENERAL    (G)

  // -------------------------------------------------------------------------
  // Construir el workbook
  // -------------------------------------------------------------------------
  const wb = new ExcelJS.Workbook();
  wb.creator = "VIATIQ";
  wb.created = new Date();
  const ws  = wb.addWorksheet("Liquidacion Viaje");

  ws.columns = [
    { width: 1.7  }, // A
    { width: 26.8 }, // B
    { width: 14.5 }, // C
    { width: 18.7 }, // D
    { width: 12.9 }, // E
    { width: 7.3  }, // F
    { width: 6.6  }, // G
  ];

  // Helper: referencia de celda por columna letra + fila numero
  const c = (col: string, row: number) => ws.getCell(`${col}${row}`);

  // =========================================================================
  // ROW 1: Titulo
  // =========================================================================
  ws.getRow(R_TITLE).height = 24;
  ws.mergeCells(`A${R_TITLE}:G${R_TITLE}`);
  {
    const cell = c("A", R_TITLE);
    cell.value = "LIQUIDACION DE GASTOS DE VIAJE, HOSPEDAJE Y ALIMENTACION";
    fill(cell, C_TEAL);
    font(cell, { size: 12, bold: true, color: C_WHITE });
    align(cell, "center");
  }

  // =========================================================================
  // ROWS 2-11: Bloque de informacion
  // =========================================================================
  type InfoRow = {
    labelL: string;
    valL:   string;
    labelR: string;
    valR:   number | "";
    bgR?:   string;   // fondo del lado derecho (E:F y G)
    boldR?: boolean;  // negrita en el valor derecho
  };

  const infoBlock: InfoRow[] = [
    // fila 2: EMPRESA / RESUMEN DE ANTICIPOS (encabezado derecha, sin valor G)
    { labelL: "EMPRESA:",           valL: empresaNombre,
      labelR: "RESUMEN DE ANTICIPOS",  valR: "", bgR: C_TEAL2 },
    // fila 3: EMPLEADO / Anticipo efectivo
    { labelL: "EMPLEADO:",          valL: empleadoNombre,
      labelR: "Anticipo efectivo:", valR: antEfectivo },
    // fila 4: PROYECTO / Anticipo tarjeta
    { labelL: "PROYECTO:",          valL: proyectoNombre,
      labelR: "Anticipo tarjeta:",  valR: antCredito },
    // fila 5: PERIODO / TOTAL ANTICIPOS
    { labelL: "PERIODO:",           valL: periodo,
      labelR: "TOTAL ANTICIPOS:",   valR: totalAnticipos, boldR: true },
    // fila 6: DESTINO / RESUMEN POR CATEGORIA (encabezado derecha)
    { labelL: "DESTINO:",           valL: destino,
      labelR: "RESUMEN POR CATEGORIA", valR: "", bgR: C_TEAL2 },
    // fila 7: MOTIVO / A. Hospedaje
    { labelL: "MOTIVO:",
      valL:   rendicion.motivo ?? (rendicion.descripcion ?? "-"),
      labelR: "A. Hospedaje:",      valR: totA },
    // fila 8: RENDICION N / B. Movilizacion
    { labelL: `RENDICION N: ${rendicion.numero}`, valL: "",
      labelR: "B. Movilizacion:",   valR: totB },
    // fila 9: FECHA / C. Alimentacion
    { labelL: `FECHA: ${fmtDate(rendicion.fecha_rendicion)}`, valL: "",
      labelR: "C. Alimentacion:",   valR: totC },
    // fila 10: (vacio) / D. Miscelaneos
    { labelL: "",                   valL: "",
      labelR: "D. Miscelaneos:",    valR: totD },
    // fila 11: (vacio) / TOTAL GENERAL
    { labelL: "",                   valL: "",
      labelR: "TOTAL GENERAL:",     valR: totalGeneral, boldR: true },
  ];

  infoBlock.forEach((info, i) => {
    const row = R_INFO_1 + i;
    ws.getRow(row).height = 16.05;
    ws.mergeCells(`B${row}:C${row}`);
    ws.mergeCells(`E${row}:F${row}`);

    // A: vacia con fondo claro
    fill(c("A", row), C_LIGHT);

    // B:C merged = etiqueta izquierda
    const bc = c("B", row);
    bc.value = info.labelL;
    fill(bc, C_LIGHT);
    font(bc, { size: 8.5, bold: true, color: C_LABEL });
    align(bc, "left");

    // D = valor izquierdo
    const cd = c("D", row);
    cd.value = info.valL;
    fill(cd, C_LIGHT);
    font(cd, { size: 8.5, color: C_DARK });
    align(cd, "left");

    // E:F merged = etiqueta derecha
    const ef = c("E", row);
    ef.value = info.labelR;
    if (info.bgR) {
      fill(ef, info.bgR);
      font(ef, { size: 8.5, bold: true, color: C_WHITE });
    } else {
      fill(ef, C_LIGHT);
      font(ef, { size: 8.5, bold: info.boldR ?? false, color: C_LABEL });
    }
    align(ef, "left");

    // G = valor derecho
    const cg = c("G", row);
    if (info.bgR) {
      cg.value = "";
      fill(cg, info.bgR);
    } else if (typeof info.valR === "number") {
      setCurrency(cg, info.valR);
      fill(cg, C_LIGHT);
      font(cg, { size: 8.5, bold: info.boldR ?? false, color: C_DARK });
      align(cg, "right");
    } else {
      cg.value = "";
      fill(cg, C_LIGHT);
    }
  });

  // Parchear celdas con formulas en bloque de info
  setFormula(c("G", R_I_TOT_ANT), `G${R_I_ANT_EF}+G${R_I_ANT_CR}`, totalAnticipos);
  fill(c("G", R_I_TOT_ANT), C_LIGHT);
  font(c("G", R_I_TOT_ANT), { size: 8.5, bold: true, color: C_DARK });
  align(c("G", R_I_TOT_ANT), "right");

  // Fila 12: espaciador
  ws.getRow(R_SPACER_1).height = 6;

  // =========================================================================
  // Helper: escribir seccion (header + col headers + datos + subtotal + spacer)
  // =========================================================================
  function writeSection(
    title:       string,
    rows:        DataRow[],
    emptyMsg:    string,
    rHdr:        number, // fila del encabezado de seccion
    rColHdr:     number, // fila de encabezados de columna
    rData:       number, // primera fila de datos
    rSubt:       number, // fila de subtotal
    rSpc:        number, // fila espaciador post-subtotal
    subtLabel:   string, // ej. "SUBTOTAL A - HOSPEDAJE"
    totalVal:    number, // total de la seccion
  ) {
    // Encabezado de seccion
    ws.getRow(rHdr).height = 18;
    ws.mergeCells(`A${rHdr}:G${rHdr}`);
    const hCell = c("A", rHdr);
    hCell.value = title;
    fill(hCell, C_TEAL);
    font(hCell, { size: 9, bold: true, color: C_WHITE });
    align(hCell, "left");

    // Encabezado de columnas
    ws.getRow(rColHdr).height = 22;
    const colNames = ["", "CONCEPTO / DETALLE", "N FACTURA", "EMPRESA / PROVEEDOR", "RUC", "KM", "VALOR ($)"];
    const colLetrs = ["A", "B", "C", "D", "E", "F", "G"];
    colNames.forEach((name, i) => {
      const cell = c(colLetrs[i], rColHdr);
      cell.value = name;
      fill(cell, C_GRAY_H);
      font(cell, { size: 8, bold: true, color: "FF12313F" });
      align(cell, i === 6 ? "center" : "left");
      thinBorder(cell);
    });

    // Filas de datos
    const effectiveRows: DataRow[] = rows.length > 0
      ? rows
      : [{ concepto: emptyMsg, factura: "", proveedor: "", ruc: "", km: "", valor: 0 }];

    effectiveRows.forEach((dr, idx) => {
      const row = rData + idx;
      ws.getRow(row).height = 14.25;
      const vals: (string | number)[] = [
        "", dr.concepto, dr.factura, dr.proveedor, dr.ruc,
        dr.km === "" ? "" : dr.km,
        dr.valor,
      ];
      vals.forEach((val, i) => {
        const cell = c(colLetrs[i], row);
        cell.value = val as string | number;
        font(cell, { size: 8, color: C_DARK });
        align(cell, i === 6 ? "right" : "left");
        thinBorder(cell);
        if (i === 6 && typeof val === "number") numFmt(cell, FMT_CURRENCY);
      });
    });

    // Fila de subtotal
    ws.getRow(rSubt).height = 16.05;
    ws.mergeCells(`B${rSubt}:D${rSubt}`);
    ws.mergeCells(`E${rSubt}:F${rSubt}`);
    c("A", rSubt).value = "";
    c("B", rSubt).value = "";
    fill(c("B", rSubt), C_LIGHT);

    const eCell = c("E", rSubt);
    eCell.value = subtLabel;
    fill(eCell, C_LIGHT);
    font(eCell, { size: 8, bold: true, color: C_LABEL });
    align(eCell, "right");
    thinBorder(eCell);

    const gCell = c("G", rSubt);
    setFormula(gCell, `SUM(G${rData}:G${rData + effectiveRows.length - 1})`, totalVal);
    fill(gCell, C_LIGHT);
    font(gCell, { size: 8, bold: true, color: C_DARK });
    align(gCell, "right");
    thinBorder(gCell);

    // Espaciador
    ws.getRow(rSpc).height = 6;
  }

  // =========================================================================
  // Escribir secciones A, B, C, D
  // =========================================================================
  writeSection(
    "A. HOSPEDAJE", hosRows, "Sin gastos de hospedaje",
    R_A_HDR, R_A_COL, R_A_DATA, R_A_SUBT, R_A_SPC,
    "SUBTOTAL A - HOSPEDAJE", totA,
  );
  writeSection(
    "B. MOVILIZACION", movRows, "Sin gastos de movilizacion",
    R_B_HDR, R_B_COL, R_B_DATA, R_B_SUBT, R_B_SPC,
    "SUBTOTAL B - MOVILIZACION", totB,
  );
  writeSection(
    "C. ALIMENTACION", alimentRows, "Sin gastos de alimentacion",
    R_C_HDR, R_C_COL, R_C_DATA, R_C_SUBT, R_C_SPC,
    "SUBTOTAL C - ALIMENTACION", totC,
  );
  writeSection(
    "D. MISCELANEOS", miscRows, "Sin gastos miscelaneos",
    R_D_HDR, R_D_COL, R_D_DATA, R_D_SUBT, R_D_SPC,
    "SUBTOTAL D - MISCELANEOS", totD,
  );

  // Actualizar celdas G del bloque de info con referencias a los subtotales
  setFormula(c("G", R_I_RES_A), `G${R_A_SUBT}`, totA);
  fill(c("G", R_I_RES_A), C_LIGHT);
  font(c("G", R_I_RES_A), { size: 8.5, color: C_DARK }); align(c("G", R_I_RES_A), "right");

  setFormula(c("G", R_I_RES_B), `G${R_B_SUBT}`, totB);
  fill(c("G", R_I_RES_B), C_LIGHT);
  font(c("G", R_I_RES_B), { size: 8.5, color: C_DARK }); align(c("G", R_I_RES_B), "right");

  setFormula(c("G", R_I_RES_C), `G${R_C_SUBT}`, totC);
  fill(c("G", R_I_RES_C), C_LIGHT);
  font(c("G", R_I_RES_C), { size: 8.5, color: C_DARK }); align(c("G", R_I_RES_C), "right");

  setFormula(c("G", R_I_RES_D), `G${R_D_SUBT}`, totD);
  fill(c("G", R_I_RES_D), C_LIGHT);
  font(c("G", R_I_RES_D), { size: 8.5, color: C_DARK }); align(c("G", R_I_RES_D), "right");

  setFormula(
    c("G", R_I_RES_T),
    `G${R_A_SUBT}+G${R_B_SUBT}+G${R_C_SUBT}+G${R_D_SUBT}`,
    totalGeneral,
  );
  fill(c("G", R_I_RES_T), C_LIGHT);
  font(c("G", R_I_RES_T), { size: 8.5, bold: true, color: C_DARK });
  align(c("G", R_I_RES_T), "right");

  // =========================================================================
  // RESUMEN FINAL
  // =========================================================================
  ws.getRow(R_RF_HDR).height = 18;
  ws.mergeCells(`A${R_RF_HDR}:G${R_RF_HDR}`);
  {
    const hCell = c("A", R_RF_HDR);
    hCell.value = "RESUMEN FINAL";
    fill(hCell, C_TEAL);
    font(hCell, { size: 10, bold: true, color: C_WHITE });
    align(hCell, "center");
  }

  type ResumenRow = {
    label:   string;
    value:   number;
    formula?: string;
    bold?:   boolean;
    dark?:   boolean; // fondo oscuro (#0D4B60)
  };

  const resumenItems: ResumenRow[] = [
    { label: "A. Hospedaje",                    value: totA,         formula: `G${R_A_SUBT}` },
    { label: "B. Movilizacion",                 value: totB,         formula: `G${R_B_SUBT}` },
    { label: "C. Alimentacion",                 value: totC,         formula: `G${R_C_SUBT}` },
    { label: "D. Miscelaneos",                  value: totD,         formula: `G${R_D_SUBT}` },
    { label: "TOTAL GENERAL",                   value: totalGeneral, bold: true, dark: true },
    { label: "Menos anticipo efectivo",         value: antEfectivo  },
    { label: "Menos anticipo tarjeta",          value: antCredito   },
    { label: "DIFERENCIA A PAGAR / DEVOLVER",   value: diferencia,   bold: true, dark: true },
  ];

  const rfRows: number[] = [];
  resumenItems.forEach((item, i) => {
    const row = R_RF_A + i;
    rfRows.push(row);
    ws.getRow(row).height = 16.05;
    ws.mergeCells(`B${row}:D${row}`);
    ws.mergeCells(`E${row}:F${row}`);

    c("A", row).value = "";
    if (item.dark) fill(c("A", row), C_TEAL);

    const bCell = c("B", row);
    bCell.value = "";
    if (item.dark) fill(bCell, C_TEAL);

    const eCell = c("E", row);
    eCell.value = item.label;
    fill(eCell, item.dark ? C_TEAL : C_LIGHT);
    font(eCell, { size: 8.5, bold: item.bold ?? false, color: item.dark ? C_WHITE : C_LABEL });
    align(eCell, "right");
    thinBorder(eCell);

    const gCell = c("G", row);
    if (item.formula) {
      setFormula(gCell, item.formula, item.value);
    } else {
      setCurrency(gCell, item.value);
    }
    fill(gCell, item.dark ? C_TEAL : C_LIGHT);
    font(gCell, { size: 8.5, bold: item.bold ?? false, color: item.dark ? C_WHITE : C_DARK });
    align(gCell, "right");
    thinBorder(gCell);
  });

  // Parchear TOTAL GENERAL y DIFERENCIA con formulas calculadas
  setFormula(
    c("G", R_RF_TOT),
    `G${rfRows[0]}+G${rfRows[1]}+G${rfRows[2]}+G${rfRows[3]}`,
    totalGeneral,
  );
  fill(c("G", R_RF_TOT), C_TEAL);
  font(c("G", R_RF_TOT), { size: 8.5, bold: true, color: C_WHITE });

  setFormula(
    c("G", R_RF_DIF),
    `G${R_RF_TOT}-G${rfRows[5]}-G${rfRows[6]}`,
    diferencia,
  );
  fill(c("G", R_RF_DIF), C_TEAL);
  font(c("G", R_RF_DIF), { size: 8.5, bold: true, color: C_WHITE });

  // =========================================================================
  // FIRMAS
  // =========================================================================
  const rFirmaStart = R_RF_DIF + 3; // dos espaciadores antes de firmas
  ws.getRow(R_RF_DIF + 1).height = 8;
  ws.getRow(R_RF_DIF + 2).height = 8;

  const LINE = "___________________________________";
  type FirmaBlock = { left: string[]; right: string[] };
  const firmaBlocks: FirmaBlock[] = [
    {
      left:  [LINE, empleadoNombre,         "Empleado / Viajante"],
      right: [LINE, "Jefe inmediato",       "Aprobado por / Firma"],
    },
    {
      left:  [LINE, "Aprobado por Cliente", "Firma / Sello"],
      right: [LINE, "Contabilidad",         "Revisado / Firma"],
    },
  ];

  let firmaRow = rFirmaStart;
  for (const fb of firmaBlocks) {
    for (let li = 0; li < 3; li++) {
      ws.getRow(firmaRow).height = li === 0 ? 20 : 13;
      ws.mergeCells(`B${firmaRow}:D${firmaRow}`);
      ws.mergeCells(`E${firmaRow}:G${firmaRow}`);
      const lCell = c("B", firmaRow);
      const rCell = c("E", firmaRow);
      lCell.value = fb.left[li];
      rCell.value = fb.right[li];
      font(lCell, { size: 8, bold: li === 1 });
      font(rCell, { size: 8, bold: li === 1 });
      align(lCell, "center");
      align(rCell, "center");
      firmaRow++;
    }
    ws.getRow(firmaRow).height = 12;
    firmaRow++;
  }

  // =========================================================================
  // Generar y descargar el archivo (browser API)
  // =========================================================================
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href    = url;
  a.download = `Liquidacion_${rendicion.numero.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
  