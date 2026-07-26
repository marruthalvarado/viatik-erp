/**
 * Parser para el archivo TXT de comprobantes recibidos exportado desde el SRI Ecuador.
 *
 * El archivo es TSV (tab-separated) con encoding ISO-8859-1, descargable desde:
 * https://srienlinea.sri.gob.ec → Comprobantes recibidos → Exportar
 *
 * Columnas (en orden):
 *   0  RUC_EMISOR
 *   1  RAZON_SOCIAL_EMISOR
 *   2  TIPO_COMPROBANTE
 *   3  SERIE_COMPROBANTE
 *   4  CLAVE_ACCESO
 *   5  FECHA_AUTORIZACION
 *   6  FECHA_EMISION
 *   7  IDENTIFICACION_RECEPTOR
 *   8  VALOR_SIN_IMPUESTOS
 *   9  IVA
 *   10 IMPORTE_TOTAL
 *   11 NUMERO_DOCUMENTO_MODIFICADO (opcional)
 */

export interface FilaTxtSri {
  ruc_emisor: string;
  razon_social: string;
  tipo_comprobante: string;
  serie: string;
  clave_acceso: string;
  /** Fecha de emisión en formato YYYY-MM-DD */
  fecha: string;
  subtotal: number;
  iva: number;
  total: number;
}

/** Convierte "DD/MM/YYYY" o "DD/MM/YYYY HH:MM:SS" → "YYYY-MM-DD" */
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

export function parseTxtSri(content: string): FilaTxtSri[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  // First line is header — skip it
  if (lines.length < 2) return [];

  const rows: FilaTxtSri[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols.length < 11) continue;

    // Skip non-invoice document types if needed (Factura, Nota de crédito, etc.)
    const tipo = cols[2].trim();
    if (!tipo) continue;

    rows.push({
      ruc_emisor: cols[0].trim(),
      razon_social: cols[1].trim(),
      tipo_comprobante: tipo,
      serie: cols[3].trim(),
      clave_acceso: cols[4].trim(),
      fecha: parseFecha(cols[6]),
      subtotal: parseNum(cols[8]),
      iva: parseNum(cols[9]),
      total: parseNum(cols[10]),
    });
  }

  return rows;
}

/**
 * Lee un File TXT/TSV del SRI y devuelve las filas parseadas.
 * Intenta ISO-8859-1 primero (encoding nativo del SRI) y cae a UTF-8.
 */
export function readTxtSriFile(file: File): Promise<FilaTxtSri[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const filas = parseTxtSri(text);
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
    // ISO-8859-1 es el encoding usado por el SRI Ecuador
    reader.readAsText(file, "ISO-8859-1");
  });
}
