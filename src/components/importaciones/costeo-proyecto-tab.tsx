/**
 * costeo-proyecto-tab.tsx
 * Pestaña "Costeo" dentro del detalle de un Proyecto.
 * Muestra el/los costeos de proyecto vinculados y permite crear uno nuevo.
 */
import { useState } from "react";
import { Plus, FolderKanban, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";
import { useCosteosByProyecto } from "@/hooks/entities/use-costeos-proyecto";
import { CosteoProyectoForm }   from "./costeo-proyecto-form";
import { CosteoProyectoDetalle } from "./costeo-proyecto-detalle";
import type { CosteoProyectoConItems } from "@/services/costeos-proyecto";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

interface Props {
  proyectoId: string;
}

export function CosteoProyectoTab({ proyectoId }: Props) {
  const { data: costeos = [], isLoading } = useCosteosByProyecto(proyectoId);
  const [formOpen, setFormOpen]   = useState(false);
  const [detalle, setDetalle]     = useState<CosteoProyectoConItems | null>(null);
  const [editando, setEditando]   = useState<CosteoProyectoConItems | null>(null);
  const [editOpen, setEditOpen]   = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {costeos.length === 0
            ? "Sin costeos de proyecto"
            : `${costeos.length} costeo${costeos.length > 1 ? "s" : ""}`}
        </p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setFormOpen(true)}>
          <Plus className="size-3.5" />
          Nuevo costeo
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground animate-pulse">Cargando…</p>}

      {!isLoading && costeos.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
          <FolderKanban className="size-8 opacity-30" />
          <p className="text-sm">No hay costeos para este proyecto.</p>
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setFormOpen(true)}>
            <Plus className="size-3.5" />
            Crear costeo de proyecto
          </Button>
        </div>
      )}

      {costeos.length > 0 && (
        <ul className="space-y-2">
          {costeos.map((cp, idx) => {
            const isLatest = idx === 0;
            return (
              <li
                key={cp.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors cursor-pointer"
                onClick={() => setDetalle(cp)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-medium">{cp.numero}</span>
                      {isLatest && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">Último</Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cp.estado === "finalizado"
                          ? "bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0"
                          : "bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px] px-1.5 py-0"
                        }
                      >
                        {cp.estado === "finalizado" ? "Finalizado" : "Borrador"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{cp.descripcion}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-right">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Aterrizaje</p>
                    <p className="text-sm font-medium text-orange-700">{fmt(cp.total_costo_aterrizaje)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">PVP sugerido</p>
                    <p className="text-sm font-semibold text-green-700">{fmt(cp.total_precio_venta)}</p>
                  </div>
                  <TrendingUp className="size-3.5 text-muted-foreground" />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Crear nuevo vinculado al proyecto */}
      <CosteoProyectoForm
        open={formOpen}
        defaultProyectoId={proyectoId}
        onClose={() => setFormOpen(false)}
      />

      {/* Editar */}
      <CosteoProyectoForm
        open={editOpen}
        costeo={editando}
        onClose={() => { setEditOpen(false); setEditando(null); }}
      />

      {/* Detalle */}
      {detalle && (
        <CosteoProyectoDetalle
          open={!!detalle}
          costeo={detalle}
          onClose={() => setDetalle(null)}
          onEdit={() => {
            setEditando(detalle);
            setDetalle(null);
            setEditOpen(true);
          }}
        />
      )}
    </div>
  );
}
