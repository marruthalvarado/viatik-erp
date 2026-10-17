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
        `El ciclotrón requiere <4×10⁻⁵ mbar para emitir la señal VACUUM_OK; en estado estacionario normal es ~5×10⁻⁷ mbar. ` +
        `Causas: fuga en la cámara de vacío, aceite de la bomba difusora degradado (cambio cada 24 meses), ` +
        `O-rings del flange principal o falla en la válvula de alto vacío (HVV). ` +
        `Verificar la lectura del medidor Penning (PEN) y Pirani (PIR2) en el VCU, y el estado de la bomba difusora (Balzers DIF320). ` +
        `[SM-Acc 770650] §8-1 — Vacuum System / Pump System.`
      ));
    }

    // ── He cool-P — monitorear siempre ───────────────────────────────────────
    if (r.heCoolP < params.he_cool_p_min) {
      anomalias.push(anom(r, p, "He cool-P", r.heCoolP, params.he_cool_p_min, undefined, "warning",
        `Presión de He cooling ${r.heCoolP.toFixed(2)} bar por debajo del mínimo (${params.he_cool_p_min} bar). ` +
        `El sistema de enfriamiento de helio debe operar entre 0.3–0.5 MPa (≈3–5 bar) con flujo 3–6 l_N/s. ` +
        `Si la presión cae, las láminas de Havar (target foils) se sobrecalientan y pueden romperse durante irradiación. ` +
        `Verificar: nivel del cilindro de He, compresor de He, válvulas solenoides (HeV1–V6), y filtro en la línea de retorno. ` +
        `[SM-Acc 770650] §11-12 — Helium Cooling System.`
      ));
    }
    if (r.heCoolP > params.he_cool_p_max) {
      anomalias.push(anom(r, p, "He cool-P", r.heCoolP, undefined, params.he_cool_p_max, "warning",
        `Presión de He cooling ${r.heCoolP.toFixed(2)} bar sobre el máximo (${params.he_cool_p_max} bar). ` +
        `Presión excesiva puede indicar obstrucción en la línea de retorno o falla en la válvula de alivio. ` +
        `Rango nominal: 0.3–0.5 MPa (3–5 bar). Verificar regulador de presión del He y válvulas de alivio del compresor. ` +
        `[SM-Acc 770650] §11-12-4 — Helium Cooling System Specifications.`
      ));
    }

    // ── Reglas en fase de irradiación activa ─────────────────────────────────
    if (p === "irradiation") {

      // Gas flow
      if (params.gas_flow.alertar && r.gasFlow < params.gas_flow.min) {
        anomalias.push(anom(r, p, "Gas flow", r.gasFlow, params.gas_flow.min, undefined, "critical",
          `Flujo de H₂/D₂ ${r.gasFlow.toFixed(2)} sccm bajo el mínimo (${params.gas_flow.min} sccm) durante irradiación. ` +
          `Este es el flujo de gas a la fuente de iones (ion source PIG). Rango normal: 2–6 sccm. ` +
          `Un flujo insuficiente colapsa el plasma de la fuente y extingue el haz. ` +
          `Verificar: controlador de flujo másico (mass flow controller), presión del cilindro de H₂ (debe ser 0.1±0.05 MPa), ` +
          `válvulas de gas (V1–V4 en manifold de gas) y restrictor de flujo. ` +
          `[SM-Acc 770650] §5-4 — Ion Source Gas Handling System.`
        ));
      }
      if (params.gas_flow.alertar && r.gasFlow > params.gas_flow.max) {
        anomalias.push(anom(r, p, "Gas flow", r.gasFlow, undefined, params.gas_flow.max, "warning",
          `Flujo de H₂/D₂ ${r.gasFlow.toFixed(2)} sccm sobre el máximo nominal (${params.gas_flow.max} sccm) a la fuente de iones. ` +
          `Rango normal: 2–6 sccm (controlador 0–10 sccm). Flujo excesivo puede causar arco inestable o pérdida de vacío. ` +
          `Verificar: deriva del MFC, ajuste del regulador del cilindro de gas, y válvulas V1/V2 del manifold. ` +
          `[SM-Acc 770650] §5-4 — Ion Source Gas Handling System.`
        ));
      }

      // Magnet-I
      if (params.magnet_i.alertar) {
        if (r.magnetI < params.magnet_i.min) {
          anomalias.push(anom(r, p, "Magnet-I", r.magnetI, params.magnet_i.min, undefined, "critical",
            `Corriente del magneto ${r.magnetI.toFixed(1)} A bajo el mínimo (${params.magnet_i.min} A). ` +
            `El campo magnético guía el haz en espiral; una corriente insuficiente cambia el radio de las órbitas ` +
            `y desvía el haz del extractor, reduciendo Target-I y aumentando Coll-I. ` +
            `Verificar: fuente de alimentación del magneto (PSMC), cables de fuerza y temperatura de bobinas ` +
            `(señal MAGN_TEMP_OK en ACU/P8). ` +
            `[SM-Acc 770650] §3 — Magnet System.`
          ));
        }
        if (r.magnetI > params.magnet_i.max) {
          anomalias.push(anom(r, p, "Magnet-I", r.magnetI, undefined, params.magnet_i.max, "warning",
            `Corriente del magneto ${r.magnetI.toFixed(1)} A sobre el máximo (${params.magnet_i.max} A). ` +
            `Corriente excesiva puede indicar cortocircuito en bobinas o deriva del controlador PSMC. ` +
            `Verificar temperatura de bobinas (MAGN_TEMP_OK), flujo de refrigeración (MAGN_FLOW_OK) ` +
            `y ajuste del setpoint en el PSMC. ` +
            `[SM-Acc 770650] §3 — Magnet System.`
          ));
        }
      }

      // Dee voltages
      if (params.dee1_kv.alertar) {
        if (r.dee1Kv < params.dee1_kv.min || r.dee1Kv > params.dee1_kv.max) {
          const sev = Math.abs(r.dee1Kv - params.dee1_kv.setpoint) > 3 ? "critical" : "warning";
          anomalias.push(anom(r, p, "Dee-1-kV", r.dee1Kv, params.dee1_kv.min, params.dee1_kv.max, sev,
            `Voltaje Dee-1 ${r.dee1Kv.toFixed(1)} kV fuera del rango [${params.dee1_kv.min}, ${params.dee1_kv.max}] kV. ` +
            `Los Dees son los electrodos de aceleración del ciclotrón; su voltaje determina la energía ganada por vuelta. ` +
            `Un voltaje incorrecto afecta la energía del haz y la tasa de producción del isótopo. ` +
            `Verificar: generador RF (RFPG), potencia forward/reflected (FP_SIG/RP_SIG), ` +
            `señal DVR1_SIG y sistema de sintonía de cavidad (flaps). ` +
            `[SM-Acc 770650] §4 — RF System / Dee Voltage Control.`
          ));
        }
      }
      if (params.dee2_kv.alertar) {
        if (r.dee2Kv < params.dee2_kv.min || r.dee2Kv > params.dee2_kv.max) {
          const sev = Math.abs(r.dee2Kv - params.dee2_kv.setpoint) > 3 ? "critical" : "warning";
          anomalias.push(anom(r, p, "Dee-2-kV", r.dee2Kv, params.dee2_kv.min, params.dee2_kv.max, sev,
            `Voltaje Dee-2 ${r.dee2Kv.toFixed(1)} kV fuera del rango [${params.dee2_kv.min}, ${params.dee2_kv.max}] kV. ` +
            `El desbalance Dee-1/Dee-2 (delta-Dee, señal DDVR_SIG) afecta la simetría del campo RF y la estabilidad del haz. ` +
            `Verificar: generador RF, señal DVR2_SIG, balance de los flaps de los dos Dees (Flap 1 y Flap 2). ` +
            `[SM-Acc 770650] §4 — RF System / Dee Voltage Control.`
          ));
        }
      }

      // Target-P durante producción activa
      if (r.targetP < params.target_p_min) {
        anomalias.push(anom(r, p, "Target-P", r.targetP, params.target_p_min, undefined, "critical",
          `Presión del blanco ${r.targetP.toFixed(1)} mbar bajo el mínimo de producción (${params.target_p_min} mbar). ` +
          `Los blancos líquidos (¹⁸F, ¹³N, ¹³NH₃) operan con ~5 bar de sobrepresión de helio. ` +
          `Presión baja indica fuga en el cuerpo del blanco, en las láminas Havar/Niobium, o falla en las válvulas de llenado (V1/V2 del LTF). ` +
          `El ACU interrumpe la irradiación si la presión cae fuera del rango preset min/max. ` +
          `Verificar sellados O-ring del blanco, integridad de las foils, y válvulas del LTF. ` +
          `[SM-Acc 770650] §11 — Target System / Process Description.`
        ));
      }
      if (r.targetP > params.target_p_max) {
        anomalias.push(anom(r, p, "Target-P", r.targetP, undefined, params.target_p_max, "critical",
          `Presión del blanco ${r.targetP.toFixed(1)} mbar sobre el máximo durante irradiación (${params.target_p_max} mbar). ` +
          `Presión excesiva puede deberse a sobrecalentamiento del líquido (agua irradiada) o falla en la válvula de salida. ` +
          `El ACU monitorea continuamente la presión y detiene la irradiación si supera el límite preset. ` +
          `Verificar: flujo de agua de refrigeración del blanco, temperatura y estado de la válvula de vaciado (V2 del LTF). ` +
          `[SM-Acc 770650] §11 — Target System / Process Description.`
        ));
      }

      // Phase load durante irradiación
      // Nota: valores altos (~17 %) son normales al inicio/fin de producción (calentamiento RF).
      // Los umbrales son configurables en el perfil del ciclotrón.
      if (r.phaseLoad > params.phase_load_irrad_max) {
        anomalias.push(anom(r, p, "Phase load", r.phaseLoad, undefined, params.phase_load_irrad_max, "warning",
          `Phase load ${r.phaseLoad.toFixed(1)}% por encima del umbral (${params.phase_load_irrad_max}%) durante irradiación. ` +
          `El PHASE LOAD es la señal del Load Phase Detector en el SCU. En resonancia vale 0 V (diferencia de fase = 180°). ` +
          `Un valor alto indica que la cavidad RF (RCAV) está fuera de resonancia. ` +
          `El ACU corrige automáticamente moviendo los servomotores de los flaps (Flap 1 y Flap 2). ` +
          `Si el error persiste: verificar temperatura de la cavidad, servo de los flaps, y señal PHASE_LOAD en RFPG/SKH. ` +
          `[SM-Acc 770650] §4-2-10 — Phase Load / RF Cavity Auto-Tuning.`
        ));
      }
      if (r.phaseLoad < params.phase_load_irrad_min) {
        anomalias.push(anom(r, p, "Phase load", r.phaseLoad, params.phase_load_irrad_min, undefined, "warning",
          `Phase load ${r.phaseLoad.toFixed(1)}% negativo por debajo del umbral (${params.phase_load_irrad_min}%) durante irradiación. ` +
          `Phase load negativo significa que la RCAV está sobresintonizada (fase < 180°). ` +
          `El ACU ajusta los flaps en dirección opuesta para recuperar la resonancia. ` +
          `Si el error persiste: verificar servo de Flap 1/Flap 2 y señal PHASE_LOAD en el RFPG. ` +
          `[SM-Acc 770650] §4-2-10 — Phase Load / RF Cavity Auto-Tuning.`
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
              `Causas probables: rotura o desgaste de la lámina de extracción (stripping foil), ` +
              `salto de posición del carrusel (Foilholder 1/2 en PSS), inestabilidad del haz (RF/magneto), ` +
              `o problema en el blanco (presión, temperatura, o fuga de helio). ` +
              `[SM-Acc 770650] §6 — Extraction System / Foil Carousel.`
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
            `El haz no está correctamente dirigido al blanco izquierdo; una fracción excesiva impacta el colimador. ` +
            `Causas: deriva del campo magnético (PSMC), posición incorrecta de la lámina de extracción (stripping foil), ` +
            `o desplazamiento del Foilholder (verificar parámetros "Foilholder 1"/"Foilholder 2" en PSS). ` +
            `Los colimadores de protones son de Tantalio; máx. 15 µA cada uno. ` +
            `[SM-Acc 770650] §6-2 — Extraction System / Foil Position.`
          ));
        }
        if (r.collRI > limColl) {
          anomalias.push(anom(r, p, "Coll-r-I", r.collRI, undefined, limColl, "warning",
            `Colimador derecho ${r.collRI.toFixed(1)} µA supera el ${params.coll_max_pct}% de Target-I (límite: ${limColl.toFixed(1)} µA). ` +
            `El haz está desviado hacia el colimador derecho en lugar de ir al blanco. ` +
            `Causas: lámina de extracción (stripping foil) desgastada o rota, posición incorrecta del Foilholder ` +
            `(verificar parámetros "Foilholder 1"/"Foilholder 2" en PSS), o deriva del campo magnético (PSMC). ` +
            `La lámina de carbono dura ~2 mAh; el carrusel tiene 6 láminas disponibles. ` +
            `[SM-Acc 770650] §6-2 — Extraction System / Foil Carousel.`
          ));
        }
      }

      // Arc-I / Arc-V fuera de rango
      if (r.arcI < params.arc_i_min) {
        anomalias.push(anom(r, p, "Arc-I", r.arcI, params.arc_i_min, undefined, "warning",
          `Corriente de arco ${r.arcI.toFixed(1)} mA muy baja (mínimo: ${params.arc_i_min} mA). ` +
          `La fuente de iones PIG (Penning Ionization Gauge, cátodo frío) está inestable o extinción del plasma. ` +
          `Verificar: flujo de gas H₂/D₂ a la fuente (rango 2–6 sccm), presión del cilindro (0.1±0.05 MPa), ` +
          `voltaje de arco (Arc-V, max 3.0 kV) y fuente PSARC (max 1.3 A / 2 kV). ` +
          `[SM-Acc 770650] §5-2 — Ion Source / PIG Source Description.`
        ));
      }
      if (r.arcI > params.arc_i_max) {
        anomalias.push(anom(r, p, "Arc-I", r.arcI, undefined, params.arc_i_max, "warning",
          `Corriente de arco ${r.arcI.toFixed(1)} mA excesiva (máximo: ${params.arc_i_max} mA). ` +
          `Arc-I elevado puede indicar plasma inestable, flujo de gas excesivo o falla en la PSARC. ` +
          `La PSARC (PS/GEMS-02A) opera a máx. 1.3 A y 2 kV; voltaje típico ~0.4 kV. ` +
          `Verificar: flujo de H₂/D₂ (reducir si > 6 sccm), voltaje de arco (Arc-V) y límites de la PSARC. ` +
          `[SM-Acc 770650] §5-2 — Ion Source / PIG Source; §5-3 — PSARC Power Supply.`
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
        `[SM-Acc 770650] §7-3 — Beam Current Analyzer (BCA) / Current Instrumentation.`,
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
