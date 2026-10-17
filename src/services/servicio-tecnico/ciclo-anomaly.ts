/**
 * Motor de detección de anomalías para logs del GE PETtrace 800.
 *
 * Estrategia:
 *  1. Detectar la fase de cada fila (startup → ramp → irradiation → end)
 *  2. Aplicar reglas específicas por fase usando el perfil de parámetros
 *  3. Devolver lista de CicloAnomalia con hints del service manual
 *
 * Referencias:
 *  GE PETtrace 800 Service Manual — Accelerator (770650)
 *  GE PETtrace 800 Service Manual — Maintenance (793392)
 */

import type { CicloAnomalia } from "@/types/entities";
import type { BatchRow } from "./ciclo-batch-parser";
import type { CiclotrónParametros } from "./ciclotrones";

// ── Fases de producción ───────────────────────────────────────────────────────

export type ProductionPhase = "startup" | "ramp" | "irradiation" | "end";

/**
 * Clasifica la fase de producción de cada fila.
 *
 *  startup:     gasFlow ≈ 0 (ciclotrón calentando, aún sin gas)
 *  ramp:        gasFlow > 0 pero targetI < 80% del setpoint
 *  irradiation: targetI ≥ 80% del setpoint (producción activa)
 *  end:         targetI vuelve a 0 (apagando el blanco)
 */
export function detectPhase(
  row: BatchRow,
  targetISetpoint: number,
): ProductionPhase {
  if (row.gasFlow < 1.0) return "startup";
  const threshold = targetISetpoint > 0 ? targetISetpoint * 0.8 : 30;
  if (row.targetI >= threshold) return "irradiation";
  if (row.targetI < 5 && row.gasFlow > 1) return "end";
  return "ramp";
}

/** Añade la fase a cada fila (no muta el original) */
export function annotatePhases(
  rows: BatchRow[],
  targetISetpoint: number,
): (BatchRow & { phase: ProductionPhase })[] {
  return rows.map((r) => ({ ...r, phase: detectPhase(r, targetISetpoint) }));
}

// ── Detección de anomalías ────────────────────────────────────────────────────

/**
 * Recorre todas las filas y aplica el conjunto de reglas según la fase.
 * Devuelve la lista completa de anomalías encontradas.
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

    // ── Reglas aplicables en todas las fases ────────────────────────────────

    // Vacuum-P — límite absoluto en cualquier momento
    if (r.vacuumP > params.vacuum_p_max) {
      anomalias.push(anomalia(r, p, "Vacuum-P", r.vacuumP, undefined, params.vacuum_p_max, "critical",
        `Presión de vacío ${fmtSci(r.vacuumP)} Pa excede límite de ${fmtSci(params.vacuum_p_max)} Pa. ` +
        `Verificar sellado del sistema de vacío y estado de la bomba difusora. ` +
        `Manual §3.4 (Vacuum System Troubleshooting).`
      ));
    }

    // He cool-P — monitorear siempre
    if (r.heCoolP < params.he_cool_p_min) {
      anomalias.push(anomalia(r, p, "He cool-P", r.heCoolP, params.he_cool_p_min, undefined, "warning",
        `Presión de He cooling ${r.heCoolP} bar por debajo del mínimo (${params.he_cool_p_min} bar). ` +
        `Verificar línea de helio y regulador. Manual §5.2 (Target Cooling System).`
      ));
    }
    if (r.heCoolP > params.he_cool_p_max) {
      anomalias.push(anomalia(r, p, "He cool-P", r.heCoolP, undefined, params.he_cool_p_max, "warning",
        `Presión de He cooling ${r.heCoolP} bar sobre el máximo (${params.he_cool_p_max} bar). ` +
        `Verificar regulador y alivio de presión. Manual §5.2.`
      ));
    }

    // ── Reglas en fase de irradiación activa ────────────────────────────────
    if (p === "irradiation") {

      // Gas flow
      if (params.gas_flow.alertar && r.gasFlow < params.gas_flow.min) {
        anomalias.push(anomalia(r, p, "Gas flow", r.gasFlow, params.gas_flow.min, undefined, "critical",
          `Flujo de H₂ ${r.gasFlow} sccm bajo el mínimo (${params.gas_flow.min} sccm). ` +
          `Verificar controlador de flujo másico (MFC) y línea de hidrógeno. ` +
          `Un corte de gas durante irradiación detiene el haz abruptamente. Manual §4.1.`
        ));
      }
      if (params.gas_flow.alertar && r.gasFlow > params.gas_flow.max) {
        anomalias.push(anomalia(r, p, "Gas flow", r.gasFlow, undefined, params.gas_flow.max, "warning",
          `Flujo de H₂ ${r.gasFlow} sccm sobre el máximo nominal (${params.gas_flow.max} sccm). ` +
          `Revisar MFC y presión de gas. Manual §4.1.`
        ));
      }

      // Magnet-I
      if (params.magnet_i.alertar) {
        if (r.magnetI < params.magnet_i.min) {
          anomalias.push(anomalia(r, p, "Magnet-I", r.magnetI, params.magnet_i.min, undefined, "critical",
            `Corriente del magneto ${r.magnetI} A bajo el mínimo (${params.magnet_i.min} A). ` +
            `El campo magnético insuficiente desvía el haz fuera del blanco. ` +
            `Verificar fuente de alimentación del magneto y controlador PID. Manual §2.3.`
          ));
        }
        if (r.magnetI > params.magnet_i.max) {
          anomalias.push(anomalia(r, p, "Magnet-I", r.magnetI, undefined, params.magnet_i.max, "warning",
            `Corriente del magneto ${r.magnetI} A sobre el máximo (${params.magnet_i.max} A). ` +
            `El ciclotrón auto-ajusta Magnet-I; valores persistentes altos pueden indicar deriva. ` +
            `Verificar temperatura de las bobinas. Manual §2.3.`
          ));
        }
      }

      // Dee-1-kV
      if (params.dee1_kv.alertar) {
        if (r.dee1Kv < params.dee1_kv.min || r.dee1Kv > params.dee1_kv.max) {
          const sev = Math.abs(r.dee1Kv - params.dee1_kv.setpoint) > 3 ? "critical" : "warning";
          anomalias.push(anomalia(r, p, "Dee-1-kV", r.dee1Kv, params.dee1_kv.min, params.dee1_kv.max, sev,
            `Voltaje Dee-1 ${r.dee1Kv} kV fuera del rango [${params.dee1_kv.min}, ${params.dee1_kv.max}] kV. ` +
            `Un Dee-kV incorrecto afecta la energía del haz y la eficiencia de aceleración. ` +
            `Verificar generador RF y frecuencia de resonancia. Manual §2.1 (RF System).`
          ));
        }
      }

      // Dee-2-kV
      if (params.dee2_kv.alertar) {
        if (r.dee2Kv < params.dee2_kv.min || r.dee2Kv > params.dee2_kv.max) {
          const sev = Math.abs(r.dee2Kv - params.dee2_kv.setpoint) > 3 ? "critical" : "warning";
          anomalias.push(anomalia(r, p, "Dee-2-kV", r.dee2Kv, params.dee2_kv.min, params.dee2_kv.max, sev,
            `Voltaje Dee-2 ${r.dee2Kv} kV fuera del rango [${params.dee2_kv.min}, ${params.dee2_kv.max}] kV. ` +
            `La asimetría Dee-1/Dee-2 afecta el balance del campo RF. ` +
            `Verificar generador RF y control de fase. Manual §2.1.`
          ));
        }
      }

      // Target-P durante producción
      if (r.targetP < params.target_p_min) {
        anomalias.push(anomalia(r, p, "Target-P", r.targetP, params.target_p_min, undefined, "critical",
          `Presión del blanco ${r.targetP} mbar bajo el mínimo de producción (${params.target_p_min} mbar). ` +
          `Posible fuga en el blanco o línea de ³⁶Cl/¹⁸O-H₂O. ` +
          `Revisar sellados y válvulas del target. Manual §5.1 (Target System).`
        ));
      }
      if (r.targetP > params.target_p_max) {
        anomalias.push(anomalia(r, p, "Target-P", r.targetP, undefined, params.target_p_max, "warning",
          `Presión del blanco ${r.targetP} mbar sobre el máximo (${params.target_p_max} mbar). ` +
          `Presión excesiva puede provocar apertura del disco de ruptura. ` +
          `Verificar flujo de agua blanco y temperatura. Manual §5.1.`
        ));
      }

      // Target-I: pico abrupto (cambio > spike_ua en 1 lectura)
      if (i > 0) {
        const prev = annotated[i - 1];
        if (prev.phase === "irradiation") {
          const deltaI = Math.abs(r.targetI - prev.targetI);
          if (deltaI > params.target_i_spike_ua) {
            anomalias.push(anomalia(r, p, "Target-I", r.targetI, undefined, undefined, "critical",
              `Target-I cambió abruptamente ${deltaI.toFixed(1)} µA en 3 s (anterior: ${prev.targetI.toFixed(1)}, actual: ${r.targetI.toFixed(1)}). ` +
              `Un salto brusco puede indicar inestabilidad del haz o falla en el blanco. ` +
              `Verificar electrodo extractor, estado del blanco y fuente de alimentación. Manual §3.2.`
            ));
          }
        }
      }

      // Colimadores — máx 12% de Target-I
      const limColl = r.targetI * (params.coll_max_pct / 100);
      if (r.collLI > limColl && limColl > 0) {
        anomalias.push(anomalia(r, p, "Coll-l-I", r.collLI, undefined, limColl, "warning",
          `Colimador izquierdo ${r.collLI.toFixed(1)} µA supera el ${params.coll_max_pct}% de Target-I (${limColl.toFixed(1)} µA). ` +
          `El haz no está bien centrado o el colimador está mal alineado. ` +
          `Verificar posición del colimador y campo del magneto. Manual §3.3.`
        ));
      }
      if (r.collRI > limColl && limColl > 0) {
        anomalias.push(anomalia(r, p, "Coll-r-I", r.collRI, undefined, limColl, "warning",
          `Colimador derecho ${r.collRI.toFixed(1)} µA supera el ${params.coll_max_pct}% de Target-I (${limColl.toFixed(1)} µA). ` +
          `Manual §3.3 (Beam Steering).`
        ));
      }

      // Arc-I / Arc-V fuera de rango
      if (r.arcI < params.arc_i_min) {
        anomalias.push(anomalia(r, p, "Arc-I", r.arcI, params.arc_i_min, undefined, "warning",
          `Corriente de arco ${r.arcI} mA muy baja. Ion source inestable. ` +
          `Verificar cátodo de la fuente de iones y presión de gas de arco. Manual §2.2.`
        ));
      }
      if (r.arcI > params.arc_i_max) {
        anomalias.push(anomalia(r, p, "Arc-I", r.arcI, undefined, params.arc_i_max, "warning",
          `Corriente de arco ${r.arcI} mA excesiva. ` +
          `Verificar voltaje de arco, presión de gas y estado del cátodo. Manual §2.2.`
        ));
      }
    }

    // ── Fin de producción ────────────────────────────────────────────────────
    if (p === "end") {
      if (r.targetP > params.target_p_end_max) {
        anomalias.push(anomalia(r, p, "Target-P", r.targetP, undefined, params.target_p_end_max, "warning",
          `Presión del blanco ${r.targetP} mbar al final de producción excede ${params.target_p_end_max} mbar. ` +
          `Proceso de vaciado más lento de lo esperado. Verificar válvulas del sistema de transferencia. Manual §5.3.`
        ));
      }
    }
  }

  return anomalias;
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function anomalia(
  row: BatchRow & { phase: ProductionPhase },
  fase: ProductionPhase,
  parametro: string,
  valor: number,
  limiteMin: number | undefined,
  limiteMax: number | undefined,
  severidad: CicloAnomalia["severidad"],
  hint: string,
): CicloAnomalia {
  return {
    tiempo:   row.time,
    fila:     row.idx,
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
  params:   Record<string, number>;  // cuenta por parámetro
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
