/**
 * Reporte de Proyectos (operativo).
 * Consume: useRptEjecucionPresupuestaria + useRptRendicionesEstado (FASE 8A)
 * Muestra: presupuesto, ejecutado, variacion, % ejecucion, rendiciones, viajes por proyecto.
 */
import { FolderKanban } from "lucide-react";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { formatCurrency } from "@/utils/formatters";
import type {
  EjecucionPresupuestariaRow,
  RendicionEstadoRow,
  ViajeDetalleRow,
} from "@/types/reportes";

interface ReporteProyectosOpProps {
  ejecucion: EjecucionPresupuestariaRow[];
  rendiciones: RendicionEstadoRow[];
  viajes: ViajeDetalleRow[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

function pctTone(pct: number): "danger" | "warning" | "success" {
  if (pct > 1) return "danger";
  if (pct > 0.9) return "warning";
  return "success";
}

export function ReporteProyectosOp({
  ejecucion,
  rendiciones,
  viajes,
  loading,
  error,
  onRetry,
}: ReporteProyectosOpProps) {
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

  // Agrupar ejecucion por proyecto
  const ejecucionPorProy = ejecucion.reduce<
    Record<string, { presupuestado: number; ejecutado: number; disponible: number }>
  >((acc, r) => {
    const k = r.proyecto_nombre ?? "Sin proyecto";
    if (!acc[k]) acc[k] = { presupuestado: 0, ejecutado: 0, disponible: 0 };
    acc[k].presupuestado += r.valor_presupuestado ?? 0;
    acc[k].ejecutado += r.ejecutado ?? 0;
    acc[k].disponible += r.disponible ?? 0;
    return acc;
  }, {});

  // Rendiciones por proyecto
  const rendicionesPorProy = rendiciones.reduce<Record<string, number>>((acc, r) => {
    const k = r.proyecto_nombre ?? "Sin proyecto";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  // Viajes por proyecto
  const viajesPorProy = viajes.reduce<Record<string, number>>((acc, v) => {
    const k = v.proyecto_nombre ?? "Sin proyecto";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const proyectos = Object.entries(ejecucionPorProy)
    .map(([nombre, vals]) => ({
      nombre,
      ...vals,
      variacion: vals.ejecutado - vals.presupuestado,
      pct: vals.presupuestado > 0 ? vals.ejecutado / vals.presupuestado : 0,
      nRendiciones: rendicionesPorProy[nombre] ?? 0,
      nViajes: viajesPorProy[nombre] ?? 0,
    }))
    .sort((a, b) => b.ejecutado - a.ejecutado);

  if (proyectos.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Sin datos de proyectos"
        description="No hay datos de ejecucion presupuestaria en el periodo."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Proyecto
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Presupuesto
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Ejecutado
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Variacion
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  % Ejec.
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Rendiciones
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Viajes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {proyectos.map((p) => (
                <tr key={p.nombre} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{p.nombre}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(p.presupuestado)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(p.ejecutado)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      p.variacion > 0
                        ? "text-destructive"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {p.variacion > 0 ? "+" : ""}
                    {formatCurrency(p.variacion)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {p.presupuestado > 0 ? (
                      <StatusBadge tone={pctTone(p.pct)}>{(p.pct * 100).toFixed(1)}%</StatusBadge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {p.nRendiciones > 0 ? p.nRendiciones : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {p.nViajes > 0 ? p.nViajes : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-3 py-2">Total ({proyectos.length} proyectos)</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(proyectos.reduce((s, p) => s + p.presupuestado, 0))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(proyectos.reduce((s, p) => s + p.ejecutado, 0))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(proyectos.reduce((s, p) => s + p.variacion, 0))}
                </td>
                <td className="px-3 py-2 text-right" />
                <td className="px-3 py-2 text-right tabular-nums">
                  {proyectos.reduce((s, p) => s + p.nRendiciones, 0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {proyectos.reduce((s, p) => s + p.nViajes, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
