/**
 * evaluacion-export.ts
 * Exporta el reporte completo de evaluación GE PETtrace 800
 * (DOC1604037 rev9) a PDF usando jsPDF + jspdf-autotable.
 *
 * Secciones:
 *   1. Portada — número, tipo, modelo PT, ingeniero, fecha, PASS/FAIL
 *   2. Site Information (datos_sitio)
 *   3. Performance Test — 9 sub-tests con PASS/FAIL
 *   4. System Evaluation — tabla de 10 producciones dual beam
 *   5. Resultado final + observaciones
 */
import type { CicloEvaluacion, DatosSitio, DatosPerformance, ProduccionDualBeam } from "@/types/entities";
import { LOGO_VIATIQ_PNG_B64, LOGO_VIATIQ_W, LOGO_VIATIQ_H } from "@/assets/branding/logo-viatiq-b64";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtFecha = (d: string | null | undefined) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(day)} ${meses[parseInt(m) - 1]} ${y}`;
};

const val = (v: string | number | boolean | null | undefined, suffix = "") =>
  v !== null && v !== undefined && v !== "" ? `${v}${suffix}` : "—";

const passColor  = [22, 163, 74]  as [number, number, number];   // green-600
const failColor  = [220, 38, 38]  as [number, number, number];   // red-600
const greyLight  = [248, 250, 252] as [number, number, number];  // slate-50
const greyHeader = [30, 41, 59]   as [number, number, number];   // slate-800

const TIPO_MAP: Record<string, string> = {
  assessment:       "Assessment General",
  upgrade_eval:     "Upgrade Evaluation",
  eosss:            "EoSSS (Fin de Contrato)",
  "10yr_refurbish": "10-Year Refurbishment",
};

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface EvaluacionExportOptions {
  empresa?: { nombre: string; ruc?: string | null };
}

// ── Función principal ─────────────────────────────────────────────────────────

export async function exportEvaluacionPDF(
  ev: CicloEvaluacion,
  opts: EvaluacionExportOptions = {}
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M  = 14; // margen

  // ── Función header/footer para cada página ─────────────────────────────────
  let pageNumber = 1;

  function addHeaderFooter() {
    // Logo
    try {
      doc.addImage(LOGO_VIATIQ_PNG_B64, "PNG", M, 6, LOGO_VIATIQ_W * 0.25, LOGO_VIATIQ_H * 0.25);
    } catch { /* logo opcional */ }

    // Título empresa
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(opts.empresa?.nombre ?? "VIATIQ", PW / 2, 11, { align: "center" });
    doc.text("Reporte de Evaluación — DOC1604037 rev9", PW / 2, 15, { align: "center" });

    // Línea separadora
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(M, 19, PW - M, 19);

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Pág. ${pageNumber}`, PW - M, PH - 6, { align: "right" });
    doc.text(`${ev.numero} · ${fmtFecha(ev.fecha)}`, M, PH - 6);
    pageNumber++;
  }

  // ── 1. PORTADA ─────────────────────────────────────────────────────────────
  addHeaderFooter();

  // Banda de color resultado
  const resultBg = ev.resultado_general === "pass" ? passColor
                 : ev.resultado_general === "fail"  ? failColor
                 : greyHeader;

  doc.setFillColor(...resultBg);
  doc.roundedRect(M, 24, PW - M * 2, 28, 3, 3, "F");

  // Número evaluación
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(ev.numero, PW / 2, 35, { align: "center" });

  // Resultado
  const resLabel = ev.resultado_general === "pass" ? "✓ PASS"
                 : ev.resultado_general === "fail"  ? "✗ FAIL"
                 : "PENDIENTE";
  doc.setFontSize(14);
  doc.text(resLabel, PW / 2, 44, { align: "center" });

  // Tipo evaluación
  doc.setFontSize(9);
  doc.setTextColor(200, 220, 255);
  doc.text(TIPO_MAP[ev.tipo_evaluacion] ?? ev.tipo_evaluacion, PW / 2, 50, { align: "center" });

  // Tabla de datos generales
  autoTable(doc, {
    startY: 57,
    margin: { left: M, right: M },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50, textColor: [71,85,105] } },
    body: [
      ["Ciclotrón / Equipo", ev.ciclotrón_id],
      ["Modelo PT",          val(ev.modelo_pt)],
      ["Versión Software",   val(ev.version_sw)],
      ["Tiene Deuterón",     ev.tiene_deuterio ? "Sí" : "No"],
      ["Ingeniero FE",       val(ev.ingeniero_nombre)],
      ["Fecha",              fmtFecha(ev.fecha)],
      ["Estado",             ev.estado],
    ],
  });

  // ── 2. SITE INFORMATION ───────────────────────────────────────────────────
  const s = ev.datos_sitio as DatosSitio ?? {};

  const sectionTitle = (title: string, y: number) => {
    doc.setFillColor(...greyHeader);
    doc.rect(M, y, PW - M * 2, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(title, M + 2, y + 4.2);
    return y + 8;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getY = () => (doc as any).lastAutoTable?.finalY ?? 140;

  let y = getY() + 6;
  y = sectionTitle("SITE INFORMATION", y);

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "striped",
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55, textColor: [71,85,105] } },
    body: [
      ["Cliente",              val(s.clienteNombre)],
      ["Sitio",                val(s.sitioNombre)],
      ["Dirección",            val(s.sitioAddress)],
      ["Site Manager",         val(s.siteManagerNombre)],
      ["Año Instalación",      val(s.anioInstalacion)],
      ["Ciclotrón Serial",     val(s.ciclotrónSerial)],
      ["Ciclotrón System ID",  val(s.ciclotrónSystemId)],
      ["PT Release",           val(s.ptRelease)],
      ["ACS Version",          val(s.acsVersion)],
      ["PSS Version",          val(s.pssVersion)],
      ["Voltaje / Hz",         val(s.voltajeHertz)],
      ["UPS",                  val(s.tieneUPS)],
      ["Temp. Sala Equipo",    val(s.tempCuartoEquipos, " °C")],
      ["Humedad Sala Equipo",  val(s.humedadCuartoEquipos, " %")],
      ["Temp. Sala Ciclotrón", val(s.tempCuartoCiclotrón, " °C")],
      ["Humedad Sala Ciclotrón", val(s.humedadCuartoCiclotrón, " %")],
      ["Vacío Standby",        val(s.vacuumPressureStandby, " mbar")],
      ["Vacío Beam On",        val(s.vacuumPressureBeamOn, " mbar")],
      ["Contrato activo",      s.bajoContrato != null ? (s.bajoContrato ? "Sí" : "No") : "—"],
      ["Vencimiento contrato", val(s.vencimientoContrato)],
      ["Corriente prom. ¹⁸F", val(s.corrientePromedio18F, " µA")],
      ["Utilización prom. ¹⁸F",val(s.utilizacionPromedio18F, " %")],
      ["Estado del sistema",   val(s.estadoSistema)],
      ["Satisfacción cliente", val(s.satisfaccionCliente)],
      ["Problemas conocidos",  val(s.problemasConocidos)],
      ["Observaciones",        val(s.observacionesAdicionales)],
    ],
  });

  // ── 3. PERFORMANCE TEST (9 sub-tests) ─────────────────────────────────────
  doc.addPage();
  addHeaderFooter();

  const p = ev.datos_performance as DatosPerformance ?? {};

  // Helpers para sub-tests
  const boolPass = (v: boolean | null | undefined): string =>
    v === true ? "PASS" : v === false ? "FAIL" : "—";
  const boolPassColor = (v: boolean | null | undefined): [number, number, number] =>
    v === true ? passColor : v === false ? failColor : [100, 116, 139];

  // Construir filas de sub-tests
  interface SubTest { nombre: string; resultado: boolean | null | undefined; detalle: string }
  const subTests: SubTest[] = [];

  // T1 – Isocronous Test (pos 1-3)
  const iso1 = p.isocronos?.[0];
  subTests.push({
    nombre: "T1 – Isochronous Test (Pos 1-3)",
    resultado: iso1?.pass,
    detalle: iso1
      ? `Target current: ${val(iso1.targetCurrent, " µA")} · Arc: ${val(iso1.arcCurrent, " µA")}`
      : "—",
  });

  // T2 – Isocronous Test (pos 4-6)
  const iso2 = p.isocronos?.[1];
  subTests.push({
    nombre: "T2 – Isochronous Test (Pos 4-6)",
    resultado: iso2?.pass,
    detalle: iso2
      ? `Target current: ${val(iso2.targetCurrent, " µA")} · Arc: ${val(iso2.arcCurrent, " µA")}`
      : "—",
  });

  // T3 – RF Performance (H⁺)
  const rfP = p.rfProton;
  subTests.push({
    nombre: "T3 – RF Performance (H⁺)",
    resultado: rfP?.pass,
    detalle: rfP
      ? `Dee1: ${val(rfP.dee1Voltage, " kV")} · Dee2: ${val(rfP.dee2Voltage, " kV")}`
      : "—",
  });

  // T4 – RF Performance (D⁻) — solo si tiene deuterio
  if (ev.tiene_deuterio) {
    const rfD = p.rfDeuteron;
    subTests.push({
      nombre: "T4 – RF Performance (D⁻)",
      resultado: rfD?.pass,
      detalle: rfD
        ? `Dee1: ${val(rfD.dee1Voltage, " kV")} · Dee2: ${val(rfD.dee2Voltage, " kV")}`
        : "—",
    });
  }

  // T5 – Main Voltage
  const mv = p.mainVoltage;
  subTests.push({
    nombre: "T5 – Main Voltage",
    resultado: mv?.pass,
    detalle: mv ? `Anode standby: ${val(mv.anodeVoltStandby, " V")}` : "—",
  });

  // T6 – IARC vs Beam
  const iarcPasses = p.iarcVsBeam?.map(f => f.pass);
  const iarcAllPass = iarcPasses?.every(v => v === true) ?? null;
  subTests.push({
    nombre: "T6 – IARC vs Beam Current",
    resultado: iarcAllPass === true ? true : iarcPasses?.some(v => v === false) ? false : null,
    detalle: p.iarcVsBeam?.length
      ? `${p.iarcVsBeam.length} puntos medidos`
      : "—",
  });

  // T7 – Ion Source
  const ionSrc = p.ionSource;
  subTests.push({
    nombre: "T7 – Ion Source",
    resultado: ionSrc ? (ionSrc.filas?.every(f => f.pass !== false) ? true : false) : null,
    detalle: ionSrc
      ? `Magnet: ${val(ionSrc.magnetCurrent, " A")} · Dee: ${val(ionSrc.deeVoltage, " kV")}`
      : "—",
  });

  // T8 – Vacuum Tightness
  const vtPasses = p.vacuumTightness?.map(f => f.pass);
  subTests.push({
    nombre: "T8 – Vacuum Tightness",
    resultado: vtPasses?.every(v => v === true) ? true : vtPasses?.some(v => v === false) ? false : null,
    detalle: p.vacuumTightness?.length ? `${p.vacuumTightness.length} mediciones` : "—",
  });

  // T9 – Vacuum Leak Rate
  const vlPasses = p.vacuumLeak?.map(f => f.pass);
  subTests.push({
    nombre: "T9 – Vacuum Leak Rate",
    resultado: vlPasses?.every(v => v === true) ? true : vlPasses?.some(v => v === false) ? false : null,
    detalle: p.vacuumLeak?.length ? `${p.vacuumLeak.length} mediciones` : "—",
  });

  let y3 = 24;
  y3 = sectionTitle("PERFORMANCE TEST — Sub-Tests", y3);

  autoTable(doc, {
    startY: y3,
    margin: { left: M, right: M },
    head: [["#", "Sub-Test", "Resultado", "Detalle"]],
    headStyles: { fillColor: greyHeader, textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 75 },
      2: { cellWidth: 20, halign: "center", fontStyle: "bold" },
      3: { cellWidth: "auto" },
    },
    body: subTests.map((t, i) => [
      String(i + 1),
      t.nombre,
      boolPass(t.resultado),
      t.detalle,
    ]),
    didParseCell(data) {
      if (data.column.index === 2 && data.section === "body") {
        const t = subTests[data.row.index];
        data.cell.styles.textColor = boolPassColor(t.resultado);
      }
    },
    alternateRowStyles: { fillColor: greyLight },
  });

  // ── 4. SYSTEM EVALUATION — 10 producciones ────────────────────────────────
  doc.addPage();
  addHeaderFooter();

  const prods: ProduccionDualBeam[] = ev.datos_evaluacion?.producciones ?? [];

  let y4 = 24;
  y4 = sectionTitle("SYSTEM EVALUATION — Dual Beam Productions", y4);

  autoTable(doc, {
    startY: y4,
    margin: { left: M, right: M },
    head: [["#", "Fecha", "Config.", "Ánodo\n(µA)", "Anode V\n(avg)", "Balance\n(avg)", "Dee1\n(avg)", "Dee2\n(avg)", "Vacío\n(avg)"]],
    headStyles: { fillColor: greyHeader, textColor: 255, fontSize: 7 },
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

  // ── 5. RESULTADO FINAL + OBSERVACIONES ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yFinal = (doc as any).lastAutoTable?.finalY ?? 180;

  if (yFinal > PH - 50) doc.addPage(), addHeaderFooter();

  const yR = yFinal > PH - 50 ? 24 : yFinal + 8;

  // Banda resultado
  doc.setFillColor(...resultBg);
  doc.roundedRect(M, yR, PW - M * 2, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("Resultado Final:", M + 4, yR + 5.5);
  doc.setFontSize(14);
  doc.text(resLabel, PW - M - 4, yR + 6, { align: "right" });

  // Observaciones
  if (ev.observaciones) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("Observaciones:", M, yR + 22);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(ev.observaciones, PW - M * 2);
    doc.text(lines, M, yR + 27);
  }

  // Firma
  const yFirma = yR + (ev.observaciones ? 50 : 24);
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.line(M, yFirma, M + 55, yFirma);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Firma Field Engineer", M, yFirma + 4);
  doc.text(val(ev.ingeniero_nombre), M, yFirma + 8);

  // ── Descarga ──────────────────────────────────────────────────────────────
  doc.save(`Evaluacion_${ev.numero.replace(/\//g, "-")}.pdf`);
}
