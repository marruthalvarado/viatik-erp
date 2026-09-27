/**
 * Parser de estado de cuenta ProCredit Ecuador (formato XLS/XLSX).
 *
 * Columnas (layout de 46 columnas, índices 0-based):
 *   col 1  → Fecha
 *   col 8  → Agencia
 *   col 14 → Referencia
 *   col 20 → Descripción
 *   col 34 → Tipo (CREDITO / DEBITO)
 *   col 38 → Valor
 *   col 45 → Saldo
 */
import * as XLSX from "xlsx";
import type { MovimientoBancarioParsed } from "./types";

function parseExcelDate(raw: unknown): string {
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof raw === "string" && raw.trim()) {
    const s = raw.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split("/");
      return `${y}-${m}-${d}`;
    }
    return s.slice(0, 10);
  }
  return "";
}

export async function parseProcreditXLS(file: File): Promise<MovimientoBancarioParsed[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];

  const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: "",
  });

  // Buscar fila de encabezado (col 1 === 'Fecha')
  let headerRow = -1;
  for (let i = 0; i < aoa.length; i++) {
    if (String(aoa[i]?.[1] ?? "").trim() === "Fecha") {
      headerRow = i;
      break;
    }
  }
  if (headerRow === -1) {
    throw new Error(
      "No se encontró la cabecera 'Fecha'. Verifica que sea un estado de cuenta ProCredit válido.",
    );
  }

  const result: MovimientoBancarioParsed[] = [];

  for (let i = headerRow + 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row) continue;

    const tipoRaw = String(row[34] ?? "")
      .trim()
      .toUpperCase();
    if (tipoRaw !== "CREDITO" && tipoRaw !== "DEBITO") continue;

    const fecha = parseExcelDate(row[1]);
    const monto = Number(row[38] ?? 0);
    if (monto <= 0 || !fecha) continue;

    result.push({
      fecha,
      descripcion: String(row[20] ?? "").trim(),
      referencia: String(row[14] ?? "").trim(),
      tipo: tipoRaw as "DEBITO" | "CREDITO",
      monto: Math.round(monto * 100) / 100,
      saldo: row[45] != null ? Math.round(Number(row[45]) * 100) / 100 : undefined,
    });
  }

  return result;
}
