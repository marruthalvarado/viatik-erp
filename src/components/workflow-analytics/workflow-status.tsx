/**
 * Distribucion por estados — Tab 4 — FASE 8E
 * Consume: useRptRendicionesEstado (FASE 8A)
 * Muestra: PieChart distribución de estados + cards resumen.
 */
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { LayoutGrid } from "lucide-react";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import type { RendicionEstadoRow } from "@/types/reportes";

interface WorkflowStatusProps {
  data: RendicionEstadoRow[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface EstadoGroup {
  estado: string;
  count: number;
  total: number;
  pct: string;
  color: string;
}

export function WorkflowStatus({ data, loading, error, onRetry }: WorkflowStatusProps) {
  if (loading) return <LoadingState label="Cargando distribucion de estados..." />;

  if (error) {
    return (
      <EmptyState
        title="Error al cargar estados"
        description={error.message}
        action={
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-label="Reintentar carga de distribucion de estados"
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
        icon={LayoutGrid}
        title="Sin datos de estados"
        description="No hay rendiciones en el periodo seleccionado."
      />
    );
  }

  // Agrupar por estado
  const mapaEstados = data.reduce<Record<string, { count: number; total: number; nombre: string }>>(
    (acc, r) => {
      const k = r.estado_codigo ?? "DESCONOCIDO";
      if (!acc[k]) acc[k] = { count: 0, total: 0, nombre: r.estado_nombre ?? k };
      acc[k].count += 1;
      acc[k].total += r.total_facturado ?? 0;
      return acc;
    },
    {},
  );

  const grupos: EstadoGroup[] = Object.entries(mapaEstados)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([, v], i) => ({
      estado: v.nombre,
      count: v.count,
      total: v.total,
      pct: `${((v.count / data.length) * 100).toFixed(1)}%`,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

  const formatMoneda = (v: number) =>
    v.toLocaleString("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      {/* PieChart */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">
          Distribucion de rendiciones por estado
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={grupos}
              dataKey="count"
              nameKey="estado"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ estado, pct }) => `${estado}: ${pct}`}
              labelLine={false}
            >
              {grupos.map((g) => (
                <Cell key={g.estado} fill={g.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => [v, "Rendiciones"]} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </section>

      {/* Cards por estado */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {grupos.map((g) => (
          <div key={g.estado} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">{g.estado}</p>
              <span
                className="size-3 flex-none rounded-full"
                style={{ backgroundColor: g.color }}
                aria-hidden="true"
              />
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums">{g.count}</p>
            <p className="text-xs text-muted-foreground">{g.pct} del total</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatMoneda(g.total)}</p>
          </div>
        ))}
      </div>

      {/* Tabla resumen */}
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Rendiciones
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  % del total
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Gasto total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {grupos.map((g) => (
                <tr key={g.estado} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: g.color }}
                        aria-hidden="true"
                      />
                      {g.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{g.count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{g.pct}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoneda(g.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{data.length}</td>
                <td className="px-3 py-2 text-right">100%</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMoneda(data.reduce((s, r) => s + (r.total_facturado ?? 0), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
