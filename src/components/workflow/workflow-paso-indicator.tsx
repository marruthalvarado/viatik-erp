import { Check, X, Clock, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PasoConEstado } from "./workflow-types";

interface WorkflowPasoIndicatorProps {
  pasos: PasoConEstado[];
}

const ICONS = {
  aprobado: <Check className="size-3.5" />,
  rechazado: <X className="size-3.5" />,
  activo: <CircleDot className="size-3.5" />,
  pendiente: <Clock className="size-3.5" />,
};

const STEP_STYLES: Record<PasoConEstado["estado"], string> = {
  aprobado: "bg-success text-success-foreground border-success",
  rechazado: "bg-destructive text-destructive-foreground border-destructive",
  activo: "bg-primary text-primary-foreground border-primary",
  pendiente: "bg-muted text-muted-foreground border-border",
};

const LINE_STYLES: Record<PasoConEstado["estado"], string> = {
  aprobado: "bg-success",
  rechazado: "bg-destructive",
  activo: "bg-border",
  pendiente: "bg-border",
};

export function WorkflowPasoIndicator({ pasos }: WorkflowPasoIndicatorProps) {
  if (pasos.length === 0) return null;

  return (
    <div className="flex items-center gap-0">
      {pasos.map((paso, idx) => (
        <div key={paso.id} className="flex items-center">
          {/* Círculo del paso */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-full border-2 text-xs",
                STEP_STYLES[paso.estado],
              )}
              title={paso.nombre ?? `Paso ${paso.orden}`}
            >
              {ICONS[paso.estado]}
            </div>
            <span className="max-w-[72px] truncate text-center text-[10px] text-muted-foreground">
              {paso.nombre ?? `Paso ${paso.orden}`}
            </span>
          </div>
          {/* Línea conectora */}
          {idx < pasos.length - 1 && (
            <div className={cn("mb-4 h-0.5 w-8 flex-shrink-0", LINE_STYLES[paso.estado])} />
          )}
        </div>
      ))}
    </div>
  );
}
