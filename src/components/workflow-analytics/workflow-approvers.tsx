/**
 * Ranking de aprobadores — Tab 3 — FASE 8E
 * Consume: useRptAprobacionesEficiencia (FASE 8A)
 * Muestra: ranking con aprobaciones, rechazos, devoluciones, total.
 */
import { UserCheck } from "lucide-react";
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
import type { AprobacionEficienciaRow } from "@/types/reportes";

interface WorkflowApproversProps {
  data: AprobacionEficienciaRow[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

const ACCION_APROBADO = new Set(["APROBADO", "APROBADA", "APPROVE", "APPROVED"]);
const ACCION_RECHAZADO = new Set(["RECHAZADO", "RECHAZADA", "REJECT", "REJECTED"]);
const ACCION_DEVUELTO = new Set(["DEVUELTO", "DEVUELTA", "DEVOLVER", "RETURN", "RETURNED"]);

interface AprobadorStats {
  aprobador: string;
  total: number;
  aprobaciones: number;
  rechazos: number;
  devoluciones: number;
  otros: number;
}

export function WorkflowApprovers({ data, loading, error, onRetry }: WorkflowApproversProps) {
  if (loading) return <LoadingState label="Cargando ranking de aprobadores..." />;

  if (error) {
    return (
      <EmptyState
        title="Error al cargar aprobadores"
        description={error.message}
        action={
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-label="Reintentar carga de aprobadores"
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
        icon={UserCheck}
        title="Sin datos de aprobadores"
        description="No hay acciones de aprobadores en el periodo seleccionado."
      />
    );
  }

  // Agrupar por aprobador
  const mapaAprobadores = data.reduce<Record<string, AprobadorStats>>((acc, r) => {
    const k = r.aprobador_nombre ?? "Sin asignar";
    if (!acc[k])
      acc[k] = { aprobador: k, total: 0, aprobaciones: 0, rechazos: 0, devoluciones: 0, otros: 0 };
    acc[k].total += 1;
    const codigo = (r.accion_codigo ?? "").toUpperCase();
    if (ACCION_APROBADO.has(codigo)) acc[k].aprobaciones += 1;
    else if (ACCION_RECHAZADO.has(codigo)) acc[k].rechazos += 1;
    else if (ACCION_DEVUELTO.has(codigo)) acc[k].devoluciones += 1;
    else acc[k].otros += 1;
    return acc;
  }, {});

  const ranking = Object.values(mapaAprobadores).sort((a, b) => b.total - a.total);
  const chartData = ranking.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* BarChart stacked */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">
          Acciones por aprobador (top {Math.min(chartData.length, 10)})
        </h2>
        <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 36)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="aprobador" tick={{ fontSize: 9 }} width={120} />
            <Tooltip />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="aprobaciones"
              name="Aprobaciones"
              stackId="a"
              fill="hsl(var(--chart-1))"
            />
            <Bar
              dataKey="rechazos"
              name="Rechazos"
              stackId="a"
              fill="hsl(var(--chart-destructive, var(--destructive)))"
            />
            <Bar
              dataKey="devoluciones"
              name="Devoluciones"
              stackId="a"
              fill="hsl(var(--chart-3))"
            />
            <Bar
              dataKey="otros"
              name="Otros"
              stackId="a"
              fill="hsl(var(--muted-foreground))"
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
                  Aprobador
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Aprobaciones
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Rechazos
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Devoluciones
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  % Aprobacion
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ranking.map((a, i) => (
                <tr key={a.aprobador} className="hover:bg-muted/30">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{a.aprobador}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.total}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {a.aprobaciones}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-destructive">
                    {a.rechazos > 0 ? a.rechazos : <span className="text-muted-foreground">0</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">
                    {a.devoluciones > 0 ? (
                      a.devoluciones
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {a.total > 0 ? `${((a.aprobaciones / a.total) * 100).toFixed(0)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-3 py-2" />
                <td className="px-3 py-2">Total ({ranking.length} aprobadores)</td>
                <td className="px-3 py-2 text-right tabular-nums">{data.length}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {ranking.reduce((s, a) => s + a.aprobaciones, 0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {ranking.reduce((s, a) => s + a.rechazos, 0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {ranking.reduce((s, a) => s + a.devoluciones, 0)}
                </td>
                <td className="px-3 py-2 text-right" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
