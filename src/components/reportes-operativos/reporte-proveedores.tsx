/**
 * Reporte de Proveedores.
 * Consume: useRptTopProveedores (FASE 8A — hook gerencial)
 * Muestra: ranking, total compras, gasto total, frecuencia, categoria principal.
 */
import { Truck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { MetricCard } from "@/components/common/metric-card";
import { formatCurrency } from "@/utils/formatters";
import type { TopProveedorRow } from "@/types/reportes";

interface ReporteProveedoresProps {
  data: TopProveedorRow[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

function tick(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
}

export function ReporteProveedores({ data, loading, error, onRetry }: ReporteProveedoresProps) {
  if (loading) return <LoadingState label="Cargando proveedores..." />;

  if (error) {
    return (
      <EmptyState
        title="Error al cargar proveedores"
        description={error.message}
        action={
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-label="Reintentar carga de proveedores"
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
        icon={Truck}
        title="Sin datos de proveedores"
        description="No hay gastos registrados con proveedores en el periodo seleccionado."
      />
    );
  }

  const totalGasto = data.reduce((s, p) => s + (p.total ?? 0), 0);
  const totalCompras = data.reduce((s, p) => s + (p.n_gastos ?? 0), 0);
  const top = data[0];
  const chartData = data.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total proveedores"
          value={String(data.length)}
          icon={Truck}
          hint="en el periodo"
        />
        <MetricCard
          label="Total compras"
          value={String(totalCompras)}
          hint={`${formatCurrency(totalGasto)} acumulado`}
        />
        <MetricCard
          label="Mayor proveedor"
          value={top?.nombre ?? "—"}
          hint={top ? formatCurrency(top.total) : undefined}
          trend={
            top && totalGasto > 0
              ? {
                  direction: "up",
                  value: `${((top.total / totalGasto) * 100).toFixed(0)}%`,
                }
              : undefined
          }
        />
      </div>

      {/* Grafico horizontal top 10 */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">
          Top {Math.min(chartData.length, 10)} proveedores por gasto
        </h2>
        <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 34)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tickFormatter={tick} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="nombre" tick={{ fontSize: 9 }} width={110} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar
              dataKey="total"
              name="Gasto total"
              fill="hsl(var(--chart-3))"
              radius={[0, 3, 3, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Tabla ranking */}
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">#</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Proveedor
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Pais / Ciudad
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  # Compras
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Gasto total
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  % del total
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Categoria principal
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((p, i) => (
                <tr key={p.proveedor_id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{p.nombre}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {[p.ciudad, p.pais].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.n_gastos}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {totalGasto > 0 ? `${((p.total / totalGasto) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.categoria_principal || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-3 py-2" />
                <td className="px-3 py-2">Total ({data.length} proveedores)</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right tabular-nums">{totalCompras}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totalGasto)}</td>
                <td className="px-3 py-2 text-right">100%</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
