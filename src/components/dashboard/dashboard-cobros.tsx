/**
 * dashboard-cobros.tsx - Seccion de cuentas por cobrar en el Dashboard.
 * Muestra aging table (0-30 / 31-60 / 61-90 / +90 dias) y top clientes.
 */
import { DollarSign, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import type { ResumenCobros, RangoAging } from "@/services/cobros";

// ─── Props ────────────────────────────────────────────────────────────────────

interface DashboardCobrosProps {
  data: ResumenCobros | undefined;
  loading: boolean;
  onNavigate: () => void;
}

// ─── Aging config ─────────────────────────────────────────────────────────────

const AGING_RANGOS: { rango: RangoAging; label: string; colorBg: string; colorText: string }[] = [
  { rango: "0-30", label: "0 - 30 dias", colorBg: "bg-emerald-50", colorText: "text-emerald-700" },
  { rango: "31-60", label: "31 - 60 dias", colorBg: "bg-amber-50", colorText: "text-amber-700" },
  { rango: "61-90", label: "61 - 90 dias", colorBg: "bg-orange-50", colorText: "text-orange-700" },
  { rango: "+90", label: "Mas de 90 dias", colorBg: "bg-red-50", colorText: "text-red-700" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardCobros({ data, loading, onNavigate }: DashboardCobrosProps) {
  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="h-4 w-40 bg-muted animate-pulse rounded mb-4" />
        <div className="grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const totalPendiente = data?.total_pendiente ?? 0;

  if (!data || totalPendiente === 0) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <SectionHeader />
        <p className="text-sm text-muted-foreground italic mt-3">
          No hay facturas con saldo pendiente.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader />
        <button
          onClick={onNavigate}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          Ver facturas
        </button>
      </div>

      {/* KPI total */}
      <div className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
        <DollarSign className="size-5 text-amber-600 shrink-0" />
        <div>
          <p className="text-xs text-amber-700 font-medium uppercase tracking-wide">
            Total por cobrar
          </p>
          <p className="text-2xl font-bold tabular-nums text-amber-700">
            {formatCurrency(totalPendiente)}
          </p>
        </div>
        {(data.aging["+90"]?.monto ?? 0) > 0 && (
          <div className="ml-auto flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1">
            <AlertCircle className="size-3.5 text-red-600" />
            <span className="text-xs font-semibold text-red-700">
              {formatCurrency(data.aging["+90"].monto)} vencido +90 dias
            </span>
          </div>
        )}
      </div>

      {/* Aging buckets */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {AGING_RANGOS.map(({ rango, label, colorBg, colorText }) => {
          const bucket = data.aging[rango] ?? { count: 0, monto: 0 };
          const pct = totalPendiente > 0 ? (bucket.monto / totalPendiente) * 100 : 0;
          return (
            <div key={rango} className={`rounded-lg border p-3 ${colorBg}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${colorText}`}>
                {label}
              </p>
              <p className={`mt-1 text-lg font-bold tabular-nums ${colorText}`}>
                {formatCurrency(bucket.monto)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {bucket.count} factura{bucket.count !== 1 ? "s" : ""} &middot;{" "}
                {pct.toFixed(0)}%
              </p>
            </div>
          );
        })}
      </div>

      {/* Top clientes */}
      {data.top_clientes.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Clientes con mayor saldo pendiente
          </p>
          <div className="space-y-1.5">
            {data.top_clientes.map((c, i) => {
              const pct = totalPendiente > 0 ? (c.saldo / totalPendiente) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium truncate">{c.razon_social}</span>
                      <span className="text-xs tabular-nums font-semibold text-amber-700 ml-2 shrink-0">
                        {formatCurrency(c.saldo)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader() {
  return (
    <div className="flex items-center gap-2">
      <DollarSign className="size-4 text-amber-600" />
      <h3 className="font-semibold text-base">Cuentas por cobrar</h3>
    </div>
  );
}
