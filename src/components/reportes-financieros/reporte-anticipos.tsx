/**
 * Reporte de Anticipos.
 * Consume: useRptAnticipos (FASE 8A)
 * Muestra: anticipo entregado, utilizado, pendiente, diferencia + indicadores visuales.
 */
import { Banknote, CheckCircle2, Clock } from "lucide-react";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { MetricCard } from "@/components/common/metric-card";
import { StatusBadge } from "@/components/common/status-badge";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { AnticipoRow } from "@/types/reportes";

interface ReporteAnticiposProps {
  data: AnticipoRow[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

export function ReporteAnticipos({ data, loading, error, onRetry }: ReporteAnticiposProps) {
  if (loading) return <LoadingState label="Cargando anticipos..." />;

  if (error) {
    return (
      <EmptyState
        title="Error al cargar anticipos"
        description={error.message}
        action={
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-label="Reintentar carga de anticipos"
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
        icon={Banknote}
        title="Sin anticipos para el periodo"
        description="No hay anticipos registrados en el rango de fechas seleccionado."
      />
    );
  }

  const totalEntregado = data.reduce((s, r) => s + (r.valor ?? 0), 0);
  const liquidados = data.filter((r) => r.liquidado === true);
  const pendientes = data.filter((r) => !r.liquidado);
  const totalLiquidado = liquidados.reduce((s, r) => s + (r.valor ?? 0), 0);
  const totalPendiente = pendientes.reduce((s, r) => s + (r.valor ?? 0), 0);
  const diferencia = totalEntregado - totalLiquidado;

  return (
    <div className="space-y-6">
      {/* Indicadores */}
      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard
          label="Anticipo entregado"
          value={formatCurrency(totalEntregado)}
          icon={Banknote}
          hint={`${data.length} anticipos`}
        />
        <MetricCard
          label="Utilizado / Liquidado"
          value={formatCurrency(totalLiquidado)}
          icon={CheckCircle2}
          hint={`${liquidados.length} liquidados`}
        />
        <MetricCard
          label="Pendiente de liquidar"
          value={formatCurrency(totalPendiente)}
          icon={Clock}
          hint={`${pendientes.length} pendientes`}
        />
        <MetricCard
          label="Diferencia sin rendir"
          value={formatCurrency(diferencia)}
          hint={diferencia > 0 ? "Por rendir" : "Sin saldo"}
          trend={
            diferencia > 0
              ? { direction: "up", value: `${((diferencia / totalEntregado) * 100).toFixed(0)}%` }
              : undefined
          }
        />
      </div>

      {/* Indicador visual de avance */}
      {totalEntregado > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium">Progreso de liquidacion</span>
            <span className="tabular-nums text-muted-foreground">
              {((totalLiquidado / totalEntregado) * 100).toFixed(1)}% liquidado
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${Math.min((totalLiquidado / totalEntregado) * 100, 100)}%` }}
              role="progressbar"
              aria-label="Progreso de liquidacion de anticipos"
              aria-valuenow={Math.round((totalLiquidado / totalEntregado) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
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
                  Anticipo
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Fecha</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Proyecto
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Moneda</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Valor</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Rendicion
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{a.numero ?? a.id.slice(0, 8)}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatDate(a.fecha)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{a.proyecto_nombre ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {a.moneda_codigo ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(a.valor)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={a.liquidado ? "success" : "warning"}>
                      {a.liquidado ? "Liquidado" : "Pendiente"}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{a.rendicion_numero ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          {data.length} anticipos &mdash; {liquidados.length} liquidados, {pendientes.length}{" "}
          pendientes
        </div>
      </div>
    </div>
  );
}
