/**
 * Reporte de Viajes.
 * Consume: useRptViajesDetalle (FASE 8A)
 * Muestra: KPIs + tabla detalle por viaje.
 */
import { Plane, MapPin, Clock } from "lucide-react";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { MetricCard } from "@/components/common/metric-card";
import { formatDate } from "@/utils/formatters";
import type { ViajeDetalleRow } from "@/types/reportes";

interface ReporteViajesProps {
  data: ViajeDetalleRow[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

export function ReporteViajes({ data, loading, error, onRetry }: ReporteViajesProps) {
  if (loading) return <LoadingState label="Cargando viajes..." />;

  if (error) {
    return (
      <EmptyState
        title="Error al cargar viajes"
        description={error.message}
        action={
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-label="Reintentar carga de viajes"
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
        icon={Plane}
        title="Sin viajes en el periodo"
        description="No hay viajes registrados en el rango de fechas seleccionado."
      />
    );
  }

  const totalViajes = data.length;
  const conVehiculoPropio = data.filter((v) => v.vehiculo_propio === true).length;
  const duracionTotal = data.reduce((s, v) => s + (v.duracion_dias ?? 0), 0);
  const duracionPromedio = totalViajes > 0 ? duracionTotal / totalViajes : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total viajes"
          value={String(totalViajes)}
          icon={Plane}
          hint="en el periodo"
        />
        <MetricCard
          label="Con vehiculo propio"
          value={String(conVehiculoPropio)}
          icon={MapPin}
          hint={`${totalViajes - conVehiculoPropio} corporativos`}
        />
        <MetricCard
          label="Duracion promedio"
          value={`${duracionPromedio.toFixed(1)} dias`}
          icon={Clock}
          hint={`${duracionTotal} dias en total`}
        />
      </div>

      {/* Tabla */}
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Numero</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Fecha salida
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Fecha regreso
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Empleado
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Proyecto
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Destino / Pais
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Vehiculo
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Duracion
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Rendicion
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((v) => (
                <tr key={v.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium tabular-nums">
                    {v.numero ?? v.id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatDate(v.fecha_inicio)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatDate(v.fecha_fin)}
                  </td>
                  <td className="px-3 py-2">{v.usuario_nombre ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{v.proyecto_nombre ?? "—"}</td>
                  <td className="px-3 py-2">
                    {v.destino ? (
                      <span>
                        {v.destino}
                        {v.pais_nombre ? (
                          <span className="text-muted-foreground"> · {v.pais_nombre}</span>
                        ) : null}
                      </span>
                    ) : (
                      (v.pais_nombre ?? "—")
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        v.vehiculo_propio
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                      }
                    >
                      {v.vehiculo_propio ? "Propio" : "Corporativo"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {v.duracion_dias != null ? `${v.duracion_dias}d` : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{v.rendicion_numero ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          {totalViajes} viajes &mdash; {conVehiculoPropio} con vehiculo propio
        </div>
      </div>
    </div>
  );
}
