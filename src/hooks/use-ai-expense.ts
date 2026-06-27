/**
 * use-ai-expense.ts — IA-2
 *
 * Hook React para extraer una propuesta de gasto con IA desde un documento OCR.
 *
 * La IA solo PROPONE. El usuario confirma los datos antes de guardar.
 * Este hook NUNCA crea gastos ni escribe en la base de datos.
 *
 * Arquitectura: Componente → Hook → ExpenseAIService → AiService → Provider → API IA
 *
 * ─── Dos modos de uso ────────────────────────────────────────────────────────
 *
 * Modo 1: Desde un documento existente en BD (más completo: incluye contexto de empresa)
 *   const { extraer, propuesta, procesando, error } = useAiExpense();
 *   extraer({ documentoId: "uuid" });
 *
 * Modo 2: Desde texto OCR directo (más rápido, sin contexto de empresa)
 *   const { extraerDesdeTexto, propuesta, procesando, error } = useAiExpense();
 *   extraerDesdeTexto({ text: "Factura...", context: { pais: "Peru" } });
 */
import { useMutation } from "@tanstack/react-query";
import {
  extractExpenseFromDocumento,
  extractExpenseFromText,
} from "@/services/ai/expense-ai-service";
import { DocumentAIError } from "@/services/ai/document-ai-provider";
import type { ExpenseExtraction, ExtractionContext } from "@/services/ai/document-ai-provider";
import type {
  ExpenseFromDocumentoInput,
  ExpenseFromTextInput,
} from "@/services/ai/expense-ai-service";
import { getProviderInfo } from "@/services/ai/ai-service";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type { ExpenseExtraction };

export interface UseAiExpenseReturn {
  /**
   * Dispara la extracción IA desde un documento existente en BD.
   * El resultado queda en `propuesta`.
   */
  extraer: (input: ExpenseFromDocumentoInput) => void;
  /**
   * Dispara la extracción IA desde texto OCR directo.
   * Útil cuando el texto ya está en memoria.
   */
  extraerDesdeTexto: (input: ExpenseFromTextInput) => void;
  /** Resultado de la extracción. null mientras no haya resultado. */
  propuesta: ExpenseExtraction | null;
  /** true mientras la extracción IA está en curso. */
  procesando: boolean;
  /** Mensaje de error si la extracción falló. */
  error: string | null;
  /** Código de error tipado para manejo diferenciado en la UI. */
  errorCode: string | null;
  /** Limpia el resultado y el error para una nueva extracción. */
  reset: () => void;
  /** Información del proveedor IA activo (para mostrar en UI). */
  proveedorInfo: { name: string; model: string } | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAiExpense(): UseAiExpenseReturn {
  const mutationFromDocumento = useMutation({
    mutationFn: (input: ExpenseFromDocumentoInput) => extractExpenseFromDocumento(input),
  });

  const mutationFromText = useMutation({
    mutationFn: (input: ExpenseFromTextInput) => extractExpenseFromText(input),
  });

  // El resultado es de whichever mutation ran last
  const activeMutation =
    mutationFromDocumento.status !== "idle" ? mutationFromDocumento : mutationFromText;

  const propuesta = activeMutation.data ?? null;
  const procesando = mutationFromDocumento.isPending || mutationFromText.isPending;
  const rawError = activeMutation.error;

  const error = rawError instanceof Error ? rawError.message : rawError ? String(rawError) : null;
  const errorCode = rawError instanceof DocumentAIError ? rawError.code : null;

  const reset = () => {
    mutationFromDocumento.reset();
    mutationFromText.reset();
  };

  return {
    extraer: (input) => mutationFromDocumento.mutate(input),
    extraerDesdeTexto: (input) => mutationFromText.mutate(input),
    propuesta,
    procesando,
    error,
    errorCode,
    reset,
    proveedorInfo: getProviderInfo(),
  };
}

// ─── Hook de solo-lectura para pasar propuesta a formulario ──────────────────

export interface UseAiExpenseFormProps {
  /** Propuesta de la IA. null si no hay extracción activa. */
  propuesta: ExpenseExtraction | null;
  /** Convierte la propuesta al formato esperado por react-hook-form. */
  toFormValues(): Partial<GastoFormValues> | null;
}

/**
 * Tipo mínimo del formulario de gastos para el prellenado.
 * Solo los campos que la IA puede proponer.
 */
export interface GastoFormValues {
  proveedor: string;
  numero_documento: string;
  fecha: string;
  moneda_id: string;
  subtotal: number;
  iva: number;
  total: number;
  notas: string;
}

/**
 * Transforma una `ExpenseExtraction` en los valores iniciales del formulario de gastos.
 * Útil para prellenar sin necesidad de adaptar en el componente.
 *
 * @param propuesta Resultado de `useAiExpense().propuesta`
 * @param monedaMap Mapa de código ISO → ID en BD (ej: { USD: "uuid-usd", PEN: "uuid-pen" })
 */
export function toGastoFormValues(
  propuesta: ExpenseExtraction,
  monedaMap: Record<string, string> = {},
): Partial<GastoFormValues> {
  const values: Partial<GastoFormValues> = {};

  if (propuesta.proveedor) values.proveedor = propuesta.proveedor;
  if (propuesta.numeroFactura) values.numero_documento = propuesta.numeroFactura;
  if (propuesta.fecha) values.fecha = propuesta.fecha;
  if (propuesta.subtotal !== null) values.subtotal = propuesta.subtotal;
  if (propuesta.iva !== null) values.iva = propuesta.iva;
  if (propuesta.total !== null) values.total = propuesta.total;

  // Resolver moneda: código ISO → ID de BD
  if (propuesta.moneda && monedaMap[propuesta.moneda]) {
    values.moneda_id = monedaMap[propuesta.moneda];
  }

  // Construir notas con observaciones e inconsistencias
  const notas: string[] = [];
  if (propuesta.observaciones) notas.push(propuesta.observaciones);
  if (propuesta.inconsistencias.length) {
    notas.push(`⚠ Revisar: ${propuesta.inconsistencias.join("; ")}`);
  }
  if (notas.length) values.notas = notas.join("\n");

  return values;
}

// ─── Utilidad: nombre del contexto ───────────────────────────────────────────

/**
 * Construye un `ExtractionContext` básico desde los datos del formulario actual.
 * Permite que la IA use la moneda y categorías ya seleccionadas como pistas.
 */
export function buildContextFromForm(partial: {
  pais?: string;
  moneda?: string;
  categoriasDisponibles?: string[];
}): ExtractionContext {
  return {
    pais: partial.pais,
    monedaPredeterminada: partial.moneda,
    categoriasDisponibles: partial.categoriasDisponibles,
  };
}
