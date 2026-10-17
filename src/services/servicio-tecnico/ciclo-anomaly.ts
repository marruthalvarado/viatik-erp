/**
 * Motor de detección de anomalías para logs del GE PETtrace 800.
 *
 * Estrategia:
 *  1. Detectar la fase de cada fila (startup → ramp → irradiation → end)
 *  2. Aplicar reglas específicas por fase usando el perfil de parámetros
 *  3. Devolver lista de CicloAnomalia con hints del service manual
 *
 * Manuales de referencia:
 *  [SM-Acc]  GE PETtrace 800 Service Manual — Accelerator (ref. 770650)
 *  [SM-Mnt]  GE PETtrace 800 Service Manual — Maintenance (ref. 793392)
 *  [OM]      GE PETtrace 800 Operator's Manual
 *
 * Diseño de fases:
 *  startup:     Antes de que el haz alcance producción (incluye el rampeo inicial)
 *  irradiation: Target-I ≥ 80% del setpoint (producción activa)
 *  end:         Target-I vuelve a 0 DESPUÉS de haber completado irradiación
 *
 * IMPORTANTE — falsos positivos conocidos:
 *  • Target-P al inicio: el blanco está presurizado antes de irradiación → normal
 *  • Phase load al inicio/fin: valores hasta ~18 son normales fuera de irradiación
 *  • Coll-l/r-I: solo válidos cuando Target-I > 20 µA (haz establecido)
 */

import type { CicloAnomalia } from "@/types/entities";
import type { BatchRow } from "./ciclo-batch-parser";
import type { CiclotrónParametros } from "./ciclotrones";

// ── Fases de producción ───────────────────────────────────────────────────────

export type ProductionPhase = "startup" | "ramp" | "irradiation" | "end";

/**
 * Clasifica la fase de una fila de forma simple (sin contexto temporal).
 * Nota: esta función no distingue "startup" de "end" — eso lo hace annotatePhases.
 */
export function detectPhase(
  row: BatchRow,
  targetISetpoint: number,
): ProductionPhase {
  const threshold = targetISetpoint > 0 ? targetISetpoint * 0.8 : 30;
  if (row.targetI >= threshold) return "irradiation";
  // gasFlow bajo → startup (calentamiento)
  if (row.gasFlow < 1.0) return "startup";
  // gasFlow activo pero haz bajo → startup (rampeo inicial) o end (fin de producción)
  // Se resuelve en annotatePhases usando contexto temporal
  if (row.targetI < 5) return "end"; // placeholder: será reemplazado si aún no hubo irradiación
  return "ramp";
}

/**
 * Añade la fase a cada fila con contexto temporal.
 *
 * Regla clave: la fase "end" sólo es válida DESPUÉS de que se haya completado
 * al menos un período de irradiación. Antes de eso, filas con targetI ≈ 0
 * corresponden a "startup" (encendido y carga del blanco).
 */
export function annotatePhases(
  rows: BatchRow[],
  targetISetpoint: number,
): (BatchRow & { phase: ProductionPhase })[] {
  let hasSeenIrradiation = false;

  return rows.map((r) => {
    const raw = detectPhase(r, targetISetpoint);

    // "irradiation" actualiza el estado
    if (raw === "irradiation") hasSeenIrradiation = true;

    let phase: ProductionPhase;
    if (raw === "end" && !hasSeenIrradiation) {
      // Antes de irradiar: targetI bajo + gasFlow > 1 es startup/ramp normal
      phase = r.gasFlow < 1.0 ? "startup" : "ramp";
    } else {
      phase = raw;
    }

    return { ...r, phase };
  });
}

// ── Detección de anomalías ────────────────────────────────────────────────────

// Colimadores: solo verificar cuando el haz está bien establecido
const COLL_MIN_TARGET_I_UA = 20;   // µA mínimo de Target-I para aplicar regla de colimadores

/**
 * Recorre todas las filas y aplica el conjunto de reglas según la fase.
 */
export function detectAnomalias(
  rows: BatchRow[],
  params: CiclotrónParametros,
  targetISetpoint: number,
): CicloAnomalia[] {
  const annotated = annotatePhases(rows, targetISetpoint);
  const anomalias: CicloAnomalia[] = [];

  for (let i = 0; i < annotated.length; i++) {
    const r = annotated[i];
    const p = r.phase;

    // ── Vacuum-P — límite absoluto en cualquier momento ──────────────────────
    if (r.vacuumP > params.vacuum_p_max) {
      anomalias.push(anom(r, p, "Vacuum-P", r.vacuumP, undefined, params.vacuum_p_max, "critical",
        `Presión de vacío ${fmtSci(r.vacuumP)} mbar excede el límite máximo (${fmtSci(params.vacuum_p_max)} mbar). ` +
        `Causas probables: fuga en el sistema de vacío, bomba difusora degradada, o válvulas de aislamiento abiertas. ` +
        `Verificar sellados O-ring del sistema de vacío y estado de la bomba turbomolecular. ` +
        `[SM-Acc 770650] §3.4 — Vacuum System Troubleshooting.`
      ));
    }

    // ── He cool-P — monitorear siempre ───────────────────────────────────────
    if (r.heCoolP < params.he_cool_p_min) {
      anomalias.push(anom(r, p, "He cool-P", r.heCoolP, params.he_cool_p_min, undefined, "warning",
        `Presión de He cooling ${r.heCoolP.toFixed(2)} bar por debajo del mínimo (${params.he_cool_p_min} bar). ` +
        `El blanco podría sobrecalentarse si la presión de helio es insuficiente. ` +
        `Verificar: suministro de helio (cilindro o línea), regulador de presión, y líneas de He hacia el blanco. ` +
        `[SM-Mnt 793392] §5.2 — Target Cooling System / He Supply.`
      ));
    }
    if (r.heCoolP > params.he_cool_p_max) {
      anomalias.push(anom(r, p, "He cool-P", r.heCoolP, undefined, params.he_cool_p_max, "warning",
        `Presión de He cooling ${r.heCoolP.toFixed(2)} bar sobre el máximo (${params.he_cool_p_max} bar). ` +
        `Verificar regulador de presión y válvula de alivio del sistema de helio. ` +
        `[SM-Mnt 793392] §5.2 — Target Cooling System.`
      ));
    }

    // ── Reglas en fase de irradiación activa ─────────────────────────────────
    if (p === "irradiation") {

      // Gas flow
      if (params.gas_flow.alertar && r.gasFlow < params.gas_flow.min) {
        anomalias.push(anom(r, p, "Gas flow", r.gasFlow, params.gas_flow.min, undefined, "critical",
          `Flujo de H₂ ${r.gasFlow.toFixed(2)} sccm bajo el mínimo (${params.gas_flow.min} sccm) durante irradiación. ` +
          `Un corte de gas detiene el haz abruptamente y puede causar variación de rendimiento del lote. ` +
          `Verificar: controlador de flujo másico (MFC), presión de la botella de H₂, y línea de gas hasta el blanco. ` +
          `[SM-Acc 770650] §4.1 — Target Gas Inlet System.`
        ));
      }
      if (params.gas_flow.alertar && r.gasFlow > params.gas_flow.max) {
        anomalias.push(anom(r, p, "Gas flow", r.gasFlow, undefined, params.gas_flow.max, "warning",
          `Flujo de H₂ ${r.gasFlow.toFixed(2)} sccm sobre el máximo nominal (${params.gas_flow.max} sccm). ` +
          `Revisar: MFC (posible deriva) y presión de gas de entrada. ` +
          `[SM-Acc 770650] §4.1 — Target Gas Inlet System.`
        ));
      }

      // Magnet-I
      if (params.magnet_i.alertar) {
        if (r.magnetI < params.magnet_i.min) {
          anomalias.push(anom(r, p, "Magnet-I", r.magnetI, params.magnet_i.min, undefined, "critical",
            `Corriente del magneto ${r.magnetI.toFixed(1)} A bajo el mínimo (${params.magnet_i.min} A). ` +
            `Un campo magnético insuficiente desvía el haz del blanco, reduciendo Target-I. ` +
            `Verificar: fuente de alimentación del magneto, cables de fuerza y controlador PID de Magnet-I. ` +
            `[SM-Acc 770650] §2.3 — Magnet Power Supply.`
          ));
        }
        if (r.magnetI > params.magnet_i.max) {
          anomalias.push(anom(r, p, "Magnet-I", r.magnetI, undefined, params.magnet_i.max, "warning",
            `Corriente del magneto ${r.magnetI.toFixed(1)} A sobre el máximo (${params.magnet_i.max} A). ` +
            `Valores persistentemente altos pueden indicar deriva térmica de las bobinas. ` +
            `Verificar temperatura de bobinas y sistema de refrigeración del magneto. ` +
            `[SM-Acc 770650] §2.3 — Magnet Power Supply.`
          ));
        }
      }

      // Dee voltages
      if (params.dee1_kv.alertar) {
        if (r.dee1Kv < params.dee1_kv.min || r.dee1Kv > params.dee1_kv.max) {
          const sev = Math.abs(r.dee1Kv - params.dee1_kv.setpoint) > 3 ? "critical" : "warning";
          anomalias.push(anom(r, p, "Dee-1-kV", r.dee1Kv, params.dee1_kv.min, params.dee1_kv.max, sev,
            `Voltaje Dee-1 ${r.dee1Kv.toFixed(1)} kV fuera del rango [${params.dee1_kv.min}, ${params.dee1_kv.max}] kV. ` +
            `Un Dee-kV incorrecto afecta la energía final del haz y la eficiencia de aceleración. ` +
            `Verificar: generador RF, frecuencia de resonancia y sistema de sintonía de cavidades. ` +
            `[SM-Acc 770650] §2.1 — RF System / Dee Voltage Control.`
          ));
        }
      }
      if (params.dee2_kv.alertar) {
        if (r.dee2Kv < params.dee2_kv.min || r.dee2Kv > params.dee2_kv.max) {
          const sev = Math.abs(r.dee2Kv - params.dee2_kv.setpoint) > 3 ? "critical" : "warning";
          anomalias.push(anom(r, p, "Dee-2-kV", r.dee2Kv, params.dee2_kv.min, params.dee2_kv.max, sev,
            `Voltaje Dee-2 ${r.dee2Kv.toFixed(1)} kV fuera del rango [${params.dee2_kv.min}, ${params.dee2_kv.max}] kV. ` +
            `La asimetría Dee-1/Dee-2 afecta el balance del campo RF y la estabilidad del haz. ` +
            `Verificar: control de fase y balance RF, generador RF Dee-2. ` +
            `[SM-Acc 770650] §2.1 — RF System / Dee Voltage Control.`
          ));
        }
      }

      // Target-P durante producción activa
      if (r.targetP < params.target_p_min) {
        anomalias.push(anom(r, p, "Target-P", r.targetP, params.target_p_min, undefined, "critical",
          `Presión del blanco ${r.targetP.toFixed(1)} mbar bajo el mínimo de producción (${params.target_p_min} mbar). ` +
          `Posible fuga en el blanco, en la línea de [18O]H₂O, o falla en la válvula de llenado del blanco. ` +
          `Revisar sellados del blanco, ventana del target, y válvulas del sistema de transferencia. ` +
          `[SM-Acc 770650] §5.1 — Target System / Leak Testing.`
        ));
      }
      if (r.targetP > params.target_p_max) {
        anomalias.push(anom(r, p, "Target-P", r.targetP, undefined, params.target_p_max, "critical",
          `Presión del blanco ${r.targetP.toFixed(1)} mbar sobre el máximo durante irradiación (${params.target_p_max} mbar). ` +
          `Presión excesiva puede forzar la apertura del disco de ruptura (burst disk). ` +
          `Verificar: flujo de agua del blanco, temperatura del blanco y estado del burst disk. ` +
          `[SM-Acc 770650] §5.1 — Target System / Pressure Relief.`
        ));
      }

      // Phase load durante irradiación
      // Nota: valores altos (~17 %) son normales al inicio/fin de producción (calentamiento RF).
      // Los umbrales son configurables en el perfil del ciclotrón.
      if (r.phaseLoad > params.phase_load_irrad_max) {
        anomalias.push(anom(r, p, "Phase load", r.phaseLoad, undefined, params.phase_load_irrad_max, "warning",
          `Phase load ${r.phaseLoad.toFixed(1)}% por encima del umbral (${params.phase_load_irrad_max}%) durante irradiación. ` +
          `Valores altos indican desajuste de fase entre el sistema RF y la cavidad del ciclotrón. ` +
          `Posibles causas: deriva de temperatura en la cavidad, ajuste de sintonía necesario, o degradación del condensador de sintonía. ` +
          `[SM-Acc 770650] §2.1.4 — Phase Control / Auto-Tuning.`
        ));
      }
      if (r.phaseLoad < params.phase_load_irrad_min) {
        anomalias.push(anom(r, p, "Phase load", r.phaseLoad, params.phase_load_irrad_min, undefined, "warning",
          `Phase load ${r.phaseLoad.toFixed(1)}% negativo por debajo del umbral (${params.phase_load_irrad_min}%) durante irradiación. ` +
          `Phase load negativo persistente puede indicar resonancia fuera del punto óptimo. ` +
          `Verificar: control de sintonía automática y estado del condensador variable de la cavidad RF. ` +
          `[SM-Acc 770650] §2.1.4 — Phase Control.`
        ));
      }

      // Target-I: pico abrupto (cambio > spike_ua en 1 lectura de 3 s)
      if (i > 0) {
        const prev = annotated[i - 1];
        if (prev.phase === "irradiation") {
          const deltaI = Math.abs(r.targetI - prev.targetI);
          if (deltaI > params.target_i_spike_ua) {
            anomalias.push(anom(r, p, "Target-I", r.targetI, undefined, undefined, "critical",
              `Target-I cambió abruptamente ${deltaI.toFixed(1)} µA en 3 s ` +
              `(anterior: ${prev.targetI.toFixed(1)} µA → actual: ${r.targetI.toFixed(1)} µA). ` +
              `Puede indicar: inestabilidad del haz, falla en el electrodo extractor, ` +
              `problema en el blanco (presión o temperatura), o corte momentáneo del gas de target. ` +
              `[SM-Acc 770650] §3.2 — Beam Extraction / Extraction Probe.`
            ));
          }
        }
      }

      // Colimadores — solo cuando haz establecido (Target-I > COLL_MIN_TARGET_I_UA)
      // Ratio alto (> coll_max_pct%) indica descentramiento del haz
      if (r.targetI > COLL_MIN_TARGET_I_UA) {
        const limColl = r.targetI * (params.coll_max_pct / 100);
        if (r.collLI > limColl) {
          anomalias.push(anom(r, p, "Coll-l-I", r.collLI, undefined, limColl, "warning",
            `Colimador izquierdo ${r.collLI.toFixed(1)} µA supera el ${params.coll_max_pct}% de Target-I (límite: ${limColl.toFixed(1)} µA). ` +
            `El haz no está bien centrado hacia el blanco izquierdo. ` +
            `Causas: deriva del campo magnético (ajustar Magnet-I setpoint), ` +
            `posición del colimador, o desgaste del electrodo extractor. ` +
            `[SM-Acc 770650] §3.3 — Beam Steering and Tuning / Collimator Alignment.`
          ));
        }
        if (r.collRI > limColl) {
          anomalias.push(anom(r, p, "Coll-r-I", r.collRI, undefined, limColl, "warning",
            `Colimador derecho ${r.collRI.toFixed(1)} µA supera el ${params.coll_max_pct}% de Target-I (límite: ${limColl.toFixed(1)} µA). ` +
            `El haz está desviado hacia el colimador derecho. ` +
            `Causas: desalineación del Beam Steering, deriva del campo magnético, ` +
            `o electrodo extractor desgastado (verificar posición "Extr pos"). ` +
            `[SM-Acc 770650] §3.3 — Beam Steering and Tuning.`
          ));
        }
      }

      // Arc-I / Arc-V fuera de rango
      if (r.arcI < params.arc_i_min) {
        anomalias.push(anom(r, p, "Arc-I", r.arcI, params.arc_i_min, undefined, "warning",
          `Corriente de arco ${r.arcI.toFixed(1)} mA muy baja (mínimo: ${params.arc_i_min} mA). ` +
          `La fuente de iones (ion source) está inestable o con baja emisión. ` +
          `Verificar: estado del cátodo (vida útil ~2000 h), presión de gas de arco y voltaje de arco. ` +
          `[SM-Acc 770650] §2.2 — Ion Source / Cathode Replacement.`
        ));
      }
      if (r.arcI > params.arc_i_max) {
        anomalias.push(anom(r, p, "Arc-I", r.arcI, undefined, params.arc_i_max, "warning",
          `Corriente de arco ${r.arcI.toFixed(1)} mA excesiva (máximo: ${params.arc_i_max} mA). ` +
          `Arc-I elevado puede indicar arco inestable o ionización excesiva. ` +
          `Verificar: voltaje de arco (Arc-V), presión de gas de arco y estado del cátodo. ` +
          `[SM-Acc 770650] §2.2 — Ion Source.`
        ));
      }
    }

    // ── Fase END — sólo ocurre DESPUÉS de irradiación (ver annotatePhases) ───
    // Target-P al final de producción: la presión sube inicialmente porque
    // el blanco aún contiene [18F]-fluoruro en agua. Es NORMAL por ~2-5 min.
    // No se reporta aquí para evitar falsos positivos durante la transferencia.
  }

  // ── Balance de haz (verificación de promedio global) ─────────────────────────
  // Foil-I − Target-I − Coll-l-I − Coll-r-I debe ≈ 0 según el manual.
  // Se calcula el promedio durante irradiación activa y se reporta si
  // la desviación supera el umbral configurado (foil_balance_max_ua).
  const irradRows = annotated.filter((r) => r.phase === "irradiation");
  if (irradRows.length > 5) {
    const balances = irradRows.map(
      (r) => r.foilI - r.targetI - r.collLI - r.collRI,
    );
    const avg = balances.reduce((s, v) => s + v, 0) / balances.length;
    const absAvg = Math.abs(avg);

    if (absAvg > params.foil_balance_max_ua) {
      // Reportar en el punto medio de la irradiación
      const mid = irradRows[Math.floor(irradRows.length / 2)];
      const sign = avg > 0 ? "+" : "";
      anomalias.push(anom(
        mid, "irradiation", "Foil balance", avg, -params.foil_balance_max_ua, params.foil_balance_max_ua, "warning",
        `Balance de haz promedio durante irradiación: ${sign}${avg.toFixed(2)} µA ` +
        `(tolerancia ±${params.foil_balance_max_ua} µA). ` +
        `Según el manual, Foil-I − Target-I − Coll-l-I − Coll-r-I debe ser ≈ 0. ` +
        `Una desviación ${avg > 0 ? "positiva" : "negativa"} indica que ` +
        `${avg > 0
          ? "hay corriente en Foil que no llega al blanco ni a los colimadores — posible dispersión o pérdida de haz en la guía de extracción."
          : "la suma de corrientes medidas supera a Foil-I — revisar calibración de los transformadores de corriente (CT) de Target-I, Coll-l-I o Coll-r-I."
        } ` +
        `[SM-Acc 770650] §3.3 — Beam Steering / Current Instrumentation.`,
      ));
    }
  }

  return anomalias;
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function anom(
  row: BatchRow & { phase: ProductionPhase },
  fase: ProductionPhase,
  parametro: string,
  valor: number,
  limiteMin: number | undefined,
  limiteMax: number | undefined,
  severidad: "warning" | "critical",
  hint: string,
): CicloAnomalia {
  return {
    tiempo:     row.time,
    fila:       row.idx,
    fase,
    parametro,
    valor,
    limite_min: limiteMin,
    limite_max: limiteMax,
    severidad,
    hint,
  };
}

function fmtSci(n: number): string {
  return n.toExponential(2);
}

// ── Resumen estadístico ───────────────────────────────────────────────────────

export interface AnomaliaResumen {
  total:    number;
  warnings: number;
  criticos: number;
  params:   Record<string, number>;
}

export function resumirAnomalias(anomalias: CicloAnomalia[]): AnomaliaResumen {
  const params: Record<string, number> = {};
  let warnings = 0;
  let criticos = 0;
  for (const a of anomalias) {
    params[a.parametro] = (params[a.parametro] ?? 0) + 1;
    if (a.severidad === "critical") criticos++;
    else warnings++;
  }
  return { total: anomalias.length, warnings, criticos, params };
}
