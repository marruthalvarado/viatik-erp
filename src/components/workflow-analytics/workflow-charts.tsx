/**
 * Graficos de tiempos de ciclo — FASE 8E
 * BarChart horizontal: horas de espera por rendicion (top 15 mas lentas).
 */
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { TiempoWorkflowRow } from "@/types/reportes";

interface WorkflowChartsProps {
  data: TiempoWorkflowRow[];
}

function tickHoras(value: number) {
  if (value >= 24) return `${(value / 24).toFixed(0)}d`;
  return `${value}h`;
}

function tooltipHoras(value: number) {
  if (value >= 24) return `${(value / 24).toFixed(1)} dias`;
  return `${value.toFixed(1)} horas`;
}

export function WorkflowCharts({ data }: WorkflowChartsProps) {
  if (data.length === 0) return null;

  const chartData = [...data]
    .filter((r) => r.horas_espera_total != null)
    .sort((a, b) => (b.horas_espera_total ?? 0) - (a.horas_espera_total ?? 0))
    .slice(0, 15)
    .map((r) => ({
      rendicion: r.rendicion_numero ?? r.rendicion_id.slice(0, 8),
      horas: r.horas_espera_total ?? 0,
      acciones: r.n_acciones ?? 0,
    }));

  const dynamicHeight = Math.max(220, chartData.length * 34);

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold tracking-tight">
        Tiempo de ciclo por rendicion (top {chartData.length} mas lentas)
      </h2>
      <ResponsiveContainer width="100%" height={dynamicHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tickFormatter={tickHoras} tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="rendicion" tick={{ fontSize: 9 }} width={80} />
          <Tooltip formatter={(v: number) => [tooltipHoras(v), "Tiempo de espera"]} />
          <Bar
            dataKey="horas"
            name="Horas de espera"
            fill="hsl(var(--chart-4))"
            radius={[0, 3, 3, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
