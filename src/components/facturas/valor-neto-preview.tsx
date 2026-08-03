import type { UseFormReturn } from "react-hook-form";
import type { FormValues } from "./factura-types";
import { formatCurrency } from "@/utils/formatters";

export function ValorNetoPreviewWrapper({ form }: { form: UseFormReturn<FormValues> }) {
  const total = form.watch("total") ?? 0;
  const iva = form.watch("iva") ?? 0;
  const subtotal = form.watch("subtotal") ?? 0;
  const retIva = form.watch("retencion_iva_pct") ?? 0;
  const retIr = form.watch("retencion_ir_pct") ?? 0;
  return (
    <ValorNetoPreview
      total={Number(total)}
      iva={Number(iva)}
      subtotal={Number(subtotal)}
      retIva={Number(retIva)}
      retIr={Number(retIr)}
    />
  );
}

export function ValorNetoPreview({
  total,
  iva,
  subtotal,
  retIva,
  retIr,
}: {
  total: number;
  iva: number;
  subtotal: number;
  retIva: number;
  retIr: number;
}) {
  if (retIva <= 0 && retIr <= 0) return null;

  const retIvaMonto = Math.round(Number(iva) * Number(retIva)) / 100;
  const retIrMonto = Math.round(Number(subtotal) * Number(retIr)) / 100;
  const valorNeto = Math.round((Number(total) - retIvaMonto - retIrMonto) * 100) / 100;

  return (
    <div className="rounded-md bg-white border border-blue-100 px-3 py-2 text-xs space-y-1">
      <div className="flex justify-between text-muted-foreground">
        <span>Total factura</span>
        <span className="tabular-nums font-medium text-foreground">
          {formatCurrency(Number(total))}
        </span>
      </div>
      {retIva > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>
            Ret. IVA ({retIva}% de {formatCurrency(Number(iva))})
          </span>
          <span className="tabular-nums text-red-600">- {formatCurrency(retIvaMonto)}</span>
        </div>
      )}
      {retIr > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>
            Ret. IR ({retIr}% de {formatCurrency(Number(subtotal))})
          </span>
          <span className="tabular-nums text-red-600">- {formatCurrency(retIrMonto)}</span>
        </div>
      )}
      <div className="flex justify-between border-t pt-1 font-semibold">
        <span className="text-blue-700">Valor a cobrar</span>
        <span className="tabular-nums text-blue-700">{formatCurrency(valorNeto)}</span>
      </div>
    </div>
  );
}
