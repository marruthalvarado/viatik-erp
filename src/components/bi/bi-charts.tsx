/**
 * Gráficos del Dashboard Ejecutivo BI.
 *
 * Charts implementados:
 *   · Evolución mensual de gastos (BarChart)
 *   · Estado de rendiciones (PieChart / donut)
 *   · Distribución presupuestaria por proyecto (BarChart horizontal)
 *   · Top proveedores por gasto (BarChart horizontal)
 *   · Gasto por categoría — derivado de ejecución presupuestaria (PieChart)
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
  EvolucionMensualRow,
  EjecucionPresupuestariaRow,
  TopProveedorRow,
  RendicionEstadoRow,
} from "@/types/reportes";

// ─── Paleta ────────────────────────────────────────────────────────────────────

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

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
        <EmptyState title="Sin datos para el período" />
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

// ─── 1. Evolución mensual ──────────────────────────────────────────────────────

interface EvolucionProps {
  data: EvolucionMensualRow[];
  loading: boolean;
  anio: number;
}

export function BiEvolucionMensualChart({ data, loading, anio }: EvolucionProps) {
  return (
    <ChartPanel
      title={`Evolución mensual ${anio}`}
      loading={loading}
      empty={!loading && data.length === 0}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={tick} tick={{ fontSize: 10 }} width={56} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Legend iconType="rect" iconSize={10} />
          <Bar dataKey="facturado" name="Facturado" fill={COLORS[0]} radius={[3, 3, 0, 0]} />
          <Bar dataKey="reembolsable" name="Reembolsable" fill={COLORS[1]} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

// ─── 2. Estado de rendiciones (donut) ─────────────────────────────────────────

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

// ─── 3. Distribución presupuestaria por proyecto ──────────────────────────────

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
            fill={COLORS[1]}
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

// ─── 4. Top proveedores ────────────────────────────────────────────────────────

interface TopProveedoresProps {
  data: TopProveedorRow[];
  loading: boolean;
  onNavigate: () => void;
}

export function BiTopProveedoresChart({ data, loading, onNavigate }: TopProveedoresProps) {
  const chartData = data.slice(0, 8).map((p) => ({ nombre: p.nombre, total: p.total }));

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
          margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tickFormatter={tick} tick={{ fontSize: 10 }} width={56} />
          <YAxis type="category" dataKey="nombre" tick={{ fontSize: 9 }} width={90} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Bar
            dataKey="total"
            name="Total"
            fill={COLORS[2]}
            radius={[0, 3, 3, 0]}
            onClick={onNavigate}
            style={{ cursor: "pointer" }}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

// ─── 5. Gasto por categoría ───────────────────────────────────────────────────

interface GastoCategoriaProps {
  data: EjecucionPresupuestariaRow[];
  loading: boolean;
  onNavigate: () => void;
}

export function BiGastoCategoriaChart({ data, loading, onNavigate }: GastoCategoriaProps) {
  const grouped = Object.entries(
    data.reduce<Record<string, number>>((acc, r) => {
      const k = r.categoria_nombre ?? "Sin categoría";
      acc[k] = (acc[k] ?? 0) + (r.ejecutado ?? 0);
      return acc;
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <ChartPanel
      title="Gasto por categoría"
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
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Legend iconType="circle" iconSize={9} />
        </PieChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
