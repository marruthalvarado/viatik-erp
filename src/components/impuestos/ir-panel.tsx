import { useState } from "react";
import { Save, ChevronDown, ChevronRight, CalendarDays, FileText, Info, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/utils/formatters";
import { toast } from "@/components/common/toast";
import type { TipoContribuyente } from "@/services/impuestos";
import {
  useCalcularIr,
  useSaveDeclaracion,
  useAnticiposIr,
  useUpsertAnticipoIr,
} from "@/hooks/entities/use-impuestos";
import { TopesPartesRelacionadas } from "./topes-partes-relacionadas";

const TABLA_IR = [
  { desde: 0,      hasta: 11722,    base: 0,     excedente: 0  },
  { desde: 11722,  hasta: 14931,    base: 0,     excedente: 5  },
  { desde: 14931,  hasta: 19385,    base: 160,   excedente: 10 },
  { desde: 19385,  hasta: 25463,    base: 606,   excedente: 12 },
  { desde: 25463,  hasta: 33603,    base: 1336,  excedente: 15 },
  { desde: 33603,  hasta: 44721,    base: 2557,  excedente: 20 },
  { desde: 44721,  hasta: 59960,    base: 4781,  excedente: 25 },
  { desde: 59960,  hasta: 80000,    base: 8591,  excedente: 30 },
  { desde: 80000,  hasta: Infinity, base: 14603, excedente: 35 },
];

const MESES = [
  "Ene","Feb","Mar","Abr","May","Jun",
  "Jul","Ago","Sep","Oct","Nov","Dic",
];

interface Props {
  empresaId: string;
  anio: number;
  tipo: TipoContribuyente;
}

export function IrPanel({ empresaId, anio, tipo }: Props) {
  const { data, isLoading, error } = useCalcularIr(empresaId, anio);
  const { data: anticiposData } = useAnticiposIr(empresaId, anio);
  const save = useSaveDeclaracion();
  const upsert = useUpsertAnticipoIr();

  const [retMesOpen, setRetMesOpen] = useState(false);

  // Estado local editable para cuotas
  const cuota1 = anticiposData?.find((a) => a.cuota === 1);
  const cuota2 = anticiposData?.find((a) => a.cuota === 2);

  const [monto1, setMonto1] = useState("");
  const [fecha1, setFecha1] = useState("");
  const [comp1, setComp1] = useState("");
  const [monto2, setMonto2] = useState("");
  const [fecha2, setFecha2] = useState("");
  const [comp2, setComp2] = useState("");

  // Sincronizar estado local cuando llegan datos del servidor
  const [synced1, setSynced1] = useState(false);
  const [synced2, setSynced2] = useState(false);
  if (cuota1 && !synced1) {
    setMonto1(String(cuota1.monto ?? ""));
    setFecha1(cuota1.fecha_pago ?? "");
    setComp1(cuota1.comprobante ?? "");
    setSynced1(true);
  }
  if (cuota2 && !synced2) {
    setMonto2(String(cuota2.monto ?? ""));
    setFecha2(cuota2.fecha_pago ?? "");
    setComp2(cuota2.comprobante ?? "");
    setSynced2(true);
  }

  async function handleSaveCuota(cuota: 1 | 2) {
    const monto = cuota === 1 ? parseFloat(monto1 || "0") : parseFloat(monto2 || "0");
    const fecha = cuota === 1 ? fecha1 || null : fecha2 || null;
    const comp  = cuota === 1 ? comp1 || null  : comp2 || null;
    try {
      await upsert.mutateAsync({ empresaId, anio, cuota, monto, fechaPago: fecha, comprobante: comp });
      toast.success(`Cuota ${cuota} guardada`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

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
        anticipos_pagados: data.anticipos_pagados,
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

  const cuota1Monto = data.anticipo_siguiente / 2;
  const cuota2Monto = data.anticipo_siguiente - cuota1Monto;

  // Saldo a liquidar en abril = IR a pagar después de retenciones y anticipos
  const saldoAbril = data.ir_a_pagar;
  const anticiposTotales = (parseFloat(monto1 || "0") + parseFloat(monto2 || "0"));

  return (
    <div className="space-y-4">

      {/* Banner: fecha de declaración */}
      <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3">
        <Info className="size-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <span className="font-semibold">Declaración anual (Form. 101)</span>
          {" — Este impuesto se declara y paga en "}
          <span className="font-semibold">abril {anio + 1}</span>
          {". Los anticipos de julio y septiembre "}
          <span className="font-semibold">{anio}</span>
          {" se descuentan del IR causado al presentar la declaración."}
        </div>
      </div>

      {/* Timeline: flujo de pagos */}
      <div className="rounded-lg border px-4 py-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Flujo de pagos IR {anio}
        </p>
        <TimelineRow
          mes={`Julio ${anio}`}
          concepto="Anticipo cuota 1 (Form. 115)"
          monto={parseFloat(monto1 || "0")}
          color="amber"
          pagado={!!cuota1?.monto}
        />
        <TimelineRow
          mes={`Septiembre ${anio}`}
          concepto="Anticipo cuota 2 (Form. 115)"
          monto={parseFloat(monto2 || "0")}
          color="amber"
          pagado={!!cuota2?.monto}
        />
        <div className="border-t pt-2 mt-1">
          <TimelineRow
            mes={`Abril ${anio + 1}`}
            concepto="Saldo IR — declaración anual (Form. 101)"
            monto={saldoAbril}
            color={saldoAbril > 0 ? "red" : "green"}
            pagado={false}
            highlight
          />
        </div>
        {anticiposTotales > 0 && saldoAbril <= 0 && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5">
            <AlertCircle className="size-3.5 shrink-0" />
            Los anticipos pagados cubren el IR causado. No habrá saldo a pagar en abril {anio + 1}.
          </div>
        )}
      </div>

      {/* KPIs base */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <IrKpi label="Ingresos gravables" value={data.ingresos_gravables} tone="neutral" />
        <IrKpi label="Gastos deducibles" value={data.gastos_deducibles} tone="green" />
        <IrKpi label="Utilidad gravable" value={data.utilidad_gravable} tone="neutral" />
        <IrKpi
          label={tipo === "sociedad" ? "IR causado (25%)" : `IR causado (tasa efectiva ${tasaEfectiva}%)`}
          value={data.ir_causado}
          tone="neutral"
        />
        <IrKpi
          label="Retenciones IR recibidas"
          value={data.retenciones_ir_recibidas}
          tone="blue"
          sub="lo que clientes retuvieron"
        />
        <IrKpi
          label="Anticipos pagados"
          value={data.anticipos_pagados}
          tone="blue"
          sub="cuota julio + septiembre"
        />
        <IrKpi
          label={`IR A PAGAR — abril ${anio + 1}`}
          value={data.ir_a_pagar}
          tone={data.ir_a_pagar > 0 ? "red" : "green"}
          sub={data.ir_a_pagar <= 0 ? "Saldo a favor / cubierto" : "Saldo declaración anual"}
          highlight
        />
      </div>

      {/* Fórmula IR */}
      <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{formatCurrency(data.ir_causado)}</span>
        {" (IR causado) − "}
        <span className="font-medium text-foreground">{formatCurrency(data.retenciones_ir_recibidas)}</span>
        {" (retenciones) − "}
        <span className="font-medium text-foreground">{formatCurrency(data.anticipos_pagados)}</span>
        {" (anticipos) = "}
        <span className={`font-bold ${data.ir_a_pagar > 0 ? "text-destructive" : "text-emerald-600"}`}>
          {formatCurrency(data.ir_a_pagar)}
        </span>
        {" a pagar en declaración anual"}
      </div>

      {/* Retenciones por mes (colapsable) */}
      {data.retenciones_por_mes.length > 0 && (
        <div className="rounded-lg border">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/20 transition-colors"
            onClick={() => setRetMesOpen((v) => !v)}
          >
            <span>Retenciones IR por mes ({anio})</span>
            {retMesOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          {retMesOpen && (
            <div className="border-t overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 text-left">Mes</th>
                    <th className="px-3 py-2 text-right">Retención</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.retenciones_por_mes.map((r) => (
                    <tr key={r.mes} className="hover:bg-muted/20">
                      <td className="px-3 py-1.5">{MESES[r.mes - 1]}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(r.monto)}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/20 font-semibold">
                    <td className="px-3 py-1.5">Total</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {formatCurrency(data.retenciones_ir_recibidas)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Anticipos pagados este año */}
      <div className="rounded-lg border">
        <div className="px-4 py-2.5 text-sm font-medium bg-muted/30 border-b rounded-t-lg">
          Anticipos IR {anio} pagados al SRI
        </div>
        <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x">
          <AnticipoForm
            label={`Cuota 1 — julio ${anio}`}
            monto={monto1}
            fecha={fecha1}
            comprobante={comp1}
            onMonto={setMonto1}
            onFecha={setFecha1}
            onComprobante={setComp1}
            onSave={() => handleSaveCuota(1)}
            saving={upsert.isPending}
          />
          <AnticipoForm
            label={`Cuota 2 — septiembre ${anio}`}
            monto={monto2}
            fecha={fecha2}
            comprobante={comp2}
            onMonto={setMonto2}
            onFecha={setFecha2}
            onComprobante={setComp2}
            onSave={() => handleSaveCuota(2)}
            saving={upsert.isPending}
          />
        </div>
      </div>

      {/* Anticipo siguiente año */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3">
        <p className="text-sm font-medium text-amber-800">Anticipo IR {anio + 1}</p>
        <p className="text-xl font-bold text-amber-700 mt-1">
          {formatCurrency(data.anticipo_siguiente)}
        </p>
        <p className="text-xs text-amber-600 mt-1 mb-3">
          50% del IR causado {anio}
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-white/60 px-3 py-2">
            <CalendarDays className="size-3.5 text-amber-600 shrink-0" />
            <div>
              <p className="font-medium text-amber-800">Cuota 1 — julio {anio + 1}</p>
              <p className="text-amber-600 font-mono">{formatCurrency(cuota1Monto)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-white/60 px-3 py-2">
            <CalendarDays className="size-3.5 text-amber-600 shrink-0" />
            <div>
              <p className="font-medium text-amber-800">Cuota 2 — septiembre {anio + 1}</p>
              <p className="text-amber-600 font-mono">{formatCurrency(cuota2Monto)}</p>
            </div>
          </div>
        </div>
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

      {/* Topes partes relacionadas */}
      <TopesPartesRelacionadas empresaId={empresaId} anio={anio} />

      {/* Guardar en historial */}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={handleGuardar} disabled={save.isPending}>
          <Save className="size-3.5 mr-1.5" />
          Guardar en historial
        </Button>
      </div>
    </div>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

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

// ─── TimelineRow ──────────────────────────────────────────────────────────────

interface TimelineRowProps {
  mes: string;
  concepto: string;
  monto: number;
  color: "amber" | "red" | "green";
  pagado: boolean;
  highlight?: boolean;
}

function TimelineRow({ mes, concepto, monto, color, pagado, highlight }: TimelineRowProps) {
  const dotClass = {
    amber: "bg-amber-400",
    red: "bg-destructive",
    green: "bg-emerald-500",
  }[color];

  const montoClass = {
    amber: "text-amber-700",
    red: "text-destructive font-bold",
    green: "text-emerald-700 font-bold",
  }[color];

  return (
    <div className={`flex items-center gap-3 text-sm ${highlight ? "pt-1" : ""}`}>
      <div className={`size-2 rounded-full shrink-0 ${dotClass}`} />
      <span className="text-xs text-muted-foreground w-28 shrink-0">{mes}</span>
      <span className="flex-1 text-xs">{concepto}</span>
      {pagado && (
        <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 shrink-0">
          pagado
        </span>
      )}
      <span className={`text-xs font-mono shrink-0 ${montoClass}`}>
        {monto === 0 ? "—" : new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(monto)}
      </span>
    </div>
  );
}

interface AnticipoFormProps {
  label: string;
  monto: string;
  fecha: string;
  comprobante: string;
  onMonto: (v: string) => void;
  onFecha: (v: string) => void;
  onComprobante: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}

function AnticipoForm({
  label, monto, fecha, comprobante,
  onMonto, onFecha, onComprobante,
  onSave, saving,
}: AnticipoFormProps) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="space-y-2">
        <div>
          <Label className="text-xs">Monto ($)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={monto}
            onChange={(e) => onMonto(e.target.value)}
            placeholder="0.00"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Fecha de pago</Label>
          <div className="relative">
            <CalendarDays className="absolute left-2.5 top-2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              value={fecha}
              onChange={(e) => onFecha(e.target.value)}
              className="h-8 text-sm pl-8"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Comprobante SRI</Label>
          <div className="relative">
            <FileText className="absolute left-2.5 top-2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={comprobante}
              onChange={(e) => onComprobante(e.target.value)}
              placeholder="Nro. formulario / declaración"
              className="h-8 text-sm pl-8"
            />
          </div>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={onSave}
        disabled={saving}
      >
        <Save className="size-3.5 mr-1.5" />
        Guardar cuota
      </Button>
    </div>
  );
}
