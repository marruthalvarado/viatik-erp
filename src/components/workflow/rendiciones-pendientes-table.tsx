/**
 * rendiciones-pendientes-table.tsx
 * Tabla de rendiciones pendientes de aprobacion directa.
 */

import { Eye, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RendicionPendiente } from "@/services/rendicion-aprobacion";

const FMT_MONEDA = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

function formatDate(s: string | null | undefined): string {
  if (!s) return "-";
  return new Date(s).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface Props {
  data: RendicionPendiente[];
  loading: boolean;
  onVerDetalle: (rendicionId: string) => void;
}

export function RendicionesPendientesTable({ data, loading, onVerDetalle }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Numero</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Enviada</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Anticipos</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Diferencia</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((r) => {
            const anticipos = (r.anticipo_efectivo ?? 0) + (r.anticipo_credito ?? 0);
            const diferencia = (r.total_facturado ?? 0) - anticipos;

            return (
              <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="size-3.5 text-warning shrink-0" />
                    {r.numero}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(r.fecha_envio)}</td>
                <td className="px-4 py-3 text-right font-medium">
                  {FMT_MONEDA.format(r.total_facturado ?? 0)}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {FMT_MONEDA.format(anticipos)}
                </td>
                <td
                  className={[
                    "px-4 py-3 text-right font-medium",
                    diferencia > 0 ? "text-destructive" : "text-success",
                  ].join(" ")}
                >
                  {FMT_MONEDA.format(diferencia)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => onVerDetalle(r.id)}
                  >
                    <Eye className="size-3.5" />
                    Revisar
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
