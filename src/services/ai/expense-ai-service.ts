/**
 * expense-ai-service.ts — IA-2
 *
 * Servicio de dominio: interpreta texto OCR como un gasto corporativo.
 *
 * Responsabilidades:
 *   - Aceptar texto OCR directo O documentoId (lee extracción de BD)
 *   - Construir el contexto de empresa para mejorar la extracción
 *   - Llamar a AiService (que llama al proveedor activo)
 *   - Post-procesar: normalizar fecha, validar totales, limpiar strings
 *   - Retornar `ExpenseExtraction` lista para prellenar el formulario
 *
 * Invariante: NUNCA escribe en base de datos. Solo lectura + IA.
 *
 * Arquitectura: Hook → ExpenseAIService → AiService → DocumentAIProvider → API IA
 */
import { supabase } from "@/integrations/supabase/client";
import { extractExpense, type ExtractExpenseOptions } from "./ai-service";
import { DocumentAIError } from "./document-ai-provider";
import type { ExpenseExtraction, ExtractionContext } from "./document-ai-provider";

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

export interface ExpenseFromDocumentoInput {
  /** ID del registro `documentos` con extracción OCR ya completada. */
  documentoId: string;
  /** Contexto adicional de empresa (opcional, mejora precisión). */
  context?: Omit<ExtractionContext, "nombreArchivo">;
}

export interface ExpenseFromTextInput {
  /** Texto OCR ya disponible (cuando no se tiene documentoId). */
  text: string;
  context?: ExtractionContext;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Extrae propuesta de gasto desde un documento existente en BD.
 *
 * Flujo:
 *   1. Lee `ocr_extracciones` para obtener el texto OCR del documento
 *   2. Lee `documentos` para obtener nombre de archivo y empresa
 *   3. Construye contexto de empresa (país, moneda, categorías)
 *   4. Llama a AiService con el texto + contexto
 *   5. Post-procesa y retorna la propuesta
 *
 * @throws DocumentAIError si el documento no tiene OCR completado.
 */
export async function extractExpenseFromDocumento(
  input: ExpenseFromDocumentoInput,
): Promise<ExpenseExtraction> {
  const { documentoId } = input;

  // 1. Obtener extracción OCR
  const { data: ocrData, error: ocrError } = await supabase
    .from("ocr_extracciones")
    .select("texto_extraido, estado, documento_id")
    .eq("documento_id", documentoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ocrError) {
    throw new DocumentAIError(
      `Error al leer OCR del documento: ${ocrError.message}`,
      "PROVIDER_ERROR",
    );
  }

  if (!ocrData) {
    throw new DocumentAIError(
      "El documento no tiene extracción OCR. Procesa el documento primero.",
      "TEXT_TOO_SHORT",
    );
  }

  if (ocrData.estado !== "completado" || !ocrData.texto_extraido?.trim()) {
    throw new DocumentAIError(
      `El OCR aún no está disponible (estado: ${ocrData.estado}). Espera a que finalice.`,
      "TEXT_TOO_SHORT",
    );
  }

  // 2. Obtener metadatos del documento
  const { data: docData } = await supabase
    .from("documentos")
    .select("nombre_archivo, empresa_id")
    .eq("id", documentoId)
    .maybeSingle();

  // 3. Construir contexto de empresa
  const context = await buildEmpresaContext(
    docData?.empresa_id ?? null,
    docData?.nombre_archivo ?? null,
    input.context,
  );

  // 4. Extraer con IA
  const raw = await extractExpense(ocrData.texto_extraido, { context });

  // 5. Post-procesar
  return postProcess(raw);
}

/**
 * Extrae propuesta de gasto desde texto OCR directo.
 * Útil para integración rápida sin depender de un documento en BD.
 */
export async function extractExpenseFromText(
  input: ExpenseFromTextInput,
): Promise<ExpenseExtraction> {
  const options: ExtractExpenseOptions = { context: input.context };
  const raw = await extractExpense(input.text, options);
  return postProcess(raw);
}

// ─── Construcción de contexto ─────────────────────────────────────────────────

async function buildEmpresaContext(
  empresaId: string | null,
  nombreArchivo: string | null,
  extra?: Omit<ExtractionContext, "nombreArchivo">,
): Promise<ExtractionContext> {
  const context: ExtractionContext = {
    nombreArchivo: nombreArchivo ?? undefined,
    ...extra,
  };

  if (!empresaId) return context;

  // Leer parámetros de la empresa para enriquecer el contexto
  const { data: params } = await supabase
    .from("parametros_sistema")
    .select("clave, valor")
    .eq("empresa_id", empresaId)
    .in("clave", ["pais_default", "moneda_default"]);

  if (params) {
    const paramMap = Object.fromEntries(params.map((p) => [p.clave, p.valor]));
    if (paramMap["pais_default"] && typeof paramMap["pais_default"] === "string") {
      context.pais = paramMap["pais_default"];
    }
    if (paramMap["moneda_default"] && typeof paramMap["moneda_default"] === "string") {
      context.monedaPredeterminada = paramMap["moneda_default"];
    }
  }

  // Leer categorías de gasto de la empresa
  const { data: cats } = await supabase.from("categorias_gasto").select("nombre").order("nombre");

  if (cats?.length) {
    context.categoriasDisponibles = cats.map((c) => c.nombre);
  }

  return context;
}

// ─── Post-procesamiento ───────────────────────────────────────────────────────

/**
 * Normaliza y valida el resultado bruto de la IA.
 *
 * Transformaciones aplicadas:
 *   - Fecha: acepta YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY → YYYY-MM-DD
 *   - Números negativos: se convierten a positivos (IVA, subtotal nunca negativos)
 *   - Total inconsistente: se agrega advertencia si subtotal+IVA ≠ total (±1%)
 *   - Confianza fuera de rango: se clampea a 0-100
 *   - categoriasSugeridas vacías: se agrega "Misceláneos" como fallback
 */
function postProcess(raw: ExpenseExtraction): ExpenseExtraction {
  const result = { ...raw };

  // Normalizar fecha
  if (result.fecha) {
    result.fecha = normalizeDate(result.fecha);
  }

  // Números siempre positivos
  if (result.subtotal !== null) result.subtotal = Math.abs(result.subtotal);
  if (result.iva !== null) result.iva = Math.abs(result.iva);
  if (result.total !== null) result.total = Math.abs(result.total);

  // Detectar inconsistencia de totales si no fue reportada ya
  if (result.subtotal !== null && result.iva !== null && result.total !== null) {
    const calculado = result.subtotal + result.iva;
    const diferencia = Math.abs(calculado - result.total);
    const tolerancia = result.total * 0.01; // 1%
    if (diferencia > tolerancia && diferencia > 0.01) {
      const yaReportada = result.inconsistencias.some((i) => i.toLowerCase().includes("total"));
      if (!yaReportada) {
        result.inconsistencias = [
          ...result.inconsistencias,
          `Total (${result.total}) no coincide con subtotal + IVA (${calculado.toFixed(2)})`,
        ];
      }
    }
  }

  // Categoría fallback
  if (!result.categoriasSugeridas.length) {
    result.categoriasSugeridas = ["Misceláneos"];
  }

  // Clampear confianza
  result.confianza = Math.max(0, Math.min(100, Math.round(result.confianza)));

  return result;
}

/** Normaliza múltiples formatos de fecha a YYYY-MM-DD. */
function normalizeDate(raw: string): string | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (iso.test(raw)) return raw;

  // DD/MM/YYYY o DD-MM-YYYY
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
  const dmyMatch = dmy.exec(raw);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // MM/DD/YYYY (formato norteamericano)
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const mdyMatch = mdy.exec(raw);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    // Heurística: si el primer número > 12, es DD/MM
    const firstNum = parseInt(m, 10);
    if (firstNum > 12) {
      return `${y}-${d.padStart(2, "0")}-${m.padStart(2, "0")}`;
    }
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return raw; // Devolver tal cual si no se reconoce el formato
}
