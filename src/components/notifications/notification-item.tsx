/**
 * notification-item.tsx — FASE 9A
 *
 * Fila individual de notificación.
 * Iconos por tipo, indicador de prioridad, marcar leída, eliminar, navegar.
 */
import { useNavigate } from "@tanstack/react-router";
import {
  GitBranch,
  Wallet,
  ScanText,
  ShieldAlert,
  Sparkles,
  Settings,
  Plane,
  Receipt,
  X,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  Notificacion,
  NotificacionTipo,
  NotificacionPrioridad,
} from "@/services/notifications/notifications-read";

// ---------------------------------------------------------------------------
// Configuración de iconos por tipo
// ---------------------------------------------------------------------------

const TIPO_CONFIG: Record<
  NotificacionTipo,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  workflow: { icon: GitBranch, color: "text-violet-500", label: "Workflow" },
  presupuesto: { icon: Wallet, color: "text-emerald-500", label: "Presupuesto" },
  ocr: { icon: ScanText, color: "text-blue-500", label: "OCR" },
  politica: { icon: ShieldAlert, color: "text-orange-500", label: "Política" },
  ia: { icon: Sparkles, color: "text-pink-500", label: "IA" },
  sistema: { icon: Settings, color: "text-gray-500", label: "Sistema" },
  viajes: { icon: Plane, color: "text-sky-500", label: "Viajes" },
  rendiciones: { icon: Receipt, color: "text-amber-500", label: "Rendiciones" },
};

// ---------------------------------------------------------------------------
// Indicador de prioridad
// ---------------------------------------------------------------------------

const PRIORIDAD_COLOR: Record<NotificacionPrioridad, string> = {
  alta: "text-destructive",
  media: "text-amber-500",
  baja: "text-muted-foreground",
};

// ---------------------------------------------------------------------------
// Helper: tiempo relativo
// ---------------------------------------------------------------------------

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NotificationItemProps {
  notificacion: Notificacion;
  onMarcarLeida: (id: string) => void;
  onEliminar: (id: string) => void;
  isMarkingRead?: boolean;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function NotificationItem({
  notificacion,
  onMarcarLeida,
  onEliminar,
  isMarkingRead = false,
}: NotificationItemProps) {
  const navigate = useNavigate();
  const cfg = TIPO_CONFIG[notificacion.tipo] ?? TIPO_CONFIG.sistema;
  const Icon = cfg.icon;

  function handleClick() {
    if (!notificacion.leida) onMarcarLeida(notificacion.id);
    if (notificacion.url_destino) {
      void navigate({ to: notificacion.url_destino as "/" });
    }
  }

  function handleEliminar(e: React.MouseEvent) {
    e.stopPropagation();
    onEliminar(notificacion.id);
  }

  function handleMarcarLeida(e: React.MouseEvent) {
    e.stopPropagation();
    onMarcarLeida(notificacion.id);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      className={`group relative flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
        notificacion.leida ? "opacity-60" : ""
      }`}
      aria-label={`Notificación: ${notificacion.titulo}`}
    >
      {/* Dot indicador no leída */}
      {!notificacion.leida && (
        <span
          className="absolute left-1.5 top-4 size-1.5 rounded-full bg-primary"
          aria-hidden="true"
        />
      )}

      {/* Icono tipo */}
      <div className="mt-0.5 shrink-0">
        <div className="flex size-8 items-center justify-center rounded-md bg-muted">
          <Icon className={`size-4 ${cfg.color}`} aria-label={cfg.label} />
        </div>
      </div>

      {/* Contenido */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-1">
          <p
            className={`truncate text-sm font-medium ${notificacion.leida ? "" : "text-foreground"}`}
          >
            {notificacion.titulo}
          </p>
          {/* Prioridad alta */}
          {notificacion.prioridad === "alta" && (
            <Circle
              className={`mt-1 size-2 shrink-0 fill-current ${PRIORIDAD_COLOR.alta}`}
              aria-label="Prioridad alta"
            />
          )}
        </div>

        {notificacion.mensaje && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {notificacion.mensaje}
          </p>
        )}

        <div className="mt-1 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {tiempoRelativo(notificacion.created_at)}
          </span>
          <span className="text-[10px] text-muted-foreground/60">·</span>
          <span className={`text-[10px] ${cfg.color} font-medium`}>{cfg.label}</span>
        </div>
      </div>

      {/* Acciones hover */}
      <div className="absolute right-2 top-2 hidden items-center gap-1 group-hover:flex">
        {!notificacion.leida && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={handleMarcarLeida}
                  disabled={isMarkingRead}
                  aria-label="Marcar como leída"
                >
                  <Circle className="size-3 fill-primary text-primary" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Marcar como leída</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-destructive"
                onClick={handleEliminar}
                aria-label="Eliminar notificación"
              >
                <X className="size-3" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Eliminar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
