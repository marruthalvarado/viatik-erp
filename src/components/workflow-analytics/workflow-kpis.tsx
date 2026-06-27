/**
 * KPIs de flujo de aprobaciones — FASE 8E
 * Computa tiempo promedio, maximo y minimo desde TiempoWorkflowRow[].
 */
import { Timer, TrendingDown, TrendingUp, Clock } from "lucide-react";
import { MetricCard } from "@/components/common/metric-card";
import type { TiempoWorkflowRow } from "@/types/reportes";

interface WorkflowKpisProps {
  data: TiempoWorkflowRow[];
}

function fmtHoras(h: number | null | undefined): string {
  if (h == null) return "—";
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export function WorkflowKpis({ data }: WorkflowKpisProps) {
  if (data.length === 0) return null;

  const horas = data.map((r) => r.horas_espera_total).filter((h): h is number => h != null);

  const promedio = horas.length > 0 ? horas.reduce((s, h) => s + h, 0) / horas.length : null;
  const maximo = horas.length > 0 ? Math.max(...horas) : null;
  const minimo = horas.length > 0 ? Math.min(...horas) : null;

  const totalRechazos = data.reduce((s, r) => s + (r.n_rechazos ?? 0), 0);
  const conRechazos = data.filter((r) => (r.n_rechazos ?? 0) > 0).length;

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <MetricCard
        label="Rendiciones analizadas"
        value={String(data.length)}
        icon={Timer}
        hint={`${data.filter((r) => !r.fecha_aprobacion_final).length} en proceso`}
      />
      <MetricCard
        label="Tiempo promedio"
        value={fmtHoras(promedio)}
        icon={Clock}
        hint="horas de espera"
      />
      <MetricCard
        label="Tiempo maximo"
        value={fmtHoras(maximo)}
        icon={TrendingUp}
        hint="caso mas lento"
      />
      <MetricCard
        label="Con rechazos"
        value={String(conRechazos)}
        icon={TrendingDown}
        hint={totalRechazos > 0 ? `${totalRechazos} rechazos totales` : "sin rechazos"}
        trend={
          conRechazos > 0
            ? { direction: "down", value: `${((conRechazos / data.length) * 100).toFixed(0)}%` }
            : undefined
        }
      />
    </div>
  );
}
