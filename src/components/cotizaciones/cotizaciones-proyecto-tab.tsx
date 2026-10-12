/**
 * cotizaciones-proyecto-tab.tsx
 * Pestaña "Cotizaciones" dentro del detalle de un Proyecto.
 * Muestra la lista de cotizaciones vinculadas y permite crear una nueva
 * pre-seleccionando el proyecto.
 */
import { useState } from "react";
import { Plus, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCotizacionesByProyecto } from "@/hooks/entities/use-cotizaciones";
import { CotizacionForm } from "@/components/cotizaciones/cotizacion-form";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { EstadoCotizacion } from "@/services/cotizaciones";

interface Props {
  proyectoId: string;
}

const ESTADO_TONE: Record<EstadoCotizacion, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  borrador:  { label: "Borrador",  variant: "secondary" },
  enviada:   { label: "Enviada",   variant: "default" },
  aprobada:  { label: "Aprobada",  variant: "default" },
  rechazada: { label: "Rechazada", variant: "destructive" },
  vencida:   { label: "Vencida",   variant: "outline" },
};

export function CotizacionesProyectoTab({ proyectoId }: Props) {
  const { data: cotizaciones = [], isLoading } = useCotizacionesByProyecto(proyectoId);
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {cotizaciones.length === 0
            ? "Sin cotizaciones vinculadas"
            : `${cotizaciones.length} cotización${cotizaciones.length > 1 ? "es" : ""}`}
        </p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setFormOpen(true)}>
          <Plus className="size-3.5" />
          Nueva cotización
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground animate-pulse">Cargando…</p>
      )}

      {!isLoading && cotizaciones.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
          <FileText className="size-8 opacity-30" />
          <p className="text-sm">No hay cotizaciones para este proyecto.</p>
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setFormOpen(true)}>
            <Plus className="size-3.5" />
            Crear primera cotización
          </Button>
        </div>
      )}

      {cotizaciones.length > 0 && (
        <ul className="space-y-2">
          {cotizaciones.map((cot, idx) => {
            const isLatest = idx === 0;
            const estadoInfo = ESTADO_TONE[cot.estado as EstadoCotizacion] ?? { label: cot.estado, variant: "secondary" as const };
            return (
              <li
                key={cot.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-medium">{cot.numero}</span>
                      {isLatest && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">Última</Badge>
                      )}
                      <Badge variant={estadoInfo.variant} className="text-[10px] px-1.5 py-0">
                        {estadoInfo.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {cot.razon_social} · {formatDate(cot.fecha)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-medium text-sm">{formatCurrency(cot.total)}</span>
                  <a
                    href={`/cotizaciones?id=${cot.id}`}
                    className="text-muted-foreground hover:text-foreground"
                    title="Ver cotización"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Formulario nueva cotización pre-vinculada al proyecto */}
      <CotizacionForm
        open={formOpen}
        defaultProyectoId={proyectoId}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}
