/**
 * Tab Empleados — Reportes Operativos
 * Muestra gasto total y número de rendiciones por empleado (ingeniero/viajero).
 */
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/utils/formatters";
import type { TopViajero } from "@/services/dashboard";

interface ReporteEmpleadosProps {
  data: TopViajero[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

export function ReporteEmpleados({ data, loading, error, onRetry }: ReporteEmpleadosProps) {
  if (loading) return <LoadingState label="Cargando empleados..." />;

  if (error) {
    return (
      <EmptyState
        icon={Users}
        title="Error al cargar"
        description={error.message}
        action={<Button variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>}
      />
    );
  }

  if (!data.length) {
    return (
      <EmptyState
        icon={Users}
        title="Sin datos"
        description="No hay rendiciones registradas en el período seleccionado."
      />
    );
  }

  const totalGastado = data.reduce((s, d) => s + d.total_gastado, 0);
  const totalRendiciones = data.reduce((s, d) => s + d.total_rendiciones, 0);

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Empleados activos</p>
          <p className="mt-1 text-2xl font-semibold">{data.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total rendiciones</p>
          <p className="mt-1 text-2xl font-semibold">{totalRendiciones}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total gastos viáticos</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(totalGastado)}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">#</th>
              <th className="px-4 py-3 text-left font-medium">Empleado</th>
              <th className="px-4 py-3 text-right font-medium">Rendiciones</th>
              <th className="px-4 py-3 text-right font-medium">Total gastado</th>
              <th className="px-4 py-3 text-right font-medium">Promedio / rendición</th>
              <th className="px-4 py-3 text-right font-medium">% del total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const promedio = row.total_rendiciones > 0 ? row.total_gastado / row.total_rendiciones : 0;
              const pct = totalGastado > 0 ? (row.total_gastado / totalGastado) * 100 : 0;
              return (
                <tr key={row.usuario_id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium">{row.nombre}</td>
                  <td className="px-4 py-2.5 text-right">{row.total_rendiciones}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(row.total_gastado)}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{formatCurrency(promedio)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground text-xs w-10 text-right">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/30 font-semibold">
              <td className="px-4 py-3" colSpan={2}>Total</td>
              <td className="px-4 py-3 text-right">{totalRendiciones}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(totalGastado)}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {totalRendiciones > 0 ? formatCurrency(totalGastado / totalRendiciones) : "—"}
              </td>
              <td className="px-4 py-3 text-right">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
