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
  // PASS si al menos UNA fila tiene ratio < 5% (punto isocrono encontrado)
  return checked.some((f: FilaIsocrona) => {
    const ratio = (((f.collLow ?? 0) + (f.collUp ?? 0)) / 2 / (f.target ?? 1)) * 100;
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

// Curva de corriente máxima por setpoint IS (DOC1604037)
const IS_MAX_PROBE_H: Record<number, number | null> = {
  0: null, 50: 13, 100: 37, 200: 121, 300: 189, 400: 244, 600: 312, 800: 343, 1000: 371,
};

export function calcIonSource(
  filas: { isCurrentMA?: number; probeCurrentH?: number | null }[]
): boolean | null {
  if (!filas.length) return null;
  const withData = filas.filter(f => f.probeCurrentH != null && (f.isCurrentMA ?? 0) > 0);
  if (!withData.length) return null;
  // PASS si ninguna fila supera el límite de su setpoint
  return withData.every(f => {
    const limit = IS_MAX_PROBE_H[f.isCurrentMA ?? -1];
    if (limit == null) return true; // IS=0 siempre OK
    return (f.probeCurrentH ?? 0) < limit;
  });
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
