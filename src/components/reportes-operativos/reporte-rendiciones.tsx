/**
 * Reporte de Rendiciones.
 * Consume: useRptRendicionesEstado (FASE 8A)
 * Muestra: KPIs + indicadores por estado + tabla detalle.
 */
import { Receipt, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { MetricCard } from "@/components/common/metric-card";
import { StatusBadge } from "@/components/common/status-badge";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { RendicionEstadoRow } from "@/types/reportes";

interface ReporteRendicionesProps {
  data: RendicionEstadoRow[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

function estadoTone(codigo: string | null): "success" | "warning" | "danger" | "neutral" {
  switch (codigo) {
    case "APROBADA":
      return "success";
    case "PENDIENTE":
    case "EN_REVISION":
      return "warning";
    case "RECHAZADA":
      return "danger";
    default:
      return "neutral";
  }
}

export function ReporteRendiciones({ data, loading, error, onRetry }: ReporteRendicionesProps) {
  if (loading) return <LoadingState label="Cargando rendiciones..." />;

  if (error) {
    return (
      <EmptyState
        title="Error al cargar rendiciones"
        description={error.message}
        action={
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-label="Reintentar carga de rendiciones"
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
        icon={Receipt}
        title="Sin rendiciones en el periodo"
        description="No hay rendiciones registradas en el rango de fechas seleccionado."
      />
    );
  }

  const total = data.length;
  const aprobadas = data.filter((r) => r.estado_codigo === "APROBADA").length;
  const pendientes = data.filter(
    (r) => r.estado_codigo === "PENDIENTE" || r.estado_codigo === "EN_REVISION",
  ).length;
  const rechazadas = data.filter((r) => r.estado_codigo === "RECHAZADA").length;
  const montoTotal = data.reduce((s, r) => s + (r.total_facturado ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard
          label="Total rendiciones"
          value={String(total)}
          icon={Receipt}
          hint={`${formatCurrency(montoTotal)} total`}
        />
        <MetricCard
          label="Aprobadas"
          value={String(aprobadas)}
          icon={CheckCircle2}
          hint={total > 0 ? `${((aprobadas / total) * 100).toFixed(0)}% tasa` : undefined}
          trend={
            aprobadas > 0
              ? { direction: "up", value: `${((aprobadas / total) * 100).toFixed(0)}%` }
              : undefined
          }
        />
        <MetricCard
          label="Pendientes / En revision"
          value={String(pendientes)}
          icon={Clock}
          hint="requieren atencion"
        />
        <MetricCard
          label="Rechazadas"
          value={String(rechazadas)}
          icon={AlertCircle}
          hint={rechazadas > 0 ? "requieren correccion" : "sin rechazos"}
        />
      </div>

      {/* Distribucion visual por estado */}
      {total > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-xs font-medium">Distribucion por estado</p>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            {aprobadas > 0 && (
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(aprobadas / total) * 100}%` }}
                title={`Aprobadas: ${aprobadas}`}
              />
            )}
            {pendientes > 0 && (
              <div
                className="h-full bg-amber-400 transition-all"
                style={{ width: `${(pendientes / total) * 100}%` }}
                title={`Pendientes: ${pendientes}`}
              />
            )}
            {rechazadas > 0 && (
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${(rechazadas / total) * 100}%` }}
                title={`Rechazadas: ${rechazadas}`}
              />
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-500" />
              Aprobadas {aprobadas}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-400" />
              Pendientes {pendientes}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-red-500" />
              Rechazadas {rechazadas}
            </span>
          </div>
        </div>
      )}

      {/* Tabla */}
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
                  Proyecto
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Fecha</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Dias en estado
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Gasto total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{r.numero ?? r.id.slice(0, 8)}</td>
                  <td className="px-3 py-2">{r.usuario_nombre ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.proyecto_nombre ?? "—"}</td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={estadoTone(r.estado_codigo)}>
                      {r.estado_nombre ?? r.estado_codigo ?? "—"}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatDate(r.fecha_rendicion)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.dias_en_estado != null ? `${r.dias_en_estado}d` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(r.total_facturado)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-3 py-2" colSpan={5}>
                  Total ({total} rendiciones)
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {total > 0
                    ? `${(data.reduce((s, r) => s + (r.dias_en_estado ?? 0), 0) / total).toFixed(1)}d prom`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(montoTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
