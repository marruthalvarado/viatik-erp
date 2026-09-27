import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/utils/formatters";
import { toast } from "@/components/common/toast";
import type { TipoContribuyente } from "@/services/impuestos";
import {
  useCalcularIr,
  useSaveDeclaracion,
} from "@/hooks/entities/use-impuestos";

const TABLA_IR = [
  { desde: 0,      hasta: 11722,  base: 0,      excedente: 0    },
  { desde: 11722,  hasta: 14931,  base: 0,      excedente: 5    },
  { desde: 14931,  hasta: 19385,  base: 160,    excedente: 10   },
  { desde: 19385,  hasta: 25463,  base: 606,    excedente: 12   },
  { desde: 25463,  hasta: 33603,  base: 1336,   excedente: 15   },
  { desde: 33603,  hasta: 44721,  base: 2557,   excedente: 20   },
  { desde: 44721,  hasta: 59960,  base: 4781,   excedente: 25   },
  { desde: 59960,  hasta: 80000,  base: 8591,   excedente: 30   },
  { desde: 80000,  hasta: Infinity, base: 14603, excedente: 35  },
];

interface Props {
  empresaId: string;
  anio: number;
  tipo: TipoContribuyente;
}

export function IrPanel({ empresaId, anio, tipo }: Props) {
  const { data, isLoading, error } = useCalcularIr(empresaId, anio);
  const save = useSaveDeclaracion();

  async function handleGuardar() {
    if (!data) return;
    try {
      await save.mutateAsync({
        empresa_id: empresaId,
        tipo: "ir_anual",
        anio,
        periodo: null,
        iva_ventas: 0,
        retenciones_iva_recibidas: 0,
        credito_tributario_compras: 0,
        iva_a_pagar: 0,
        ingresos_gravables: data.ingresos_gravables,
        gastos_deducibles: data.gastos_deducibles,
        utilidad_gravable: data.utilidad_gravable,
        ir_causado: data.ir_causado,
        retenciones_ir_recibidas: data.retenciones_ir_recibidas,
        anticipos_pagados: 0,
        ir_a_pagar: data.ir_a_pagar,
        estado: "borrador",
        fecha_presentacion: null,
        observacion: null,
      });
      toast.success("Declaración IR guardada en historial");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4 text-center">Calculando…</div>;
  }
  if (error) {
    return <div className="text-sm text-destructive py-4 text-center">{(error as Error).message}</div>;
  }
  if (!data) return null;

  const tasaEfectiva =
    data.utilidad_gravable > 0
      ? ((data.ir_causado / data.utilidad_gravable) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <IrKpi label="Ingresos gravables" value={data.ingresos_gravables} tone="neutral" />
        <IrKpi label="Gastos deducibles" value={data.gastos_deducibles} tone="green" />
        <IrKpi label="Utilidad gravable" value={data.utilidad_gravable} tone="neutral" />
        <IrKpi
          label={tipo === "sociedad" ? "IR causado (25%)" : `IR causado (tasa efectiva ${tasaEfectiva}%)`}
          value={data.ir_causado}
          tone="neutral"
        />
        <IrKpi label="Retenciones IR recibidas" value={data.retenciones_ir_recibidas} tone="blue" sub="lo que clientes retuvieron" />
        <IrKpi
          label="IR A PAGAR"
          value={data.ir_a_pagar}
          tone={data.ir_a_pagar > 0 ? "red" : "green"}
          highlight
        />
      </div>

      {/* Fórmula */}
      <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{formatCurrency(data.ir_causado)}</span>
        {" (IR causado) − "}
        <span className="font-medium text-foreground">{formatCurrency(data.retenciones_ir_recibidas)}</span>
        {" (retenciones) = "}
        <span className={`font-bold ${data.ir_a_pagar > 0 ? "text-destructive" : "text-emerald-600"}`}>
          {formatCurrency(data.ir_a_pagar)}
        </span>
        {" a pagar en declaración anual"}
      </div>

      {/* Anticipo siguiente año */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3">
        <p className="text-sm font-medium text-amber-800">
          Anticipo IR {anio + 1}
        </p>
        <p className="text-xl font-bold text-amber-700 mt-1">
          {formatCurrency(data.anticipo_siguiente)}
        </p>
        <p className="text-xs text-amber-600 mt-1">
          50% del IR causado {anio} · Cuotas en julio y septiembre {anio + 1}
        </p>
      </div>

      {/* Tabla progresiva (solo PN) */}
      {tipo !== "sociedad" && tipo !== "rise" && (
        <div className="rounded-lg border">
          <div className="px-4 py-2.5 text-sm font-medium bg-muted/30 rounded-t-lg">
            Tabla progresiva IR Ecuador {anio} — Personas Naturales
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-right">Fracción básica</th>
                  <th className="px-3 py-2 text-right">Hasta</th>
                  <th className="px-3 py-2 text-right">Impuesto base</th>
                  <th className="px-3 py-2 text-right">% excedente</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {TABLA_IR.map((t, i) => {
                  const activa =
                    data.utilidad_gravable >= t.desde &&
                    data.utilidad_gravable < (t.hasta === Infinity ? 999999999 : t.hasta);
                  return (
                    <tr key={i} className={activa ? "bg-primary/10 font-semibold" : "hover:bg-muted/20"}>
                      <td className="px-3 py-1.5 text-right">{formatCurrency(t.desde)}</td>
                      <td className="px-3 py-1.5 text-right">
                        {t.hasta === Infinity ? "En adelante" : formatCurrency(t.hasta)}
                      </td>
                      <td className="px-3 py-1.5 text-right">{formatCurrency(t.base)}</td>
                      <td className="px-3 py-1.5 text-right">{t.excedente}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Guardar */}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={handleGuardar} disabled={save.isPending}>
          <Save className="size-3.5 mr-1.5" />
          Guardar en historial
        </Button>
      </div>
    </div>
  );
}

// ─── Mini KPI ─────────────────────────────────────────────────────────────────

interface IrKpiProps {
  label: string;
  value: number;
  tone: "neutral" | "blue" | "green" | "red";
  sub?: string;
  highlight?: boolean;
}

function IrKpi({ label, value, tone, sub, highlight }: IrKpiProps) {
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
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
