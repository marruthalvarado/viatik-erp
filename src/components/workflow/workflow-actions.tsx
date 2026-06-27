import { useState } from "react";
import { Send, CheckCircle2, XCircle, CornerDownLeft, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowPasoIndicator } from "./workflow-paso-indicator";
import type { PasoConEstado } from "./workflow-types";

// ---------------------------------------------------------------------------
// Panel de acciones de envío (para el propietario)
// ---------------------------------------------------------------------------

interface WorkflowEnviarPanelProps {
  onEnviar: () => void;
  loading: boolean;
}

export function WorkflowEnviarPanel({ onEnviar, loading }: WorkflowEnviarPanelProps) {
  return (
    <div className="rounded-lg border border-dashed border-border p-4">
      <p className="mb-3 text-sm text-muted-foreground">
        La rendición está en borrador. Envíala a aprobación cuando esté lista.
      </p>
      <Button
        onClick={onEnviar}
        disabled={loading}
        size="sm"
        className="gap-1.5"
        aria-label="Enviar rendición a aprobación"
      >
        <Send className="size-4" />
        {loading ? "Enviando…" : "Enviar a aprobación"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel de acciones del aprobador
// ---------------------------------------------------------------------------

interface WorkflowAprobadorPanelProps {
  pasoActivo: PasoConEstado;
  onAccion: (accion: "aprobar" | "rechazar" | "devolver", comentario: string | null) => void;
  loading: boolean;
}

export function WorkflowAprobadorPanel({
  pasoActivo,
  onAccion,
  loading,
}: WorkflowAprobadorPanelProps) {
  const [comentario, setComentario] = useState("");
  const [accionPendiente, setAccionPendiente] = useState<
    "aprobar" | "rechazar" | "devolver" | null
  >(null);

  function handleAccion(accion: "aprobar" | "rechazar" | "devolver") {
    setAccionPendiente(accion);
    onAccion(accion, comentario.trim() || null);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Paso actual
        </p>
        <p className="mt-0.5 text-sm font-semibold">
          {pasoActivo.nombre ?? `Paso ${pasoActivo.orden}`}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wf-comentario" className="text-xs">
          Comentario (opcional)
        </Label>
        <Textarea
          id="wf-comentario"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Observaciones, motivo de rechazo…"
          rows={2}
          className="resize-none text-sm"
          disabled={loading}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="default"
          className="gap-1.5"
          onClick={() => handleAccion("aprobar")}
          disabled={loading}
          aria-label="Aprobar rendición"
        >
          <CheckCircle2 className="size-4" />
          {loading && accionPendiente === "aprobar" ? "Aprobando…" : "Aprobar"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => handleAccion("devolver")}
          disabled={loading}
          aria-label="Devolver rendición para corrección"
        >
          <CornerDownLeft className="size-4" />
          {loading && accionPendiente === "devolver" ? "Devolviendo…" : "Devolver"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="gap-1.5"
          onClick={() => handleAccion("rechazar")}
          disabled={loading}
          aria-label="Rechazar rendición"
        >
          <XCircle className="size-4" />
          {loading && accionPendiente === "rechazar" ? "Rechazando…" : "Rechazar"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel de comentario (para cualquier participante autorizado)
// ---------------------------------------------------------------------------

interface WorkflowComentarioPanelProps {
  onComentario: (texto: string) => void;
  loading: boolean;
}

export function WorkflowComentarioPanel({ onComentario, loading }: WorkflowComentarioPanelProps) {
  const [texto, setTexto] = useState("");

  function handleSubmit() {
    if (!texto.trim()) return;
    onComentario(texto.trim());
    setTexto("");
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Agregar un comentario…"
        rows={2}
        className="resize-none text-sm"
        disabled={loading}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={handleSubmit}
        disabled={loading || !texto.trim()}
        className="gap-1.5"
        aria-label="Agregar comentario al workflow"
      >
        <MessageSquare className="size-4" />
        {loading ? "Guardando…" : "Comentar"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel completo: stepper + acciones contextuales
// ---------------------------------------------------------------------------

interface WorkflowPanelProps {
  pasos: PasoConEstado[];
  pasoActivo: PasoConEstado | null;
  estadoCodigo: string | null | undefined;
  puedeEnviar: boolean;
  puedeActuar: boolean;
  puedeComentar: boolean;
  loadingEnviar: boolean;
  loadingAccion: boolean;
  loadingComentario: boolean;
  onEnviar: () => void;
  onAccion: (accion: "aprobar" | "rechazar" | "devolver", comentario: string | null) => void;
  onComentario: (texto: string) => void;
  loading?: boolean;
}

export function WorkflowPanel({
  pasos,
  pasoActivo,
  estadoCodigo,
  puedeEnviar,
  puedeActuar,
  puedeComentar,
  loadingEnviar,
  loadingAccion,
  loadingComentario,
  onEnviar,
  onAccion,
  onComentario,
  loading,
}: WorkflowPanelProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const esTerminal = estadoCodigo === "aprobada" || estadoCodigo === "rechazada";

  return (
    <div className="space-y-4">
      {/* Stepper */}
      {pasos.length > 0 && (
        <div className="overflow-x-auto pb-1">
          <WorkflowPasoIndicator pasos={pasos} />
        </div>
      )}

      {/* Acciones contextuales */}
      {!esTerminal && puedeEnviar && (
        <WorkflowEnviarPanel onEnviar={onEnviar} loading={loadingEnviar} />
      )}

      {!esTerminal && puedeActuar && pasoActivo && (
        <WorkflowAprobadorPanel
          pasoActivo={pasoActivo}
          onAccion={onAccion}
          loading={loadingAccion}
        />
      )}

      {/* Mensaje de estado terminal */}
      {esTerminal && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">
            {estadoCodigo === "aprobada"
              ? "Esta rendición fue aprobada. No se requieren más acciones."
              : "Esta rendición fue rechazada. No se requieren más acciones."}
          </p>
        </div>
      )}

      {/* Comentarios */}
      {puedeComentar && (
        <WorkflowComentarioPanel onComentario={onComentario} loading={loadingComentario} />
      )}
    </div>
  );
}
