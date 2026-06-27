/**
 * Reporte Gasto por Categoria.
 * Consume: useRptEjecucionPresupuestaria (FASE 8A) — agrupa por categoria_nombre.
 * Muestra: grafico PieChart, tabla con totales y porcentajes.
 */
import { Tag } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/utils/formatters";
import type { EjecucionPresupuestariaRow } from "@/types/reportes";

interface ReporteCategoriasProps {
  data: EjecucionPresupuestariaRow[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
];

export function ReporteCategorias({ data, loading, error, onRetry }: ReporteCategoriasProps) {
  if (loading) return <LoadingState label="Cargando categorias..." />;

  if (error) {
    return (
      <EmptyState
        title="Error al cargar categorias"
        description={error.message}
        action={
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-label="Reintentar carga de categorias"
          >
            Reintentar
          </button>
        }
      />
    );
  }

  // Agrupar por categoria
  const agrupado = Object.entries(
    data.reduce<Record<string, { ejecutado: number; presupuestado: number; count: number }>>(
      (acc, r) => {
        const k = r.categoria_nombre ?? "Sin categoria";
        if (!acc[k]) acc[k] = { ejecutado: 0, presupuestado: 0, count: 0 };
        acc[k].ejecutado += r.ejecutado ?? 0;
        acc[k].presupuestado += r.valor_presupuestado ?? 0;
        acc[k].count += 1;
        return acc;
      },
      {},
    ),
  )
    .map(([name, vals]) => ({ name, ...vals }))
    .filter((d) => d.ejecutado > 0)
    .sort((a, b) => b.ejecutado - a.ejecutado);

  if (agrupado.length === 0) {
    return (
      <EmptyState
        icon={Tag}
        title="Sin datos por categoria"
        description="No hay gasto ejecutado para las categorias en este periodo."
      />
    );
  }

  const totalEjecutado = agrupado.reduce((s, d) => s + d.ejecutado, 0);
  const chartData = agrupado.slice(0, 8).map((d) => ({ name: d.name, value: d.ejecutado }));

  return (
    <div className="space-y-6">
      {/* Grafico PieChart */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">
          Distribucion de gasto por categoria
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend iconType="circle" iconSize={9} />
          </PieChart>
        </ResponsiveContainer>
      </section>

      {/* Tabla */}
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Categoria
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Presupuestado
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Ejecutado
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">%</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  # Lineas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {agrupado.map((d, i) => (
                <tr key={d.name} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <span className="font-medium">{d.name}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(d.presupuestado)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(d.ejecutado)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {totalEjecutado > 0
                      ? `${((d.ejecutado / totalEjecutado) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {d.count}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(agrupado.reduce((s, d) => s + d.presupuestado, 0))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(totalEjecutado)}
                </td>
                <td className="px-3 py-2 text-right">100%</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {agrupado.reduce((s, d) => s + d.count, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
