/**
 * Parser browser-side para logs de producción del ciclotrón GE PETtrace 800.
 *
 * Soporta:
 *  - Archivos .log — TSV con cabecera de 4 líneas y luego datos
 *  - Archivos .ods / .xlsx — misma estructura de columnas, vía SheetJS (xlsx)
 *
 * Columnas esperadas (26 por fila de datos):
 *  Time, Arc-I, Arc-V, Gas flow, Dee-1-kV, Dee-2-kV, Magnet-I, Foil-I,
 *  Coll-l-I, Target-I, Coll-r-I, Vacuum-P, Target-P, Delta Dee-kV,
 *  Phase load, Dee ref-V, Probe-I, He cool-P, Flap1-pos, Flap2-pos,
 *  Step pos, Extr pos, Balance, RF fwd-W, RF refl-W, Foil No
 */

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface BatchMeta {
  tracer:      string | null;  // Ej: "18F-FDG"
  numeroBatch: number | null;
  fecha:       string | null;  // ISO date YYYY-MM-DD
  sitio:       string | null;
}

/** Una lectura de 3 segundos del ciclotrón (todas las columnas numéricas) */
export interface BatchRow {
  /** Tiempo original del log, p.ej. "04:21:51" */
  time:          string;
  /** Índice 0-based en el array */
  idx:           number;
  arcI:          number;   // mA corriente del arco
  arcV:          number;   // V tensión del arco
  gasFlow:       number;   // sccm flujo de gas (H2)
  dee1Kv:        number;   // kV Dee 1
  dee2Kv:        number;   // kV Dee 2
  magnetI:       number;   // A corriente del magneto
  foilI:         number;   // µA corriente en la hoja
  collLI:        number;   // µA colimador izquierdo
  targetI:       number;   // µA corriente en el blanco
  collRI:        number;   // µA colimador derecho
  vacuumP:       number;   // mbar presión de vacío (p.ej. 1.27e-5)
  targetP:       number;   // mbar presión del blanco
  deltaDeeKv:    number;   // kV diferencia entre Dee voltages
  phaseLoad:     number;   // % carga de fase
  deeRefV:       number;   // V referencia Dee
  probeI:        number;   // µA corriente de la sonda
  heCoolP:       number;   // bar presión de enfriamiento He
  flap1Pos:      number;   // posición flap 1
  flap2Pos:      number;   // posición flap 2
  stepPos:       number;
  extrPos:       number;
  balance:       number;
  rfFwdW:        number;   // W potencia RF directa
  rfReflW:       number;   // W potencia RF reflejada
  foilNo:        number;   // número de hoja activa
}

export interface ParsedBatch {
  meta:  BatchMeta;
  rows:  BatchRow[];
}

// ── Parser principal ──────────────────────────────────────────────────────────

/**
 * Punto de entrada: recibe un File, detecta el tipo y despacha al parser
 * apropiado. Retorna meta + array de filas.
 */
export async function parseBatchFile(file: File): Promise<ParsedBatch> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".log") || lower.endsWith(".txt")) {
    return parseTsv(file);
  }
  if (lower.endsWith(".ods") || lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseSpreadsheet(file);
  }
  // Fallback: intentar como TSV
  return parseTsv(file);
}

// ── Parser TSV (.log) ─────────────────────────────────────────────────────────

async function parseTsv(file: File): Promise<ParsedBatch> {
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const meta = extractMetaFromLines(lines);
  const rows = parseDataLines(lines);
  return { meta, rows };
}

/**
 * El encabezado tiene esta estructura (exacta):
 *   Tracer:	18F-FDG
 *   Batch no:	6817
 *   Date:	2024-07-03
 *   Site:	SOLCA GYE
 *   (línea de nombres de columnas)
 *   (datos…)
 */
/**
 * Extrae metadatos del encabezado del log.
 *
 * Soporta dos formatos:
 *  A) Cada campo en su propia línea:
 *       Tracer:\t18F-FDG
 *       Batch no:\t6817
 *  B) Múltiples campos en la misma línea:
 *       Tracer:\t(1) 18F-\tBatch no:\t7610\tDate:\t2026-03-27
 *
 * Usamos regex sobre el texto completo del encabezado para cubrir ambos casos.
 */
function extractMetaFromLines(lines: string[]): BatchMeta {
  // Tomar las primeras 10 líneas y normalizar a texto plano
  const rawText = lines.slice(0, 10).join("\n");

  // Tracer: puede ser "(1) 18F-" o "18F-FDG"; capturamos hasta el siguiente tab, \n o fin
  const tracerM = rawText.match(/Tracer[:\s]+([^\t\n]+)/i);
  const tracer = tracerM ? tracerM[1].trim() : null;

  // Batch no: número entero
  const batchM = rawText.match(/Batch\s*no[:\s]+(\d+)/i);
  const numeroBatch = batchM ? (parseInt(batchM[1], 10) || null) : null;

  // Date
  const dateM = rawText.match(/Date[:\s]+([^\t\n]+)/i);
  const fecha = dateM ? parseLogDate(dateM[1].trim()) : null;

  // Site / Site name
  const siteM = rawText.match(/Site(?:\s+name)?[:\s]+([^\t\n]+)/i);
  const sitio = siteM ? siteM[1].trim() : null;

  return { tracer, numeroBatch, fecha, sitio };
}

/** Convierte fechas como "03.07.2024" o "2024-07-03" a ISO */
function parseLogDate(s: string): string | null {
  if (!s) return null;
  // DD.MM.YYYY
  const dmY = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, "0")}-${dmY[1].padStart(2, "0")}`;
  // YYYY-MM-DD
  const iso = s.match(/^\d{4}-\d{2}-\d{2}$/);
  if (iso) return s;
  // MM/DD/YYYY
  const mdY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdY) return `${mdY[3]}-${mdY[1].padStart(2, "0")}-${mdY[2].padStart(2, "0")}`;
  return null;
}

/** Busca la línea de cabecera de columnas y parsea los datos debajo */
function parseDataLines(lines: string[]): BatchRow[] {
  let dataStart = -1;
  // La línea de cabecera de datos empieza con "Time"
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    if (lines[i].trim().toLowerCase().startsWith("time")) {
      dataStart = i + 1;
      break;
    }
  }
  if (dataStart < 0) return [];

  const rows: BatchRow[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const row = parseTsvRow(lines[i], rows.length);
    if (row) rows.push(row);
  }
  return rows;
}

function parseTsvRow(line: string, idx: number): BatchRow | null {
  const parts = line.split("\t");
  if (parts.length < 26) return null;
  const time = parts[0].trim();
  if (!time || time.length < 5) return null;

  const n = (i: number) => parseFloat(parts[i]?.replace(",", ".") ?? "0") || 0;
  return {
    time,  idx,
    arcI:       n(1),
    arcV:       n(2),
    gasFlow:    n(3),
    dee1Kv:     n(4),
    dee2Kv:     n(5),
    magnetI:    n(6),
    foilI:      n(7),
    collLI:     n(8),
    targetI:    n(9),
    collRI:     n(10),
    vacuumP:    n(11),
    targetP:    n(12),
    deltaDeeKv: n(13),
    phaseLoad:  n(14),
    deeRefV:    n(15),
    probeI:     n(16),
    heCoolP:    n(17),
    flap1Pos:   n(18),
    flap2Pos:   n(19),
    stepPos:    n(20),
    extrPos:    n(21),
    balance:    n(22),
    rfFwdW:     n(23),
    rfReflW:    n(24),
    foilNo:     n(25),
  };
}

// ── Parser ODS / XLSX (SheetJS) ───────────────────────────────────────────────

async function parseSpreadsheet(file: File): Promise<ParsedBatch> {
  // SheetJS está disponible en el proyecto (dependencia instalada)
  const XLSX = await import("xlsx");

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // Convertir a array de arrays sin cabeceras
  const raw: (string | number)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: true,
  }) as (string | number)[][];

  // Extraer meta desde las primeras filas (misma lógica que TSV)
  const textLines = raw.map((r) => r.join("\t"));
  const meta = extractMetaFromLines(textLines);

  // Encontrar la fila de cabecera de columnas
  let dataStart = -1;
  for (let i = 0; i < Math.min(20, raw.length); i++) {
    const cell = String(raw[i][0] ?? "").toLowerCase().trim();
    if (cell === "time") {
      dataStart = i + 1;
      break;
    }
  }

  const rows: BatchRow[] = [];
  if (dataStart >= 0) {
    for (let i = dataStart; i < raw.length; i++) {
      const row = parseSheetRow(raw[i], rows.length);
      if (row) rows.push(row);
    }
  }

  return { meta, rows };
}

function parseSheetRow(cells: (string | number)[], idx: number): BatchRow | null {
  if (cells.length < 26) return null;
  const time = String(cells[0] ?? "").trim();
  if (!time || time.length < 5) return null;

  const n = (i: number): number => {
    const v = cells[i];
    if (typeof v === "number") return v;
    return parseFloat(String(v ?? "0").replace(",", ".")) || 0;
  };

  return {
    time,  idx,
    arcI:       n(1),
    arcV:       n(2),
    gasFlow:    n(3),
    dee1Kv:     n(4),
    dee2Kv:     n(5),
    magnetI:    n(6),
    foilI:      n(7),
    collLI:     n(8),
    targetI:    n(9),
    collRI:     n(10),
    vacuumP:    n(11),
    targetP:    n(12),
    deltaDeeKv: n(13),
    phaseLoad:  n(14),
    deeRefV:    n(15),
    probeI:     n(16),
    heCoolP:    n(17),
    flap1Pos:   n(18),
    flap2Pos:   n(19),
    stepPos:    n(20),
    extrPos:    n(21),
    balance:    n(22),
    rfFwdW:     n(23),
    rfReflW:    n(24),
    foilNo:     n(25),
  };
}

// ── Utilidades ────────────────────────────────────────────────────────────────

/** Calcula cuántos segundos dura el batch (nº de filas × 3 s/lectura aprox) */
export function calcDuracionSegundos(rows: BatchRow[]): number {
  return rows.length * 3;
}

/** Target-I setpoint: mediana de las filas de irradiación activa */
export function calcTargetISetpoint(rows: BatchRow[]): number {
  const active = rows.filter((r) => r.gasFlow > 4 && r.targetI > 10);
  if (active.length === 0) return 0;
  const sorted = [...active.map((r) => r.targetI)].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
