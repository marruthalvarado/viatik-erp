import { useState } from "react";
import { Loader2, X, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/common/toast";
import { formatCurrency, formatDate } from "@/utils/formatters";
import {
  useCobros,
  useCrearCobro,
  useEliminarCobro,
} from "@/hooks/entities/use-cobros";
import type { CobroInsert } from "@/types/entities";
import { calcEstadoCobro, BADGE_COBRO } from "./factura-types";

export interface CobroPanelProps {
  facturaId: string;
  total: number;
  subtotal: number;
  iva: number;
  retencionIvaPct: number;
  retencionIrPct: number;
  empresaId: string;
  numero: string;
  onRetencionesSave: (ivaPct: number, irPct: number) => Promise<void>;
}

export function CobroPanel({
  facturaId,
  total,
  subtotal,
  iva,
  retencionIvaPct,
  retencionIrPct,
  empresaId,
  numero,
  onRetencionesSave,
}: CobroPanelProps) {
  const cobros = useCobros(facturaId);
  const crear = useCrearCobro(facturaId);
  const eliminar = useEliminarCobro(facturaId);

  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  const [monto, setMonto] = useState("");
  const [observacion, setObservacion] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Retenciones editables dentro del panel
  const [retIvaPct, setRetIvaPct] = useState(retencionIvaPct);
  const [retIrPct, setRetIrPct] = useState(retencionIrPct);
  const [savingRet, setSavingRet] = useState(false);
  const retChanged = retIvaPct !== retencionIvaPct || retIrPct !== retencionIrPct;

  const listaCobros = cobros.data ?? [];
  const montoCobrado = listaCobros.reduce((s, c) => s + Number(c.monto), 0);

  const retIvaMontoAct = Math.round(iva * retIvaPct) / 100;
  const retIrMontoAct = Math.round(subtotal * retIrPct) / 100;
  const valorNeto = Math.round((total - retIvaMontoAct - retIrMontoAct) * 100) / 100;
  const saldo = Math.max(0, valorNeto - montoCobrado);
  const estado = calcEstadoCobro(valorNeto, montoCobrado);

  async function handleSaveRetenciones() {
    setSavingRet(true);
    try {
      await onRetencionesSave(retIvaPct, retIrPct);
      toast.success("Retenciones actualizadas");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingRet(false);
    }
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const montoNum = parseFloat(monto);
    if (!fecha) { setFormError("La fecha es requerida."); return; }
    if (isNaN(montoNum) || montoNum <= 0) { setFormError("El monto debe ser mayor a 0."); return; }
    if (montoNum > saldo + 0.001) {
      setFormError(`El monto no puede superar el saldo (${formatCurrency(saldo)}).`);
      return;
    }
    try {
      const payload: CobroInsert = {
        empresa_id: empresaId,
        factura_id: facturaId,
        fecha_cobro: fecha,
        monto: montoNum,
        observacion: observacion.trim() || null,
      };
      await crear.mutateAsync(payload);
      setMonto("");
      setObservacion("");
      toast.success("Cobro registrado");
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function handleEliminar(id: string) {
    if (!confirm("¿Eliminar este cobro?")) return;
    try {
      await eliminar.mutateAsync(id);
      toast.success("Cobro eliminado");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {/* Saldo header */}
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs uppercase text-muted-foreground tracking-wide">Factura</p>
          <p className="font-mono text-sm font-medium">{numero}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground tracking-wide">Total</p>
          <p className="tabular-nums font-semibold">{formatCurrency(total)}</p>
        </div>
        {(retIvaPct > 0 || retIrPct > 0) && (
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Valor a cobrar</p>
            <p className="tabular-nums font-semibold text-blue-700">{formatCurrency(valorNeto)}</p>
          </div>
        )}
        <div>
          <p className="text-xs uppercase text-muted-foreground tracking-wide">Cobrado</p>
          <p className="tabular-nums font-semibold text-emerald-700">
            {formatCurrency(montoCobrado)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground tracking-wide">Saldo pendiente</p>
          <p
            className={`tabular-nums text-xl font-bold ${
              estado === "cobrado" ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {formatCurrency(saldo)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${BADGE_COBRO[estado]}`}
        >
          {estado}
        </span>
      </div>

      {/* Retenciones inline */}
      <div className="rounded-lg border border-blue-100 bg-blue-50/30 px-4 py-3">
        <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
          <Percent className="size-3" />
          Retenciones fiscales
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Ret. IVA (% del IVA)
            </label>
            <div className="relative w-28">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={retIvaPct}
                onChange={(e) => setRetIvaPct(Number(e.target.value))}
                className="h-8 w-full rounded-md border bg-background px-2 pr-6 text-sm tabular-nums"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                %
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Ret. IR (% del subtotal)
            </label>
            <div className="relative w-28">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={retIrPct}
                onChange={(e) => setRetIrPct(Number(e.target.value))}
                className="h-8 w-full rounded-md border bg-background px-2 pr-6 text-sm tabular-nums"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                %
              </span>
            </div>
          </div>
          {(retIvaPct > 0 || retIrPct > 0) && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              {retIvaPct > 0 && (
                <p>
                  Ret. IVA:{" "}
                  <span className="text-red-500 font-medium">
                    - {formatCurrency(retIvaMontoAct)}
                  </span>
                </p>
              )}
              {retIrPct > 0 && (
                <p>
                  Ret. IR:{" "}
                  <span className="text-red-500 font-medium">
                    - {formatCurrency(retIrMontoAct)}
                  </span>
                </p>
              )}
              <p className="font-semibold text-blue-700 border-t pt-0.5 mt-0.5">
                Neto: {formatCurrency(valorNeto)}
              </p>
            </div>
          )}
          {retChanged && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={handleSaveRetenciones}
              disabled={savingRet}
            >
              {savingRet && <Loader2 className="size-3 mr-1.5 animate-spin" />}
              Guardar
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lista de cobros */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Pagos recibidos
          </p>
          {cobros.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Cargando…
            </div>
          ) : listaCobros.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sin cobros registrados.</p>
          ) : (
            <div className="space-y-1">
              {listaCobros.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border bg-background px-3 py-2"
                >
                  <div className="flex items-center gap-4">
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {formatDate(c.fecha_cobro)}
                    </span>
                    <span className="tabular-nums font-semibold text-emerald-700">
                      {formatCurrency(Number(c.monto))}
                    </span>
                    {c.observacion && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {c.observacion}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-destructive hover:text-destructive"
                    onClick={() => handleEliminar(c.id)}
                    disabled={eliminar.isPending}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formulario nuevo cobro */}
        {estado !== "cobrado" && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Registrar cobro
            </p>
            <form onSubmit={handleCrear} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Fecha</label>
                  <Input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">
                    Monto{" "}
                    <span className="text-muted-foreground font-normal">
                      (máx {formatCurrency(saldo)})
                    </span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  Observación{" "}
                  <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <Input
                  placeholder="Transferencia, cheque, cuota #1…"
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              {formError && <p className="text-xs text-destructive">{formError}</p>}
              <Button type="submit" size="sm" disabled={crear.isPending}>
                {crear.isPending && <Loader2 className="size-3 mr-1.5 animate-spin" />}
                Registrar cobro
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
