/**
 * ciclo-error-log-parser.ts
 * Parser browser-side para logs de errores del GE PETtrace 800.
 *
 * Formato de cada línea del .txt:
 *   YYYY-MM-DD HH:MM:SS.microseconds Mensaje (codigo)
 *
 * Clasificación basada en patrones del equipo (sin IA externa):
 *  - fault:   "ACS fault", "fault" en el mensaje (excluyendo warnings)
 *  - warning: "ACS warning", "Warning in"
 *  - info:    "Message from maintenance", "Message from main menu"
 *
 * Ref: GE PETtrace 800 Service Manual [SM-Acc 770650, SM-Mnt 793392]
 */

import type { EventoLog, TipoEventoLog, SubsistemaLog } from "@/types/entities";

// ── Expresión regular para parsear cada línea ────────────────────────────────
// Ejemplo: "2025-03-18 05:04:11.442976 Message from maintenance, Fill (0)"
const LINE_RE = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(.+?)\s*\((\d+)\)\s*$/;

// ── Reglas de clasificación ──────────────────────────────────────────────────

/** Mensajes que son puramente informativos aunque contengan "warning" en su descripción */
const INFO_OVERRIDES = [
  "target already full",        // operador hizo clic en Fill cuando ya estaba lleno
];

/** Determina el tipo del evento */
function clasificarTipo(msg: string): TipoEventoLog {
  const lower = msg.toLowerCase();

  // Verificar primero si es un override de info
  for (const o of INFO_OVERRIDES) {
    if (lower.includes(o)) return "info";
  }

  // Faults reales
  if (lower.includes("acs fault") || lower.includes("network communication fault")) {
    return "fault";
  }

  // Warnings
  if (lower.includes("acs warning") || lower.startsWith("warning in")) {
    return "warning";
  }

  // Todo lo demás es info
  return "info";
}

/** Determina el subsistema al que pertenece el evento */
function clasificarSubsistema(msg: string, tipo: TipoEventoLog): SubsistemaLog {
  const lower = msg.toLowerCase();

  if (lower.includes("ion source") || lower.includes("gas flow")) return "ion_source";
  if (lower.includes("vacuum")) return "vacuum";
  if (lower.includes("safety interlock") || lower.includes("safety door")) return "safety";
  if (lower.includes("network") || lower.includes("communication")) return "network";
  if (lower.includes("message from maintenance")) return "maintenance";
  if (lower.includes("message from main menu")) return "production";
  if (lower.includes("target")) return "target";
  if (tipo === "warning") return "other";
  return "other";
}

/** Normaliza el mensaje a una clave para agrupación y búsqueda histórica */
function normalizarClave(msg: string): string {
  const lower = msg.toLowerCase();

  // Faults
  if (lower.includes("gas flow fault"))                    return "gas_flow_fault";
  if (lower.includes("vacuum fault"))                      return "vacuum_fault";
  if (lower.includes("safety door is open"))               return "safety_door_open";
  if (lower.includes("network communication fault") ||
      lower.includes("communication broken"))              return "network_comm_fault";

  // Warnings
  if (lower.includes("target already full"))               return "target_already_full";
  if (lower.includes("wrong password"))                    return "wrong_password";
  if (lower.includes("gems file"))                         return "gems_file_warning";

  // Info — operaciones de mantenimiento
  if (lower.includes("fill other"))                        return "maintenance_fill_o16";
  if (/message from maintenance, fill(?! other)/.test(lower)) return "maintenance_fill_o18";
  if (lower.includes("message from maintenance, empty"))   return "maintenance_empty";
  if (lower.includes("message from maintenance, dry"))     return "maintenance_dry";
  if (lower.includes("message from maintenance, stop"))    return "maintenance_stop";
  if (lower.includes("message from maintenance, connect")) return "maintenance_connect";
  if (lower.includes("message from maintenance, disconnect")) return "maintenance_disconnect";
  if (lower.includes("leak check"))                       return "maintenance_leak_check";

  // Info — producción
  if (lower.includes("production is started"))            return "production_started";
  if (lower.includes("production is ended"))              return "production_ended";
  if (lower.includes("local mode is started"))            return "local_mode_started";
  if (lower.includes("local mode is ended"))              return "local_mode_ended";

  // Fallback: slug del mensaje
  return lower
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 64);
}

// ── Resultado del parser ─────────────────────────────────────────────────────

export interface ParseResult {
  eventos: EventoLog[];
  fecha_inicio: string | null;
  fecha_fin: string | null;
  total_eventos: number;
  total_faults: number;
  total_warnings: number;
  total_info: number;
  /** Líneas que no pudieron parsearse */
  lineas_invalidas: number;
}

/**
 * Parsea el contenido de un archivo .txt de log del GE PETtrace.
 * Retorna los eventos clasificados y estadísticas de resumen.
 */
export function parsearErrorLog(contenido: string): ParseResult {
  const lineas = contenido.split(/\r?\n/);
  const eventos: EventoLog[] = [];
  let lineas_invalidas = 0;
  let total_faults = 0;
  let total_warnings = 0;
  let total_info = 0;

  for (const linea of lineas) {
    const trimmed = linea.trim();
    if (!trimmed) continue;

    const match = LINE_RE.exec(trimmed);
    if (!match) {
      lineas_invalidas++;
      continue;
    }

    const [, tsRaw, mensaje, codigoStr] = match;
    // Normalizar timestamp a ISO 8601
    const ts = tsRaw.replace(" ", "T") + "Z";
    const codigo = parseInt(codigoStr, 10);

    const tipo = clasificarTipo(mensaje);
    const subsistema = clasificarSubsistema(mensaje, tipo);
    const clave = normalizarClave(mensaje);

    if (tipo === "fault")   total_faults++;
    else if (tipo === "warning") total_warnings++;
    else total_info++;

    eventos.push({ ts, tipo, subsistema, mensaje, codigo, clave });
  }

  const timestamps = eventos.map(e => e.ts).sort();
  const fecha_inicio = timestamps.length > 0 ? timestamps[0] : null;
  const fecha_fin    = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;

  return {
    eventos,
    fecha_inicio,
    fecha_fin,
    total_eventos: eventos.length,
    total_faults,
    total_warnings,
    total_info,
    lineas_invalidas,
  };
}

/**
 * Lee un File y devuelve el ParseResult.
 * Conveniente para llamar desde un handler de <input type="file">.
 */
export async function parsearArchivoLog(file: File): Promise<ParseResult> {
  const texto = await file.text();
  return parsearErrorLog(texto);
}

/**
 * Etiqueta legible en español para un tipo de evento
 */
export function labelTipo(tipo: TipoEventoLog): string {
  switch (tipo) {
    case "fault":   return "Fault";
    case "warning": return "Warning";
    case "info":    return "Info";
  }
}

/**
 * Etiqueta legible en español para un subsistema
 */
export function labelSubsistema(sub: SubsistemaLog): string {
  switch (sub) {
    case "ion_source":   return "Fuente de Iones";
    case "vacuum":       return "Sistema de Vacío";
    case "safety":       return "Interlocks de Seguridad";
    case "network":      return "Red / Comunicaciones";
    case "target":       return "Target";
    case "maintenance":  return "Mantenimiento";
    case "production":   return "Producción";
    case "other":        return "Otro";
  }
}

/**
 * Descripción en español de una clave normalizada para mostrar al usuario
 */
export const CLAVE_DESCRIPCION: Record<string, string> = {
  gas_flow_fault:         "Falla en flujo de gas — fuente de iones",
  vacuum_fault:           "Falla en sistema de vacío",
  safety_door_open:       "Puerta de bunker abierta (interlock)",
  network_comm_fault:     "Falla de comunicación en red",
  target_already_full:    "Target ya estaba lleno al iniciar llenado",
  wrong_password:         "Contraseña incorrecta al iniciar producción",
  gems_file_warning:      "Archivo GEMS protegido (no se puede editar)",
  maintenance_fill_o18:   "Llenado de target con H₂¹⁸O",
  maintenance_fill_o16:   "Llenado de target con H₂¹⁶O",
  maintenance_empty:      "Vaciado de target",
  maintenance_dry:        "Secado de target",
  maintenance_stop:       "Detención manual del sistema",
  maintenance_connect:    "Conexión de target",
  maintenance_disconnect: "Desconexión de target",
  maintenance_leak_check: "Prueba de fuga",
  production_started:     "Producción iniciada",
  production_ended:       "Producción finalizada",
  local_mode_started:     "Modo local iniciado",
  local_mode_ended:       "Modo local finalizado",
};
