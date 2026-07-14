/**
 * Graficos del Dashboard Ejecutivo BI.
 * Usa colores hex solidos (no CSS vars --chart-* que no estan definidas).
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
  EjecucionPresupuestariaRow,
  TopProveedorRow,
  RendicionEstadoRow,
} from "@/types/reportes";
import type { EvolucionMensual, GastoCategoria } from "@/services/dashboard";

// Paleta hex (misma que dashboard-charts.tsx para consistencia)
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

function ChartPanel({
  title,
  loading,
  empty,
  children,
  onTitleClick,
}: {
  title: string;
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
  onTitleClick?: () => void;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2
        className={
          onTitleClick
            ? "mb-4 cursor-pointer text-sm font-semibold tracking-tight hover:underline"
            : "mb-4 text-sm font-semibold tracking-tight"
        }
        onClick={onTitleClick}
      >
        {title}
      </h2>
      {loading ? (
        <LoadingState label="Cargando..." />
      ) : empty ? (
        <EmptyState title="Sin datos para el periodo" />
      ) : (
        children
      )}
    </section>
  );
}

function tick(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
}

// 1. Evolucion mensual — usa EvolucionMensual[] de dashboard.ts
interface EvolucionProps {
  data: EvolucionMensual[];
  loading: boolean;
  anio: number;
}

export function BiEvolucionMensualChart({ data, loading, anio }: EvolucionProps) {
  return (
    <ChartPanel
      title={`Evolucion mensual ${anio}`}
      loading={loading}
      empty={!loading && data.every((d) => d.total_facturado === 0)}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={tick} tick={{ fontSize: 10 }} width={56} />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatCurrency(value),
              name === "total_facturado" ? "Facturado" : "Reembolsable",
            ]}
          />
          <Legend
            formatter={(v) => (v === "total_facturado" ? "Facturado" : "Reembolsable")}
            iconType="rect"
            iconSize={10}
          />
          <Bar dataKey="total_facturado" fill={COLORS[0]} radius={[3, 3, 0, 0]} />
          <Bar dataKey="total_reembolsable" fill={COLORS[1]} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

// 2. Estado de rendiciones
interface EstadoRendicionesProps {
  data: RendicionEstadoRow[];
  loading: boolean;
  onNavigate: () => void;
}

export function BiEstadoRendicionesChart({ data, loading, onNavigate }: EstadoRendicionesProps) {
  const grouped = Object.entries(
    data.reduce<Record<string, number>>((acc, r) => {
      const k = r.estado_nombre ?? r.estado_codigo ?? "Desconocido";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  return (
    <ChartPanel
      title="Estado de rendiciones"
      loading={loading}
      empty={!loading && grouped.length === 0}
      onTitleClick={onNavigate}
    >
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={grouped}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
            onClick={onNavigate}
            style={{ cursor: "pointer" }}
          >
            {grouped.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => `${v} rendiciones`} />
          <Legend iconType="circle" iconSize={9} />
        </PieChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

// 3. Distribucion presupuestaria por proyecto
interface PresupuestoProyectoProps {
  data: EjecucionPresupuestariaRow[];
  loading: boolean;
  onNavigate: () => void;
}

export function BiPresupuestoProyectoChart({
  data,
  loading,
  onNavigate,
}: PresupuestoProyectoProps) {
  const grouped = Object.entries(
    data.reduce<Record<string, { presupuestado: number; ejecutado: number }>>((acc, r) => {
      const k = r.proyecto_nombre ?? "Sin proyecto";
      if (!acc[k]) acc[k] = { presupuestado: 0, ejecutado: 0 };
      acc[k].presupuestado += r.valor_presupuestado ?? 0;
      acc[k].ejecutado += r.ejecutado ?? 0;
      return acc;
    }, {}),
  )
    .map(([proyecto, vals]) => ({ proyecto, ...vals }))
    .sort((a, b) => b.ejecutado - a.ejecutado)
    .slice(0, 8);

  return (
    <ChartPanel
      title="Presupuesto vs ejecutado por proyecto"
      loading={loading}
      empty={!loading && grouped.length === 0}
      onTitleClick={onNavigate}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={grouped}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tickFormatter={tick} tick={{ fontSize: 10 }} width={56} />
          <YAxis type="category" dataKey="proyecto" tick={{ fontSize: 9 }} width={90} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Legend iconType="rect" iconSize={10} />
          <Bar
            dataKey="presupuestado"
            name="Presupuesto"
            fill={COLORS[2]}
            radius={[0, 3, 3, 0]}
            onClick={onNavigate}
            style={{ cursor: "pointer" }}
          />
          <Bar
            dataKey="ejecutado"
            name="Ejecutado"
            fill={COLORS[0]}
            radius={[0, 3, 3, 0]}
            onClick={onNavigate}
            style={{ cursor: "pointer" }}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

// 4. Top proveedores — acepta TopProveedorRow[] (campo total)
interface TopProveedoresProps {
  data: TopProveedorRow[];
  loading: boolean;
  onNavigate: () => void;
}

export function BiTopProveedoresChart({ data, loading, onNavigate }: TopProveedoresProps) {
  const chartData = data.slice(0, 8).map((p) => ({
    nombre: p.nombre && p.nombre.length > 22 ? p.nombre.slice(0, 20) + "..." : (p.nombre ?? "-"),
    total: p.total ?? 0,
  }));

  return (
    <ChartPanel
      title="Top proveedores por gasto"
      loading={loading}
      empty={!loading && chartData.length === 0}
      onTitleClick={onNavigate}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 40, left: 4, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tickFormatter={tick} tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="nombre" tick={{ fontSize: 9 }} width={90} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Bar
            dataKey="total"
            name="Total"
            fill={COLORS[3]}
            radius={[0, 3, 3, 0]}
            onClick={onNavigate}
            style={{ cursor: "pointer" }}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

// 5. Gasto por categoria — usa GastoCategoria[] de dashboard.ts
// Incluye "Vehiculo propio" y aplica filtro de politica
const RADIAN = Math.PI / 180;

function PieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
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

interface GastoCategoriaProps {
  data: GastoCategoria[];
  loading: boolean;
  onNavigate: () => void;
}

export function BiGastoCategoriaChart({ data, loading, onNavigate }: GastoCategoriaProps) {
  const top = data.filter((d) => d.total > 0).slice(0, 8);

  return (
    <ChartPanel
      title="Gasto por categoria"
      loading={loading}
      empty={!loading && top.length === 0}
      onTitleClick={onNavigate}
    >
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
              onClick={onNavigate}
              style={{ cursor: "pointer" }}
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
