/**
 * Tab P&L mensual — Reportes Financieros
 * Muestra ingresos, costos empresa, costos viáticos, margen y % margen por mes.
 */
import { TrendingUp, TrendingDown } from "lucide-react";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/utils/formatters";
import type { EvolucionFinanciera } from "@/services/dashboard";

interface ReportePLProps {
  data: EvolucionFinanciera[];
  loading: boolean;
  anio: number;
}

export function ReportePL({ data, loading, anio }: ReportePLProps) {
  if (loading) return <LoadingState label="Cargando P&L..." />;

  const hasData = data.some((d) => d.ingresos > 0 || d.costos_empresa > 0 || d.costos_viaticos > 0);

  if (!hasData) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Sin datos"
        description={`No hay ingresos ni costos registrados en ${anio}.`}
      />
    );
  }

  // Totales del año
  const totalIngresos = data.reduce((s, d) => s + d.ingresos, 0);
  const totalCostosEmpresa = data.reduce((s, d) => s + d.costos_empresa, 0);
  const totalCostosViaticos = data.reduce((s, d) => s + d.costos_viaticos, 0);
  const totalCostos = totalCostosEmpresa + totalCostosViaticos;
  const totalMargen = totalIngresos - totalCostos;
  const totalMargenPct = totalIngresos > 0 ? (totalMargen / totalIngresos) * 100 : null;

  const v = (n: number) => formatCurrency(n);
  const pct = (n: number | null) =>
    n !== null ? `${n >= 0 ? "+" : ""}${n.toFixed(1)}%` : "—";

  return (
    <div className="space-y-6">
      {/* Resumen anual */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Ingresos" value={v(totalIngresos)} positive />
        <KpiCard label="Costos empresa" value={v(totalCostosEmpresa)} positive={false} sub="Gastos directos" />
        <KpiCard label="Costos viáticos" value={v(totalCostosViaticos)} positive={false} sub="Rendiciones" />
        <KpiCard
          label="Margen bruto"
          value={v(Math.abs(totalMargen))}
          positive={totalMargen >= 0}
          sub={pct(totalMargenPct)}
        />
      </div>

      {/* Tabla mensual */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Mes</th>
              <th className="px-4 py-3 text-right font-medium">Ingresos</th>
              <th className="px-4 py-3 text-right font-medium">Costos empresa</th>
              <th className="px-4 py-3 text-right font-medium">Viáticos</th>
              <th className="px-4 py-3 text-right font-medium">Total costos</th>
              <th className="px-4 py-3 text-right font-medium">Margen</th>
              <th className="px-4 py-3 text-right font-medium">% Margen</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const costos = row.costos_empresa + row.costos_viaticos;
              const margen = row.ingresos - costos;
              const margenPct = row.ingresos > 0 ? (margen / row.ingresos) * 100 : null;
              const isEmpty = row.ingresos === 0 && costos === 0;
              return (
                <tr key={row.mes} className={`border-b last:border-0 ${isEmpty ? "text-muted-foreground/50" : ""}`}>
                  <td className="px-4 py-2.5 font-medium">{row.label}</td>
                  <td className="px-4 py-2.5 text-right">{isEmpty ? "—" : v(row.ingresos)}</td>
                  <td className="px-4 py-2.5 text-right">{isEmpty ? "—" : v(row.costos_empresa)}</td>
                  <td className="px-4 py-2.5 text-right">{isEmpty ? "—" : v(row.costos_viaticos)}</td>
                  <td className="px-4 py-2.5 text-right">{isEmpty ? "—" : v(costos)}</td>
                  <td className={`px-4 py-2.5 text-right font-medium ${isEmpty ? "" : margen >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {isEmpty ? "—" : (margen >= 0 ? "" : "-") + v(Math.abs(margen))}
                  </td>
                  <td className={`px-4 py-2.5 text-right ${isEmpty ? "" : margen >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {isEmpty ? "—" : pct(margenPct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/30 font-semibold">
              <td className="px-4 py-3">Total {anio}</td>
              <td className="px-4 py-3 text-right">{v(totalIngresos)}</td>
              <td className="px-4 py-3 text-right">{v(totalCostosEmpresa)}</td>
              <td className="px-4 py-3 text-right">{v(totalCostosViaticos)}</td>
              <td className="px-4 py-3 text-right">{v(totalCostos)}</td>
              <td className={`px-4 py-3 text-right ${totalMargen >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {(totalMargen >= 0 ? "" : "-") + v(Math.abs(totalMargen))}
              </td>
              <td className={`px-4 py-3 text-right ${totalMargen >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {pct(totalMargenPct)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string;
  positive: boolean;
  sub?: string;
}

function KpiCard({ label, value, positive, sub }: KpiCardProps) {
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-lg border p-4 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={`size-4 ${positive ? "text-emerald-500" : "text-red-400"}`} />
      </div>
      <p className="text-xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
