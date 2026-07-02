/**
 * liquidacion-export.ts
 * Genera el Excel de Liquidacion de Viaticos para una rendicion.
 * Usa SheetJS (xlsx) - 7 columnas: A(spacer) B(Concepto) C(N°Doc) D(Empresa) E(RUC) F(Km) G(Valor)
 * - Subtotales y totales son formulas =SUM(...) editables en Excel.
 * - Gastos de Combustible/Peaje se zeroan si la politica lo indica.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Gasto, Viaje, Politica, Rendicion } from "@/types/entities";

// --- Helpers -----------------------------------------------------------------

type Cell = string | number;
type AoaRow = Cell[];

function n(v: number | null | undefined): number {
  return Number(v ?? 0);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
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
  const s = normalizar(nombre);
  if (s.includes("hospedaje") || s.includes("alojamiento")) return "hospedaje";
  if (
    s.includes("combustible") ||
    s.includes("movilizacion") ||
    s.includes("taxi") ||
    s.includes("peaje") ||
    s.includes("transporte")
  )
    return "movilizacion";
  if (
    s.includes("desayuno") ||
    s.includes("almuerzo") ||
    s.includes("cena") ||
    s.includes("alimentacion")
  )
    return "alimentacion";
  return "miscelaneos";
}

// 7-cell row builder
function r(
  a: Cell = "",
  b: Cell = "",
  c: Cell = "",
  d: Cell = "",
  e: Cell = "",
  f: Cell = "",
  g: Cell = "",
): AoaRow {
  return [a, b, c, d, e, f, g];
}

// --- Fetch helpers -----------------------------------------------------------

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
    const raw = g as unknown as Record<string, unknown>;
    const cat = raw["categorias_gasto"] as { nombre: string } | null;
    const prov = raw["proveedores"] as { nombre: string; identificacion: string | null } | null;
    return {
      ...(g as unknown as Gasto),
      categoria_nombre: cat?.nombre ?? "Miscelaneos",
      proveedor_nombre: prov?.nombre ?? "-",
      proveedor_ruc: prov?.identificacion ?? "-",
    };
  });
}

async function fetchViajes(rendicionId: string): Promise<Viaje[]> {
  const { data } = await supabase
    .from("viajes")
    .select("*")
    .eq("rendicion_id", rendicionId)
    .order("fecha_inicio");
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
    .from("politicas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at")
    .limit(1)
    .single();
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

async function fetchProyectoNombre(proyectoId: string): Promise<string> {
  const { data } = await supabase.from("proyectos").select("nombre").eq("id", proyectoId).single();
  return (data as unknown as { nombre: string })?.nombre ?? "-";
}

// --- Aplicar politica de pagos -----------------------------------------------

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

// --- Main export -------------------------------------------------------------

export async function exportarLiquidacion(rendicion: Rendicion): Promise<void> {
  const XLSX = await import("xlsx");

  const [gastos, viajes, politica, empleadoNombre, empresaNombre, proyectoNombre] =
    await Promise.all([
      fetchGastos(rendicion.id),
      fetchViajes(rendicion.id),
      fetchPolitica(rendicion.politica_id, rendicion.empresa_id),
      fetchUsuarioNombre(rendicion.usuario_id),
      fetchEmpresaNombre(rendicion.empresa_id),
      fetchProyectoNombre(rendicion.proyecto_id),
    ]);

  // Aplicar politica de pagos: zeroa combustible/peaje si corresponde
  const gastosEfectivos = aplicarPolitica(gastos, politica);

  const valorKm = n(politica?.valor_km);
  const kmCiudadDia = n(politica?.km_ciudad_por_dia);

  const viajePropio = viajes.find((v) => v.vehiculo_propio) ?? viajes[0] ?? null;
  const destino = viajePropio?.destino ?? "-";
  const periodo = viajePropio?.fecha_inicio
    ? `${fmtDate(viajePropio.fecha_inicio)} al ${fmtDate(viajePropio.fecha_fin)}`
    : "-";

  const diasViaje =
    viajePropio?.fecha_inicio && viajePropio?.fecha_fin
      ? Math.ceil(
          (new Date(viajePropio.fecha_fin).getTime() -
            new Date(viajePropio.fecha_inicio).getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1
      : 0;

  const hospedajeG = gastosEfectivos.filter(
    (g) => categoriaSeccion(g.categoria_nombre) === "hospedaje",
  );
  const movG = gastosEfectivos.filter(
    (g) => categoriaSeccion(g.categoria_nombre) === "movilizacion",
  );
  const alimentG = gastosEfectivos.filter(
    (g) => categoriaSeccion(g.categoria_nombre) === "alimentacion",
  );
  const miscG = gastosEfectivos.filter(
    (g) => categoriaSeccion(g.categoria_nombre) === "miscelaneos",
  );

  type KmRow = { label: string; km: number; valor: number };
  const kmRows: KmRow[] = viajes
    .filter((v) => v.vehiculo_propio && (v.distancia_km ?? 0) > 0)
    .map((v) => {
      const kmIda = n(v.distancia_km);
      const kmTotal = kmIda * 2;
      const trayecto = v.origen ? `${v.origen} - ${v.destino}` : v.destino;
      return {
        label: `Vehiculo propio - ${trayecto} (${kmIda}km x2 x $${valorKm})`,
        km: kmTotal,
        valor: kmTotal * valorKm,
      };
    });

  const kmCiudadValor = diasViaje > 0 && kmCiudadDia > 0 ? diasViaje * kmCiudadDia * valorKm : 0;

  const totA = hospedajeG.reduce((s, g) => s + n(g.valor_factura), 0);
  const totKmViaje = kmRows.reduce((s, row) => s + row.valor, 0);
  const totMovFact = movG.reduce((s, g) => s + n(g.valor_factura), 0);
  const totB = totKmViaje + kmCiudadValor + totMovFact;
  const totC = alimentG.reduce((s, g) => s + n(g.valor_factura), 0);
  const totD = miscG.reduce((s, g) => s + n(g.valor_factura), 0);
  const totalGeneral = totA + totB + totC + totD;
  const antEfectivo = n(rendicion.anticipo_efectivo);
  const antCredito = n(rendicion.anticipo_credito);
  const totalAnticipos = antEfectivo + antCredito;
  const diferencia = totalGeneral - totalAnticipos;

  // --- Pre-calcular indices de filas (0-based) para referencias de formulas --
  //
  // Estructura AOA:
  //  0       : titulo
  //  1-10    : filas de cabecera (11 filas)
  //  11      : blank
  //  12      : "A. HOSPEDAJE" header
  //  13      : COL_HDR
  //  14..    : datos hospedaje (hosDataCount filas)
  //  hosSubtotalIdx     : SUBTOTAL A
  //  hosSubtotalIdx+1   : blank
  //  hosSubtotalIdx+2   : "B. MOVILIZACION" header
  //  hosSubtotalIdx+3   : COL_HDR
  //  hosSubtotalIdx+4.. : datos movilizacion (movDataCount filas)
  //  movSubtotalIdx     : SUBTOTAL B
  //  ... same pattern for C y D

  const hosDataCount = Math.max(hospedajeG.length, 1);
  const movActualCount = kmRows.length + (kmCiudadValor > 0 ? 1 : 0) + movG.length;
  const movDataCount = movActualCount === 0 ? 1 : movActualCount;
  const alimentDataCount = Math.max(alimentG.length, 1);
  const miscDataCount = Math.max(miscG.length, 1);

  const hosDataStartIdx = 14;
  const hosDataEndIdx = hosDataStartIdx + hosDataCount - 1;
  const hosSubtotalIdx = hosDataEndIdx + 1;

  const movDataStartIdx = hosSubtotalIdx + 4;
  const movDataEndIdx = movDataStartIdx + movDataCount - 1;
  const movSubtotalIdx = movDataEndIdx + 1;

  const alimentDataStartIdx = movSubtotalIdx + 4;
  const alimentDataEndIdx = alimentDataStartIdx + alimentDataCount - 1;
  const alimentSubtotalIdx = alimentDataEndIdx + 1;

  const miscDataStartIdx = alimentSubtotalIdx + 4;
  const miscDataEndIdx = miscDataStartIdx + miscDataCount - 1;
  const miscSubtotalIdx = miscDataEndIdx + 1;

  // Indices del bloque de resumen final
  const rFinalHeader = miscSubtotalIdx + 2;
  const rA = rFinalHeader + 1;
  const rB = rA + 1;
  const rC = rA + 2;
  const rD = rA + 3;
  const rTotal = rA + 4;
  const rAnt1 = rA + 5;
  const rAnt2 = rA + 6;
  const rDif = rA + 7;

  // Convierte indice 0-based a numero de fila Excel (1-based)
  const ex = (idx: number) => idx + 1;

  // --- Build AoA -------------------------------------------------------------

  const aoa: AoaRow[] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

  function mergeFullRow() {
    merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 6 } });
  }

  // Fila 0: Titulo
  aoa.push(r("LIQUIDACION DE GASTOS DE VIAJE, HOSPEDAJE Y ALIMENTACION"));
  mergeFullRow();

  // Filas 1-10: cabecera izquierda + resumen derecha
  function headerRow(labelL: string, valL: Cell, labelR: string, valR: Cell) {
    const idx = aoa.length;
    aoa.push(r("", labelL, "", valL, labelR, "", valR));
    merges.push({ s: { r: idx, c: 1 }, e: { r: idx, c: 2 } });
    merges.push({ s: { r: idx, c: 4 }, e: { r: idx, c: 5 } });
  }

  headerRow("EMPRESA:", empresaNombre, "RESUMEN DE ANTICIPOS", ""); // row 1
  headerRow("EMPLEADO:", empleadoNombre, "Anticipo efectivo:", antEfectivo); // row 2
  headerRow("PROYECTO:", proyectoNombre, "Anticipo tarjeta:", antCredito); // row 3
  headerRow("PERIODO:", periodo, "TOTAL ANTICIPOS:", totalAnticipos); // row 4
  headerRow("DESTINO:", destino, "RESUMEN POR CATEGORIA", ""); // row 5
  headerRow("MOTIVO:", rendicion.motivo ?? rendicion.descripcion ?? "-", "A. Hospedaje:", totA); // row 6
  headerRow(`RENDICION N: ${rendicion.numero}`, "", "B. Movilizacion:", totB); // row 7
  headerRow(`FECHA: ${fmtDate(rendicion.fecha_rendicion)}`, "", "C. Alimentacion:", totC); // row 8
  headerRow("", "", "D. Miscelaneos:", totD); // row 9
  headerRow("", "", "TOTAL GENERAL:", totalGeneral); // row 10

  aoa.push(r()); // row 11 blank

  // Column header row (reutilizable)
  const COL_HDR = r(
    "",
    "CONCEPTO / DETALLE",
    "N FACTURA",
    "EMPRESA / PROVEEDOR",
    "RUC",
    "KM",
    "VALOR ($)",
  );

  function gastoRow(g: GastoEnriquecido): AoaRow {
    return r(
      "",
      g.descripcion ?? g.categoria_nombre ?? "-",
      g.numero_documento ?? "-",
      g.proveedor_nombre,
      g.proveedor_ruc,
      "",
      n(g.valor_factura),
    );
  }

  function subtotalRow(label: string, value: number): AoaRow {
    const idx = aoa.length;
    merges.push({ s: { r: idx, c: 1 }, e: { r: idx, c: 3 } });
    merges.push({ s: { r: idx, c: 4 }, e: { r: idx, c: 5 } });
    return r("", "", "", "", label, "", value);
  }

  // --- Seccion A: Hospedaje (row 12+) ----------------------------------------
  aoa.push(r("A. HOSPEDAJE"));
  mergeFullRow();
  aoa.push(COL_HDR);
  if (hospedajeG.length > 0) {
    hospedajeG.forEach((g) => aoa.push(gastoRow(g)));
  } else {
    aoa.push(r("", "Sin gastos de hospedaje", "", "", "", "", 0));
  }
  aoa.push(subtotalRow("SUBTOTAL A - HOSPEDAJE", totA));
  aoa.push(r());

  // --- Seccion B: Movilizacion -----------------------------------------------
  aoa.push(r("B. MOVILIZACION"));
  mergeFullRow();
  aoa.push(COL_HDR);

  kmRows.forEach((km) => {
    aoa.push(r("", km.label, "-", "Vehiculo propio", "-", km.km, km.valor));
  });

  if (kmCiudadValor > 0) {
    aoa.push(
      r(
        "",
        `Movilizacion en ciudad (${diasViaje} dias x ${kmCiudadDia} km x $${valorKm})`,
        "-",
        "Vehiculo propio",
        "-",
        diasViaje * kmCiudadDia,
        kmCiudadValor,
      ),
    );
  }

  movG.forEach((g) => aoa.push(gastoRow(g)));

  if (kmRows.length === 0 && kmCiudadValor === 0 && movG.length === 0) {
    aoa.push(r("", "Sin gastos de movilizacion", "", "", "", "", 0));
  }
  aoa.push(subtotalRow("SUBTOTAL B - MOVILIZACION", totB));
  aoa.push(r());

  // --- Seccion C: Alimentacion ------------------------------------------------
  aoa.push(r("C. ALIMENTACION"));
  mergeFullRow();
  aoa.push(COL_HDR);
  if (alimentG.length > 0) {
    alimentG.forEach((g) => aoa.push(gastoRow(g)));
  } else {
    aoa.push(r("", "Sin gastos de alimentacion", "", "", "", "", 0));
  }
  aoa.push(subtotalRow("SUBTOTAL C - ALIMENTACION", totC));
  aoa.push(r());

  // --- Seccion D: Miscelaneos -------------------------------------------------
  aoa.push(r("D. MISCELANEOS"));
  mergeFullRow();
  aoa.push(COL_HDR);
  if (miscG.length > 0) {
    miscG.forEach((g) => aoa.push(gastoRow(g)));
  } else {
    aoa.push(r("", "Sin gastos miscelaneos", "", "", "", "", 0));
  }
  aoa.push(subtotalRow("SUBTOTAL D - MISCELANEOS", totD));
  aoa.push(r());

  // --- Resumen Final ---------------------------------------------------------
  aoa.push(r("RESUMEN FINAL"));
  mergeFullRow();

  const resumenItems: [string, number][] = [
    ["A. Hospedaje", totA],
    ["B. Movilizacion", totB],
    ["C. Alimentacion", totC],
    ["D. Miscelaneos", totD],
    ["TOTAL GENERAL", totalGeneral],
    ["Menos anticipo efectivo", antEfectivo],
    ["Menos anticipo tarjeta", antCredito],
    ["DIFERENCIA A PAGAR / DEVOLVER", diferencia],
  ];
  resumenItems.forEach(([label, val]) => {
    const idx = aoa.length;
    aoa.push(r("", "", "", "", label, "", val));
    merges.push({ s: { r: idx, c: 1 }, e: { r: idx, c: 3 } });
    merges.push({ s: { r: idx, c: 4 }, e: { r: idx, c: 5 } });
  });

  aoa.push(r());
  aoa.push(r());

  // --- Firmas ----------------------------------------------------------------
  const linea = "___________________________________";

  const firmaRows: [string, string][] = [
    [linea, linea],
    [empleadoNombre, "Aprobado por / Jefe inmediato"],
    ["Empleado / Viajante", "Firma / Sello"],
    ["", ""],
    [linea, linea],
    ["Aprobado por / Cliente", "Contabilidad / Revisado"],
    ["Firma / Sello", "Firma / Sello"],
  ];

  firmaRows.forEach(([left, right]) => {
    const idx = aoa.length;
    aoa.push(r("", left, "", "", right));
    merges.push({ s: { r: idx, c: 1 }, e: { r: idx, c: 3 } });
    merges.push({ s: { r: idx, c: 4 }, e: { r: idx, c: 6 } });
  });

  // --- Worksheet -------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ws: any = XLSX.utils.aoa_to_sheet(aoa);

  ws["!merges"] = merges;
  ws["!cols"] = [
    { wch: 2 },
    { wch: 34 },
    { wch: 14 },
    { wch: 24 },
    { wch: 14 },
    { wch: 8 },
    { wch: 13 },
  ];

  // Formato moneda columna G para celdas con valor numerico
  for (let rowIdx = 0; rowIdx < aoa.length; rowIdx++) {
    const cellAddr = XLSX.utils.encode_cell({ r: rowIdx, c: 6 });
    if (ws[cellAddr] && typeof ws[cellAddr].v === "number") {
      ws[cellAddr].z = '"$"#,##0.00';
    }
  }

  // --- Parchear celdas con formulas =SUM(...) --------------------------------

  function setGFormula(rowIdx: number, formula: string, value: number) {
    const addr = XLSX.utils.encode_cell({ r: rowIdx, c: 6 });
    ws[addr] = { t: "n", f: formula, v: value, z: '"$"#,##0.00' };
  }

  // Subtotales de secciones (referencias a rangos de datos)
  setGFormula(hosSubtotalIdx, `SUM(G${ex(hosDataStartIdx)}:G${ex(hosDataEndIdx)})`, totA);
  setGFormula(movSubtotalIdx, `SUM(G${ex(movDataStartIdx)}:G${ex(movDataEndIdx)})`, totB);
  setGFormula(
    alimentSubtotalIdx,
    `SUM(G${ex(alimentDataStartIdx)}:G${ex(alimentDataEndIdx)})`,
    totC,
  );
  setGFormula(miscSubtotalIdx, `SUM(G${ex(miscDataStartIdx)}:G${ex(miscDataEndIdx)})`, totD);

  // Cabecera derecha: referencias a los subtotales de seccion
  setGFormula(4, "G3+G4", totalAnticipos);
  setGFormula(6, `G${ex(hosSubtotalIdx)}`, totA);
  setGFormula(7, `G${ex(movSubtotalIdx)}`, totB);
  setGFormula(8, `G${ex(alimentSubtotalIdx)}`, totC);
  setGFormula(9, `G${ex(miscSubtotalIdx)}`, totD);
  setGFormula(10, "G7+G8+G9+G10", totalGeneral);

  // Resumen final: referencias cruzadas a subtotales y anticipos
  setGFormula(rA, `G${ex(hosSubtotalIdx)}`, totA);
  setGFormula(rB, `G${ex(movSubtotalIdx)}`, totB);
  setGFormula(rC, `G${ex(alimentSubtotalIdx)}`, totC);
  setGFormula(rD, `G${ex(miscSubtotalIdx)}`, totD);
  setGFormula(rTotal, `G${ex(rA)}+G${ex(rB)}+G${ex(rC)}+G${ex(rD)}`, totalGeneral);
  setGFormula(rDif, `G${ex(rTotal)}-G${ex(rAnt1)}-G${ex(rAnt2)}`, diferencia);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Liquidacion Viaje");

  const filename = `Liquidacion_${rendicion.numero.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
