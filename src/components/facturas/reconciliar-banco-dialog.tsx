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
  /** Factura ya tiene cobros que cubren el valor_neto (ya registrada) */
  yaCobrada: boolean;
  /** Días de diferencia entre crédito y fecha factura */
  diasDif: number;
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
  /** facturaId elegida manualmente para cada crédito sin coincidencia (clave = índice en unmatched) */
  const [manual, setManual] = useState<Record<number, string>>({});

  const crearLote = useCrearCobrosLote(empresaId);

  /** Valor neto de una factura (helper sin depender de closures internos) */
  const getVN = (f: FacturaEmitida) =>
    calcValorNeto(
      Number(f.total), Number(f.iva), Number(f.subtotal),
      Number(f.retencion_iva_pct ?? 0), Number(f.retencion_ir_pct ?? 0),
    );

  /** Facturas con saldo pendiente (pendiente, parcial o vencida) para el selector manual */
  const facturasParaSelector = facturas
    .filter((f) => {
      if (f.estado_sri === "ANULADA") return false;
      const vn = getVN(f);
      const cobrado = cobrosMap.get(f.id) ?? 0;
      return vn - cobrado > 0.005; // saldo pendiente
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  // ─── Parsear XLS ────────────────────────────────────────────────────────────

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const credits = await parseProcreditXLS(file);

      // Todas las facturas no anuladas como candidatas (incluye ya cobradas)
      const candidatas = facturas.filter((f) => f.estado_sri !== "ANULADA");

      const matchRows: MatchRow[] = [];
      const unmatchedRows: UnmatchedCredit[] = [];
      // Evitar asociar la misma factura a dos créditos distintos
      const usadas = new Set<string>();

      const facturaVN = (f: FacturaEmitida) =>
        calcValorNeto(
          Number(f.total),
          Number(f.iva),
          Number(f.subtotal),
          Number(f.retencion_iva_pct ?? 0),
          Number(f.retencion_ir_pct ?? 0),
        );

      for (const credit of credits) {
        const creditMs = new Date(credit.fecha + "T00:00:00").getTime();

        // 1. Filtrar por monto exacto (±1.5¢)
        const porMonto = candidatas.filter(
          (f) => !usadas.has(f.id) && Math.abs(facturaVN(f) - credit.monto) < 0.015,
        );

        if (porMonto.length === 0) {
          unmatchedRows.push({ credit });
          continue;
        }

        // 2. Ordenar por proximidad de fecha (crédito vs. fecha de factura)
        const calcDias = (f: FacturaEmitida) =>
          Math.abs(creditMs - new Date(f.fecha + "T00:00:00").getTime()) / 86_400_000;

        porMonto.sort((a, b) => calcDias(a) - calcDias(b));
        const best = porMonto[0];
        const vn = facturaVN(best);
        const cobrado = cobrosMap.get(best.id) ?? 0;
        const yaCobrada = vn - cobrado <= 0.005;
        const diasDif = Math.round(calcDias(best));

        usadas.add(best.id);
        matchRows.push({
          credit,
          factura: best,
          valorNeto: vn,
          // No pre-seleccionar si ya está cobrada
          selected: !yaCobrada,
          yaCobrada,
          diasDif,
        });
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
    const autoSelected = matches.filter((m) => m.selected && !m.yaCobrada);
    const manualEntries = Object.entries(manual).filter(([, id]) => id);

    if (autoSelected.length === 0 && manualEntries.length === 0) {
      toast.error("No hay cobros seleccionados.");
      return;
    }

    const autoPayloads: CobroInsert[] = autoSelected.map((m) => ({
      factura_id: m.factura.id,
      empresa_id: empresaId,
      fecha_cobro: m.credit.fecha,
      monto: m.credit.monto,
      observacion: m.credit.descripcion || "Conciliación bancaria ProCredit",
    }));

    const manualPayloads: CobroInsert[] = manualEntries.map(([idxStr, facturaId]) => {
      const credit = unmatched[Number(idxStr)].credit;
      return {
        factura_id: facturaId,
        empresa_id: empresaId,
        fecha_cobro: credit.fecha,
        monto: credit.monto,
        referencia: credit.descripcion || "Conciliación bancaria ProCredit",
        };
    });

    const total = autoSelected.length + manualEntries.length;
    try {
      await crearLote.mutateAsync([...autoPayloads, ...manualPayloads]);
      toast.success(`${total} cobro${total !== 1 ? "s" : ""} registrado${total !== 1 ? "s" : ""} correctamente.`);
      handleClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => {
      setMatches([]);
      setUnmatched([]);
      setParsed(false);
      setManual({});
    }, 300);
  }

  const selectedCount = matches.filter((m) => m.selected && !m.yaCobrada).length;
  const manualCount = Object.values(manual).filter(Boolean).length;
  const totalToRegister = selectedCount + manualCount;
  const allSelected = matches.length > 0 && matches.filter((m) => !m.yaCobrada).every((m) => m.selected);

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
                            className={`transition-colors ${m.yaCobrada ? "opacity-60" : "cursor-pointer hover:bg-muted/20"} ${m.selected ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}
                            onClick={() => !m.yaCobrada && toggleSelect(idx)}
                          >
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={m.selected}
                                disabled={m.yaCobrada}
                                onChange={() => toggleSelect(idx)}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded disabled:cursor-not-allowed"
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
                            <td className="px-3 py-2">
                              <span className="font-mono">{m.factura.numero}</span>
                              {m.yaCobrada && (
                                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
                                  Ya registrada
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 max-w-[160px] truncate">
                              {m.factura.razon_social}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {formatCurrency(m.valorNeto)}
                              {m.diasDif > 0 && (
                                <div className="text-[9px] text-muted-foreground/70">
                                  {m.diasDif}d de diferencia
                                </div>
                              )}
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
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                    <Link2Off className="size-4 text-amber-500" />
                    Sin coincidencia ({unmatched.length})
                  </h3>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Asigna manualmente a una factura si corresponde a una cuota o pago parcial.
                  </p>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/30 border-b text-[10px] uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Fecha banco</th>
                          <th className="px-3 py-2 text-left">Descripción</th>
                          <th className="px-3 py-2 text-right">Monto</th>
                          <th className="px-3 py-2 text-left">Asignar a factura</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {unmatched.map((u, idx) => {
                          const asignadaId = manual[idx] ?? "";
                          const asignada = asignadaId
                            ? facturas.find((f) => f.id === asignadaId)
                            : undefined;
                          return (
                            <tr
                              key={idx}
                              className={asignadaId ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}
                            >
                              <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                                {formatDate(u.credit.fecha)}
                              </td>
                              <td className="px-3 py-2 max-w-[180px] truncate text-muted-foreground">
                                {u.credit.descripcion || "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-medium">
                                {formatCurrency(u.credit.monto)}
                                {asignada && (
                                  <div className="text-[9px] text-blue-600 font-normal">
                                    → {formatCurrency(getVN(asignada))} neto
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 min-w-[200px]">
                                <select
                                  value={asignadaId}
                                  onChange={(e) =>
                                    setManual((prev) => ({ ...prev, [idx]: e.target.value }))
                                  }
                                  className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                  <option value="">— Seleccionar —</option>
                                  {facturasParaSelector.map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.numero} · {f.razon_social.slice(0, 22)} · {formatCurrency(getVN(f))}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
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
          {parsed && totalToRegister > 0 && (
            <Button
              onClick={handleConfirm}
              disabled={crearLote.isPending}
            >
              {crearLote.isPending
                ? "Registrando..."
                : `Registrar ${totalToRegister} cobro${totalToRegister !== 1 ? "s" : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
