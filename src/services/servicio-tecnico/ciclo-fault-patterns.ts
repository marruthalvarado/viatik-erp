/**
 * ciclo-fault-patterns.ts
 * Motor de análisis de patrones para logs de errores del GE PETtrace 800.
 *
 * Funciones:
 *  1. Detectar patrones en un log recién subido (correlaciones temporales)
 *  2. Analizar historial acumulado de la DB (memoria a largo plazo)
 *  3. Generar sugerencias de texto para OS correctivas (basadas en manuales)
 *  4. Detectar tendencias (frecuencia creciente de un fault)
 *
 * Ref: GE PETtrace 800 Service Manual [SM-Acc 770650, SM-Mnt 793392]
 * IMPORTANTE: Este módulo NUNCA inventa diagnósticos. Todas las sugerencias
 * están ancladas a procedimientos documentados en los manuales de GE.
 */

import type { EventoLog, CicloFaultPatron, CicloFaultResumen } from "@/types/entities";

// ── Ventana de correlación temporal ─────────────────────────────────────────
const VENTANA_CORRELACION_MS = 4 * 60 * 60 * 1000; // 4 horas

// ── Base de conocimiento derivada de los manuales GE ─────────────────────────

interface ReglaPATRON {
  /** Clave del fault que dispara esta regla */
  clave: string;
  titulo: string;
  /** Función que evalúa el contexto y retorna descripción o null si no aplica */
  evaluar: (ctx: ContextoEvento) => PatronResult | null;
}

interface ContextoEvento {
  evento: EventoLog;
  /** Eventos en las 4 horas previas */
  previos: EventoLog[];
  /** Eventos en las 4 horas posteriores */
  posteriores: EventoLog[];
  /** Resumen histórico de este fault en el ciclotrón */
  historial?: CicloFaultResumen;
}

interface PatronResult {
  descripcion: string;
  severidad: CicloFaultPatron["severidad"];
  referencia_manual: string | null;
  sugerencia_os: string | null;
}

const REGLAS: ReglaPATRON[] = [
  // ── Fuente de Iones: Gas Flow Fault ─────────────────────────────────────
  {
    clave: "gas_flow_fault",
    titulo: "Falla en flujo de gas — Fuente de Iones",
    evaluar: ({ evento, previos, historial }) => {
      // ¿Hubo múltiples gas_flow_fault en el mismo día?
      const fechaDia = evento.ts.substring(0, 10);
      const enMismoDia = previos.filter(
        e => e.clave === "gas_flow_fault" && e.ts.startsWith(fechaDia)
      ).length;

      let descripcion: string;
      let sugerencia_os: string;

      if (enMismoDia >= 2) {
        descripcion =
          `Gas flow fault recurrente (${enMismoDia + 1} veces en el mismo día). ` +
          "Indica problema activo en el suministro de hidrógeno o fuente de iones.";
        sugerencia_os =
          "Gas flow fault recurrente detectado en fuente de iones. " +
          "Verificar: 1) Presión de suministro H₂ (regulador externo), " +
          "2) Válvula de gas y línea de suministro al ACS, " +
          "3) Parámetro Gas Flow setpoint vs. valor medido en ACS, " +
          "4) Posible falla en MFC (Mass Flow Controller). " +
          "Ref: SM-Mnt 793392 §Ion Source.";
      } else {
        descripcion = "Gas flow fault en fuente de iones. Verificar suministro de H₂ y parámetros de la fuente.";
        sugerencia_os =
          "Gas flow fault en fuente de iones. " +
          "Verificar presión de suministro H₂, válvula de gas y MFC. " +
          "Ref: SM-Mnt 793392 §Ion Source.";
      }

      // ¿Hay historial de este fault?
      if (historial && historial.total > 3) {
        descripcion += ` Este fault ha ocurrido ${historial.total} veces en los últimos 90 días.`;
      }

      return {
        descripcion,
        severidad: enMismoDia >= 2 ? "critico" : "advertencia",
        referencia_manual: "SM-Mnt 793392 §Ion Source Maintenance",
        sugerencia_os,
      };
    },
  },

  // ── Sistema de Vacío: Vacuum Fault ──────────────────────────────────────
  {
    clave: "vacuum_fault",
    titulo: "Falla en sistema de vacío",
    evaluar: ({ previos, posteriores }) => {
      // ¿Hubo Disconnect de target en las 4 horas previas?
      const disconnectPrevio = previos.some(e => e.clave === "maintenance_disconnect");
      const connectPosterior = posteriores.some(e => e.clave === "maintenance_connect");

      if (disconnectPrevio) {
        return {
          descripcion:
            "Vacuum fault ocurrido después de desconexión de target. " +
            "Patrón asociado a mantenimiento de target que compromete el vacío del sistema.",
          severidad: "advertencia",
          referencia_manual: "SM-Mnt 793392 §Target Maintenance, §Vacuum System",
          sugerencia_os:
            "Vacuum fault post-mantenimiento de target. " +
            "Verificar: 1) O-rings del target (desgaste o instalación incorrecta), " +
            "2) Conexiones del sistema de vacío tras reconexión del target, " +
            "3) Integridad del sistema de vacío con Leak Check. " +
            "Ref: SM-Mnt 793392 §Target Maintenance.",
        };
      }

      if (connectPosterior) {
        return {
          descripcion:
            "Vacuum fault seguido de reconexión de target. " +
            "Posible falla de vacío durante mantenimiento del sistema.",
          severidad: "advertencia",
          referencia_manual: "SM-Mnt 793392 §Vacuum System",
          sugerencia_os:
            "Vacuum fault con reconexión posterior de target. " +
            "Verificar O-rings y sellado del sistema de vacío. " +
            "Realizar Leak Check antes de reiniciar producción. " +
            "Ref: SM-Mnt 793392 §Vacuum System.",
        };
      }

      return {
        descripcion:
          "Vacuum fault en sistema de vacío. " +
          "Posible problema en bomba turbomolecular, válvulas o O-rings.",
        severidad: "critico",
        referencia_manual: "SM-Acc 770650 §Vacuum System, SM-Mnt 793392 §Vacuum System",
        sugerencia_os:
          "Vacuum fault detectado. " +
          "Verificar: 1) Bomba turbomolecular (presión base), " +
          "2) Válvulas de vacío (apertura/cierre), " +
          "3) O-rings del sistema, " +
          "4) Presión de vacío en ACS (debe ser < 1.9E-5 mbar en standby). " +
          "Ref: SM-Acc 770650 §Vacuum System.",
      };
    },
  },

  // ── Interlocks de Seguridad: Safety Door ────────────────────────────────
  {
    clave: "safety_door_open",
    titulo: "Puerta de bunker abierta — interlock de seguridad",
    evaluar: ({ evento, previos, posteriores }) => {
      // ¿Había una producción activa? (production_started en las 2h previas sin production_ended)
      const prodStarted = previos.filter(
        e => e.clave === "production_started" &&
          (new Date(evento.ts).getTime() - new Date(e.ts).getTime()) < 2 * 3600 * 1000
      );
      const prodEnded = previos.filter(
        e => e.clave === "production_ended" &&
          (new Date(evento.ts).getTime() - new Date(e.ts).getTime()) < 2 * 3600 * 1000
      );

      const duranteProduccion = prodStarted.length > prodEnded.length;

      if (duranteProduccion) {
        return {
          descripcion:
            "Puerta de bunker abierta durante período de producción activa. " +
            "El interlock de seguridad detuvo el sistema automáticamente.",
          severidad: "critico",
          referencia_manual: "SM-Acc 770650 §Safety Interlocks",
          sugerencia_os:
            "Safety door interlock activado durante producción. " +
            "Verificar: 1) Estado del switch de puerta del bunker, " +
            "2) Wiring del interlock (posible falso contacto), " +
            "3) Confirmar con el sitio si hubo acceso real o si es fault del sensor. " +
            "Ref: SM-Acc 770650 §Safety Interlocks.",
        };
      }

      return {
        descripcion:
          "Puerta de bunker abierta fuera de período de producción. " +
          "Acceso normal al bunker para mantenimiento u operación rutinaria.",
        severidad: "informativo",
        referencia_manual: null,
        sugerencia_os: null,
      };
    },
  },

  // ── Red / Comunicaciones ─────────────────────────────────────────────────
  {
    clave: "network_comm_fault",
    titulo: "Falla de comunicación en red",
    evaluar: () => ({
      descripcion:
        "Falla de comunicación en receptor de red entre PT Console y ACS. " +
        "Puede indicar problema en cableado Ethernet, switch de red o configuración de IP.",
      severidad: "advertencia",
      referencia_manual: "SM-Acc 770650 §Network Communication",
      sugerencia_os:
        "Network communication fault. " +
        "Verificar: 1) Cables Ethernet entre PT Console y ACS (especialmente en armario de control), " +
        "2) Estado del switch de red del sistema, " +
        "3) Dirección IP del ACS en la configuración de red. " +
        "Ref: SM-Acc 770650 §Network Communication.",
    }),
  },
];

// ── Función principal de análisis de un log ──────────────────────────────────

/**
 * Analiza un array de eventos recién parseados y detecta patrones.
 * Retorna los patrones detectados, ordenados por severidad.
 */
export function detectarPatrones(
  eventos: EventoLog[],
  historiales?: CicloFaultResumen[]
): CicloFaultPatron[] {
  const patronesMap = new Map<string, CicloFaultPatron>();
  const historialMap = new Map<string, CicloFaultResumen>(
    (historiales ?? []).map(h => [h.clave, h])
  );

  // Solo procesar faults y warnings (los info no generan patrones)
  const relevantes = eventos.filter(e => e.tipo === "fault" || e.tipo === "warning");

  for (const evento of relevantes) {
    // Contexto temporal
    const tsMs = new Date(evento.ts).getTime();
    const previos = eventos.filter(e =>
      e !== evento &&
      new Date(e.ts).getTime() < tsMs &&
      new Date(e.ts).getTime() >= tsMs - VENTANA_CORRELACION_MS
    );
    const posteriores = eventos.filter(e =>
      e !== evento &&
      new Date(e.ts).getTime() > tsMs &&
      new Date(e.ts).getTime() <= tsMs + VENTANA_CORRELACION_MS
    );

    // Buscar regla para esta clave
    const regla = REGLAS.find(r => r.clave === evento.clave);
    if (!regla) continue;

    const resultado = regla.evaluar({
      evento,
      previos,
      posteriores,
      historial: historialMap.get(evento.clave),
    });
    if (!resultado) continue;

    // Merge: si ya existe un patrón para esta clave, quedarse con la versión más severa
    const existing = patronesMap.get(evento.clave);
    const severidadOrd: Record<CicloFaultPatron["severidad"], number> = {
      critico: 3, advertencia: 2, informativo: 1,
    };
    if (
      !existing ||
      severidadOrd[resultado.severidad] > severidadOrd[existing.severidad]
    ) {
      patronesMap.set(evento.clave, {
        clave:            evento.clave,
        titulo:           regla.titulo,
        descripcion:      resultado.descripcion,
        severidad:        resultado.severidad,
        referencia_manual: resultado.referencia_manual,
        sugerencia_os:    resultado.sugerencia_os,
        ocurrencias:      relevantes.filter(e => e.clave === evento.clave).length,
        ultima_vez:       evento.ts,
        os_previas_ids:   [],
      });
    }
  }

  // Ordenar: crítico primero
  return Array.from(patronesMap.values()).sort((a, b) => {
    const ord: Record<CicloFaultPatron["severidad"], number> = {
      critico: 3, advertencia: 2, informativo: 1,
    };
    return ord[b.severidad] - ord[a.severidad];
  });
}

// ── Análisis de tendencias desde el historial acumulado ──────────────────────

export interface TendenciaFault {
  clave: string;
  titulo: string;
  total_90d: number;
  total_30d: number;
  tendencia: "creciente" | "estable" | "decreciente" | "sin_datos";
  alerta: string | null;
}

/**
 * Detecta tendencias de frecuencia comparando los últimos 30 días
 * vs. el promedio de los 60 días anteriores.
 * Necesita el historial por mes que se puede calcular del array de eventos
 * o de los resúmenes de la DB.
 */
export function analizarTendencias(
  eventos: EventoLog[],
  ahora: Date = new Date()
): TendenciaFault[] {
  const faultClaves = [...new Set(
    eventos.filter(e => e.tipo === "fault").map(e => e.clave)
  )];

  const tendencias: TendenciaFault[] = [];

  for (const clave of faultClaves) {
    const propios = eventos.filter(e => e.clave === clave && e.tipo === "fault");

    const hace30 = new Date(ahora.getTime() - 30 * 86400 * 1000);
    const hace90 = new Date(ahora.getTime() - 90 * 86400 * 1000);

    const en30d = propios.filter(e => new Date(e.ts) >= hace30).length;
    const en60d_60a30 = propios.filter(
      e => new Date(e.ts) >= hace90 && new Date(e.ts) < hace30
    ).length;
    const en90d = propios.filter(e => new Date(e.ts) >= hace90).length;

    // Comparar tasa mensual: últimos 30d vs promedio de los 60d previos (÷2)
    const tasaPrevia = en60d_60a30 / 2;
    let tendencia: TendenciaFault["tendencia"] = "sin_datos";
    let alerta: string | null = null;

    if (en90d > 0) {
      if (en30d > tasaPrevia * 1.5 && en30d >= 3) {
        tendencia = "creciente";
        alerta = `Frecuencia de "${CLAVE_TITULO[clave] ?? clave}" aumentó de ~${tasaPrevia.toFixed(1)}×/mes a ${en30d}×/mes en los últimos 30 días.`;
      } else if (en30d < tasaPrevia * 0.5) {
        tendencia = "decreciente";
      } else {
        tendencia = "estable";
      }
    }

    tendencias.push({
      clave,
      titulo: CLAVE_TITULO[clave] ?? clave,
      total_90d: en90d,
      total_30d: en30d,
      tendencia,
      alerta,
    });
  }

  return tendencias.sort((a, b) => b.total_90d - a.total_90d);
}

// ── Títulos legibles para claves ─────────────────────────────────────────────

const CLAVE_TITULO: Record<string, string> = {
  gas_flow_fault:      "Gas Flow Fault (Fuente de Iones)",
  vacuum_fault:        "Vacuum Fault (Sistema de Vacío)",
  safety_door_open:    "Safety Door Open (Interlock)",
  network_comm_fault:  "Network Communication Fault",
  target_already_full: "Target Already Full (Warning)",
  wrong_password:      "Wrong Password (Warning)",
};

// ── Texto sugerido para OS correctiva ────────────────────────────────────────

/**
 * Genera el texto sugerido para pre-llenar el campo descripcion_problema
 * de una OS correctiva, basado en los patrones detectados y la fecha del batch.
 *
 * Solo incluye faults relevantes (severidad crítica o advertencia).
 * El texto es editable por el ingeniero en la UI.
 */
export function generarTextoOsCorrectiva(
  patrones: CicloFaultPatron[],
  fechaBatch?: string
): string {
  const relevantes = patrones.filter(
    p => p.severidad === "critico" || p.severidad === "advertencia"
  );
  if (relevantes.length === 0) return "";

  const fechaStr = fechaBatch
    ? `Faults detectados en el log del ${fechaBatch}:\n\n`
    : "Faults detectados en el log de errores:\n\n";

  const lineas = relevantes.map((p, i) =>
    `${i + 1}. ${p.titulo} (${p.ocurrencias} vez${p.ocurrencias > 1 ? "es" : ""})\n` +
    `   ${p.sugerencia_os ?? p.descripcion}`
  );

  return fechaStr + lineas.join("\n\n");
}

/**
 * Obtiene los faults de un log que coinciden temporalmente con un batch
 * de producción (±4 horas del inicio/fin del batch).
 */
export function faultsDeBatch(
  eventos: EventoLog[],
  batchFecha: string
): EventoLog[] {
  const batchMs = new Date(batchFecha).getTime();
  const ventanaMs = 4 * 60 * 60 * 1000;

  return eventos.filter(e => {
    if (e.tipo !== "fault") return false;
    const eMs = new Date(e.ts).getTime();
    return Math.abs(eMs - batchMs) <= ventanaMs;
  });
}
