/**
 * liquidacion-export.ts
 * Genera el Excel de Liquidacion de Viaticos para una rendicion.
 * Usa SheetJS (xlsx) - 7 columnas: A(spacer) B(Concepto) C(N°Doc) D(Empresa) E(RUC) F(Km) G(Valor)
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
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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

  const hospedajeG = gastos.filter((g) => categoriaSeccion(g.categoria_nombre) === "hospedaje");
  const movG = gastos.filter((g) => categoriaSeccion(g.categoria_nombre) === "movilizacion");
  const alimentG = gastos.filter((g) => categoriaSeccion(g.categoria_nombre) === "alimentacion");
  const miscG = gastos.filter((g) => categoriaSeccion(g.categoria_nombre) === "miscelaneos");

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

  // --- Build AoA -------------------------------------------------------------

  const aoa: AoaRow[] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

  function mergeFullRow() {
    merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 6 } });
  }

  // Fila 0: Titulo
  aoa.push(r("LIQUIDACION DE GASTOS DE VIAJE, HOSPEDAJE Y ALIMENTACION"));
  mergeFullRow();

  // Filas 1-10: info izquierda + resumen derecha
  function headerRow(labelL: string, valL: Cell, labelR: string, valR: Cell) {
    const idx = aoa.length;
    aoa.push(r("", labelL, "", valL, labelR, "", valR));
    merges.push({ s: { r: idx, c: 1 }, e: { r: idx, c: 2 } });
    merges.push({ s: { r: idx, c: 4 }, e: { r: idx, c: 5 } });
  }

  headerRow("EMPRESA:", empresaNombre, "RESUMEN DE ANTICIPOS", "");
  headerRow("EMPLEADO:", empleadoNombre, "Anticipo efectivo:", antEfectivo);
  headerRow("PROYECTO:", proyectoNombre, "Anticipo tarjeta:", antCredito);
  headerRow("PERIODO:", periodo, "TOTAL ANTICIPOS:", totalAnticipos);
  headerRow("DESTINO:", destino, "RESUMEN POR CATEGORIA", "");
  headerRow("MOTIVO:", rendicion.motivo ?? rendicion.descripcion ?? "-", "A. Hospedaje:", totA);
  headerRow(`RENDICION N: ${rendicion.numero}`, "", "B. Movilizacion:", totB);
  headerRow(`FECHA: ${fmtDate(rendicion.fecha_rendicion)}`, "", "C. Alimentacion:", totC);
  headerRow("", "", "D. Miscelaneos:", totD);
  headerRow("", "", "TOTAL GENERAL:", totalGeneral);

  aoa.push(r()); // blank

  // Column header row (reusable)
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

  // --- Seccion A: Hospedaje --------------------------------------------------
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

  const ws = XLSX.utils.aoa_to_sheet(aoa);

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

  // Formato moneda columna G
  for (let rowIdx = 0; rowIdx < aoa.length; rowIdx++) {
    const cellAddr = XLSX.utils.encode_cell({ r: rowIdx, c: 6 });
    if (ws[cellAddr] && typeof ws[cellAddr].v === "number") {
      ws[cellAddr].z = '"$"#,##0.00';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Liquidacion Viaje");

  const filename = `Liquidacion_${rendicion.numero.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
