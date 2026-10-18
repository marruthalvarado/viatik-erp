/**
 * eval-calcs.ts
 * Funciones de cálculo PASS/FAIL compartidas entre Step 3 y Step 4
 */
import type { DatosPerformance, FilaIsocrona } from "@/types/entities";

// ── Exported type alias ───────────────────────────────────────────────────────

export type ResultadosStep3 = Record<string, boolean | null>;

// ── Funciones individuales ────────────────────────────────────────────────────

export function calcIsocronos(datos: DatosPerformance): boolean | null {
  if (!datos.isocronos?.length) return null;
  const allFilas = datos.isocronos.flatMap((t: { filas?: FilaIsocrona[] }) => t.filas ?? []);
  if (!allFilas.length) return null;
  const checked = allFilas.filter((f: FilaIsocrona) => f.target && f.target > 0);
  if (!checked.length) return null;
  return checked.every((f: FilaIsocrona) => {
    const ratio = (((f.collLow ?? 0) + (f.collUp ?? 0)) / (f.target ?? 1)) * 100;
    return ratio < 5;
  });
}

export function calcRF(rf?: {
  skipped?: boolean;
  phaseAnalysis?: { pass: boolean | null };
}): boolean | null {
  if (rf?.skipped) return true;
  return rf?.phaseAnalysis?.pass ?? null;
}

export function calcIarcBeam(filas: { pass?: boolean }[]): boolean | null {
  if (!filas.length) return null;
  return filas.every(f => f.pass !== false) ? true : false;
}

export function calcIonSource(
  filas: { probeCurrentH?: number | null; maxProbeH?: number }[]
): boolean | null {
  if (!filas.length) return null;
  const checked = filas.filter(f => f.probeCurrentH != null);
  if (!checked.length) return null;
  return checked.every(f => (f.probeCurrentH ?? 0) <= (f.maxProbeH ?? Infinity));
}

export function calcTransmision(
  filas: { transmissionToTarget?: number; transmissionToFoil?: number }[]
): boolean | null {
  if (!filas.length) return null;
  return filas.every(f =>
    (f.transmissionToTarget == null || f.transmissionToTarget >= 55) &&
    (f.transmissionToFoil   == null || f.transmissionToFoil   >= 65)
  );
}

export function calcVacuumTight(
  filas: {
    chamberPressureMbar?: number | null;
    backingPressureMbar?: number | null;
    maxChamberMbar?: number;
    maxBackingMbar?: number;
  }[]
): boolean | null {
  if (!filas.length) return null;
  return filas.every(f =>
    (f.chamberPressureMbar == null || f.chamberPressureMbar <= (f.maxChamberMbar ?? 5e-5)) &&
    (f.backingPressureMbar == null || f.backingPressureMbar <= (f.maxBackingMbar ?? 4e-1))
  );
}

export function calcVacuumLeak(filas: { pressureMbar?: number | null }[]): boolean | null {
  if (filas.length < 2) return null;
  const first = filas[0].pressureMbar ?? null;
  const last  = filas[filas.length - 1].pressureMbar ?? null;
  if (first == null || last == null) return null;
  return (last - first) < 5e-6;
}

// ── Cálculo combinado de todos los sub-tests del paso 3 ───────────────────────

export function calcularResultados(
  datos: DatosPerformance,
  tieneDeuterio: boolean
): ResultadosStep3 {
  return {
    isocronos:   calcIsocronos(datos),
    rfProton:    calcRF(datos.rfProton),
    rfDeuteron:  tieneDeuterio ? calcRF(datos.rfDeuteron) : true,
    mainVoltage: datos.mainVoltage?.pass ?? null,
    iarcVsBeam:  calcIarcBeam(datos.iarcVsBeam ?? []),
    ionSource:   calcIonSource(datos.ionSource?.filas ?? []),
    transmision: calcTransmision(datos.transmision ?? []),
    vacuumTight: calcVacuumTight(datos.vacuumTightness ?? []),
    vacuumLeak:  calcVacuumLeak(datos.vacuumLeak ?? []),
  };
}
