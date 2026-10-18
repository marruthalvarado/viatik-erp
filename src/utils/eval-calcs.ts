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

// Corriente mínima de sonda por setpoint IS (DOC1604037)
// PASS si la corriente medida >= mínimo del setpoint (la curva azul debe superar la curva roja)
const IS_MIN_PROBE_H: Record<number, number | null> = {
  0: null, 50: 13, 100: 37, 200: 121, 300: 189, 400: 244, 600: 312, 800: 343, 1000: 371,
};

export function calcIonSource(
  filas: { isCurrentMA?: number; probeCurrentH?: number | null }[]
): boolean | null {
  if (!filas.length) return null;
  const withData = filas.filter(f => f.probeCurrentH != null && (f.isCurrentMA ?? 0) > 0);
  if (!withData.length) return null;
  // PASS si cada fila alcanza o supera el mínimo de su setpoint
  return withData.every(f => {
    const min = IS_MIN_PROBE_H[f.isCurrentMA ?? -1];
    if (min == null) return true; // IS=0 siempre OK
    return (f.probeCurrentH ?? 0) >= min;
  });
}

export function calcTransmision(
  filas: { transmissionToTarget?: number; transmissionToFoil?: number }[]
): boolean | null {
  if (!filas.length) return null;
  // Solo se evalúan filas con datos; filas vacías se ignoran (PT860 solo requiere 50 µA)
  const withData = filas.filter(f => f.transmissionToTarget != null || f.transmissionToFoil != null);
  if (!withData.length) return null;
  return withData.every(f =>
    (f.transmissionToTarget == null || f.transmissionToTarget >= 55) &&
    (f.transmissionToFoil   == null || f.transmissionToFoil   >= 65)
  );
}

// Límites por gas flow para Vacuum Tightness (DOC1604037)
const VT_LIMITS: Record<number, { maxChamber: number; maxBacking: number }> = {
  1:  { maxChamber: 3.6e-6,  maxBacking: 1.3e-2 },
  2:  { maxChamber: 6.1e-6,  maxBacking: 2.1e-2 },
  3:  { maxChamber: 8.9e-6,  maxBacking: 2.7e-2 },
  4:  { maxChamber: 1.1e-5,  maxBacking: 3.3e-2 },
  5:  { maxChamber: 1.3e-5,  maxBacking: 3.9e-2 },
  6:  { maxChamber: 1.5e-5,  maxBacking: 4.5e-2 },
  7:  { maxChamber: 1.6e-5,  maxBacking: 4.7e-2 },
  8:  { maxChamber: 1.8e-5,  maxBacking: 5.4e-2 },
  9:  { maxChamber: 2.0e-5,  maxBacking: 5.9e-2 },
  10: { maxChamber: 2.2e-5,  maxBacking: 6.5e-2 },
};

export function calcVacuumTight(
  filas: {
    gasFlowSccm?: number;
    chamberPressureMbar?: number | null;
    backingPressureMbar?: number | null;
    maxChamberMbar?: number;
    maxBackingMbar?: number;
  }[]
): boolean | null {
  if (!filas.length) return null;
  const withData = filas.filter(
    f => (f.chamberPressureMbar != null && !isNaN(f.chamberPressureMbar)) ||
         (f.backingPressureMbar != null && !isNaN(f.backingPressureMbar))
  );
  if (!withData.length) return null;
  return withData.every(f => {
    const lim = VT_LIMITS[f.gasFlowSccm ?? 0];
    const maxC = f.maxChamberMbar ?? lim?.maxChamber ?? 5e-5;
    const maxB = f.maxBackingMbar ?? lim?.maxBacking ?? 4e-1;
    const cOk = (f.chamberPressureMbar == null || isNaN(f.chamberPressureMbar))
      ? true : f.chamberPressureMbar <= maxC;
    const bOk = (f.backingPressureMbar == null || isNaN(f.backingPressureMbar))
      ? true : f.backingPressureMbar <= maxB;
    return cOk && bOk;
  });
}

// Límites por tiempo para Vacuum Leak Rate (DOC1604037)
const LEAK_LIMITS: Record<number, number> = {
  0: 1.80e-7, 10: 1.00e-6, 20: 1.50e-6, 30: 1.90e-6, 40: 2.30e-6,
  50: 2.70e-6, 60: 3.00e-6, 70: 3.30e-6, 80: 3.60e-6, 90: 3.90e-6,
  100: 4.20e-6, 110: 4.60e-6, 120: 4.90e-6,
};

export function calcVacuumLeak(
  filas: { timeSec?: number; pressureMbar?: number | null; maxLeakRate?: number }[]
): boolean | null {
  if (!filas.length) return null;
  const withData = filas.filter(f => f.pressureMbar != null && !isNaN(f.pressureMbar as number));
  if (!withData.length) return null;
  // PASS: la presión medida en cada punto ≤ límite de ese tiempo (curva azul bajo curva roja)
  return withData.every(f => {
    const lim = f.maxLeakRate ?? LEAK_LIMITS[f.timeSec ?? -1] ?? Infinity;
    return (f.pressureMbar as number) <= lim;
  });
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
    mainVoltage: datos.mainVoltage?.anodeVoltStandby != null
      ? datos.mainVoltage.anodeVoltStandby >= 7.4 && datos.mainVoltage.anodeVoltStandby <= 8.2
      : null,
    iarcVsBeam:  calcIarcBeam(datos.iarcVsBeam ?? []),
    ionSource:   calcIonSource(datos.ionSource?.filas ?? []),
    transmision: calcTransmision(datos.transmision ?? []),
    vacuumTight: calcVacuumTight(datos.vacuumTightness ?? []),
    vacuumLeak:  calcVacuumLeak(datos.vacuumLeak ?? []),
  };
}
