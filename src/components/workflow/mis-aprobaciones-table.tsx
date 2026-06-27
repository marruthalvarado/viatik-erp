import { formatCurrency, formatDate } from "@/utils/formatters";
import { WorkflowBadge } from "./workflow-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { AprobacionPendiente } from "@/services/workflow-read";

interface MisAprobacionesTableProps {
  data: AprobacionPendiente[];
  loading: boolean;
  onVerDetalle?: (rendicionId: string) => void;
}

export function MisAprobacionesTable({ data, loading, onVerDetalle }: MisAprobacionesTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <p className="text-sm font-medium">Sin aprobaciones pendientes</p>
        <p className="mt-1 text-xs text-muted-foreground">
          No hay rendiciones esperando tu revisión en este momento.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-2 pr-4 font-medium text-muted-foreground">Número</th>
            <th className="pb-2 pr-4 font-medium text-muted-foreground">Viajero</th>
            <th className="pb-2 pr-4 font-medium text-muted-foreground">Paso</th>
            <th className="pb-2 pr-4 font-medium text-muted-foreground">Estado</th>
            <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Total</th>
            <th className="pb-2 pr-4 font-medium text-muted-foreground">Fecha</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.rendicion_id} className="group">
              <td className="py-3 pr-4">
                <span className="font-medium">{row.numero}</span>
              </td>
              <td className="py-3 pr-4">
                <span className="text-muted-foreground">{row.usuario_nombre ?? "—"}</span>
              </td>
              <td className="py-3 pr-4">
                <span className="text-muted-foreground">
                  {row.paso_nombre ?? `Paso ${row.paso_orden}`}
                </span>
              </td>
              <td className="py-3 pr-4">
                <WorkflowBadge estadoCodigo={row.estado_codigo} />
              </td>
              <td className="py-3 pr-4 text-right tabular-nums">
                {formatCurrency(row.total_facturado)}
              </td>
              <td className="py-3 pr-4 text-muted-foreground">
                {row.fecha_rendicion ? formatDate(row.fecha_rendicion) : "—"}
              </td>
              <td className="py-3">
                {onVerDetalle && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => onVerDetalle(row.rendicion_id)}
                    aria-label={`Ver detalle de rendición ${row.numero}`}
                  >
                    <ArrowRight className="size-3.5" />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
