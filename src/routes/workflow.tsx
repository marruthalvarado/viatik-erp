/**
 * workflow.tsx
 * Bandeja de aprobaciones — el aprobador ve, actúa y decide desde aquí.
 * Usa Sistema 1 (aprobacion directa por aprobador_id).
 */

import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  ArrowRight,
  Inbox,
  AlertTriangle,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/common/toast";

import { useMisAprobacionesPendientes, useRegistrarAccion } from "@/hooks/entities/use-workflow";
import {
  useAprobarRendicionDirect,
  useDevolverRendicionDirect,
  useRechazarRendicionDirect,
} from "@/hooks/entities/use-rendicion-aprobacion";

import { formatCurrency, formatDate } from "@/utils/formatters";
import type { AprobacionPendiente } from "@/services/workflow-read";

export const Route = createFileRoute("/workflow")({
  head: () => ({ meta: [{ title: "Aprobaciones - VIATIQ" }] }),
  component: WorkflowPage,
});

function WorkflowPage() {
  return (
    <AppShell>
      <WorkflowContent />
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Tipos de diálogo activo
// ---------------------------------------------------------------------------
type AccionDialog =
  | { tipo: "aprobar"; rendicion: AprobacionPendiente }
  | { tipo: "devolver"; rendicion: AprobacionPendiente }
  | { tipo: "rechazar"; rendicion: AprobacionPendiente }
  | null;

// ---------------------------------------------------------------------------
// Contenido principal
// ---------------------------------------------------------------------------
function WorkflowContent() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useMisAprobacionesPendientes();

  const [dialogActivo, setDialogActivo] = useState<AccionDialog>(null);
  const [observacion, setObservacion] = useState("");
  const [motivo, setMotivo] = useState("");

  // Sistema 1: aprobacion directa (aprobador_id)
  const aprobar = useAprobarRendicionDirect();
  const devolver = useDevolverRendicionDirect();
  const rechazar = useRechazarRendicionDirect();
  // Sistema 2: workflow por pasos (workflow_paso_id != "")
  const registrarAccion = useRegistrarAccion();

  function cerrarDialog() {
    setDialogActivo(null);
    setObservacion("");
    setMotivo("");
  }

  /** ¿El item actual usa el workflow por pasos (Sistema 2)? */
  function esWorkflow2(rendicion: AprobacionPendiente) {
    return !!rendicion.workflow_paso_id;
  }

  async function handleAprobar() {
    if (!dialogActivo || dialogActivo.tipo !== "aprobar") return;
    const { rendicion } = dialogActivo;
    try {
      if (esWorkflow2(rendicion)) {
        await registrarAccion.mutateAsync({
          rendicionId: rendicion.rendicion_id,
          workflowPasoId: rendicion.workflow_paso_id,
          accionCodigo: "aprobar",
          comentario: null,
        });
      } else {
        await aprobar.mutateAsync({ rendicionId: rendicion.rendicion_id });
      }
      toast.success(`Rendición ${rendicion.numero} aprobada.`);
      cerrarDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al aprobar.");
    }
  }

  async function handleDevolver() {
    if (!dialogActivo || dialogActivo.tipo !== "devolver") return;
    const { rendicion } = dialogActivo;
    try {
      if (esWorkflow2(rendicion)) {
        await registrarAccion.mutateAsync({
          rendicionId: rendicion.rendicion_id,
          workflowPasoId: rendicion.workflow_paso_id,
          accionCodigo: "devolver",
          comentario: observacion.trim() || null,
        });
      } else {
        await devolver.mutateAsync({
          rendicionId: rendicion.rendicion_id,
          observacion: observacion.trim() || null,
        });
      }
      toast.success(`Rendición ${rendicion.numero} devuelta para corrección.`);
      cerrarDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al devolver.");
    }
  }

  async function handleRechazar() {
    if (!dialogActivo || dialogActivo.tipo !== "rechazar") return;
    if (!motivo.trim()) {
      toast.error("El motivo de rechazo es obligatorio.");
      return;
    }
    const { rendicion } = dialogActivo;
    try {
      if (esWorkflow2(rendicion)) {
        await registrarAccion.mutateAsync({
          rendicionId: rendicion.rendicion_id,
          workflowPasoId: rendicion.workflow_paso_id,
          accionCodigo: "rechazar",
          comentario: motivo.trim(),
        });
      } else {
        await rechazar.mutateAsync({
          rendicionId: rendicion.rendicion_id,
          motivo: motivo.trim(),
        });
      }
      toast.success(`Rendición ${rendicion.numero} rechazada.`);
      cerrarDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al rechazar.");
    }
  }

  function irARendicion(rendicionId: string) {
    void navigate({ to: "/rendiciones", search: { detalle: rendicionId } as never });
  }

  return (
    <>
      <PageHeader
        title="Aprobaciones pendientes"
        description="Rendiciones asignadas a ti para revisión y aprobación."
        breadcrumbs={[{ label: "Aprobaciones" }]}
      />

      {/* Lista */}
      {error ? (
        <EmptyState
          title="Error al cargar aprobaciones"
          description={error instanceof Error ? error.message : "Error inesperado."}
        />
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Sin pendientes"
          description="No tienes rendiciones asignadas para aprobar en este momento."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Número</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Solicitante</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Descripción</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Fecha envío</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Paso</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Acciones</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((row) => (
                <tr key={row.rendicion_id} className="group bg-background hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className="font-medium tabular-nums">{row.numero}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.usuario_nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">
                    {row.descripcion ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {formatCurrency(row.total_facturado)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.fecha_envio ? formatDate(row.fecha_envio) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {row.workflow_paso_id
                      ? <span className="rounded bg-muted px-1.5 py-0.5">{row.paso_nombre ?? `Paso ${row.paso_orden}`}</span>
                      : <span className="text-muted-foreground/50">Directa</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {/* Aprobar */}
                      <Button
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => setDialogActivo({ tipo: "aprobar", rendicion: row })}
                      >
                        <CheckCircle className="size-3.5" />
                        Aprobar
                      </Button>
                      {/* Devolver */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                        onClick={() => setDialogActivo({ tipo: "devolver", rendicion: row })}
                      >
                        <RotateCcw className="size-3.5" />
                        Devolver
                      </Button>
                      {/* Rechazar */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={() => setDialogActivo({ tipo: "rechazar", rendicion: row })}
                      >
                        <XCircle className="size-3.5" />
                        Rechazar
                      </Button>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => irARendicion(row.rendicion_id)}
                      aria-label={`Ver detalle de ${row.numero}`}
                      title="Ver detalle completo"
                    >
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Dialog: Aprobar ────────────────────────────────── */}
      <Dialog
        open={dialogActivo?.tipo === "aprobar"}
        onOpenChange={(o) => { if (!o) cerrarDialog(); }}
      >
        <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Aprobar rendición</DialogTitle>
            <DialogDescription>
              {dialogActivo?.tipo === "aprobar" && (
                <>
                  <strong>{dialogActivo.rendicion.numero}</strong> de{" "}
                  {dialogActivo.rendicion.usuario_nombre} por{" "}
                  {formatCurrency(dialogActivo.rendicion.total_facturado)}.{" "}
                  {dialogActivo.rendicion.workflow_paso_id
                    ? <>Paso: <em>{dialogActivo.rendicion.paso_nombre ?? `#${dialogActivo.rendicion.paso_orden}`}</em>. Al aprobar, pasará al siguiente nivel de revisión o quedará aprobada si es el último paso.</>
                    : <>Esta acción cambiará el estado a <em>Aprobada</em>.</>
                  }
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cerrarDialog}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleAprobar()}
              disabled={aprobar.isPending || registrarAccion.isPending}
              className="gap-2"
            >
              <CheckCircle className="size-4" />
              {(aprobar.isPending || registrarAccion.isPending) ? "Aprobando..." : "Confirmar aprobación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Devolver ───────────────────────────────── */}
      <Dialog
        open={dialogActivo?.tipo === "devolver"}
        onOpenChange={(o) => { if (!o) cerrarDialog(); }}
      >
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Devolver para corrección</DialogTitle>
            <DialogDescription>
              La rendición regresará al solicitante para que la corrija y reenvíe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                "Falta documentación de soporte",
                "Los importes no coinciden con las facturas",
                "Se requiere corrección de fechas",
                "Categorías de gasto incorrectas",
              ].map((msg) => (
                <button
                  key={msg}
                  type="button"
                  onClick={() => setObservacion(msg)}
                  className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {msg}
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Observación (opcional)..."
              value={observacion}
              onChange={(e) => setObservacion(e.target.value.slice(0, 500))}
              rows={3}
            />
            <p className="text-right text-xs text-muted-foreground">{observacion.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cerrarDialog}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleDevolver()}
              disabled={devolver.isPending}
              variant="outline"
              className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              <RotateCcw className="size-4" />
              {devolver.isPending ? "Devolviendo..." : "Confirmar devolución"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Rechazar ───────────────────────────────── */}
      <Dialog
        open={dialogActivo?.tipo === "rechazar"}
        onOpenChange={(o) => { if (!o) cerrarDialog(); }}
      >
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              Rechazar rendición
            </DialogTitle>
            <DialogDescription>
              Indica el motivo del rechazo. El solicitante podrá ver este mensaje.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                "Gastos no corresponden al período del viaje",
                "No se aceptan los gastos presentados",
                "Límites de política excedidos",
                "Documentación insuficiente",
              ].map((msg) => (
                <button
                  key={msg}
                  type="button"
                  onClick={() => setMotivo(msg)}
                  className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {msg}
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Motivo del rechazo (obligatorio)..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value.slice(0, 500))}
              rows={3}
            />
            <p className="text-right text-xs text-muted-foreground">{motivo.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cerrarDialog}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleRechazar()}
              disabled={!motivo.trim() || rechazar.isPending}
              variant="destructive"
              className="gap-2"
            >
              <XCircle className="size-4" />
              {rechazar.isPending ? "Rechazando..." : "Confirmar rechazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
