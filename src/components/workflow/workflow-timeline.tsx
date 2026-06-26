import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Send, MessageSquare, CheckCircle2, XCircle, CornerDownLeft, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { eventoLabel, type EntradaTimeline } from "./workflow-types";

interface WorkflowTimelineProps {
  entradas: EntradaTimeline[];
  loading?: boolean;
}

function formatFecha(fecha: string): string {
  try {
    return format(new Date(fecha), "d MMM yyyy HH:mm", { locale: es });
  } catch {
    return fecha;
  }
}

function EventoIcon({
  tipo,
  accionCodigo,
}: {
  tipo: EntradaTimeline["tipo"];
  accionCodigo?: string | null;
}) {
  if (tipo === "comentario") {
    return <MessageSquare className="size-3.5 text-muted-foreground" />;
  }
  if (tipo === "decision") {
    switch (accionCodigo) {
      case "aprobar":
        return <CheckCircle2 className="size-3.5 text-success" />;
      case "rechazar":
        return <XCircle className="size-3.5 text-destructive" />;
      case "devolver":
        return <CornerDownLeft className="size-3.5 text-warning" />;
    }
  }
  if (accionCodigo === "enviada") {
    return <Send className="size-3.5 text-primary" />;
  }
  return <Clock className="size-3.5 text-muted-foreground" />;
}

function entradaAccentClass(entrada: EntradaTimeline): string {
  if (entrada.tipo === "comentario") return "border-l-border";
  if (entrada.tipo === "decision") {
    switch (entrada.accion_codigo) {
      case "aprobar":
        return "border-l-success";
      case "rechazar":
        return "border-l-destructive";
      case "devolver":
        return "border-l-warning";
    }
  }
  if (entrada.evento === "enviada") return "border-l-primary";
  return "border-l-border";
}

export function WorkflowTimeline({ entradas, loading }: WorkflowTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (entradas.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Sin actividad registrada aún.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {entradas.map((entrada) => (
        <li
          key={entrada.id}
          className={cn(
            "rounded-md border border-border border-l-2 bg-card px-3 py-2.5",
            entradaAccentClass(entrada),
          )}
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">
              <EventoIcon
                tipo={entrada.tipo}
                accionCodigo={entrada.accion_codigo ?? entrada.evento}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="text-xs font-medium">
                  {entrada.tipo === "comentario"
                    ? (entrada.usuario_nombre ?? "Usuario")
                    : entrada.tipo === "decision"
                      ? eventoLabel(entrada.accion_codigo) +
                        (entrada.paso_nombre ? ` — ${entrada.paso_nombre}` : "")
                      : eventoLabel(entrada.evento)}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatFecha(entrada.fecha)}
                </span>
              </div>
              {entrada.tipo === "comentario" ? (
                <p className="mt-0.5 text-xs text-foreground">{entrada.texto}</p>
              ) : (
                <>
                  {entrada.usuario_nombre && (
                    <p className="text-[11px] text-muted-foreground">{entrada.usuario_nombre}</p>
                  )}
                  {entrada.texto && entrada.tipo === "decision" && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{entrada.texto}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
