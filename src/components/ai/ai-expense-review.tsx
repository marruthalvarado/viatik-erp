import { formatCurrency } from "@/utils/formatters";
/**
 * ai-expense-review.tsx — IA-3
 *
 * Pantalla de revisión de la propuesta IA antes de crear el gasto.
 *
 * Muestra:
 *   - Badge de confianza (verde/amarillo/rojo)
 *   - Resumen de campos extraídos
 *   - Inconsistencias como alertas
 *   - Formulario de gasto pre-llenado con los valores de la IA
 *
 * El componente NO guarda nada. La confirmación la maneja el wizard padre.
 * No accede a servicios ni a Supabase directamente.
 */
import { AlertTriangle, Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { GastoForm } from "@/components/gastos/gasto-form";
import { AiConfidenceBadge } from "./ai-confidence-badge";
import type { GastoFormValues } from "@/components/gastos/gasto-types";
import type { ExpenseExtraction } from "@/services/ai/document-ai-provider";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AiExpenseReviewProps {
  propuesta: ExpenseExtraction | null;
  defaultValues: GastoFormValues;
  onConfirm: (values: GastoFormValues) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  rendiciones: Array<{ id: string; numero: string }>;
  proveedores: Array<{ id: string; nombre: string }>;
  categorias: Array<{ id: string; nombre: string }>;
  estados: Array<{ id: string; nombre: string; codigo: string }>;
  monedas: Array<{ codigo: string; nombre: string; simbolo: string | null }>;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function AiExpenseReview({
  propuesta,
  defaultValues,
  onConfirm,
  onCancel,
  loading,
  rendiciones,
  proveedores,
  categorias,
  estados,
  monedas,
}: AiExpenseReviewProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera IA */}
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Propuesta de la IA</h3>
        <Badge variant="secondary" className="text-[10px]">
          Revisar antes de guardar
        </Badge>
      </div>

      {/* Panel IA — solo cuando hay propuesta (imágenes; no para PDFs) */}
      {propuesta && (
        <>
          <AiConfidenceBadge confianza={propuesta.confianza} />

          {propuesta.inconsistencias.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="size-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                <span className="text-xs font-semibold text-amber-800">Posibles inconsistencias</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5">
                {propuesta.inconsistencias.map((inc, i) => (
                  <li key={i} className="text-xs text-amber-700">
                    {inc}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border bg-muted/30 p-3">
            <Campo label="Proveedor" valor={propuesta.proveedor} />
            <Campo label="RUC" valor={propuesta.ruc} />
            <Campo label="N° Factura" valor={propuesta.numeroFactura} />
            <Campo label="Fecha" valor={propuesta.fecha} />
            <Campo label="Moneda" valor={propuesta.moneda} />
            <Campo label="Total" valor={propuesta.total !== null ? formatCurrency(propuesta.total, propuesta.moneda ?? "USD") : null} />
            {propuesta.categoriasSugeridas.length > 0 && (
              <Campo label="Categoría sugerida" valor={propuesta.categoriasSugeridas[0]} />
            )}
            {propuesta.observaciones && (
              <div className="col-span-2">
                <Campo label="Observaciones" valor={propuesta.observaciones} />
              </div>
            )}
          </div>

          <Separator />

          <p className="text-xs text-muted-foreground">
            Revisa y ajusta los campos del formulario. Los datos son una propuesta editable.
          </p>
        </>
      )}

      {/* Formulario de gasto pre-llenado */}
      <GastoForm
        defaultValues={defaultValues}
        onSubmit={onConfirm}
        onCancel={onCancel}
        loading={loading}
        submitLabel="Crear gasto"
        rendiciones={rendiciones}
        proveedores={proveedores}
        categorias={categorias}
        estados={estados}
        monedas={monedas}
      />
    </div>
  );
}

// ─── Sub-componente de campo ──────────────────────────────────────────────────

function Campo({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-xs font-medium text-foreground truncate">
        {valor ?? <span className="italic text-muted-foreground">—</span>}
      </span>
    </div>
  );
}
