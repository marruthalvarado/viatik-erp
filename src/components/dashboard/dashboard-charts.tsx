/**
 * Gráficos del Dashboard Ejecutivo:
 * - Evolución financiera mensual: Ingresos (line) vs Costos empresa + Viáticos (bars apiladas)
 * - Resumen por proyecto: tabla con Facturado / Gastos / Margen
 * - Gastos por categoría (PieChart)
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
  ComposedChart,
  Line,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/utils/formatters";
import type {
  EvolucionMensual,
  EvolucionFinanciera,
  GastoCategoria,
  DashboardProyecto,
  DashboardCliente,
  ResumenFinancieroProyecto,
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

// Color fijo para la categoría de vehículo propio (km reembolsables)
const COLOR_KM_VEHICULO = "#f97316"; // orange

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

// ─── Evolución financiera: Ingresos vs Costos ─────────────────────────────────

interface EvolucionFinancieraChartProps {
  data: EvolucionFinanciera[];
  loading: boolean;
  anio: number;
}

export function EvolucionFinancieraChart({ data, loading, anio }: EvolucionFinancieraChartProps) {
  const hasData = data.some(
    (d) => d.ingresos > 0 || d.costos_empresa > 0 || d.costos_viaticos > 0,
  );

  const totalIngresos = data.reduce((s, d) => s + d.ingresos, 0);
  const totalCostosEmpresa = data.reduce((s, d) => s + d.costos_empresa, 0);
  const totalViaticos = data.reduce((s, d) => s + d.costos_viaticos, 0);
  const totalMargen = totalIngresos - totalCostosEmpresa - totalViaticos;
  const margenPositivo = totalMargen >= 0;

  return (
    <ChartPanel
      title={`Evolución financiera ${anio}`}
      loading={loading}
      empty={!loading && !hasData}
    >
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={currencyTick} tick={{ fontSize: 11 }} width={60} />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatCurrency(value),
              name === "ingresos"
                ? "Ingresos"
                : name === "costos_empresa"
                  ? "Gastos empresa"
                  : name === "costos_viaticos"
                    ? "Viáticos"
                    : name,
            ]}
          />
          <Legend
            formatter={(v) =>
              v === "ingresos"
                ? "Ingresos"
                : v === "costos_empresa"
                  ? "Gastos empresa"
                  : v === "costos_viaticos"
                    ? "Viáticos"
                    : v
            }
            wrapperStyle={{ fontSize: 11 }}
          />
          <Bar
            dataKey="costos_empresa"
            stackId="costos"
            fill="#6366f1"
            name="costos_empresa"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="costos_viaticos"
            stackId="costos"
            fill="#f59e0b"
            name="costos_viaticos"
            radius={[3, 3, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="ingresos"
            name="ingresos"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#10b981" }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Resumen totales del año */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground border-t pt-2">
        <span>
          <span className="inline-block size-2 rounded-full bg-emerald-500 mr-1 align-middle" />
          Ingresos: <span className="font-medium text-foreground">{formatCurrency(totalIngresos)}</span>
        </span>
        <span>
          <span className="inline-block size-2 rounded-full bg-indigo-500 mr-1 align-middle" />
          Gastos empresa: <span className="font-medium text-foreground">{formatCurrency(totalCostosEmpresa)}</span>
        </span>
        <span>
          <span className="inline-block size-2 rounded-full bg-amber-500 mr-1 align-middle" />
          Viáticos: <span className="font-medium text-foreground">{formatCurrency(totalViaticos)}</span>
        </span>
        <span className={margenPositivo ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
          {margenPositivo ? "▲" : "▼"} Margen: {formatCurrency(Math.abs(totalMargen))}
        </span>
      </div>
    </ChartPanel>
  );
}

// Evolucion mensual (legacy — se mantiene para backward compatibility)

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
              name === "total_facturado"
                ? "Facturado"
                : name === "total_reembolsable"
                  ? "Reembolsable"
                  : "Km Vehículo",
            ]}
          />
          <Legend
            formatter={(v) =>
              v === "total_facturado"
                ? "Facturado"
                : v === "total_reembolsable"
                  ? "Reembolsable"
                  : "Km Vehículo"
            }
            wrapperStyle={{ fontSize: 11 }}
          />
          <Bar dataKey="total_facturado" fill={COLORS[0]} radius={[3, 3, 0, 0]} />
          <Bar dataKey="total_reembolsable" fill={COLORS[1]} radius={[3, 3, 0, 0]} />
          <Bar dataKey="total_km_vehiculo" fill={COLOR_KM_VEHICULO} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

// Contrato vs Ejecutado por proyecto (tabla con indicadores)

interface ResumenProyectosChartProps {
  data: ResumenFinancieroProyecto[];
  loading: boolean;
}

export function ResumenProyectosChart({ data, loading }: ResumenProyectosChartProps) {
  const rows = data
    .filter((p) => p.facturado > 0 || p.ejecutado > 0 || p.valor_contrato > 0)
    .slice(0, 8);

  return (
    <ChartPanel
      title="Rentabilidad por proyecto"
      loading={loading}
      empty={!loading && rows.length === 0}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="pb-2 text-left font-medium pr-2">Proyecto</th>
              <th className="pb-2 text-right font-medium pr-2 tabular-nums">Facturado</th>
              <th className="pb-2 text-right font-medium pr-2 tabular-nums">Gastos</th>
              <th className="pb-2 text-right font-medium tabular-nums">Margen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((p) => {
              const margen = p.facturado > 0
                ? p.facturado - p.ejecutado
                : p.ganancia;
              const margenPos = margen >= 0;
              const pct = p.facturado > 0
                ? Math.round((margen / p.facturado) * 100)
                : p.valor_contrato > 0
                  ? Math.round((p.ganancia / p.valor_contrato) * 100)
                  : null;

              return (
                <tr key={p.proyecto_id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2 pr-2">
                    <span className="truncate block max-w-[130px] font-medium" title={p.nombre}>
                      {p.nombre}
                    </span>
                    {p.cliente_nombre && (
                      <span className="text-[10px] text-muted-foreground">{p.cliente_nombre}</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-foreground">
                    {formatCurrency(p.facturado > 0 ? p.facturado : p.valor_contrato)}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-foreground">
                    {formatCurrency(p.ejecutado)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    <span
                      className={`flex items-center justify-end gap-0.5 font-medium ${margenPos ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {margenPos ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      {pct !== null ? `${pct}%` : formatCurrency(Math.abs(margen))}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ChartPanel>
  );
}

// Kept for backward compatibility (unused but avoids import errors)
interface PresupuestoChartProps {
  data: DashboardProyecto[];
  loading: boolean;
}

export function PresupuestoEjecutadoChart(_props: PresupuestoChartProps) {
  return null;
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
              {top.map((cat, i) => (
                <Cell
                  key={i}
                  fill={
                    cat.categoria_id === "__vehiculo_propio__"
                      ? COLOR_KM_VEHICULO
                      : COLORS[i % COLORS.length]
                  }
                />
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
                style={{
                  background:
                    cat.categoria_id === "__vehiculo_propio__"
                      ? COLOR_KM_VEHICULO
                      : COLORS[i % COLORS.length],
                }}
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
