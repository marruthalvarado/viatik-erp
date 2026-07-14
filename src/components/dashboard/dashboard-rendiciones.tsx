/**
 * Tabla de rendiciones pendientes con drill-down hacia el módulo Rendiciones.
 */
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { estadoTone } from "@/components/rendiciones/rendicion-types";
import type { RendicionPendiente } from "@/services/dashboard";

interface DashboardRendicionesProps {
  data: RendicionPendiente[];
  loading: boolean;
  onNavigate?: () => void;
}

export function DashboardRendiciones({ data, loading, onNavigate }: DashboardRendicionesProps) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Rendiciones pendientes</h2>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onNavigate}>
          Ver todas
          <ExternalLink className="size-3" />
        </Button>
      </div>

      {loading ? (
        <LoadingState label="Cargando..." />
      ) : data.length === 0 ? (
        <EmptyState title="Sin rendiciones pendientes" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Número</th>
                <th className="pb-2 pr-4 font-medium">Proyecto</th>
                <th className="pb-2 pr-4 font-medium">Viajero</th>
                <th className="pb-2 pr-4 font-medium">Fecha</th>
                <th className="pb-2 pr-4 font-medium text-right">Total</th>
                <th className="pb-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-4 font-mono text-xs font-medium">{r.numero}</td>
                  <td className="py-2 pr-4 max-w-[180px] truncate text-muted-foreground">
                    {r.proyecto_nombre ?? "—"}
                  </td>
                  <td className="py-2 pr-4 max-w-[160px] truncate">{r.usuario_nombre ?? "—"}</td>
                  <td className="py-2 pr-4 tabular-nums text-xs">
                    {formatDate(r.fecha_rendicion)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums font-semibold">
                    {formatCurrency(r.total_facturado)}
                  </td>
                  <td className="py-2">
                    <StatusBadge tone={estadoTone(r.estado_codigo)}>
                      {r.estado_nombre ?? "—"}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}