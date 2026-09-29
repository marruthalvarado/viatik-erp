/**
 * Componente: Checklist de actividades de una orden de servicio
 * Permite marcar actividades como completadas y agregar observaciones.
 */
import { useState } from "react";
import { Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useOrdenActividades,
  useActualizarActividad,
  useCrearActividadManual,
  useEliminarActividad,
} from "@/hooks/entities/use-servicio-tecnico";

interface Props {
  ordenId: string;
}

export function ActividadesChecklist({ ordenId }: Props) {
  const { data: actividades = [], isLoading } = useOrdenActividades(ordenId);
  const updateMut = useActualizarActividad();
  const crearMut = useCrearActividadManual();
  const eliminarMut = useEliminarActividad();

  const [nuevaNombre, setNuevaNombre] = useState("");
  const [expandida, setExpandida] = useState<string | null>(null);

  const toggleCompletada = (id: string, completada: boolean) => {
    updateMut.mutate({ id, payload: { completada: !completada } });
  };

  const guardarObservacion = (id: string, obs: string) => {
    updateMut.mutate({ id, payload: { observacion: obs || null } });
  };

  const agregar = () => {
    if (!nuevaNombre.trim()) return;
    crearMut.mutate({ orden_id: ordenId, nombre: nuevaNombre.trim() });
    setNuevaNombre("");
  };

  const completadas = actividades.filter((a) => a.completada).length;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actividades.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {completadas}/{actividades.length} completadas
          </span>
          <div className="h-1.5 flex-1 mx-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${actividades.length ? (completadas / actividades.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-1">
        {actividades.map((act) => (
          <div key={act.id} className="border rounded-lg overflow-hidden">
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50"
              onClick={() => setExpandida(expandida === act.id ? null : act.id)}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCompletada(act.id, act.completada);
                }}
                className="shrink-0"
              >
                {act.completada ? (
                  <CheckCircle2 className="size-4 text-green-600" />
                ) : (
                  <Circle className="size-4 text-muted-foreground" />
                )}
              </button>

              <span className={`flex-1 text-sm ${act.completada ? "line-through text-muted-foreground" : ""}`}>
                {act.nombre}
              </span>

              {act.observacion && (
                <Badge variant="secondary" className="text-xs shrink-0">obs.</Badge>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  eliminarMut.mutate(act.id);
                }}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </div>

            {expandida === act.id && (
              <div className="px-3 pb-3 pt-1 bg-muted/20 border-t space-y-2">
                {act.descripcion && (
                  <p className="text-xs text-muted-foreground">{act.descripcion}</p>
                )}
                <Textarea
                  placeholder="Observación del técnico…"
                  defaultValue={act.observacion ?? ""}
                  rows={2}
                  className="text-sm"
                  onBlur={(e) => guardarObservacion(act.id, e.target.value)}
                />
              </div>
            )}
          </div>
        ))}

        {actividades.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">
            Sin actividades. Agrega una manualmente o carga desde plantillas.
          </p>
        )}
      </div>

      {/* Agregar actividad manual */}
      <div className="flex gap-2">
        <Input
          value={nuevaNombre}
          onChange={(e) => setNuevaNombre(e.target.value)}
          placeholder="Nueva actividad…"
          className="text-sm"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), agregar())}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={agregar}
          disabled={!nuevaNombre.trim() || crearMut.isPending}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
