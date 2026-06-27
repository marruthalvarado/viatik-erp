/**
 * Reporte de Gastos — tabla de detalle de gastos por periodo.
 * Consume: useRptGastosDetalle (FASE 8A)
 * Columnas: Fecha, Empleado, Proyecto, Categoria, Proveedor, Moneda, Valor, Estado, Rendicion
 */
import { DollarSign } from "lucide-react";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { MetricCard } from "@/components/common/metric-card";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { GastoDetalleRow } from "@/types/reportes";

interface ReporteGastosProps {
  data: GastoDetalleRow[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

function estadoTone(codigo: string | null): "success" | "danger" | "warning" | "info" | "neutral" {
  switch (codigo) {
    case "aprobado":
      return "success";
    case "rechazado":
      return "danger";
    case "pendiente":
      return "warning";
    case "en_revision":
      return "info";
    default:
      return "neutral";
  }
}

export function ReporteGastos({ data, loading, error, onRetry }: ReporteGastosProps) {
  if (loading) return <LoadingState label="Cargando gastos..." />;

  if (error) {
    return (
      <EmptyState
        title="Error al cargar gastos"
        description={error.message}
        action={
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-label="Reintentar carga de gastos"
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
        icon={DollarSign}
        title="Sin gastos para el periodo"
        description="Ajusta los filtros para ver otros periodos."
      />
    );
  }

  const totalFacturado = data.reduce((s, r) => s + (r.valor_factura ?? 0), 0);
  const totalReembolsable = data.reduce((s, r) => s + (r.valor_reembolsable ?? 0), 0);
  const countPendientes = data.filter((r) => r.estado_codigo === "pendiente").length;

  return (
    <div className="space-y-6">
      {/* KPIs resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total facturado"
          value={formatCurrency(totalFacturado)}
          icon={DollarSign}
        />
        <MetricCard
          label="Total reembolsable"
          value={formatCurrency(totalReembolsable)}
          icon={DollarSign}
        />
        <MetricCard
          label="Gastos registrados"
          value={data.length}
          hint={countPendientes > 0 ? `${countPendientes} pendientes` : undefined}
        />
      </div>

      {/* Tabla */}
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Fecha</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Empleado
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Proyecto
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Categoria
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Proveedor
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
              {data.map((g) => (
                <tr key={g.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatDate(g.fecha)}
                  </td>
                  <td className="px-3 py-2 font-medium">{g.origen_nombre ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{g.proyecto_nombre ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{g.categoria_nombre ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{g.proveedor_nombre ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {g.moneda_codigo ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(g.valor_factura)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={estadoTone(g.estado_codigo)}>
                      {g.estado_codigo ?? "—"}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{g.rendicion_numero ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          {data.length} registros
        </div>
      </div>
    </div>
  );
}
