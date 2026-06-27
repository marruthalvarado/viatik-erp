/**
 * Flujo de aprobaciones — Tab 1 — FASE 8E
 * Consume: useRptTiemposWorkflow (FASE 8A)
 * Muestra: KPIs + grafico tiempos + tabla detalle.
 */
import { Timer } from "lucide-react";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { formatDate } from "@/utils/formatters";
import { WorkflowKpis } from "./workflow-kpis";
import { WorkflowCharts } from "./workflow-charts";
import type { TiempoWorkflowRow } from "@/types/reportes";

interface WorkflowSummaryProps {
  data: TiempoWorkflowRow[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

function fmtHoras(h: number | null | undefined): string {
  if (h == null) return "—";
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export function WorkflowSummary({ data, loading, error, onRetry }: WorkflowSummaryProps) {
  if (loading) return <LoadingState label="Cargando flujo de aprobaciones..." />;

  if (error) {
    return (
      <EmptyState
        title="Error al cargar flujo"
        description={error.message}
        action={
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-label="Reintentar carga del flujo de aprobaciones"
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
        icon={Timer}
        title="Sin datos de flujo"
        description="No hay rendiciones con datos de tiempos en el periodo seleccionado."
      />
    );
  }

  return (
    <div className="space-y-6">
      <WorkflowKpis data={data} />

      <WorkflowCharts data={data} />

      {/* Tabla detalle */}
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Rendicion
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Responsable
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Fecha envio
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Primera accion
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Tiempo total
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Acciones
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Rechazos
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((r) => {
                const enProceso = !r.fecha_aprobacion_final;
                return (
                  <tr key={r.rendicion_id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">
                      {r.rendicion_numero ?? r.rendicion_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2">{r.usuario_nombre ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {formatDate(r.fecha_envio)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {formatDate(r.fecha_primera_accion)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtHoras(r.horas_espera_total)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {r.n_acciones ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {(r.n_rechazos ?? 0) > 0 ? (
                        <span className="text-destructive">{r.n_rechazos}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          enProceso
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }
                      >
                        {enProceso ? "En proceso" : "Finalizada"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-3 py-2" colSpan={4}>
                  Total ({data.length} rendiciones)
                </td>
                <td className="px-3 py-2 text-right tabular-nums" />
                <td className="px-3 py-2 text-right tabular-nums">
                  {data.reduce((s, r) => s + (r.n_acciones ?? 0), 0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-destructive">
                  {data.reduce((s, r) => s + (r.n_rechazos ?? 0), 0)}
                </td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
