/**
 * aprobacion-panel.tsx
 * Panel de aprobacion directa (Opcion B).
 * Muestra el estado actual y los botones de accion segun el rol del usuario.
 *
 * Logica:
 *   - Propietario + borrador/rechazada → boton "Enviar para aprobacion"
 *   - Propietario + enviada            → info "Pendiente de aprobacion"
 *   - Aprobador asignado + enviada     → botones "Aprobar" / "Rechazar"
 *   - Aprobada/rechazada               → muestra resultado y fecha
 */

import { useState } from "react";
import { Send, CheckCircle, XCircle, Clock, UserCheck, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/common/status-badge";
import { toast } from "@/components/common/toast";

import { useAuth } from "@/contexts/auth-context";
import { useCompany } from "@/contexts/company-context";

import {
  useAprobadoresDisponibles,
  useEnviarRendicion,
  useAprobarRendicion,
  useRechazarRendicion,
} from "@/hooks/entities/use-rendicion-aprobacion";

import { estadoTone } from "./rendicion-types";
import type { Rendicion } from "@/types/entities";

function formatDate(s: string | null | undefined): string {
  if (!s) return "-";
  return new Date(s).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------

interface AprobacionPanelProps {
  rendicion: Rendicion;
  estadoCodigo: string | null;
  estadoNombre: string;
}

export function AprobacionPanel({ rendicion, estadoCodigo, estadoNombre }: AprobacionPanelProps) {
  const { user } = useAuth();
  const { empresaActivaId } = useCompany();

  const esPropietario = user?.id === rendicion.usuario_id;
  const esAprobador = user?.id === rendicion.aprobador_id;

  const puedeEnviar =
    esPropietario &&
    (estadoCodigo == null || estadoCodigo === "borrador" || estadoCodigo === "rechazada");
  const puedeActuar = esAprobador && estadoCodigo === "enviada";

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Estado de aprobacion</span>
        </div>
        <StatusBadge tone={estadoTone(estadoCodigo)}>{estadoNombre}</StatusBadge>
      </div>

      {/* Info aprobador asignado */}
      {rendicion.aprobador_id && (
        <AprobadorInfo aprobadorId={rendicion.aprobador_id} empresaId={empresaActivaId ?? ""} />
      )}

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
        {rendicion.fecha_envio && (
          <div>
            <span className="font-medium text-foreground">Enviada:</span>{" "}
            {formatDate(rendicion.fecha_envio)}
          </div>
        )}
        {rendicion.fecha_aprobacion && (
          <div>
            <span className="font-medium text-foreground">Aprobada:</span>{" "}
            {formatDate(rendicion.fecha_aprobacion)}
          </div>
        )}
      </div>

      {/* Comentario de rechazo */}
      {estadoCodigo === "rechazada" && rendicion.comentario_rechazo && (
        <div className="flex gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-destructive">Motivo de rechazo</p>
            <p className="text-xs text-foreground mt-1">{rendicion.comentario_rechazo}</p>
          </div>
        </div>
      )}

      {/* Acciones */}
      {puedeEnviar && <EnviarDialog rendicionId={rendicion.id} empresaId={empresaActivaId ?? ""} />}
      {puedeActuar && <AccionesAprobador rendicionId={rendicion.id} />}

      {/* Info estado enviada para el propietario */}
      {esPropietario && estadoCodigo === "enviada" && (
        <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 rounded-md p-3 border border-warning/20">
          <Clock className="size-4 shrink-0" />
          Pendiente de revision por el aprobador asignado.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componente: nombre del aprobador
// ---------------------------------------------------------------------------
function AprobadorInfo({ aprobadorId, empresaId }: { aprobadorId: string; empresaId: string }) {
  const { data: aprobadores = [] } = useAprobadoresDisponibles();
  const aprobador = aprobadores.find((a) => a.usuario_id === aprobadorId);

  if (!aprobador && !empresaId) return null;

  const nombre = aprobador
    ? `${aprobador.nombres}${aprobador.apellidos ? " " + aprobador.apellidos : ""}`
    : "Aprobador asignado";

  return (
    <div className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Aprobador:</span> {nombre}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialogo: enviar para aprobacion
// ---------------------------------------------------------------------------
function EnviarDialog({ rendicionId, empresaId }: { rendicionId: string; empresaId: string }) {
  const [open, setOpen] = useState(false);
  const [aprobadorId, setAprobadorId] = useState("");

  const { data: aprobadores = [], isLoading } = useAprobadoresDisponibles();
  const enviar = useEnviarRendicion(rendicionId);

  async function handleEnviar() {
    if (!aprobadorId) return;
    try {
      await enviar.mutateAsync(aprobadorId);
      toast.success("Rendicion enviada para aprobacion.");
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message ?? "Error al enviar.");
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-full gap-2" variant="default">
        <Send className="size-4" />
        Enviar para aprobacion
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Enviar para aprobacion</DialogTitle>
            <DialogDescription>Selecciona quien debe aprobar esta rendicion.</DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Select value={aprobadorId} onValueChange={setAprobadorId} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Cargando..." : "Seleccionar aprobador"} />
              </SelectTrigger>
              <SelectContent>
                {aprobadores.map((a) => (
                  <SelectItem key={a.usuario_id} value={a.usuario_id}>
                    {a.nombres}
                    {a.apellidos ? " " + a.apellidos : ""}
                    {a.email ? ` (${a.email})` : ""}
                  </SelectItem>
                ))}
                {aprobadores.length === 0 && !isLoading && (
                  <SelectItem value="__none__" disabled>
                    No hay otros usuarios en la empresa
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEnviar}
              disabled={!aprobadorId || enviar.isPending}
              className="gap-2"
            >
              <Send className="size-4" />
              {enviar.isPending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-componente: acciones del aprobador
// ---------------------------------------------------------------------------
function AccionesAprobador({ rendicionId }: { rendicionId: string }) {
  const [openAprobar, setOpenAprobar] = useState(false);
  const [openRechazar, setOpenRechazar] = useState(false);
  const [motivo, setMotivo] = useState("");

  const aprobar = useAprobarRendicion(rendicionId);
  const rechazar = useRechazarRendicion(rendicionId);

  async function handleAprobar() {
    try {
      await aprobar.mutateAsync(undefined);
      toast.success("Rendicion aprobada correctamente.");
      setOpenAprobar(false);
    } catch (err) {
      toast.error((err as Error).message ?? "Error al aprobar.");
    }
  }

  async function handleRechazar() {
    if (!motivo.trim()) {
      toast.error("El motivo de rechazo es obligatorio.");
      return;
    }
    try {
      await rechazar.mutateAsync(motivo.trim());
      toast.success("Rendicion rechazada.");
      setOpenRechazar(false);
      setMotivo("");
    } catch (err) {
      toast.error((err as Error).message ?? "Error al rechazar.");
    }
  }

  return (
    <>
      <div className="flex gap-3">
        <Button onClick={() => setOpenAprobar(true)} className="flex-1 gap-2" variant="default">
          <CheckCircle className="size-4" />
          Aprobar
        </Button>
        <Button
          onClick={() => setOpenRechazar(true)}
          className="flex-1 gap-2"
          variant="destructive"
        >
          <XCircle className="size-4" />
          Rechazar
        </Button>
      </div>

      {/* Dialog: Aprobar */}
      <Dialog open={openAprobar} onOpenChange={setOpenAprobar}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Aprobar rendicion</DialogTitle>
            <DialogDescription>
              Esta accion cambiara el estado a Aprobada. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAprobar(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAprobar} disabled={aprobar.isPending} className="gap-2">
              <CheckCircle className="size-4" />
              {aprobar.isPending ? "Aprobando..." : "Confirmar aprobacion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Rechazar */}
      <Dialog open={openRechazar} onOpenChange={setOpenRechazar}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rechazar rendicion</DialogTitle>
            <DialogDescription>
              Indica el motivo del rechazo. El empleado podra corregirla y reenviarla.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Motivo del rechazo..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenRechazar(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRechazar}
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
