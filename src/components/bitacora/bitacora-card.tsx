import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  NIVEL_BLOQUEO_LABELS,
  NIVEL_BLOQUEO_COLOR,
  type BitacoraEntrada,
  type NivelBloqueo,
} from "@/services/bitacora";

interface Props {
  entrada: BitacoraEntrada;
  isOwn: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function BitacoraCard({ entrada, isOwn, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);

  const nivel = entrada.nivel_bloqueo as NivelBloqueo;
  const tieneBloqueo = nivel !== "ninguno" && !!entrada.bloqueos;

  const fechaLabel = (() => {
    try {
      return format(new Date(entrada.fecha + "T12:00:00"), "EEEE d MMM yyyy", { locale: es });
    } catch {
      return entrada.fecha;
    }
  })();

  const horaLabel = (() => {
    try {
      return format(new Date(entrada.created_at), "HH:mm", { locale: es });
    } catch {
      return "";
    }
  })();

  const iniciales = (entrada.usuario_nombre ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="relative pl-8">
      {/* Timeline dot */}
      <div className="absolute left-0 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold ring-2 ring-background">
        {iniciales}
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{entrada.usuario_nombre}</span>
            <span className="text-xs text-muted-foreground capitalize">{fechaLabel}</span>
            {horaLabel && (
              <span className="text-xs text-muted-foreground">· {horaLabel}</span>
            )}
            {entrada.porcentaje_avance !== null && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                {entrada.porcentaje_avance}% avance
              </Badge>
            )}
            {tieneBloqueo && (
              <Badge
                variant="outline"
                className={cn("text-xs px-1.5 py-0 h-4 border-0", NIVEL_BLOQUEO_COLOR[nivel])}
              >
                🚧 {NIVEL_BLOQUEO_LABELS[nivel]}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isOwn && (
              <>
                {onEdit && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
                    <Pencil className="size-3" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </Button>
          </div>
        </div>

        {/* Collapsed preview */}
        {!expanded && (
          <div className="px-4 py-2 text-xs text-muted-foreground line-clamp-1">
            {entrada.hoy ?? entrada.ayer ?? entrada.novedades ?? "Sin detalle"}
          </div>
        )}

        {/* Expanded content */}
        {expanded && (
          <div className="divide-y px-4">
            {entrada.ayer && (
              <div className="py-2.5 space-y-0.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">✅ Ayer</p>
                <p className="text-sm whitespace-pre-wrap">{entrada.ayer}</p>
              </div>
            )}
            {entrada.hoy && (
              <div className="py-2.5 space-y-0.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🎯 Hoy</p>
                <p className="text-sm whitespace-pre-wrap">{entrada.hoy}</p>
              </div>
            )}
            {tieneBloqueo && (
              <div className="py-2.5 space-y-0.5">
                <p className={cn("text-xs font-semibold uppercase tracking-wide", NIVEL_BLOQUEO_COLOR[nivel])}>
                  🚧 Bloqueo — {NIVEL_BLOQUEO_LABELS[nivel]}
                </p>
                <p className="text-sm whitespace-pre-wrap">{entrada.bloqueos}</p>
              </div>
            )}
            {entrada.novedades && (
              <div className="py-2.5 space-y-0.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">⚠️ Novedades</p>
                <p className="text-sm whitespace-pre-wrap">{entrada.novedades}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
