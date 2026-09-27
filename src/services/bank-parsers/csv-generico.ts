/**
 * Parser CSV genérico para extractos bancarios ecuatorianos.
 * Auto-detecta columnas buscando palabras clave en los encabezados.
 *
 * Soporta delimitadores: coma, punto y coma, tabulación.
 * Soporta formatos de fecha: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY.
 *
 * Para bancos con columnas separadas de DEBITO / CREDITO
 * (Pichincha, Internacional, Produbanco) y con columna TIPO (DEBITO/CREDITO).
 */
import type { MovimientoBancarioParsed } from "./types";

// ─── Utilidades ───────────────────────────────────────────────────────────────

function detectDelimiter(sample: string): string {
  const counts = {
    ",": (sample.match(/,/g) ?? []).length,
    ";": (sample.match(/;/g) ?? []).length,
    "\t": (sample.match(/\t/g) ?? []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseFecha(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  // DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split("-");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // YYYY-MM-DD (ISO)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return "";
}

function normCol(s: string): string {
  return s.toLowerCase().replace(/[^a-záéíóú0-9]/g, "");
}

function findCol(headers: string[], ...keywords: string[]): number {
  for (const kw of keywords) {
    const idx = headers.findIndex((h) => normCol(h).includes(kw));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseMonto(raw: string): number {
  if (!raw || raw.trim() === "" || raw.trim() === "-") return 0;
  // Eliminar símbolos de moneda, espacios; tratar coma como decimal si va al final
  const s = raw.replace(/[$\s]/g, "").replace(/,(?=\d{2}$)/, ".");
  const n = parseFloat(s.replace(/[.,](?=\d{3})/g, "").replace(",", "."));
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

// ─── Parser principal ─────────────────────────────────────────────────────────

export async function parseCsvGenerico(file: File): Promise<MovimientoBancarioParsed[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("El archivo CSV está vacío o tiene menos de 2 filas.");

  const delim = detectDelimiter(lines[0]);
  const splitLine = (l: string) => l.split(delim).map((c) => c.replace(/^"|"$/g, "").trim());

  const headers = splitLine(lines[0]);

  // Detectar columnas
  const iFecha = findCol(headers, "fecha");
  const iDesc = findCol(headers, "descripcion", "concepto", "detalle", "glosa");
  const iRef = findCol(headers, "referencia", "docnum", "documento", "numero");
  const iTipo = findCol(headers, "tipo");
  const iDeb = findCol(headers, "debito", "egreso", "retiro", "cargo");
  const iCred = findCol(headers, "credito", "ingreso", "deposito", "abono");
  const iValor = findCol(headers, "valor", "monto", "importe");
  const iSaldo = findCol(headers, "saldo");

  if (iFecha === -1) {
    throw new Error(`No se encontró columna de fecha. Columnas detectadas: ${headers.join(", ")}`);
  }

  const result: MovimientoBancarioParsed[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    if (cells.every((c) => !c)) continue;

    const fecha = parseFecha(cells[iFecha] ?? "");
    if (!fecha) continue;

    const descripcion = iDesc !== -1 ? (cells[iDesc] ?? "") : "";
    const referencia = iRef !== -1 ? (cells[iRef] ?? "") : "";
    const saldo = iSaldo !== -1 ? parseMonto(cells[iSaldo] ?? "") || undefined : undefined;

    let tipo: "DEBITO" | "CREDITO" | null = null;
    let monto = 0;

    if (iTipo !== -1) {
      // Columna única TIPO + columna de valor
      const tipoRaw = (cells[iTipo] ?? "").trim().toUpperCase();
      if (tipoRaw.includes("DEB") || tipoRaw.includes("EGR") || tipoRaw.includes("CAR"))
        tipo = "DEBITO";
      else if (tipoRaw.includes("CRED") || tipoRaw.includes("ING") || tipoRaw.includes("ABO"))
        tipo = "CREDITO";

      const valorCol = iValor !== -1 ? iValor : iDeb !== -1 ? iDeb : iCred;
      monto = valorCol !== -1 ? parseMonto(cells[valorCol] ?? "") : 0;
    } else if (iDeb !== -1 && iCred !== -1) {
      // Columnas separadas DEBITO / CREDITO
      const mDeb = parseMonto(cells[iDeb] ?? "");
      const mCred = parseMonto(cells[iCred] ?? "");
      if (mCred > 0) {
        tipo = "CREDITO";
        monto = mCred;
      } else if (mDeb > 0) {
        tipo = "DEBITO";
        monto = mDeb;
      }
    } else if (iValor !== -1) {
      // Columna única de valor (positivo = crédito, negativo = débito)
      const val = parseMonto(cells[iValor] ?? "");
      if (val > 0) {
        tipo = "CREDITO";
        monto = val;
      } else if (val < 0) {
        tipo = "DEBITO";
        monto = Math.abs(val);
      }
    }

    if (!tipo || monto <= 0) continue;

    result.push({ fecha, descripcion, referencia, tipo, monto, saldo });
  }

  if (result.length === 0) {
    throw new Error(
      "No se encontraron movimientos válidos. Verifica que el archivo tenga columnas de fecha y monto.",
    );
  }

  return result;
}
