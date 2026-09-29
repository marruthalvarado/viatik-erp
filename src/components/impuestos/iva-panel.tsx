import { useState } from "react";
import { ChevronDown, ChevronUp, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/utils/formatters";
import { toast } from "@/components/common/toast";
import { periodoIva } from "@/services/impuestos";
import type { TipoContribuyente } from "@/services/impuestos";
import {
  useCalcularIva,
  useSaveDeclaracion,
} from "@/hooks/entities/use-impuestos";

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

interface Props {
  empresaId: string;
  anio: number;
  tipo: TipoContribuyente;
}

export function IvaPanel({ empresaId, anio, tipo }: Props) {
  const periodo = periodoIva(tipo);
  const [mes, setMes] = useState<number | undefined>(
    periodo === "mensual" ? new Date().getMonth() + 1 : undefined,
  );
  const [semestre, setSemestre] = useState<number | undefined>(
    periodo === "semestral" ? (new Date().getMonth() < 6 ? 1 : 2) : undefined,
  );
  const [showVentas, setShowVentas] = useState(false);
  const [showCompras, setShowCompras] = useState(false);

  const { data, isLoading, error } = useCalcularIva(empresaId, anio, mes, semestre);
  const save = useSaveDeclaracion();

  async function handleGuardar() {
    if (!data) return;
    try {
      await save.mutateAsync({
        empresa_id: empresaId,
        tipo: periodo === "mensual" ? "iva_mensual" : "iva_semestral",
        anio,
        periodo: mes ?? semestre ?? null,
        iva_ventas: data.iva_ventas,
        retenciones_iva_recibidas: data.retenciones_iva_recibidas,
        credito_tributario_compras: data.credito_tributario_compras,
        iva_a_pagar: data.iva_a_pagar,
        ingresos_gravables: 0,
        gastos_deducibles: 0,
        utilidad_gravable: 0,
        ir_causado: 0,
        retenciones_ir_recibidas: 0,
        anticipos_pagados: 0,
        ir_a_pagar: 0,
        estado: "borrador",
        fecha_presentacion: null,
        observacion: null,
      });
      toast.success("Declaración guardada en el historial");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const periodoLabel =
    periodo === "mensual"
      ? `${MESES[(mes ?? 1) - 1]} ${anio}`
      : `${semestre}° semestre ${anio}`;

  return (
    <div className="space-y-4">
      {/* Selector período */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground">Período:</span>
        {periodo === "mensual" ? (
          <div className="flex flex-wrap gap-1">
            {MESES.map((m, i) => (
              <button
                key={i}
                onClick={() => setMes(i + 1)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors
                  ${mes === i + 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
              >
                {m.slice(0, 3)}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            {[1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSemestre(s)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors
                  ${semestre === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
              >
                {s}° semestre
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground py-4 text-center">Calculando…</div>
      )}
      {error && (
        <div className="text-sm text-destructive py-4 text-center">{(error as Error).message}</div>
      )}

      {data && (
        <>
          {/* KPI cards */}
          <div className={`grid gap-3 ${data.credito_tributario_anterior > 0 ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-4"}`}>
            <IvaKpi
              label="IVA Ventas (cobrado)"
              value={data.iva_ventas}
              sub={`${data.num_facturas} facturas`}
              tone="neutral"
            />
            <IvaKpi
              label="Retenciones IVA recibidas"
              value={data.retenciones_iva_recibidas}
              sub="lo que clientes retuvieron"
              tone="blue"
            />
            <IvaKpi
              label="Crédito tributario (compras)"
              value={data.credito_tributario_compras}
              sub={`${data.num_compras} gastos deducibles`}
              tone="green"
            />
            {data.credito_tributario_anterior > 0 && (
              <IvaKpi
                label="Crédito mes anterior"
                value={data.credito_tributario_anterior}
                sub="saldo a favor arrastrado"
                tone="green"
              />
            )}
            <IvaKpi
              label="IVA A PAGAR"
              value={data.iva_a_pagar}
              sub={periodoLabel}
              tone={data.iva_a_pagar > 0 ? "red" : "green"}
              highlight
            />
          </div>

          {/* Fórmula visual */}
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{formatCurrency(data.iva_ventas)}</span>
            {" (IVA ventas) − "}
            <span className="font-medium text-foreground">{formatCurrency(data.retenciones_iva_recibidas)}</span>
            {" (retenciones) − "}
            <span className="font-medium text-foreground">{formatCurrency(data.credito_tributario_compras)}</span>
            {" (crédito compras)"}
            {data.credito_tributario_anterior > 0 && (
              <>
                {" − "}
                <span className="font-medium text-emerald-600">{formatCurrency(data.credito_tributario_anterior)}</span>
                {" (crédito anterior)"}
              </>
            )}
            {" = "}
            <span className={`font-bold ${data.iva_a_pagar > 0 ? "text-destructive" : "text-emerald-600"}`}>
              {formatCurrency(data.iva_a_pagar)}
            </span>
          </div>

          {/* Detalle ventas */}
          {data.detalle_ventas.length > 0 && (
            <div className="rounded-lg border">
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/30 transition-colors"
                onClick={() => setShowVentas(!showVentas)}
              >
                <span>Detalle ventas ({data.detalle_ventas.length})</span>
                {showVentas ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              {showVentas && (
                <div className="overflow-x-auto border-t">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-3 py-2 text-left">Factura</th>
                        <th className="px-3 py-2 text-left">Cliente</th>
                        <th className="px-3 py-2 text-left">Fecha</th>
                        <th className="px-3 py-2 text-right">Subtotal</th>
                        <th className="px-3 py-2 text-right">IVA</th>
                        <th className="px-3 py-2 text-right">Ret. IVA %</th>
                        <th className="px-3 py-2 text-right">Ret. IVA $</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.detalle_ventas.map((v, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-3 py-1.5 font-mono">{v.numero}</td>
                          <td className="px-3 py-1.5 max-w-[160px] truncate">{v.razon_social}</td>
                          <td className="px-3 py-1.5">{v.fecha}</td>
                          <td className="px-3 py-1.5 text-right">{formatCurrency(v.subtotal)}</td>
                          <td className="px-3 py-1.5 text-right">{formatCurrency(v.iva)}</td>
                          <td className="px-3 py-1.5 text-right">{v.ret_iva_pct}%</td>
                          <td className="px-3 py-1.5 text-right text-amber-600">{formatCurrency(v.ret_iva_monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Detalle compras */}
          {data.detalle_compras.length > 0 && (
            <div className="rounded-lg border">
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/30 transition-colors"
                onClick={() => setShowCompras(!showCompras)}
              >
                <span>Detalle compras / gastos deducibles ({data.detalle_compras.length})</span>
                {showCompras ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              {showCompras && (
                <div className="overflow-x-auto border-t">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-3 py-2 text-left">Descripción</th>
                        <th className="px-3 py-2 text-left">RUC Emisor</th>
                        <th className="px-3 py-2 text-left">Fecha</th>
                        <th className="px-3 py-2 text-right">Subtotal</th>
                        <th className="px-3 py-2 text-right">IVA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.detalle_compras.map((c, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-3 py-1.5 max-w-[200px] truncate">{c.descripcion}</td>
                          <td className="px-3 py-1.5 font-mono text-muted-foreground">{c.ruc_emisor ?? "—"}</td>
                          <td className="px-3 py-1.5">{c.fecha}</td>
                          <td className="px-3 py-1.5 text-right">{formatCurrency(c.subtotal)}</td>
                          <td className="px-3 py-1.5 text-right text-emerald-600">{formatCurrency(c.iva)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Guardar */}
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={handleGuardar} disabled={save.isPending}>
              <Save className="size-3.5 mr-1.5" />
              Guardar en historial
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Mini KPI ─────────────────────────────────────────────────────────────────

interface IvaKpiProps {
  label: string;
  value: number;
  sub: string;
  tone: "neutral" | "blue" | "green" | "red";
  highlight?: boolean;
}

function IvaKpi({ label, value, sub, tone, highlight }: IvaKpiProps) {
  const valueClass = {
    neutral: "text-foreground",
    blue: "text-blue-600",
    green: "text-emerald-600",
    red: "text-destructive",
  }[tone];

  return (
    <div className={`rounded-lg border p-3 ${highlight ? "bg-muted/30" : ""}`}>
      <p className="text-xs text-muted-foreground mb-1 leading-tight">{label}</p>
      <p className={`text-lg font-bold ${valueClass}`}>{formatCurrency(value)}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}
