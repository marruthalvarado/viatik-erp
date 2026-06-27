/**
 * Reporte Presupuesto vs Ejecutado.
 * Consume: useRptEjecucionPresupuestaria (FASE 8A)
 * Muestra: presupuesto, ejecutado, disponible, %, variacion + grafico comparativo.
 */
import { Wallet } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { MetricCard } from "@/components/common/metric-card";
import { formatCurrency } from "@/utils/formatters";
import type { EjecucionPresupuestariaRow } from "@/types/reportes";

interface ReportePresupuestoProps {
  data: EjecucionPresupuestariaRow[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

function tick(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
}

function pctTone(pct: number | null): string {
  if (pct === null) return "text-muted-foreground";
  if (pct > 1) return "text-destructive font-semibold";
  if (pct > 0.9) return "text-warning-foreground font-medium";
  return "text-success font-medium";
}

export function ReportePresupuesto({ data, loading, error, onRetry }: ReportePresupuestoProps) {
  if (loading) return <LoadingState label="Cargando presupuesto..." />;

  if (error) {
    return (
      <EmptyState
        title="Error al cargar presupuesto"
        description={error.message}
        action={
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-label="Reintentar carga de presupuesto"
          >
            Reintentar
          </button>
        }
      />
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Sin datos de presupuesto"
        description="No hay presupuestos registrados para el periodo."
      />
    );
  }

  const totalPresupuestado = data.reduce((s, r) => s + (r.valor_presupuestado ?? 0), 0);
  const totalEjecutado = data.reduce((s, r) => s + (r.ejecutado ?? 0), 0);
  const totalDisponible = data.reduce((s, r) => s + (r.disponible ?? 0), 0);
  const pctGlobal = totalPresupuestado > 0 ? totalEjecutado / totalPresupuestado : null;

  // Agrupar por proyecto para el grafico
  const porProyecto = Object.entries(
    data.reduce<Record<string, { presupuestado: number; ejecutado: number }>>((acc, r) => {
      const k = r.proyecto_nombre ?? "Sin proyecto";
      if (!acc[k]) acc[k] = { presupuestado: 0, ejecutado: 0 };
      acc[k].presupuestado += r.valor_presupuestado ?? 0;
      acc[k].ejecutado += r.ejecutado ?? 0;
      return acc;
    }, {}),
  )
    .map(([proyecto, vals]) => ({ proyecto, ...vals }))
    .sort((a, b) => b.ejecutado - a.ejecutado)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard
          label="Presupuestado"
          value={formatCurrency(totalPresupuestado)}
          icon={Wallet}
        />
        <MetricCard label="Ejecutado" value={formatCurrency(totalEjecutado)} />
        <MetricCard label="Disponible" value={formatCurrency(totalDisponible)} />
        <MetricCard
          label="Ejecucion global"
          value={pctGlobal !== null ? `${(pctGlobal * 100).toFixed(1)}%` : "—"}
          hint={pctGlobal !== null && pctGlobal > 1 ? "Sobre presupuesto" : undefined}
          trend={
            pctGlobal !== null
              ? {
                  direction: pctGlobal > 0.5 ? "up" : "down",
                  value: `${(pctGlobal * 100).toFixed(0)}%`,
                }
              : undefined
          }
        />
      </div>

      {/* Grafico comparativo */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">
          Presupuesto vs Ejecutado por proyecto
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={porProyecto}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tickFormatter={tick} tick={{ fontSize: 10 }} width={56} />
            <YAxis type="category" dataKey="proyecto" tick={{ fontSize: 9 }} width={100} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend iconType="rect" iconSize={10} />
            <Bar
              dataKey="presupuestado"
              name="Presupuestado"
              fill="hsl(var(--chart-2))"
              radius={[0, 3, 3, 0]}
            />
            <Bar
              dataKey="ejecutado"
              name="Ejecutado"
              fill="hsl(var(--chart-1))"
              radius={[0, 3, 3, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Tabla de detalle */}
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Presupuesto
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Proyecto
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Categoria
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Presupuestado
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Ejecutado
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Disponible
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">%</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Variacion
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((r) => {
                const variacion = (r.ejecutado ?? 0) - (r.valor_presupuestado ?? 0);
                return (
                  <tr key={r.presupuesto_id + (r.detalle_id ?? "")} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{r.presupuesto_nombre ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.proyecto_nombre ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.categoria_nombre ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(r.valor_presupuestado)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(r.ejecutado)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(r.disponible)}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${pctTone(r.pct_ejecucion)}`}>
                      {r.pct_ejecucion !== null ? `${(r.pct_ejecucion * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${variacion > 0 ? "text-destructive" : "text-success"}`}
                    >
                      {formatCurrency(variacion)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          {data.length} lineas de presupuesto
        </div>
      </div>
    </div>
  );
}
