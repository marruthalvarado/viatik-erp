/**
 * Indicadores SLA de workflow — Tab 5 — FASE 8E
 * Consume: useRptTiemposWorkflow (FASE 8A)
 * SLA definido: 72 horas (3 dias habiles).
 * Muestra: KPIs cumplimiento, tendencia mensual, tabla.
 */
import { CheckCircle2, XCircle, Target } from "lucide-react";
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
import { MetricCard } from "@/components/common/metric-card";
import type { TiempoWorkflowRow } from "@/types/reportes";

const SLA_HORAS = 72; // 3 dias habiles

interface WorkflowSlaProps {
  data: TiempoWorkflowRow[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

interface MesSla {
  mes: string;
  dentro: number;
  fuera: number;
  pct: number;
}

export function WorkflowSla({ data, loading, error, onRetry }: WorkflowSlaProps) {
  if (loading) return <LoadingState label="Calculando indicadores SLA..." />;

  if (error) {
    return (
      <EmptyState
        title="Error al cargar SLA"
        description={error.message}
        action={
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-label="Reintentar carga de indicadores SLA"
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
        icon={Target}
        title="Sin datos SLA"
        description="No hay rendiciones con datos de tiempos en el periodo seleccionado."
      />
    );
  }

  // Calcular SLA por cada rendicion (usar horas_espera_total cuando esta disponible)
  const conHoras = data.filter((r) => r.horas_espera_total != null);
  const dentroCumplimiento = conHoras.filter((r) => (r.horas_espera_total ?? 0) <= SLA_HORAS);
  const fueraCumplimiento = conHoras.filter((r) => (r.horas_espera_total ?? 0) > SLA_HORAS);
  const enProceso = data.filter((r) => !r.fecha_aprobacion_final && r.horas_espera_total == null);

  const pctCumplimiento =
    conHoras.length > 0 ? (dentroCumplimiento.length / conHoras.length) * 100 : null;

  // Tendencia mensual desde fecha_envio
  const porMes = data.reduce<Record<string, { dentro: number; fuera: number }>>((acc, r) => {
    if (!r.fecha_envio) return acc;
    const mes = r.fecha_envio.slice(0, 7); // YYYY-MM
    if (!acc[mes]) acc[mes] = { dentro: 0, fuera: 0 };
    if (r.horas_espera_total != null) {
      if (r.horas_espera_total <= SLA_HORAS) acc[mes].dentro += 1;
      else acc[mes].fuera += 1;
    }
    return acc;
  }, {});

  const tendencia: MesSla[] = Object.entries(porMes)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, v]) => ({
      mes: mes.replace("-", "/"),
      dentro: v.dentro,
      fuera: v.fuera,
      pct: v.dentro + v.fuera > 0 ? Math.round((v.dentro / (v.dentro + v.fuera)) * 100) : 0,
    }));

  const promedioFuera =
    fueraCumplimiento.length > 0
      ? fueraCumplimiento.reduce((s, r) => s + (r.horas_espera_total ?? 0), 0) /
        fueraCumplimiento.length
      : null;

  return (
    <div className="space-y-6">
      {/* KPIs SLA */}
      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard
          label="% Cumplimiento SLA"
          value={pctCumplimiento != null ? `${pctCumplimiento.toFixed(1)}%` : "—"}
          icon={Target}
          hint={`SLA = ${SLA_HORAS}h (3 dias)`}
          trend={
            pctCumplimiento != null
              ? {
                  direction: pctCumplimiento >= 80 ? "up" : "down",
                  value: pctCumplimiento >= 80 ? "OK" : "Bajo",
                }
              : undefined
          }
        />
        <MetricCard
          label="Dentro del SLA"
          value={String(dentroCumplimiento.length)}
          icon={CheckCircle2}
          hint={`de ${conHoras.length} rendiciones`}
        />
        <MetricCard
          label="Fuera del SLA"
          value={String(fueraCumplimiento.length)}
          icon={XCircle}
          hint={
            promedioFuera != null
              ? `promedio ${(promedioFuera / 24).toFixed(1)}d extra`
              : "sin excedidos"
          }
        />
        <MetricCard
          label="En proceso"
          value={String(
            enProceso.length +
              data.filter((r) => !r.fecha_aprobacion_final && r.horas_espera_total != null).length,
          )}
          hint="rendiciones activas"
        />
      </div>

      {/* Tendencia mensual SLA */}
      {tendencia.length > 0 && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold tracking-tight">
            Cumplimiento SLA mensual (umbral: {SLA_HORAS}h)
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tendencia} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="dentro" name="Dentro del SLA" stackId="a" fill="hsl(var(--chart-1))" />
              <Bar
                dataKey="fuera"
                name="Fuera del SLA"
                stackId="a"
                fill="hsl(var(--chart-2))"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Tabla rendiciones fuera del SLA */}
      {fueraCumplimiento.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="px-4 py-3 border-b">
            <h3 className="text-xs font-semibold text-destructive">
              Rendiciones fuera del SLA ({fueraCumplimiento.length})
            </h3>
          </div>
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
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                    Horas espera
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                    Exceso
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fueraCumplimiento
                  .sort((a, b) => (b.horas_espera_total ?? 0) - (a.horas_espera_total ?? 0))
                  .map((r) => {
                    const exceso = (r.horas_espera_total ?? 0) - SLA_HORAS;
                    return (
                      <tr key={r.rendicion_id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">
                          {r.rendicion_numero ?? r.rendicion_id.slice(0, 8)}
                        </td>
                        <td className="px-3 py-2">{r.usuario_nombre ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">
                          {r.fecha_envio ? r.fecha_envio.slice(0, 10) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.horas_espera_total?.toFixed(1) ?? "—"}h
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-destructive">
                          +{exceso.toFixed(1)}h
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
