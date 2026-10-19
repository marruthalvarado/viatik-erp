/**
 * evaluacion-export.ts
 * Exporta el reporte completo de evaluación GE PETtrace 800
 * a PDF usando jsPDF + jspdf-autotable.
 *
 * Estructura:
 *   Pág 1 — Portada compacta + Site Information (2 columnas) + Resumen Performance + Resultado
 *   Pág 2+ — Detalle de cada sub-test (valores medidos)
 *   Pág final — System Evaluation (si aplica)
 */
import type {
  CicloEvaluacion,
  DatosSitio,
  DatosPerformance,
  ProduccionDualBeam,
  TestIsocrono,
} from "@/types/entities";
import { LOGO_VIATIQ_PNG_B64, LOGO_VIATIQ_W, LOGO_VIATIQ_H } from "@/assets/branding/logo-viatiq-b64";
import { calcIarcBeam, calcIonSource, calcTransmision, calcVacuumTight, calcVacuumLeak } from "@/utils/eval-calcs";

// ── Helpers privados ──────────────────────────────────────────────────────────

async function fetchImageBase64(url: string): Promise<{ b64: string; mime: "PNG" | "JPEG" } | null> {
  try {
    const res = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);
    const ct = res.headers.get("content-type") ?? "";
    const mime: "PNG" | "JPEG" = ct.includes("png") ? "PNG" : "JPEG";
    return { b64, mime };
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtFecha = (d: string | null | undefined) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(day)} ${meses[parseInt(m) - 1]} ${y}`;
};

const val = (v: string | number | boolean | null | undefined, suffix = "") =>
  v !== null && v !== undefined && v !== "" ? `${v}${suffix}` : "—";

const fmtNum = (n: number | null | undefined, dec = 2) =>
  n != null ? n.toFixed(dec) : "—";

const passColor  = [22, 163, 74]   as [number, number, number];
const failColor  = [220, 38, 38]   as [number, number, number];
const NAVY       = [15, 40, 100]   as [number, number, number];
const BGNAVY     = [235, 240, 255] as [number, number, number];
const DARK       = [15, 23, 42]    as [number, number, number];
const WHITE      = [255, 255, 255] as [number, number, number];
const greyLight  = [248, 250, 252] as [number, number, number];
const LGREY      = [241, 245, 249] as [number, number, number];

const TIPO_MAP: Record<string, string> = {
  assessment:       "Evaluación General",
  upgrade_eval:     "Evaluación de Actualización",
  eosss:            "EoSSS (Fin de Contrato)",
  "10yr_refurbish": "Reacondicionamiento 10 Años",
};

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface EvaluacionExportOptions {
  empresa?: {
    nombre: string;
    ruc?: string | null;
    telefono?: string | null;
    correo?: string | null;
    direccion?: string | null;
    logo_url?: string | null;
  };
  cliente?: {
    logo_url?: string | null;
  };
}

// ── Función principal ─────────────────────────────────────────────────────────

export async function exportEvaluacionPDF(
  ev: CicloEvaluacion,
  opts: EvaluacionExportOptions = {}
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");

  // Pre-cargar logos
  const empresaLogoImg = opts.empresa?.logo_url
    ? await fetchImageBase64(opts.empresa.logo_url)
    : null;
  const clienteLogoImg = opts.cliente?.logo_url
    ? await fetchImageBase64(opts.cliente.logo_url)
    : null;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M  = 14; // margen

  let pageNumber = 1;

  // ── Header / Footer por página ────────────────────────────────────────────
  function addHeaderFooter() {
    const HDR_H = 22;
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, PW, HDR_H, "F");

    type JsPDFImg = { addImage: (img: string, fmt: string, x: number, y: number, w: number, h: number) => void };
    try {
      if (empresaLogoImg) {
        const maxW = 38, maxH = 14;
        (doc as unknown as JsPDFImg).addImage(
          `data:image/${empresaLogoImg.mime.toLowerCase()};base64,${empresaLogoImg.b64}`,
          empresaLogoImg.mime, M, (HDR_H - maxH) / 2, maxW, maxH,
        );
      } else {
        const lw = LOGO_VIATIQ_W * 0.07;
        const lh = LOGO_VIATIQ_H * 0.07;
        doc.addImage(LOGO_VIATIQ_PNG_B64, "PNG", M, (HDR_H - lh) / 2, lw, lh);
      }
    } catch { /* logo opcional */ }

    // Logo del cliente (lado derecho del header)
    try {
      if (clienteLogoImg) {
        const maxW = 38, maxH = 14;
        (doc as unknown as JsPDFImg).addImage(
          `data:image/${clienteLogoImg.mime.toLowerCase()};base64,${clienteLogoImg.b64}`,
          clienteLogoImg.mime, PW - M - maxW, (HDR_H - maxH) / 2, maxW, maxH,
        );
      }
    } catch { /* logo opcional */ }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.text(opts.empresa?.nombre ?? "VIATIQ", PW / 2, 9, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...BGNAVY);
    doc.text("Reporte de Evaluacion", PW / 2, 16, { align: "center" });

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(M, PH - 10, PW - M, PH - 10);
    doc.setFontSize(7);
    doc.setTextColor(...DARK);
    if (opts.empresa) {
      const partes = [opts.empresa.nombre, opts.empresa.telefono, opts.empresa.correo].filter(Boolean).join("  \xB7  ");
      doc.text(partes, M, PH - 7);
      if (opts.empresa.direccion) doc.text(opts.empresa.direccion, M, PH - 3.5);
    } else {
      doc.text(`${ev.numero}  ${fmtFecha(ev.fecha)}`, M, PH - 6);
    }
    doc.text(`Pag. ${pageNumber}`, PW - M, PH - 7, { align: "right" });
    doc.text("Generado con VIATIQ ERP", PW - M, PH - 3.5, { align: "right" });
    pageNumber++;
  }

  // Helper: Y actual después del último autoTable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getY = () => (doc as any).lastAutoTable?.finalY ?? 120;

  // Helper: subtítulo de sección
  function sectionTitle(title: string, y: number, compact = false): number {
    const h = compact ? 5 : 6;
    doc.setFillColor(...NAVY);
    doc.rect(M, y, PW - M * 2, h, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(compact ? 7.5 : 8.5);
    doc.setTextColor(...WHITE);
    doc.text(title, M + 2, y + (compact ? 3.5 : 4.2));
    return y + h + 2;
  }

  // Helper: subtítulo de detalle (nivel 2)
  function subTitle(title: string, y: number, pass?: boolean | null): number {
    doc.setFillColor(...LGREY);
    doc.rect(M, y, PW - M * 2, 5.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text(title, M + 2, y + 3.8);
    if (pass !== undefined) {
      const label = pass === true ? "PASS" : pass === false ? "FAIL" : "—";
      const color = pass === true ? passColor : pass === false ? failColor : [100, 116, 139] as [number, number, number];
      doc.setTextColor(...color);
      doc.text(label, PW - M - 2, y + 3.8, { align: "right" });
    }
    doc.setTextColor(...DARK);
    return y + 7;
  }

  // Helper: página nueva si no queda espacio
  function ensureSpace(yNow: number, needed: number): number {
    if (yNow + needed > PH - 18) {
      doc.addPage();
      addHeaderFooter();
      return 27;
    }
    return yNow;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PÁG 1: Portada compacta + Site Info (2 col) + Performance Summary + Resultado
  // ══════════════════════════════════════════════════════════════════════════
  addHeaderFooter();

  // Estado label: "Completado" si la evaluación fue cerrada, "Pendiente" en cualquier otro caso
  const estadoLabel = ev.estado === "completado" ? "Completado" : "Pendiente";

  // Banda cover compacta — siempre azul oscuro, independiente del resultado
  doc.setFillColor(...NAVY);
  doc.roundedRect(M, 26, PW - M * 2, 20, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...WHITE);
  doc.text(ev.numero, PW / 2, 34, { align: "center" });

  doc.setFontSize(11);
  doc.text(estadoLabel, PW / 2, 41.5, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(200, 220, 255);
  doc.text(TIPO_MAP[ev.tipo_evaluacion] ?? ev.tipo_evaluacion, PW / 2, 45, { align: "center" });

  // ── Datos generales (2 columnas) ─────────────────────────────────────────
  const s0 = ev.datos_sitio as DatosSitio ?? {};
  const cicloLabel = s0.ciclotrónSerial ?? s0.ciclotrónSystemId ?? ev.ciclotrón_id;

  autoTable(doc, {
    startY: 49,
    margin: { left: M, right: M },
    theme: "plain",
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 36, textColor: [71,85,105] },
      1: { cellWidth: 50 },
      2: { fontStyle: "bold", cellWidth: 36, textColor: [71,85,105] },
      3: {},
    },
    body: [
      ["Ciclotrón / Equipo", val(cicloLabel), "Modelo PT",     val(ev.modelo_pt)],
      ["Versión Software",   val(ev.version_sw),  "Tiene Deuterón", ev.tiene_deuterio ? "Sí" : "No"],
      ["Ingeniero FE",       val(ev.ingeniero_nombre), "Fecha", fmtFecha(ev.fecha)],
      ["Estado",             ev.estado ?? "—",    "",           ""],
    ],
  });

  // ── Site Information (2 columnas) ─────────────────────────────────────────
  const s = s0;
  let y = getY() + 4;
  y = sectionTitle("SITE INFORMATION", y, true);

  const sInfoBody: (string | { content: string; colSpan: number })[][] = [
    ["Cliente",          val(s.clienteNombre),            "Sitio",              val(s.sitioNombre)],
    ["Dirección",        val(s.sitioAddress),              "Site Manager",        val(s.siteManagerNombre)],
    ["Año Instalación",  val(s.anioInstalacion),           "Ciclotrón Serial",    val(s.ciclotrónSerial)],
    ["System ID",        val(s.ciclotrónSystemId),         "PT Release",          val(s.ptRelease)],
    ["ACS Version",      val(s.acsVersion),                "PSS Version",         val(s.pssVersion)],
    ["Voltaje / Hz",     val(s.voltajeHertz),              "UPS",                 val(s.tieneUPS)],
    ["Temp. Eq. (°C)",   val(s.tempCuartoEquipos),         "Hum. Eq. (%)",        val(s.humedadCuartoEquipos)],
    ["Temp. Ciclotron.", val(s.tempCuartoCiclotrón),       "Hum. Cicl. (%)",      val(s.humedadCuartoCiclotrón)],
    ["Vacío Standby",    val(s.vacuumPressureStandby, " mbar"), "Vacío Beam On",  val(s.vacuumPressureBeamOn, " mbar")],
    ["Contrato activo",  s.bajoContrato != null ? (s.bajoContrato ? "Sí" : "No") : "—",
                                                           "Vencimiento contrato", val(s.vencimientoContrato)],
    ["I prom. 18F (µA)", val(s.corrientePromedio18F),      "Util. prom. 18F (%)", val(s.utilizacionPromedio18F)],
    ["Estado sistema",   val(s.estadoSistema),              "Satisfacción cliente", val(s.satisfaccionCliente)],
  ];

  if (s.problemasConocidos) {
    sInfoBody.push(["Problemas conocidos", { content: val(s.problemasConocidos), colSpan: 3 }]);
  }
  if (s.observacionesAdicionales) {
    sInfoBody.push(["Observaciones", { content: val(s.observacionesAdicionales), colSpan: 3 }]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "striped",
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 36, textColor: [71,85,105] },
      1: { cellWidth: 50 },
      2: { fontStyle: "bold", cellWidth: 36, textColor: [71,85,105] },
      3: {},
    },
    body: sInfoBody as Parameters<typeof autoTable>[1]["body"],
    alternateRowStyles: { fillColor: greyLight },
  });

  // ── Performance Test — resumen (misma página) ─────────────────────────────
  const p = ev.datos_performance as DatosPerformance ?? {};
  const skip = new Set(p.skippedTests ?? []);

  const boolPass = (v: boolean | null | undefined): string =>
    v === true ? "PASS" : v === false ? "FAIL" : "—";
  const boolPassColor = (v: boolean | null | undefined): [number, number, number] =>
    v === true ? passColor : v === false ? failColor : [100, 116, 139];

  const calcIsoPerTest = (t?: { filas?: { target?: number | null; collLow?: number | null; collUp?: number | null }[] }): boolean | null => {
    if (!t) return null;
    const checked = (t.filas ?? []).filter(f => f.target && f.target > 0);
    if (!checked.length) return null;
    return checked.some(f => (((f.collLow ?? 0) + (f.collUp ?? 0)) / 2 / (f.target ?? 1)) * 100 < 5);
  };

  interface SubTest { nombre: string; resultado: boolean | null | undefined; detalle: string; skipped?: boolean }
  const subTests: SubTest[] = [];

  const iso1 = p.isocronos?.[0];
  const iso2 = p.isocronos?.[1];

  if ((iso1?.filas?.length ?? 0) > 0) {
    subTests.push({
      nombre: "T1 - Isochronous Test (Pos 1-3)",
      resultado: calcIsoPerTest(iso1),
      detalle: `${iso1!.filas.length} posiciones medidas`,
    });
  }

  if ((iso2?.filas?.length ?? 0) > 0) {
    subTests.push({
      nombre: "T2 - Isochronous Test (Pos 4-6)",
      resultado: calcIsoPerTest(iso2),
      detalle: `${iso2!.filas.length} posiciones medidas`,
    });
  }

  if (!skip.has("rfProton")) {
    const rfP = p.rfProton;
    subTests.push({
      nombre: "T3 - RF Performance (H-)",
      resultado: rfP?.phaseAnalysis?.pass ?? null,
      detalle: rfP?.phaseAnalysis
        ? `Refl. P95: ${val(rfP.phaseAnalysis.reflectedPowerP95, " kW")} · Anode I P95: ${val(rfP.phaseAnalysis.anodeCurrentP95, " mA")}`
        : "—",
    });
  }

  if (ev.tiene_deuterio && !skip.has("rfDeuteron")) {
    const rfD = p.rfDeuteron;
    subTests.push({
      nombre: "T4 - RF Performance (D-)",
      resultado: rfD?.phaseAnalysis?.pass ?? null,
      detalle: rfD?.phaseAnalysis
        ? `Refl. P95: ${val(rfD.phaseAnalysis.reflectedPowerP95, " kW")} · Anode I P95: ${val(rfD.phaseAnalysis.anodeCurrentP95, " mA")}`
        : "—",
    });
  }

  if (!skip.has("mainVoltage")) {
    const mv = p.mainVoltage;
    const mvPass = mv?.anodeVoltStandby != null
      ? mv.anodeVoltStandby >= 7.4 && mv.anodeVoltStandby <= 8.2
      : (mv?.pass ?? null);
    subTests.push({
      nombre: "T5 - Main Voltage Variation",
      resultado: mvPass,
      detalle: mv ? `Anode standby: ${val(mv.anodeVoltStandby, " V")} (spec: 7.4-8.2 V)` : "—",
    });
  }

  // T6 – IARC vs Beam: solo si tiene datos (cuando está como "No realizado" no aparece)
  if ((p.iarcVsBeam?.length ?? 0) > 0) {
    subTests.push({
      nombre: "T6 - IARC vs Beam Current",
      resultado: calcIarcBeam(p.iarcVsBeam ?? []),
      detalle: `${p.iarcVsBeam!.length} puntos medidos`,
    });
  }

  if (!skip.has("ionSource")) {
    const measuredIS = (p.ionSource?.filas ?? []).filter(f => f.probeCurrentH != null).length;
    subTests.push({
      nombre: "T7 - Ion Source Performance",
      resultado: calcIonSource(p.ionSource?.filas ?? []),
      detalle: measuredIS ? `${measuredIS} de 9 setpoints medidos` : "—",
    });
  }

  if (!skip.has("vacuumTight")) {
    const vtFilas = (p.vacuumTightness ?? []).filter(f => f.chamberPressureMbar != null);
    subTests.push({
      nombre: "T8 - Vacuum Tightness",
      resultado: calcVacuumTight(p.vacuumTightness ?? []),
      detalle: vtFilas.length ? `${vtFilas.length} mediciones` : "—",
    });
  }

  if (!skip.has("vacuumLeak")) {
    const vlFilas = (p.vacuumLeak ?? []).filter(f => f.pressureMbar != null);
    subTests.push({
      nombre: "T9 - Vacuum Leak Rate",
      resultado: calcVacuumLeak(p.vacuumLeak ?? []),
      detalle: vlFilas.length ? `${vlFilas.length} mediciones` : "—",
    });
  }

  const transmConDatos = (p.transmision ?? []).filter(f =>
    (f as { foilCurrentUA?: number | null }).foilCurrentUA != null ||
    (f as { probeInCurrentUA?: number | null }).probeInCurrentUA != null
  );
  if (transmConDatos.length > 0 && !skip.has("transmision")) {
    subTests.push({
      nombre: "T10 - Beam Transmission",
      resultado: calcTransmision(p.transmision ?? []),
      detalle: `${transmConDatos.length} punto${transmConDatos.length !== 1 ? "s" : ""} medido${transmConDatos.length !== 1 ? "s" : ""}`,
    });
  }

  let y3 = getY() + 4;
  if (y3 > PH - 55) {
    doc.addPage();
    addHeaderFooter();
    y3 = 27;
  }
  y3 = sectionTitle("PERFORMANCE TEST - Sub-Tests", y3, true);

  autoTable(doc, {
    startY: y3,
    margin: { left: M, right: M },
    head: [["#", "Sub-Test", "Resultado", "Detalle"]],
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 7.5 },
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 7 },
      1: { cellWidth: 72 },
      2: { cellWidth: 20, halign: "center", fontStyle: "bold" },
      3: {},
    },
    body: subTests.map((t, i) => [
      String(i + 1),
      t.nombre,
      boolPass(t.resultado),
      t.detalle,
    ]),
    didParseCell(data) {
      if (data.column.index === 2 && data.section === "body") {
        data.cell.styles.textColor = boolPassColor(subTests[data.row.index]?.resultado);
      }
    },
    alternateRowStyles: { fillColor: BGNAVY },
  });

  // ── Resultado Final + Firma ───────────────────────────────────────────────
  let yFinal = getY() + 6;
  if (yFinal > PH - 40) {
    doc.addPage();
    addHeaderFooter();
    yFinal = 27;
  }

  // Mensaje de resultado basado en tests que fallaron
  const failedTestNames = subTests
    .filter(t => t.resultado === false)
    .map(t => t.nombre);
  const hasTests = subTests.length > 0;

  let resultBoxH = 12;
  if (!hasTests) {
    // Sin tests evaluados aún
    doc.setFillColor(...LGREY);
    doc.roundedRect(M, yFinal, PW - M * 2, resultBoxH, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.text("Evaluacion pendiente de completar.", PW / 2, yFinal + 7.5, { align: "center" });
  } else if (failedTestNames.length === 0) {
    // Todos los tests dentro de especificación
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(M, yFinal, PW - M * 2, resultBoxH, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(22, 101, 52);
    doc.text("Todos los tests realizados se encuentran dentro de especificacion.", PW / 2, yFinal + 7.5, { align: "center" });
  } else {
    // Hay tests fuera de especificación — listarlos
    const shortNames = failedTestNames.map(n => n.replace(/^T\d+ - /, "")).join(", ");
    const msg = `Los siguientes tests no se encuentran dentro de especificacion: ${shortNames}.`;
    const msgLines = doc.splitTextToSize(msg, PW - M * 2 - 8);
    resultBoxH = Math.max(12, msgLines.length * 5 + 6);
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(M, yFinal, PW - M * 2, resultBoxH, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(153, 27, 27);
    doc.text(msgLines, M + 4, yFinal + 4.5);
  }

  const resultBoxBottom = yFinal + resultBoxH;

  if (ev.observaciones) {
    let yObs = resultBoxBottom + 4;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(71, 85, 105);
    doc.text("Observaciones:", M, yObs);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(ev.observaciones, PW - M * 2);
    doc.text(lines, M, yObs + 4.5);
    yFinal = yObs + 4.5 + lines.length * 4;
  } else {
    yFinal = resultBoxBottom;
  }

  const yFirma = yFinal + (ev.observaciones ? 10 : 6);
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.line(M, yFirma, M + 55, yFirma);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Firma Field Engineer", M, yFirma + 4);
  doc.text(val(ev.ingeniero_nombre), M, yFirma + 8);

  // ══════════════════════════════════════════════════════════════════════════
  // PÁG 2+: DETALLE POR SUB-TEST
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  addHeaderFooter();
  let yd = 27;
  yd = sectionTitle("DETALLE DE SUB-TESTS", yd);

  // ── T1 / T2 Isochronous Test ──────────────────────────────────────────────
  const printIso = (iso: TestIsocrono, label: string) => {
    const isoPass = calcIsoPerTest(iso);
    yd = ensureSpace(yd, 40);
    yd = subTitle(label, yd, isoPass);

    // Setup params
    autoTable(doc, {
      startY: yd,
      margin: { left: M, right: M },
      theme: "plain",
      styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 40, textColor: [71,85,105] },
        1: { cellWidth: 30 },
        2: { fontStyle: "bold", cellWidth: 40, textColor: [71,85,105] },
        3: {},
      },
      body: [
        ["Target position", val(iso.posicion), "Magneto inicio (A)", val(iso.magnetStart)],
        ["Dee Volt (kV)", val(iso.deeVoltage), "ΔVoltage (kV)",  val(iso.deltaVoltage)],
        ["Vacío (mbar)", val(iso.vacuumPressure), "Gas flow (sccm)", val(iso.gasFlow)],
        ["IS current (mA)", val(iso.isCurrentMA), "Probe I start (µA)", val(iso.probeCurrentStart)],
        ["Probe I end (µA)", val(iso.probeCurrentEnd), "", ""],
      ],
    });
    yd = getY() + 3;
    yd = ensureSpace(yd, 30);

    // Mediciones
    const filasConDatos = iso.filas.filter(f =>
      f.collLow != null || f.target != null || f.collUp != null
    );
    if (filasConDatos.length) {
      autoTable(doc, {
        startY: yd,
        margin: { left: M, right: M },
        head: [["Magneto (A)", "Foil (µA)", "Coll-Low (µA)", "Target (µA)", "Coll-Up (µA)", "Ratio (%)"]],
        headStyles: { fillColor: [71,85,105], textColor: 255, fontSize: 7, cellPadding: 1.5 },
        styles: { fontSize: 7, cellPadding: 1.5, halign: "center" },
        body: filasConDatos.map(f => {
          const ratio = f.target && f.target > 0
            ? (((f.collLow ?? 0) + (f.collUp ?? 0)) / 2 / f.target) * 100
            : null;
          return [
            fmtNum(f.magnet, 1),
            fmtNum(f.foil, 1),
            fmtNum(f.collLow, 1),
            fmtNum(f.target, 1),
            fmtNum(f.collUp, 1),
            ratio != null ? `${ratio.toFixed(1)} %` : "—",
          ];
        }),
        didParseCell(data) {
          if (data.section === "body" && data.column.index === 5) {
            const row = filasConDatos[data.row.index];
            if (row?.target && row.target > 0) {
              const ratio = (((row.collLow ?? 0) + (row.collUp ?? 0)) / 2 / row.target) * 100;
              data.cell.styles.textColor = ratio < 5 ? passColor : failColor;
            }
          }
        },
        alternateRowStyles: { fillColor: greyLight },
      });
      yd = getY() + 5;
    }
  };

  if ((iso1?.filas?.length ?? 0) > 0) printIso(iso1!, "T1 - Isochronous Test (Pos 1-3)");
  if ((iso2?.filas?.length ?? 0) > 0) printIso(iso2!, "T2 - Isochronous Test (Pos 4-6)");

  // ── T3 RF Performance (H-) ────────────────────────────────────────────────
  if (!skip.has("rfProton") && p.rfProton?.phaseAnalysis) {
    const rf = p.rfProton;
    const pa = rf.phaseAnalysis!;
    yd = ensureSpace(yd, 30);
    yd = subTitle("T3 - RF Performance (H-)", yd, pa.pass);

    autoTable(doc, {
      startY: yd,
      margin: { left: M, right: M },
      theme: "plain",
      styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 55, textColor: [71,85,105] },
        1: { cellWidth: 45 },
        2: { fontStyle: "bold", cellWidth: 55, textColor: [71,85,105] },
        3: {},
      },
      body: [
        ["Refl. Power P95 (kW)", fmtNum(pa.reflectedPowerP95), "Anode Current P95 (mA)", fmtNum(pa.anodeCurrentP95)],
        ["Anode Voltage Standby (V)", fmtNum(rf.anodeVoltageStandby), "Anode Voltage Pass", rf.anodeVoltagePass != null ? (rf.anodeVoltagePass ? "✓" : "✗") : "—"],
        ["Resultado", pa.pass ? "PASS" : pa.pass === false ? "FAIL" : "—", "", ""],
      ],
    });
    yd = getY() + 5;
  }

  // ── T4 RF Performance (D-) ────────────────────────────────────────────────
  if (ev.tiene_deuterio && !skip.has("rfDeuteron") && p.rfDeuteron?.phaseAnalysis) {
    const rf = p.rfDeuteron;
    const pa = rf.phaseAnalysis!;
    yd = ensureSpace(yd, 25);
    yd = subTitle("T4 - RF Performance (D-)", yd, pa.pass);

    autoTable(doc, {
      startY: yd,
      margin: { left: M, right: M },
      theme: "plain",
      styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 55, textColor: [71,85,105] },
        1: { cellWidth: 45 },
        2: { fontStyle: "bold", cellWidth: 55, textColor: [71,85,105] },
        3: {},
      },
      body: [
        ["Refl. Power P95 (kW)", fmtNum(pa.reflectedPowerP95), "Anode Current P95 (mA)", fmtNum(pa.anodeCurrentP95)],
        ["Anode Voltage Standby (V)", fmtNum(rf.anodeVoltageStandby), "Anode Voltage Pass", rf.anodeVoltagePass != null ? (rf.anodeVoltagePass ? "✓" : "✗") : "—"],
      ],
    });
    yd = getY() + 5;
  }

  // ── T5 Main Voltage Variation ─────────────────────────────────────────────
  if (!skip.has("mainVoltage") && p.mainVoltage) {
    const mv = p.mainVoltage;
    const mvPass = mv.anodeVoltStandby != null
      ? mv.anodeVoltStandby >= 7.4 && mv.anodeVoltStandby <= 8.2
      : mv.pass;
    yd = ensureSpace(yd, 20);
    yd = subTitle("T5 - Main Voltage Variation", yd, mvPass);

    autoTable(doc, {
      startY: yd,
      margin: { left: M, right: M },
      theme: "plain",
      styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 55, textColor: [71,85,105] },
        1: {},
      },
      body: [
        ["Anode Voltage Standby (V)", fmtNum(mv.anodeVoltStandby)],
        ["Especificación", "7.4 – 8.2 V"],
        ["Resultado", mvPass ? "PASS" : mvPass === false ? "FAIL" : "—"],
      ],
    });
    yd = getY() + 5;
  }

  // ── T6 IARC vs Beam ───────────────────────────────────────────────────────
  if ((p.iarcVsBeam?.length ?? 0) > 0) {
    const iaPass = calcIarcBeam(p.iarcVsBeam ?? []);
    yd = ensureSpace(yd, 25);
    yd = subTitle("T6 - IARC vs Beam Current", yd, iaPass);

    autoTable(doc, {
      startY: yd,
      margin: { left: M, right: M },
      head: [["Beam I (µA)", "Arc I (µA)", "Ratio (%)"]],
      headStyles: { fillColor: [71,85,105], textColor: 255, fontSize: 7, cellPadding: 1.5 },
      styles: { fontSize: 7, cellPadding: 1.5, halign: "center" },
      body: (p.iarcVsBeam ?? []).map(f => [
        fmtNum((f as { beamCurrent?: number }).beamCurrent),
        fmtNum((f as { arcCurrent?: number }).arcCurrent),
        fmtNum((f as { ratio?: number }).ratio),
      ]),
      alternateRowStyles: { fillColor: greyLight },
    });
    yd = getY() + 5;
  }

  // ── T7 Ion Source Performance ─────────────────────────────────────────────
  if (!skip.has("ionSource") && (p.ionSource?.filas?.length ?? 0) > 0) {
    const isPass = calcIonSource(p.ionSource?.filas ?? []);
    yd = ensureSpace(yd, 40);
    yd = subTitle("T7 - Ion Source Performance", yd, isPass);

    const isFilasConDatos = p.ionSource!.filas.filter(f => f.probeCurrentH != null || (f.isCurrentMA ?? 0) === 0);

    autoTable(doc, {
      startY: yd,
      margin: { left: M, right: M },
      head: [["IS Current (mA)", "Probe H⁻ (µA)", "Mín. requerido (µA)", "Estado"]],
      headStyles: { fillColor: [71,85,105], textColor: 255, fontSize: 7, cellPadding: 1.5 },
      styles: { fontSize: 7, cellPadding: 1.5, halign: "center" },
      body: p.ionSource!.filas.map(f => {
        const min = (f as { maxProbeH?: number }).maxProbeH;
        const pass = min != null && f.probeCurrentH != null ? f.probeCurrentH >= min : null;
        return [
          String(f.isCurrentMA ?? "—"),
          f.probeCurrentH != null ? fmtNum(f.probeCurrentH, 1) : "—",
          min != null ? ">= " + min : "—",
          pass === true ? "OK" : pass === false ? "Bajo" : "—",
        ];
      }),
      didParseCell(data) {
        if (data.section === "body" && data.column.index === 3) {
          const text = data.cell.text[0];
          if (text === "OK") data.cell.styles.textColor = passColor;
          else if (text === "Bajo") data.cell.styles.textColor = failColor;
        }
      },
      alternateRowStyles: { fillColor: greyLight },
    });
    yd = getY() + 5;
    void isFilasConDatos; // suppress unused var
  }

  // ── T8 Vacuum Tightness ───────────────────────────────────────────────────
  const vtFilas = (p.vacuumTightness ?? []).filter(f => f.chamberPressureMbar != null || f.backingPressureMbar != null);
  if (!skip.has("vacuumTight") && vtFilas.length > 0) {
    const vtPass = calcVacuumTight(p.vacuumTightness ?? []);
    yd = ensureSpace(yd, 35);
    yd = subTitle("T8 - Vacuum Tightness", yd, vtPass);

    autoTable(doc, {
      startY: yd,
      margin: { left: M, right: M },
      head: [["Gas flow (sccm)", "Chamber P (mbar)", "Spec Chamber", "Backing P (mbar)", "Spec Backing"]],
      headStyles: { fillColor: [71,85,105], textColor: 255, fontSize: 7, cellPadding: 1.5 },
      styles: { fontSize: 7, cellPadding: 1.5, halign: "center" },
      body: (p.vacuumTightness ?? []).filter(f => f.chamberPressureMbar != null).map(f => {
        const maxCh = (f as { maxChamberMbar?: number }).maxChamberMbar;
        const maxBk = (f as { maxBackingMbar?: number }).maxBackingMbar;
        return [
          String((f as { gasFlowSccm?: number }).gasFlowSccm ?? "—"),
          f.chamberPressureMbar != null ? f.chamberPressureMbar.toExponential(2) : "—",
          maxCh != null ? "<= " + maxCh.toExponential(2) : "—",
          f.backingPressureMbar != null ? (f.backingPressureMbar as number).toFixed(3) : "—",
          maxBk != null ? "<= " + maxBk.toFixed(3) : "—",
        ];
      }),
      alternateRowStyles: { fillColor: greyLight },
    });
    yd = getY() + 5;
  }

  // ── T9 Vacuum Leak Rate ───────────────────────────────────────────────────
  const vlFilas = (p.vacuumLeak ?? []).filter(f => f.pressureMbar != null);
  if (!skip.has("vacuumLeak") && vlFilas.length > 0) {
    const vlPass = calcVacuumLeak(p.vacuumLeak ?? []);
    yd = ensureSpace(yd, 35);
    yd = subTitle("T9 - Vacuum Leak Rate", yd, vlPass);

    autoTable(doc, {
      startY: yd,
      margin: { left: M, right: M },
      head: [["Tiempo (s)", "Presión (mbar)", "Límite (mbar)"]],
      headStyles: { fillColor: [71,85,105], textColor: 255, fontSize: 7, cellPadding: 1.5 },
      styles: { fontSize: 7, cellPadding: 1.5, halign: "center" },
      body: vlFilas.map(f => {
        const maxL = (f as { maxLeakRate?: number }).maxLeakRate;
        return [
          String((f as { timeSec?: number }).timeSec ?? "—"),
          f.pressureMbar != null ? f.pressureMbar.toExponential(2) : "—",
          maxL != null ? "<= " + maxL.toExponential(2) : "—",
        ];
      }),
      alternateRowStyles: { fillColor: greyLight },
    });
    yd = getY() + 5;
  }

  // ── T10 Beam Transmission ─────────────────────────────────────────────────
  const trFilasConDatos = (p.transmision ?? []).filter(f =>
    f.foilCurrentUA != null || f.probeInCurrentUA != null
  );
  if (!skip.has("transmision") && trFilasConDatos.length > 0) {
    const trPass = calcTransmision(p.transmision ?? []);
    yd = ensureSpace(yd, 35);
    yd = subTitle("T10 - Beam Transmission", yd, trPass);

    autoTable(doc, {
      startY: yd,
      margin: { left: M, right: M },
      head: [["#", "Target (µA)", "I-Foil (µA)", "I-Probe-In (µA)", "Trans.→Target%", "Trans.→Foil%"]],
      headStyles: { fillColor: [71,85,105], textColor: 255, fontSize: 7, cellPadding: 1.5 },
      styles: { fontSize: 7, cellPadding: 1.5, halign: "center" },
      body: trFilasConDatos.map((f, i) => {
        const tgt  = (f as { transmissionToTarget?: number }).transmissionToTarget;
        const foil = (f as { transmissionToFoil?: number }).transmissionToFoil;
        return [
          String(i + 1),
          fmtNum(f.targetCurrentUA, 0),
          f.foilCurrentUA != null ? fmtNum(f.foilCurrentUA, 1) : "—",
          f.probeInCurrentUA != null ? fmtNum(f.probeInCurrentUA, 1) : "—",
          tgt  != null ? tgt.toFixed(1)  + "%" : "—",
          foil != null ? foil.toFixed(1) + "%" : "—",
        ];
      }),
      didParseCell(data) {
        if (data.section === "body") {
          const f = trFilasConDatos[data.row.index];
          if (data.column.index === 4) {
            const v = (f as { transmissionToTarget?: number }).transmissionToTarget;
            if (v != null) data.cell.styles.textColor = v >= 55 ? passColor : failColor;
          }
          if (data.column.index === 5) {
            const v = (f as { transmissionToFoil?: number }).transmissionToFoil;
            if (v != null) data.cell.styles.textColor = v >= 65 ? passColor : failColor;
          }
        }
      },
      columnStyles: {
        0: { cellWidth: 8 },
      },
      alternateRowStyles: { fillColor: greyLight },
    });
    yd = getY() + 5;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SYSTEM EVALUATION — 10 producciones
  // ══════════════════════════════════════════════════════════════════════════
  const systemEvalSkipped = ev.datos_evaluacion?.skipped === true;
  const prods: ProduccionDualBeam[] = ev.datos_evaluacion?.producciones ?? [];

  if (!systemEvalSkipped) {
    doc.addPage();
    addHeaderFooter();

    let y4 = 27;
    y4 = sectionTitle("SYSTEM EVALUATION - Dual Beam Productions", y4);

    autoTable(doc, {
      startY: y4,
      margin: { left: M, right: M },
      head: [["#", "Fecha", "Config.", "Ánodo\n(µA)", "Anode V\n(avg)", "Balance\n(avg)", "Dee1\n(avg)", "Dee2\n(avg)", "Vacío\n(avg)"]],
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 2, halign: "center" },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 20 },
        2: { cellWidth: 22 },
      },
      body: Array.from({ length: 10 }, (_, i) => {
        const pr = prods[i] ?? {};
        return [
          String(i + 1),
          pr.fecha ? fmtFecha(pr.fecha) : "—",
          pr.configuracion ?? "—",
          pr.anodeCurrentHigh != null ? pr.anodeCurrentHigh.toFixed(1) : "—",
          pr.anodeVoltageAvg  != null ? pr.anodeVoltageAvg.toFixed(0)  : "—",
          pr.balanceAvg       != null ? pr.balanceAvg.toFixed(2)       : "—",
          pr.dee1Avg          != null ? pr.dee1Avg.toFixed(1)          : "—",
          pr.dee2Avg          != null ? pr.dee2Avg.toFixed(1)          : "—",
          pr.vacuumAvg        != null ? pr.vacuumAvg.toExponential(1)  : "—",
        ];
      }),
      alternateRowStyles: { fillColor: greyLight },
    });
  }

  // ── Descarga ──────────────────────────────────────────────────────────────
  doc.save(`Evaluacion_${ev.numero.replace(/\//g, "-")}.pdf`);
}
