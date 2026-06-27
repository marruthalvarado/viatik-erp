/**
 * notification-bell.tsx — FASE 9A
 *
 * Botón campana con badge de no leídas.
 * Abre NotificationPanel en un Popover.
 * Se integra en el SidebarHeader de app-sidebar.tsx.
 */
import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useConteoNoLeidas } from "@/hooks/entities/use-notifications";
import { NotificationBadge } from "./notification-badge";
import { NotificationPanel } from "./notification-panel";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: conteo = 0 } = useConteoNoLeidas();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8 shrink-0"
          aria-label={`Notificaciones${conteo > 0 ? ` — ${conteo} sin leer` : ""}`}
        >
          <Bell className="size-4" aria-hidden="true" />
          <NotificationBadge count={conteo} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="right"
        sideOffset={8}
        className="w-[380px] p-0"
        style={{
          maxHeight: "min(520px, calc(100vh - 80px))",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <NotificationPanel />
      </PopoverContent>
    </Popover>
  );
}
