/**
 * bank-statement-procredit.ts
 * Parser de estado de cuenta ProCredit Ecuador (formato XLS).
 *
 * Estructura de columnas (layout de 46 columnas, índices 0-based):
 *   col 1  → Fecha
 *   col 8  → Agencia
 *   col 14 → Referencia (Doc Num)
 *   col 20 → Descripción
 *   col 34 → Tipo (CREDITO / DEBITO)
 *   col 38 → Valor
 *   col 45 → Saldo
 */
import * as XLSX from "xlsx";

export interface BankCredit {
  /** Fecha en formato YYYY-MM-DD */
  fecha: string;
  descripcion: string;
  referencia: string;
  monto: number;
}

/** Parsea un archivo XLS de ProCredit y devuelve solo las filas CREDITO. */
export async function parseProcreditXLS(file: File): Promise<BankCredit[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Leer como array de arrays; con cellDates:true las fechas vienen como Date
  const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: "",
  });

  // Buscar la fila de encabezado (donde col 1 === 'Fecha')
  let headerRow = -1;
  for (let i = 0; i < aoa.length; i++) {
    const cell = String(aoa[i]?.[1] ?? "").trim();
    if (cell === "Fecha") {
      headerRow = i;
      break;
    }
  }
  if (headerRow === -1) {
    throw new Error(
      "No se encontró la cabecera 'Fecha' en el archivo. Verifica que sea un estado de cuenta ProCredit válido.",
    );
  }

  const credits: BankCredit[] = [];

  for (let i = headerRow + 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row) continue;

    const tipo = String(row[34] ?? "")
      .trim()
      .toUpperCase();
    if (tipo !== "CREDITO") continue;

    // Fecha: puede ser un objeto Date (cellDates:true) o un serial numérico de Excel
    const fechaRaw = row[1];
    let fecha = "";
    if (fechaRaw instanceof Date) {
      fecha = fechaRaw.toISOString().slice(0, 10);
    } else if (typeof fechaRaw === "number") {
      // Serial de Excel → Date
      const d = XLSX.SSF.parse_date_code(fechaRaw);
      if (d) {
        const mm = String(d.m).padStart(2, "0");
        const dd = String(d.d).padStart(2, "0");
        fecha = `${d.y}-${mm}-${dd}`;
      }
    } else if (typeof fechaRaw === "string" && fechaRaw.trim()) {
      // Si viene como texto "DD/MM/YYYY" o "YYYY-MM-DD"
      const s = fechaRaw.trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const [d, m, y] = s.split("/");
        fecha = `${y}-${m}-${d}`;
      } else {
        fecha = s.slice(0, 10);
      }
    }

    const monto = Number(row[38] ?? 0);
    if (monto <= 0 || !fecha) continue;

    credits.push({
      fecha,
      descripcion: String(row[20] ?? "").trim(),
      referencia: String(row[14] ?? "").trim(),
      monto: Math.round(monto * 100) / 100,
    });
  }

  return credits;
}
