/**
 * ocr-service.ts — IA-1
 *
 * Orquestador de la pipeline OCR completa:
 *   1. Subir archivo a Supabase Storage (via ocr-storage.ts)
 *   2. Registrar documento en tabla `documentos`
 *   3. Ejecutar OCR (via IOcrProvider)
 *   4. Persistir resultado en `ocr_extracciones`
 *   5. Marcar `documentos.procesado = true`
 *
 * Gestión de PDFs:
 *   Los PDFs se suben normalmente pero el OCR requiere backend (Edge Functions).
 *   Estado resultante: 'requiere_backend'.
 *
 * Arquitectura: Hook → Service → (Storage + Supabase DB)
 * Nunca acceder directamente desde componentes.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/types/database";
import type { OcrExtraccion, OcrExtraccionInsert } from "@/types/entities";
import { uploadDocumento, type StorageUploadOptions } from "./ocr-storage";
import { activeOcrProvider, type IOcrProvider } from "./ocr-provider";
import { extractFromXml } from "./xml-extractor";
import { readPdfAsBase64 } from "./pdf-extractor";
import { EdgeFunctionDocumentProvider } from "@/services/ai/edge-function-provider";

// ─── Tipos de entrada/salida ──────────────────────────────────────────────────

export interface OcrPipelineInput {
  file: File;
  empresaId: string;
  rendicionId: string | null;
  /** ID del registro `documentos` ya existente, o null para crear uno nuevo. */
  documentoId?: string;
  /** Categoría del documento (referencia a cat_documentos). */
  categoriDocumentoId?: string;
  /** Tipo de documento (referencia a tipo_documentos). */
  tipoDocumentoId?: string;
}

export interface OcrPipelineOptions extends StorageUploadOptions {
  /** Proveedor OCR a usar. Por defecto: activeOcrProvider. */
  provider?: IOcrProvider;
}

export interface OcrPipelineResult {
  documentoId: string;
  storagePath: string;
  extraccion: OcrExtraccion;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/bmp", "image/webp"];
const TIPOS_ACEPTADOS = [...TIPOS_IMAGEN, "application/pdf", "application/xml", "text/xml"];

// ─── Validación de archivo ────────────────────────────────────────────────────

export function validarArchivo(file: File): { valido: boolean; error?: string } {
  // .xml files may report as application/xml, text/xml or empty MIME — accept by extension too
  const esXml =
    file.type === "application/xml" ||
    file.type === "text/xml" ||
    file.name.toLowerCase().endsWith(".xml");
  if (!TIPOS_ACEPTADOS.includes(file.type) && !esXml) {
    return {
      valido: false,
      error: `Tipo de archivo no soportado: ${file.type}. Se aceptan JPG, PNG, PDF y XML.`,
    };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { valido: false, error: "El archivo supera el límite de 20 MB." };
  }
  if (file.size === 0) {
    return { valido: false, error: "El archivo está vacío." };
  }
  return { valido: true };
}

// ─── Pipeline principal ───────────────────────────────────────────────────────

/**
 * Ejecuta la pipeline OCR completa para un archivo dado.
 *
 * @param input   Parámetros del documento
 * @param options Opciones de upload y proveedor OCR
 */
export async function procesarDocumentoOcr(
  input: OcrPipelineInput,
  options: OcrPipelineOptions = {},
): Promise<OcrPipelineResult> {
  const { file, empresaId, rendicionId } = input;
  const provider = options.provider ?? activeOcrProvider;

  // 1. Validar archivo
  const validacion = validarArchivo(file);
  if (!validacion.valido) {
    throw new Error(validacion.error);
  }

  // 2. Crear registro en documentos (o usar el existente)
  const documentoId = input.documentoId ?? (await crearRegistroDocumento(input));

  // 3. Subir a Storage
  const { storagePath, signedUrl } = await uploadDocumento(
    file,
    empresaId,
    rendicionId,
    documentoId,
    { onProgress: options.onProgress, signal: options.signal },
  );

  // 4. Actualizar storage_path en documentos
  await supabase
    .from("documentos")
    .update({ storage_path: storagePath })
    .eq("id", documentoId)
    .throwOnError();

  // 5. Insertar extracción con estado inicial
  const extraccionBase = await insertarExtraccionPendiente(documentoId, provider.name);

  // 6. Ejecutar extracción según tipo de archivo
  let extraccion: OcrExtraccion;
  const esXml =
    file.type === "application/xml" ||
    file.type === "text/xml" ||
    file.name.toLowerCase().endsWith(".xml");

  if (esXml) {
    extraccion = await ejecutarExtraccionXml(file, extraccionBase.id);
  } else if (file.type === "application/pdf") {
    extraccion = await ejecutarExtraccionPdf(file, extraccionBase.id);
  } else {
    extraccion = await ejecutarOcr(file, extraccionBase.id, provider);
  }

  // 7. Marcar documento como procesado
  await supabase
    .from("documentos")
    .update({ procesado: true })
    .eq("id", documentoId)
    .throwOnError();

  void signedUrl; // signedUrl está disponible si el llamador necesita preview
  return { documentoId, storagePath, extraccion };
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

async function crearRegistroDocumento(input: OcrPipelineInput): Promise<string> {
  const { file, empresaId, rendicionId, categoriDocumentoId, tipoDocumentoId } = input;

  const { data, error } = await supabase
    .from("documentos")
    .insert({
      empresa_id: empresaId,
      rendicion_id: rendicionId ?? null,
      nombre_archivo: file.name,
      storage_path: "", // Se actualiza tras el upload
      tamano: file.size,
      procesado: false,
      categoria_documento_id: categoriDocumentoId ?? null,
      tipo_documento_id: tipoDocumentoId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`[ocr-service] Error al crear documento: ${error?.message}`);
  }

  return data.id;
}

async function insertarExtraccionPendiente(
  documentoId: string,
  proveedorNombre: string,
): Promise<OcrExtraccion> {
  const payload: OcrExtraccionInsert = {
    documento_id: documentoId,
    ocr_proveedor: proveedorNombre,
    estado: "procesando",
    texto_extraido: null,
    confianza: null,
    json_ocr: null,
    tiempo_procesamiento_ms: null,
  };

  const { data, error } = await supabase.from("ocr_extracciones").insert(payload).select().single();

  if (error || !data) {
    throw new Error(`[ocr-service] Error al insertar extracción: ${error?.message}`);
  }

  return data;
}

async function ejecutarOcr(
  file: File,
  extraccionId: string,
  provider: IOcrProvider,
): Promise<OcrExtraccion> {
  let resultado;
  let errorMensaje: string | null = null;
  let estado: string = "completado";

  try {
    resultado = await provider.extractText(file);
  } catch (err) {
    estado = "error";
    errorMensaje = err instanceof Error ? err.message : String(err);
  }

  const update: Partial<OcrExtraccionInsert> = {
    estado,
    error_mensaje: errorMensaje,
    texto_extraido: resultado?.textoCompleto ?? null,
    confianza: resultado?.confianza ?? null,
    json_ocr: (resultado?.jsonRaw ?? null) as Json | null,
    tiempo_procesamiento_ms: resultado?.tiempoMs ?? null,
  };

  const { data, error } = await supabase
    .from("ocr_extracciones")
    .update(update)
    .eq("id", extraccionId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`[ocr-service] Error al actualizar extracción: ${error?.message}`);
  }

  return data;
}

/**
 * Extrae texto de un XML (CFDI/UBL/genérico) y lo guarda en ocr_extracciones.
 */
async function ejecutarExtraccionXml(file: File, extraccionId: string): Promise<OcrExtraccion> {
  let textoExtraido: string | null = null;
  let estado = "completado";
  let errorMensaje: string | null = null;
  let confianza: number | null = null;
  const t0 = Date.now();

  let jsonOcr: Record<string, unknown> | null = null;

  try {
    const resultado = await extractFromXml(file);
    textoExtraido = resultado.textoParaIA;
    confianza = resultado.confianza;
    // Guardar datos estructurados para evitar llamar a OpenAI en el paso IA
    jsonOcr = resultado.datos as unknown as Record<string, unknown>;
  } catch (err) {
    estado = "error";
    errorMensaje = err instanceof Error ? err.message : String(err);
  }

  const { data, error } = await supabase
    .from("ocr_extracciones")
    .update({
      estado,
      texto_extraido: textoExtraido,
      json_ocr: jsonOcr,
      confianza,
      error_mensaje: errorMensaje,
      ocr_proveedor: "xml_parser",
      tiempo_procesamiento_ms: Date.now() - t0,
    })
    .eq("id", extraccionId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`[ocr-service] Error al actualizar extracción XML: ${error?.message}`);
  }
  return data;
}

/**
 * Envía el PDF como base64 a la Edge Function (OpenAI Vision) y guarda el texto.
 */
async function ejecutarExtraccionPdf(file: File, extraccionId: string): Promise<OcrExtraccion> {
  let textoExtraido: string | null = null;
  let estado = "completado";
  let errorMensaje: string | null = null;
  const t0 = Date.now();

  try {
    const { base64 } = await readPdfAsBase64(file);
    // Llamamos directamente al provider para obtener la extracción IA
    // y guardamos la representación textual del resultado como texto_extraido
    const edgeProvider = new EdgeFunctionDocumentProvider();
    const extraccion = await edgeProvider.extractExpenseFromPdf(base64);
    // Serializar la extracción como texto estructurado para reutilizarla luego
    textoExtraido = JSON.stringify(extraccion);
  } catch (err) {
    estado = "error";
    errorMensaje = err instanceof Error ? err.message : String(err);
  }

  const { data, error } = await supabase
    .from("ocr_extracciones")
    .update({
      estado,
      texto_extraido: textoExtraido,
      error_mensaje: errorMensaje,
      ocr_proveedor: "openai_vision_pdf",
      tiempo_procesamiento_ms: Date.now() - t0,
    })
    .eq("id", extraccionId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`[ocr-service] Error al actualizar extracción PDF: ${error?.message}`);
  }
  return data;
}

// ─── Consultas ────────────────────────────────────────────────────────────────

/** Obtiene la extracción OCR asociada a un documento. */
export async function getExtraccionByDocumentoId(
  documentoId: string,
): Promise<OcrExtraccion | null> {
  const { data, error } = await supabase
    .from("ocr_extracciones")
    .select("*")
    .eq("documento_id", documentoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`[ocr-service] Error al obtener extraccion: ${error.message}`);
  }

  return data;
}
