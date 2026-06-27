/**
 * Reporte de Clientes (agregado por proyecto).
 * Consume: useRptEjecucionPresupuestaria + useRptViajesDetalle + useRptGastosDetalle (FASE 8A)
 * Nota: la infraestructura 8A no expone campo cliente_nombre directamente;
 *       se agrupa por proyecto_nombre como mejor proxy disponible.
 */
import { Users2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/utils/formatters";
import type {
  EjecucionPresupuestariaRow,
  ViajeDetalleRow,
  GastoDetalleRow,
} from "@/types/reportes";

interface ReporteClientesProps {
  ejecucion: EjecucionPresupuestariaRow[];
  viajes: ViajeDetalleRow[];
  gastos: GastoDetalleRow[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

function tick(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
}

export function ReporteClientes({
  ejecucion,
  viajes,
  gastos,
  loading,
  error,
  onRetry,
}: ReporteClientesProps) {
  if (loading) return <LoadingState label="Cargando datos de clientes..." />;

  if (error) {
    return (
      <EmptyState
        title="Error al cargar clientes"
        description={error.message}
        action={
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-label="Reintentar carga de clientes"
          >
            Reintentar
          </button>
        }
      />
    );
  }

  // Viajes por proyecto
  const viajesPorProyecto = viajes.reduce<Record<string, number>>((acc, v) => {
    const k = v.proyecto_nombre ?? "Sin proyecto";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  // Gastos por proyecto
  const gastosPorProyecto = gastos.reduce<Record<string, number>>((acc, g) => {
    const k = g.proyecto_nombre ?? "Sin proyecto";
    acc[k] = (acc[k] ?? 0) + (g.valor_factura ?? 0);
    return acc;
  }, {});

  // Presupuesto/ejecutado por proyecto desde ejecucion
  const ejecucionPorProyecto = ejecucion.reduce<
    Record<string, { presupuestado: number; ejecutado: number }>
  >((acc, r) => {
    const k = r.proyecto_nombre ?? "Sin proyecto";
    if (!acc[k]) acc[k] = { presupuestado: 0, ejecutado: 0 };
    acc[k].presupuestado += r.valor_presupuestado ?? 0;
    acc[k].ejecutado += r.ejecutado ?? 0;
    return acc;
  }, {});

  // Merge y ranking
  const proyectos = Array.from(
    new Set([
      ...Object.keys(viajesPorProyecto),
      ...Object.keys(gastosPorProyecto),
      ...Object.keys(ejecucionPorProyecto),
    ]),
  )
    .map((nombre) => ({
      nombre,
      viajes: viajesPorProyecto[nombre] ?? 0,
      gastos: gastosPorProyecto[nombre] ?? 0,
      presupuestado: ejecucionPorProyecto[nombre]?.presupuestado ?? 0,
      ejecutado: ejecucionPorProyecto[nombre]?.ejecutado ?? 0,
    }))
    .sort((a, b) => b.gastos - a.gastos);

  if (proyectos.length === 0) {
    return (
      <EmptyState
        icon={Users2}
        title="Sin datos de clientes"
        description="No hay datos de proyectos/clientes en el periodo seleccionado."
      />
    );
  }

  const totalGastos = proyectos.reduce((s, p) => s + p.gastos, 0);
  const chartData = proyectos.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Nota informativa */}
      <p className="text-xs text-muted-foreground">
        Datos agrupados por proyecto. La asociacion directa cliente-gasto esta disponible en
        versiones futuras del modulo.
      </p>

      {/* Grafico ranking */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">
          Gasto por proyecto — ranking (top {Math.min(chartData.length, 10)})
        </h2>
        <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 34)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tickFormatter={tick} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="nombre" tick={{ fontSize: 9 }} width={110} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar
              dataKey="gastos"
              name="Gasto total"
              fill="hsl(var(--chart-2))"
              radius={[0, 3, 3, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Tabla detalle */}
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">#</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Proyecto
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Viajes</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Gasto total
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Presupuesto
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Ejecutado
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  % del total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {proyectos.map((p, i) => (
                <tr key={p.nombre} className="hover:bg-muted/30">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{p.nombre}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {p.viajes}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.gastos)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(p.presupuestado)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(p.ejecutado)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {totalGastos > 0 ? `${((p.gastos / totalGastos) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-medium">
                <td className="px-3 py-2" />
                <td className="px-3 py-2">Total ({proyectos.length} proyectos)</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {proyectos.reduce((s, p) => s + p.viajes, 0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totalGastos)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(proyectos.reduce((s, p) => s + p.presupuestado, 0))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(proyectos.reduce((s, p) => s + p.ejecutado, 0))}
                </td>
                <td className="px-3 py-2 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
