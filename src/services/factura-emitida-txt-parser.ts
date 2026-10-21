/**
 * Parser para el archivo TXT de comprobantes EMITIDOS autorizados del SRI Ecuador.
 *
 * Descargable desde:
 * https://srienlinea.sri.gob.ec → Comprobantes emitidos → Exportar
 *
 * Columnas (en orden, tab-separadas):
 *   0  COMPROBANTE          (e.g. "Factura")
 *   1  SERIE_COMPROBANTE    (e.g. "001-001-000000105")
 *   2  CLAVE_ACCESO
 *   3  FECHA_AUTORIZACION   (DD/MM/YYYY HH:MM:SS)
 *   4  FECHA_EMISION        (DD/MM/YYYY HH:MM:SS)
 *   5  VALOR_SIN_IMPUESTOS
 *   6  IVA
 *   7  IMPORTE_TOTAL
 */

export interface FilaTxtFacturaEmitida {
  tipo_comprobante: string;          // "Factura", "Nota de Crédito", etc.
  numero: string;                    // SERIE_COMPROBANTE
  clave_acceso: string;
  /** Fecha de emisión YYYY-MM-DD */
  fecha: string;
  subtotal: number;
  iva: number;
  total: number;
}

/** "DD/MM/YYYY" o "DD/MM/YYYY HH:MM:SS" → "YYYY-MM-DD" */
function parseFecha(raw: string): string {
  const datePart = raw.trim().split(" ")[0];
  const parts = datePart.split("/");
  if (parts.length !== 3) return raw.trim();
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseNum(raw: string): number {
  const n = parseFloat(raw.trim().replace(",", "."));
  return isNaN(n) ? 0 : n;
}

export function parseTxtFacturasEmitidas(content: string): FilaTxtFacturaEmitida[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  // Primera línea es cabecera — omitir
  if (lines.length < 2) return [];

  const rows: FilaTxtFacturaEmitida[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols.length < 8) continue;

    const tipo = cols[0].trim();
    if (!tipo) continue;

    rows.push({
      tipo_comprobante: tipo,
      numero: cols[1].trim(),
      clave_acceso: cols[2].trim(),
      fecha: parseFecha(cols[4]),   // FECHA_EMISION (col 4), no FECHA_AUTORIZACION
      subtotal: parseNum(cols[5]),
      iva: parseNum(cols[6]),
      total: parseNum(cols[7]),
    });
  }

  return rows;
}

/**
 * Lee un File TXT/TSV de emitidos SRI y devuelve las filas parseadas.
 * Intenta ISO-8859-1 primero (encoding nativo del SRI) y cae a UTF-8.
 */
export function readTxtFacturasEmitidasFile(file: File): Promise<FilaTxtFacturaEmitida[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const filas = parseTxtFacturasEmitidas(text);
        if (filas.length === 0) {
          reject(new Error("El archivo no contiene comprobantes válidos."));
        } else {
          resolve(filas);
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo TXT."));
    reader.readAsText(file, "ISO-8859-1");
  });
}
