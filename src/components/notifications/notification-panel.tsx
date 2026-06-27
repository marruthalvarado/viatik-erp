/**
 * notification-panel.tsx — FASE 9A
 *
 * Panel desplegable con listado de notificaciones.
 * Agrupación por fecha, filtro no-leídas, marcar todas.
 * Consumido por NotificationBell.
 */
import { useState, useMemo } from "react";
import { CheckCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useNotificaciones,
  useMarcarLeida,
  useMarcarTodasLeidas,
  useEliminarNotificacion,
} from "@/hooks/entities/use-notifications";
import { NotificationItem } from "./notification-item";
import { NotificationEmpty } from "./notification-empty";
import type { Notificacion } from "@/services/notifications/notifications-read";

// ---------------------------------------------------------------------------
// Agrupación por fecha
// ---------------------------------------------------------------------------

function agruparPorFecha(items: Notificacion[]): Map<string, Notificacion[]> {
  const grupos = new Map<string, Notificacion[]>();
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);

  for (const item of items) {
    const d = new Date(item.created_at);
    let etiqueta: string;

    if (d.toDateString() === hoy.toDateString()) {
      etiqueta = "Hoy";
    } else if (d.toDateString() === ayer.toDateString()) {
      etiqueta = "Ayer";
    } else {
      etiqueta = d.toLocaleDateString("es-EC", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      etiqueta = etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
    }

    const grupo = grupos.get(etiqueta) ?? [];
    grupo.push(item);
    grupos.set(etiqueta, grupo);
  }

  return grupos;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function NotificationPanel() {
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);

  const {
    data: notificaciones = [],
    isLoading,
    refetch,
    isFetching,
  } = useNotificaciones({
    soloNoLeidas,
    limite: 80,
  });

  const marcarLeida = useMarcarLeida();
  const marcarTodas = useMarcarTodasLeidas();
  const eliminar = useEliminarNotificacion();

  const noLeidas = useMemo(() => notificaciones.filter((n) => !n.leida).length, [notificaciones]);

  const grupos = useMemo(() => agruparPorFecha(notificaciones), [notificaciones]);

  function handleMarcarLeida(id: string) {
    marcarLeida.mutate(id);
  }

  function handleEliminar(id: string) {
    eliminar.mutate(id);
  }

  function handleMarcarTodas() {
    marcarTodas.mutate();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Notificaciones</h2>
          {noLeidas > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {noLeidas}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label="Actualizar notificaciones"
          >
            <RefreshCw
              className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </Button>
          {noLeidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={handleMarcarTodas}
              disabled={marcarTodas.isPending}
              aria-label="Marcar todas como leídas"
            >
              <CheckCheck className="size-3.5" aria-hidden="true" />
              Leer todas
            </Button>
          )}
        </div>
      </div>

      {/* Filtro */}
      <div className="flex gap-1 px-4 pb-2">
        <Button
          variant={soloNoLeidas ? "default" : "outline"}
          size="sm"
          className="h-6 rounded-full text-xs"
          onClick={() => setSoloNoLeidas(false)}
        >
          Todas
        </Button>
        <Button
          variant={soloNoLeidas ? "outline" : "default"}
          size="sm"
          className="h-6 rounded-full text-xs"
          onClick={() => setSoloNoLeidas(true)}
        >
          No leídas
        </Button>
      </div>

      <Separator />

      {/* Listado */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex flex-col gap-2 px-4 py-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="size-8 animate-pulse rounded-md bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : notificaciones.length === 0 ? (
          <NotificationEmpty soloNoLeidas={soloNoLeidas} />
        ) : (
          Array.from(grupos.entries()).map(([fecha, items]) => (
            <div key={fecha}>
              <p className="sticky top-0 bg-background px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {fecha}
              </p>
              {items.map((n) => (
                <NotificationItem
                  key={n.id}
                  notificacion={n}
                  onMarcarLeida={handleMarcarLeida}
                  onEliminar={handleEliminar}
                  isMarkingRead={marcarLeida.isPending}
                />
              ))}
              <Separator className="my-0.5" />
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
