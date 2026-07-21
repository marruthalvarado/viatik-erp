/**
 * Parser de RIDE (Representación Impresa del Documento Electrónico) SRI Ecuador en PDF.
 * Carga pdfjs-dist desde CDN en tiempo de ejecución para evitar problemas de bundling SSR.
 * Compatible con: Factura electrónica (tipo 01), Nota de Crédito (tipo 04).
 *
 * Nota: requiere que el PDF tenga capa de texto (PDFs generados por el SRI / portales de facturación),
 * NO funciona con PDFs escaneados (imágenes).
 */

import type { FacturaXmlData } from "./factura-xml-parser";

// ─── Carga de pdfjs desde CDN ────────────────────────────────────────────────

const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfjsLib = any;

async function loadPdfjs(): Promise<PdfjsLib> {
  // Reutilizar instancia ya cargada
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  if (win.pdfjsLib?.getDocument) return win.pdfjsLib;

  // Cargar script principal desde CDN
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar pdf.js desde CDN"));
    document.head.appendChild(script);
  });

  const lib: PdfjsLib = win.pdfjsLib;
  // Apuntar al worker también desde CDN
  lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
  return lib;
}

// ─── Extracción de texto ──────────────────────────────────────────────────────

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await loadPdfjs();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Agrupar items por posición Y (redondeada) para reconstruir líneas
    const byY = new Map<number, { x: number; str: string }[]>();
    for (const item of textContent.items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const it = item as any;
      if (!it.str?.trim()) continue;
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y)!.push({ x, str: it.str });
    }

    // Ordenar líneas de arriba a abajo (Y descendente en coordenadas PDF)
    const sortedYs = Array.from(byY.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = byY.get(y)!.sort((a, b) => a.x - b.x);
      const line = items.map((i) => i.str).join(" ").trim();
      if (line) allLines.push(line);
    }
  }

  return allLines.join("\n");
}

// ─── Parser de texto SRI ──────────────────────────────────────────────────────

function num(s: string | undefined | null): number {
  if (!s) return 0;
  return parseFloat(s.replace(/,/g, ".")) || 0;
}

function parsePdfText(text: string): FacturaXmlData {
  // ── Tipo de documento ──
  const tipo: "factura" | "nota_credito" = /NOTA\s+DE\s+CR[ÉE]DITO/i.test(text)
    ? "nota_credito"
    : "factura";

  // ── Número (ej: 001-001-000000092) ──
  const numeroMatch = text.match(/No\.\s+((?:\d{3}-){2}\d{9})/);
  const numero = numeroMatch?.[1] ?? "";

  // ── Clave de acceso (49 dígitos exactos) ──
  const claveMatch = text.match(/\b(\d{49})\b/);
  const clave_acceso = claveMatch?.[1] ?? null;

  // ── Fecha de emisión ──
  // El RIDE tiene dos fechas: autorización (con hora "HH:MM:SS") y emisión (sin hora).
  // Tomamos la primera fecha dd/mm/yyyy que NO vaya seguida de una hora.
  let fecha = "";
  const allDatesRe = /\b(\d{2}\/\d{2}\/\d{4})\b/g;
  let dm: RegExpExecArray | null;
  while ((dm = allDatesRe.exec(text)) !== null) {
    const after = text.slice(dm.index + dm[0].length, dm.index + dm[0].length + 12);
    if (!/\s*\d{1,2}:\d{2}:\d{2}/.test(after)) {
      const [d, m, y] = dm[1].split("/");
      fecha = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      break;
    }
  }

  // ── Razón social del cliente ──
  // En pdfjs la etiqueta "Razón Social...Apellidos:" y "Identificación" a veces quedan
  // en la misma fila Y; capturamos todo hasta el primer RUC (10-13 dígitos) o la
  // etiqueta "Identificación" y filtramos residuos de etiquetas.
  const razonMatch = text.match(
    /Raz[oó]n\s+Social[^:\n]*:?\s+([\s\S]{1,200}?)(?=\s*(?:\b\d{10,13}\b|Identificaci[oó]n))/i,
  );
  const razon_social = (razonMatch?.[1] ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^(Identificaci[oó]n|Fecha|Direcci[oó]n|Placa)/i.test(l))
    .join(" ")
    .trim();

  // ── RUC / Identificación del cliente ──
  const idMatch = text.match(/Identificaci[oó]n\s+(\d{10,13})/i);
  const ruc_cliente = idMatch?.[1] ?? null;

  // ── Subtotal (SUBTOTAL SIN IMPUESTOS = suma de todos los subtotales) ──
  const subtotalMatch = text.match(/SUBTOTAL\s+SIN\s+IMPUESTOS\s+([\d.,]+)/i);
  const subtotal = num(subtotalMatch?.[1]);

  // ── IVA (suma de todas las líneas IVA XX%) ──
  let iva = 0;
  const ivaRe = /IVA\s+\d+%\s+([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = ivaRe.exec(text)) !== null) {
    iva += num(m[1]);
  }
  iva = Math.round(iva * 100) / 100;

  // ── Descuento total ──
  const descuentoMatch = text.match(/TOTAL\s+DESCUENTO\s+([\d.,]+)/i);
  const descuento = num(descuentoMatch?.[1]);

  // ── Descripción de ítems → Observación ──
  // Buscar en el bloque entre la cabecera de la tabla (Cantidad) y los totales
  let observacion: string | null = null;
  const tblStart = text.search(/\bCantidad\b/i);
  const tblEnd = text.search(/SUBTOTAL\s+SIN\s+IMPUESTOS/i);
  if (tblStart >= 0 && tblEnd > tblStart) {
    const block = text.slice(tblStart, tblEnd);
    const descLines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 4 &&
          !/^[\d.,\s]+$/.test(l) && // solo números → descartar
          !/^[A-Z]{1,6}-\d+$/.test(l) && // códigos como SERV-012 → descartar
          !/^(Cantidad|Descripci|Detalle|Precio|Subsidio|Descuento|Cod\.)/i.test(l) && // cabeceras
          !/^(Sucursal|Direcci[oó]n|E-MAIL|Tel[eé]fono|Forma|Informaci[oó]n)/i.test(l),
      );
    observacion = descLines.join(" ").trim() || null;
  }

  // ── Total ("VALOR TOTAL" pero NO "VALOR TOTAL SIN SUBSIDIO") ──
  const totalMatch = text.match(/VALOR\s+TOTAL\s+([\d.,]+)(?!\s*SIN\s+SUBSIDIO)/i);
  const total = num(totalMatch?.[1]) || subtotal + iva;

  // ── Validaciones mínimas ──
  if (!numero) throw new Error("No se pudo leer el número de factura. ¿Es un RIDE del SRI?");
  if (!fecha) throw new Error("No se pudo leer la fecha de emisión del PDF.");
  if (!razon_social) throw new Error("No se pudo leer la razón social del cliente.");

  return {
    numero,
    fecha,
    tipo,
    ruc_cliente,
    razon_social,
    subtotal,
    descuento,
    iva,
    total,
    clave_acceso,
    estado_sri: "AUTORIZADO",
    xml_content: "",
    observacion,
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Lee un archivo PDF (RIDE SRI Ecuador) y devuelve los datos de la factura.
 * Lanza un error si el PDF no tiene capa de texto o si faltan campos clave.
 */
export async function readFacturaPdfFile(file: File): Promise<FacturaXmlData> {
  const text = await extractPdfText(file);
  if (!text.trim()) {
    throw new Error(
      "El PDF no contiene texto seleccionable. Solo se admiten PDFs del SRI (RIDE), no imágenes escaneadas.",
    );
  }
  return parsePdfText(text);
}
