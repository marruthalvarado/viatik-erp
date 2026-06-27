/**
 * Cuellos de botella en el workflow — Tab 2 — FASE 8E
 * Consume: useRptAprobacionesEficiencia (FASE 8A)
 * Identifica: paso mas lento, aprobador con mayor carga, area de retraso.
 */
import { AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { MetricCard } from "@/components/common/metric-card";
import type { AprobacionEficienciaRow } from "@/types/reportes";

interface WorkflowBottlenecksProps {
  data: AprobacionEficienciaRow[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

export function WorkflowBottlenecks({ data, loading, error, onRetry }: WorkflowBottlenecksProps) {
  if (loading) return <LoadingState label="Analizando cuellos de botella..." />;

  if (error) {
    return (
      <EmptyState
        title="Error al cargar datos"
        description={error.message}
        action={
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-label="Reintentar carga de cuellos de botella"
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
        icon={AlertTriangle}
        title="Sin datos de workflow"
        description="No hay acciones de aprobacion en el periodo seleccionado."
      />
    );
  }

  // Acciones por paso (volumen = carga de trabajo por paso)
  const porPaso = Object.entries(
    data.reduce<Record<string, number>>((acc, r) => {
      const k = r.paso_nombre ?? "Sin paso";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([paso, count]) => ({ paso, count }))
    .sort((a, b) => b.count - a.count);

  // Acciones por aprobador
  const porAprobador = Object.entries(
    data.reduce<Record<string, number>>((acc, r) => {
      const k = r.aprobador_nombre ?? "Sin asignar";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([aprobador, count]) => ({ aprobador, count }))
    .sort((a, b) => b.count - a.count);

  // Workflow con mas acciones
  const porWorkflow = Object.entries(
    data.reduce<Record<string, number>>((acc, r) => {
      const k = r.workflow_nombre ?? "Sin workflow";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([workflow, count]) => ({ workflow, count }))
    .sort((a, b) => b.count - a.count);

  const pasoMasActivo = porPaso[0];
  const aprobadorMasActivo = porAprobador[0];
  const workflowMasActivo = porWorkflow[0];

  return (
    <div className="space-y-6">
      {/* KPIs cuellos de botella */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Paso mas activo"
          value={pasoMasActivo?.paso ?? "—"}
          icon={AlertTriangle}
          hint={pasoMasActivo ? `${pasoMasActivo.count} acciones` : undefined}
        />
        <MetricCard
          label="Aprobador con mayor carga"
          value={aprobadorMasActivo?.aprobador ?? "—"}
          hint={aprobadorMasActivo ? `${aprobadorMasActivo.count} acciones` : undefined}
        />
        <MetricCard
          label="Workflow mas activo"
          value={workflowMasActivo?.workflow ?? "—"}
          hint={workflowMasActivo ? `${workflowMasActivo.count} acciones` : undefined}
        />
      </div>

      {/* BarChart: volumen por paso */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">
          Volumen de acciones por paso de aprobacion
        </h2>
        <ResponsiveContainer width="100%" height={Math.max(180, porPaso.length * 36)}>
          <BarChart
            data={porPaso.slice(0, 10)}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="paso" tick={{ fontSize: 9 }} width={120} />
            <Tooltip />
            <Bar dataKey="count" name="Acciones" fill="hsl(var(--chart-5))" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Tabla: carga por aprobador */}
      <div className="rounded-xl border bg-card">
        <div className="px-4 py-3 border-b">
          <h3 className="text-xs font-semibold">Carga por aprobador</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">#</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Aprobador
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  # Acciones
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  % del total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {porAprobador.map((a, i) => (
                <tr key={a.aprobador} className="hover:bg-muted/30">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{a.aprobador}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {data.length > 0 ? `${((a.count / data.length) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-3 py-2" />
                <td className="px-3 py-2">Total ({porAprobador.length} aprobadores)</td>
                <td className="px-3 py-2 text-right tabular-nums">{data.length}</td>
                <td className="px-3 py-2 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
