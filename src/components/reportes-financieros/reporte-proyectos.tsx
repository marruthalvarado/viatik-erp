/**
 * Reporte Gasto por Proyecto.
 * Consume: useRptEjecucionPresupuestaria (FASE 8A) — agrupa por proyecto_nombre.
 * Muestra: ranking, grafico BarChart horizontal, detalle.
 */
import { FolderKanban } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/utils/formatters";
import type { EjecucionPresupuestariaRow } from "@/types/reportes";

interface ReporteProyectosProps {
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

export function ReporteProyectos({ data, loading, error, onRetry }: ReporteProyectosProps) {
  if (loading) return <LoadingState label="Cargando proyectos..." />;

  if (error) {
    return (
      <EmptyState
        title="Error al cargar proyectos"
        description={error.message}
        action={
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-label="Reintentar carga de proyectos"
          >
            Reintentar
          </button>
        }
      />
    );
  }

  // Agrupar por proyecto
  const agrupado = Object.entries(
    data.reduce<
      Record<
        string,
        { ejecutado: number; presupuestado: number; disponible: number; count: number }
      >
    >((acc, r) => {
      const k = r.proyecto_nombre ?? "Sin proyecto";
      if (!acc[k]) acc[k] = { ejecutado: 0, presupuestado: 0, disponible: 0, count: 0 };
      acc[k].ejecutado += r.ejecutado ?? 0;
      acc[k].presupuestado += r.valor_presupuestado ?? 0;
      acc[k].disponible += r.disponible ?? 0;
      acc[k].count += 1;
      return acc;
    }, {}),
  )
    .map(([proyecto, vals]) => ({ proyecto, ...vals }))
    .sort((a, b) => b.ejecutado - a.ejecutado);

  if (agrupado.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Sin datos por proyecto"
        description="No hay gasto ejecutado por proyecto en este periodo."
      />
    );
  }

  const totalEjecutado = agrupado.reduce((s, d) => s + d.ejecutado, 0);
  const chartData = agrupado.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Grafico horizontal */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">
          Gasto ejecutado por proyecto (top {Math.min(chartData.length, 10)})
        </h2>
        <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 34)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tickFormatter={tick} tick={{ fontSize: 10 }} width={56} />
            <YAxis type="category" dataKey="proyecto" tick={{ fontSize: 9 }} width={110} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar
              dataKey="ejecutado"
              name="Ejecutado"
              fill="hsl(var(--chart-1))"
              radius={[0, 3, 3, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Ranking y detalle */}
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">#</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Proyecto
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
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  % del total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {agrupado.map((d, i) => (
                <tr key={d.proyecto} className="hover:bg-muted/30">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{d.proyecto}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(d.presupuestado)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(d.ejecutado)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(d.disponible)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {totalEjecutado > 0
                      ? `${((d.ejecutado / totalEjecutado) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-3 py-2" />
                <td className="px-3 py-2">Total ({agrupado.length} proyectos)</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(agrupado.reduce((s, d) => s + d.presupuestado, 0))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(totalEjecutado)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(agrupado.reduce((s, d) => s + d.disponible, 0))}
                </td>
                <td className="px-3 py-2 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
