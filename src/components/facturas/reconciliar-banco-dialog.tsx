/**
 * reconciliar-banco-dialog.tsx
 * Dialog para conciliación bancaria automática.
 * El usuario sube un XLS de ProCredit → se muestran los créditos que coinciden
 * con facturas pendientes (por monto exacto de valor_neto) → confirma → se crean cobros.
 */
import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, AlertCircle, Link2Off } from "lucide-react";
import { toast } from "@/components/common/toast";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { parseProcreditXLS, type BankCredit } from "@/services/bank-statement-procredit";
import { calcValorNeto } from "@/components/facturas/factura-types";
import type { FacturaEmitida } from "@/services/facturas-emitidas";
import { useCrearCobrosLote } from "@/hooks/entities/use-cobros";
import type { CobroInsert } from "@/types/entities";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface MatchRow {
  credit: BankCredit;
  factura: FacturaEmitida;
  valorNeto: number;
  selected: boolean;
}

interface UnmatchedCredit {
  credit: BankCredit;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Lista completa de facturas emitidas de la empresa (con datos de retención). */
  facturas: FacturaEmitida[];
  /** Mapa facturaId → monto ya cobrado (para calcular saldo pendiente). */
  cobrosMap: Map<string, number>;
  empresaId: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ReconciliarBancoDialog({
  open,
  onOpenChange,
  facturas,
  cobrosMap,
  empresaId,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedCredit[]>([]);
  const [parsed, setParsed] = useState(false);

  const crearLote = useCrearCobrosLote(empresaId);

  // ─── Parsear XLS ────────────────────────────────────────────────────────────

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const credits = await parseProcreditXLS(file);

      // Facturas que tienen saldo pendiente
      const facturasConSaldo = facturas.filter((f) => {
        if (f.estado_sri === "ANULADA") return false;
        const vn = calcValorNeto(
          Number(f.total),
          Number(f.iva),
          Number(f.subtotal),
          Number(f.retencion_iva_pct ?? 0),
          Number(f.retencion_ir_pct ?? 0),
        );
        const cobrado = cobrosMap.get(f.id) ?? 0;
        return vn - cobrado > 0.005;
      });

      const matchRows: MatchRow[] = [];
      const unmatchedRows: UnmatchedCredit[] = [];

      for (const credit of credits) {
        // Buscar factura cuyo valor_neto coincida exactamente (±1 centavo)
        const match = facturasConSaldo.find((f) => {
          const vn = calcValorNeto(
            Number(f.total),
            Number(f.iva),
            Number(f.subtotal),
            Number(f.retencion_iva_pct ?? 0),
            Number(f.retencion_ir_pct ?? 0),
          );
          const cobrado = cobrosMap.get(f.id) ?? 0;
          const saldo = vn - cobrado;
          return Math.abs(saldo - credit.monto) < 0.015;
        });

        if (match) {
          const vn = calcValorNeto(
            Number(match.total),
            Number(match.iva),
            Number(match.subtotal),
            Number(match.retencion_iva_pct ?? 0),
            Number(match.retencion_ir_pct ?? 0),
          );
          matchRows.push({ credit, factura: match, valorNeto: vn, selected: true });
        } else {
          unmatchedRows.push({ credit });
        }
      }

      setMatches(matchRows);
      setUnmatched(unmatchedRows);
      setParsed(true);

      if (credits.length === 0) {
        toast.error("No se encontraron créditos en el archivo.");
      } else {
        toast.success(
          `${credits.length} crédito${credits.length !== 1 ? "s" : ""} encontrado${credits.length !== 1 ? "s" : ""}. ${matchRows.length} coinciden con facturas pendientes.`,
        );
      }
    } catch (err) {
      toast.error("Error al leer el archivo: " + (err as Error).message);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function toggleSelect(idx: number) {
    setMatches((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, selected: !m.selected } : m)),
    );
  }

  function toggleAll(val: boolean) {
    setMatches((prev) => prev.map((m) => ({ ...m, selected: val })));
  }

  // ─── Confirmar cobros ────────────────────────────────────────────────────────

  async function handleConfirm() {
    const selected = matches.filter((m) => m.selected);
    if (selected.length === 0) {
      toast.error("No hay cobros seleccionados.");
      return;
    }

    const payloads: CobroInsert[] = selected.map((m) => ({
      factura_id: m.factura.id,
      empresa_id: empresaId,
      fecha_cobro: m.credit.fecha,
      monto: m.credit.monto,
      referencia: m.credit.descripcion || "Conciliación bancaria ProCredit",
      metodo_pago: "transferencia",
    }));

    try {
      await crearLote.mutateAsync(payloads);
      toast.success(
        `${selected.length} cobro${selected.length !== 1 ? "s" : ""} registrado${selected.length !== 1 ? "s" : ""} correctamente.`,
      );
      handleClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function handleClose() {
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setMatches([]);
      setUnmatched([]);
      setParsed(false);
    }, 300);
  }

  const selectedCount = matches.filter((m) => m.selected).length;
  const allSelected = matches.length > 0 && matches.every((m) => m.selected);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conciliar estado de cuenta bancario</DialogTitle>
        </DialogHeader>

        {/* Upload zone */}
        <div className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/20 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xls,.xlsx"
              className="hidden"
              onChange={handleFile}
            />
            <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">
              {loading ? "Procesando archivo..." : "Cargar estado de cuenta ProCredit (.xls)"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Se detectarán automáticamente los créditos y se intentará hacer match con facturas pendientes.
            </p>
          </div>

          {/* Resultados */}
          {parsed && (
            <>
              {/* Coincidencias */}
              {matches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      Coincidencias encontradas ({matches.length})
                    </h3>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => toggleAll(e.target.checked)}
                        className="rounded"
                      />
                      Seleccionar todos
                    </label>
                  </div>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/30 border-b text-[10px] uppercase text-muted-foreground">
                        <tr>
                          <th className="w-8 px-3 py-2" />
                          <th className="px-3 py-2 text-left">Fecha banco</th>
                          <th className="px-3 py-2 text-left">Descripción</th>
                          <th className="px-3 py-2 text-right">Monto</th>
                          <th className="px-3 py-2 text-left">Factura</th>
                          <th className="px-3 py-2 text-left">Cliente</th>
                          <th className="px-3 py-2 text-right">Valor neto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {matches.map((m, idx) => (
                          <tr
                            key={idx}
                            className={`cursor-pointer hover:bg-muted/20 transition-colors ${m.selected ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}
                            onClick={() => toggleSelect(idx)}
                          >
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={m.selected}
                                onChange={() => toggleSelect(idx)}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded"
                              />
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {formatDate(m.credit.fecha)}
                            </td>
                            <td className="px-3 py-2 max-w-[180px] truncate text-muted-foreground">
                              {m.credit.descripcion || "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-700">
                              {formatCurrency(m.credit.monto)}
                            </td>
                            <td className="px-3 py-2 font-mono">{m.factura.numero}</td>
                            <td className="px-3 py-2 max-w-[160px] truncate">
                              {m.factura.razon_social}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {formatCurrency(m.valorNeto)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sin coincidencia */}
              {unmatched.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Link2Off className="size-4 text-amber-500" />
                    Sin coincidencia ({unmatched.length})
                  </h3>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/30 border-b text-[10px] uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Fecha banco</th>
                          <th className="px-3 py-2 text-left">Descripción</th>
                          <th className="px-3 py-2 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {unmatched.map((u, idx) => (
                          <tr key={idx} className="text-muted-foreground">
                            <td className="px-3 py-2 tabular-nums">
                              {formatDate(u.credit.fecha)}
                            </td>
                            <td className="px-3 py-2 max-w-[240px] truncate">
                              {u.credit.descripcion || "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCurrency(u.credit.monto)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sin ningún crédito */}
              {matches.length === 0 && unmatched.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <AlertCircle className="size-4" />
                  No se encontraron transacciones CREDITO en el archivo.
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {parsed && matches.length > 0 && (
            <Button
              onClick={handleConfirm}
              disabled={selectedCount === 0 || crearLote.isPending}
            >
              {crearLote.isPending
                ? "Registrando..."
                : `Registrar ${selectedCount} cobro${selectedCount !== 1 ? "s" : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
