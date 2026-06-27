/**
 * notification-empty.tsx — FASE 9A
 *
 * Estado vacío del panel de notificaciones.
 */
import { BellOff } from "lucide-react";

interface NotificationEmptyProps {
  soloNoLeidas: boolean;
}

export function NotificationEmpty({ soloNoLeidas }: NotificationEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <BellOff className="size-8 text-muted-foreground/50" aria-hidden="true" />
      <p className="text-sm font-medium text-muted-foreground">
        {soloNoLeidas ? "No tienes notificaciones pendientes" : "Sin notificaciones"}
      </p>
      <p className="text-xs text-muted-foreground/70">
        {soloNoLeidas
          ? "Todas las notificaciones están al día."
          : "Las notificaciones aparecerán aquí cuando haya actividad."}
      </p>
    </div>
  );
}
