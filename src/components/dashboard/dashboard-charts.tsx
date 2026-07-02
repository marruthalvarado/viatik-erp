/**
 * Graficos del Dashboard Ejecutivo:
 * - Evolucion mensual de gastos (BarChart)
 * - Presupuesto vs ejecutado por proyecto (BarChart horizontal)
 * - Gastos por categoria (PieChart)
 * - Gastos por cliente (BarChart horizontal)
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/utils/formatters";
import type {
  EvolucionMensual,
  GastoCategoria,
  DashboardProyecto,
  DashboardCliente,
} from "@/services/dashboard";

// Paleta de colores (hex para evitar dependencia de CSS vars indefinidas)

const COLORS = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#0ea5e9", // sky
  "#84cc16", // lime
  "#f97316", // orange
  "#06b6d4", // cyan
];

// Helpers

function ChartPanel({
  title,
  loading,
  empty,
  children,
}: {
  title: string;
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold tracking-tight">{title}</h2>
      {loading ? (
        <LoadingState label="Cargando..." />
      ) : empty ? (
        <EmptyState title="Sin datos" />
      ) : (
        children
      )}
    </section>
  );
}

function currencyTick(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
}

// Evolucion mensual

interface EvolucionChartProps {
  data: EvolucionMensual[];
  loading: boolean;
  anio: number;
}

export function EvolucionMensualChart({ data, loading, anio }: EvolucionChartProps) {
  return (
    <ChartPanel
      title={`Evolucion mensual ${anio > 0 ? anio : "- todos los anos"}`}
      loading={loading}
      empty={!loading && data.every((d) => d.total_facturado === 0)}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={currencyTick} tick={{ fontSize: 11 }} width={60} />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatCurrency(value),
              name === "total_facturado" ? "Facturado" : "Reembolsable",
            ]}
          />
          <Legend
            formatter={(v) => (v === "total_facturado" ? "Facturado" : "Reembolsable")}
            wrapperStyle={{ fontSize: 11 }}
          />
          <Bar dataKey="total_facturado" fill={COLORS[0]} radius={[3, 3, 0, 0]} />
          <Bar dataKey="total_reembolsable" fill={COLORS[1]} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

// Presupuesto vs Ejecutado

interface PresupuestoChartProps {
  data: DashboardProyecto[];
  loading: boolean;
}

export function PresupuestoEjecutadoChart({ data, loading }: PresupuestoChartProps) {
  const chartData = data
    .filter((p) => (p.presupuesto ?? 0) > 0 || (p.gasto_real ?? 0) > 0)
    .slice(0, 8)
    .map((p) => ({
      nombre: p.nombre ? (p.nombre.length > 18 ? p.nombre.slice(0, 16) + "..." : p.nombre) : "-",
      presupuesto: p.presupuesto ?? 0,
      ejecutado: p.gasto_real ?? 0,
    }));

  return (
    <ChartPanel
      title="Presupuesto vs ejecutado por proyecto"
      loading={loading}
      empty={!loading && chartData.length === 0}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 40, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tickFormatter={currencyTick} tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={100} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="presupuesto" name="Presupuesto" fill={COLORS[2]} radius={[0, 3, 3, 0]} />
          <Bar dataKey="ejecutado" name="Ejecutado" fill={COLORS[0]} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

// Gastos por categoria

interface CategoriaChartProps {
  data: GastoCategoria[];
  loading: boolean;
}

const RADIAN = Math.PI / 180;

function PieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name: _name,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
}) {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={9}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function GastosCategoriaChart({ data, loading }: CategoriaChartProps) {
  const top = data.slice(0, 8);
  return (
    <ChartPanel title="Gastos por categoria" loading={loading} empty={!loading && top.length === 0}>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="55%" height={200}>
          <PieChart>
            <Pie
              data={top}
              dataKey="total"
              nameKey="categoria_nombre"
              cx="50%"
              cy="50%"
              outerRadius={90}
              labelLine={false}
              label={(p) => <PieLabel {...p} name={p.categoria_nombre} />}
            >
              {top.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="flex-1 space-y-1.5 text-xs">
          {top.map((cat, i) => (
            <li key={cat.categoria_id ?? i} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="truncate flex-1">{cat.categoria_nombre}</span>
              <span className="tabular-nums font-medium">{formatCurrency(cat.total)}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartPanel>
  );
}

// Gastos por cliente

interface ClienteChartProps {
  data: DashboardCliente[];
  loading: boolean;
}

export function GastosClienteChart({ data, loading }: ClienteChartProps) {
  const chartData = data.slice(0, 8).map((c) => ({
    nombre: c.cliente ? (c.cliente.length > 18 ? c.cliente.slice(0, 16) + "..." : c.cliente) : "-",
    total: c.total_gastado ?? 0,
  }));

  return (
    <ChartPanel
      title="Gastos por cliente"
      loading={loading}
      empty={!loading && chartData.length === 0}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 40, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tickFormatter={currencyTick} tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={100} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Bar dataKey="total" name="Total gastado" fill={COLORS[3]} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
