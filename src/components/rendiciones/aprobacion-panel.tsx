/**
 * aprobacion-panel.tsx
 * Panel de aprobacion directa (Opcion B) — V1.2.
 * Historial de estados (rendir_log) + acciones por rol.
 */

import { useState } from "react";
import {
  Send,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  History,
} from "lucide-react";

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
  useDevolverRendicion,
  useRendirLog,
} from "@/hooks/entities/use-rendicion-aprobacion";

import { usePoliticas } from "@/hooks/entities/use-politicas";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/utils/formatters";

import { estadoTone } from "./rendicion-types";
import type { Rendicion } from "@/types/entities";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(s: string | null | undefined): string {
  if (!s) return "-";
  return new Date(s).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(s: string): string {
  return new Date(s).toLocaleString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTope(
  catNombre: string,
  pol: {
    tope_desayuno: number | null;
    tope_almuerzo: number | null;
    tope_cena: number | null;
    tope_hospedaje: number | null;
    tope_miscelaneo: number | null;
  },
): number | null {
  const n = catNombre.toLowerCase();
  if (n.includes("desayuno")) return pol.tope_desayuno;
  if (n.includes("almuerzo")) return pol.tope_almuerzo;
  if (n.includes("cena")) return pol.tope_cena;
  if (n.includes("hospedaje") || n.includes("hotel") || n.includes("alojamiento"))
    return pol.tope_hospedaje;
  if (n.includes("miscel")) return pol.tope_miscelaneo;
  return null;
}

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  devuelta: "Devuelta",
  liquidada: "Liquidada",
  registrada: "Registrada",
};

const MENSAJES_DEVOLUCION = [
  "Falta documentación de soporte",
  "Los importes no coinciden con las facturas",
  "Se requiere corrección de fechas",
  "Categorías de gasto incorrectas",
];

// ---------------------------------------------------------------------------
// ViolacionesPolitica
// ---------------------------------------------------------------------------
function ViolacionesPolitica({ rendicionId }: { rendicionId: string }) {
  const { data: politicasData } = usePoliticas({ pageSize: 1 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gastosRaw = [] } = useQuery<any[]>({
    queryKey: ["gastos-enriquecidos", rendicionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("gastos")
        .select("*, categorias_gasto(nombre)")
        .eq("rendicion_id", rendicionId)
        .is("deleted_at", null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any[];
    },
    staleTime: 30_000,
  });

  const politica = politicasData?.rows?.[0] ?? null;
  if (!politica) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const violaciones = (gastosRaw as any[]).filter((g) => {
    const catNombre: string = g.categorias_gasto?.nombre ?? "";
    const tope = getTope(catNombre, politica);
    return tope != null && tope > 0 && Number(g.valor_factura ?? 0) > tope;
  });

  if (violaciones.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="size-4 text-amber-600 shrink-0" />
        <p className="text-xs font-medium text-amber-800">
          {violaciones.length} gasto{violaciones.length !== 1 ? "s" : ""} excede
          {violaciones.length === 1 ? "" : "n"} el tope de política
        </p>
      </div>
      <ul className="space-y-1">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(violaciones as any[]).map((g) => {
          const catNombre: string = g.categorias_gasto?.nombre ?? "—";
          const tope = getTope(catNombre, politica) ?? 0;
          return (
            <li
              key={g.id as string}
              className="flex items-center justify-between text-xs text-amber-700"
            >
              <span>
                {catNombre}: {formatCurrency(Number(g.valor_factura ?? 0))}
              </span>
              <span className="text-amber-500">tope {formatCurrency(tope)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HistorialWorkflow
// ---------------------------------------------------------------------------
function HistorialWorkflow({ rendicionId }: { rendicionId: string }) {
  const { data: log = [], isLoading } = useRendirLog(rendicionId);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <History className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Historial
        </span>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando historial...</p>
      ) : log.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin registros.</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Fecha</th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Usuario</th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Estado</th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                  Observación
                </th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry, i) => (
                <tr key={entry.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                  <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                    {formatDateTime(entry.created_at)}
                  </td>
                  <td className="px-2 py-1.5 font-medium text-foreground">
                    {entry.usuario_nombre}
                  </td>
                  <td className="px-2 py-1.5">
                    <StatusBadge tone={estadoTone(entry.estado_codigo)}>
                      {ESTADO_LABEL[entry.estado_codigo] ?? entry.estado_codigo}
                    </StatusBadge>
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {entry.observacion ?? <span className="text-muted-foreground/40">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DevolverDialogContent (reutilizado)
// ---------------------------------------------------------------------------
interface DevolverDialogContentProps {
  open: boolean;
  observacion: string;
  onObservacionChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

function DevolverDialogContent({
  open,
  observacion,
  onObservacionChange,
  onConfirm,
  onCancel,
  isPending,
}: DevolverDialogContentProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Devolver rendicion</DialogTitle>
          <DialogDescription>
            La rendicion regresará al empleado para que la corrija y reenvíe.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            {MENSAJES_DEVOLUCION.map((msg) => (
              <button
                key={msg}
                type="button"
                onClick={() => onObservacionChange(msg)}
                className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {msg}
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Observación (opcional, máx. 500 caracteres)..."
            value={observacion}
            onChange={(e) => onObservacionChange(e.target.value.slice(0, 500))}
            rows={4}
          />
          <p className="text-right text-xs text-muted-foreground">{observacion.length}/500</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            variant="outline"
            className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            <RotateCcw className="size-4" />
            {isPending ? "Devolviendo..." : "Confirmar devolución"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// AprobacionPanel (principal)
// ---------------------------------------------------------------------------
interface AprobacionPanelProps {
  rendicion: Rendicion;
  estadoCodigo: string | null;
  estadoNombre: string;
}

export function AprobacionPanel({ rendicion, estadoCodigo, estadoNombre }: AprobacionPanelProps) {
  const { user } = useAuth();
  const { empresaActivaId } = useCompany();
  const { data: politicasData } = usePoliticas({ pageSize: 1 });

  const esPropietario = user?.id === rendicion.usuario_id;
  const esAprobador = user?.id === rendicion.aprobador_id;

  const puedeEnviar =
    esPropietario &&
    (estadoCodigo == null ||
      estadoCodigo === "borrador" ||
      estadoCodigo === "rechazada" ||
      estadoCodigo === "devuelta");

  const puedeActuar = esAprobador && estadoCodigo === "enviada";
  const puedeDevolver = esAprobador && (estadoCodigo === "enviada" || estadoCodigo === "aprobada");

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Estado de aprobacion</span>
        </div>
        <StatusBadge tone={estadoTone(estadoCodigo)}>{estadoNombre}</StatusBadge>
      </div>

      {rendicion.aprobador_id && (
        <AprobadorInfo aprobadorId={rendicion.aprobador_id} empresaId={empresaActivaId ?? ""} />
      )}

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

      <HistorialWorkflow rendicionId={rendicion.id} />

      <ViolacionesPolitica rendicionId={rendicion.id} />

      {estadoCodigo === "devuelta" && <DevueltaBanner rendicionId={rendicion.id} />}

      {estadoCodigo === "rechazada" && rendicion.comentario_rechazo && (
        <div className="flex gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-destructive">Motivo de rechazo</p>
            <p className="text-xs text-foreground mt-1">{rendicion.comentario_rechazo}</p>
          </div>
        </div>
      )}

      {puedeEnviar && (
        <EnviarDialog
          rendicionId={rendicion.id}
          empresaId={empresaActivaId ?? ""}
          defaultAprobadorId={politicasData?.rows?.[0]?.aprobador_id ?? null}
        />
      )}

      {puedeActuar && (
        <AccionesAprobador rendicionId={rendicion.id} puedeDevolver={puedeDevolver} />
      )}

      {!puedeActuar && puedeDevolver && <DevolverSolo rendicionId={rendicion.id} />}

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
// DevueltaBanner
// ---------------------------------------------------------------------------
function DevueltaBanner({ rendicionId }: { rendicionId: string }) {
  const { data: log = [] } = useRendirLog(rendicionId);
  const ultima = [...log].reverse().find((e) => e.estado_codigo === "devuelta");

  return (
    <div className="flex gap-2 rounded-md bg-orange-50 border border-orange-200 p-3">
      <RotateCcw className="size-4 text-orange-600 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-medium text-orange-700">Rendición devuelta para corrección</p>
        {ultima?.observacion && (
          <p className="text-xs text-foreground mt-1">{ultima.observacion}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AprobadorInfo
// ---------------------------------------------------------------------------
function AprobadorInfo({ aprobadorId, empresaId }: { aprobadorId: string; empresaId: string }) {
  const { data: aprobadores = [] } = useAprobadoresDisponibles();
  void empresaId;
  const aprobador = aprobadores.find((a) => a.usuario_id === aprobadorId);
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
// EnviarDialog
// ---------------------------------------------------------------------------
function EnviarDialog({
  rendicionId,
  empresaId,
  defaultAprobadorId,
}: {
  rendicionId: string;
  empresaId: string;
  defaultAprobadorId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [aprobadorId, setAprobadorId] = useState(defaultAprobadorId ?? "");
  const { data: aprobadores = [], isLoading } = useAprobadoresDisponibles();
  const enviar = useEnviarRendicion(rendicionId);
  void empresaId;

  function handleOpen() {
    setAprobadorId(defaultAprobadorId ?? "");
    setOpen(true);
  }

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
      <Button onClick={handleOpen} className="w-full gap-2" variant="default">
        <Send className="size-4" />
        Enviar para aprobacion
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
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
              disabled={!aprobadorId || aprobadorId === "__none__" || enviar.isPending}
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
// DevolverSolo (botón standalone para estado aprobada)
// ---------------------------------------------------------------------------
function DevolverSolo({ rendicionId }: { rendicionId: string }) {
  const [open, setOpen] = useState(false);
  const [observacion, setObservacion] = useState("");
  const devolver = useDevolverRendicion(rendicionId);

  async function handleDevolver() {
    try {
      await devolver.mutateAsync(observacion.trim() || null);
      toast.success("Rendicion devuelta para corrección.");
      setOpen(false);
      setObservacion("");
    } catch (err) {
      toast.error((err as Error).message ?? "Error al devolver.");
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="w-full gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
        variant="outline"
      >
        <RotateCcw className="size-4" />
        Devolver para corrección
      </Button>
      <DevolverDialogContent
        open={open}
        observacion={observacion}
        onObservacionChange={setObservacion}
        onConfirm={handleDevolver}
        onCancel={() => {
          setOpen(false);
          setObservacion("");
        }}
        isPending={devolver.isPending}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// AccionesAprobador (estado: enviada)
// ---------------------------------------------------------------------------
function AccionesAprobador({
  rendicionId,
  puedeDevolver,
}: {
  rendicionId: string;
  puedeDevolver: boolean;
}) {
  const [openAprobar, setOpenAprobar] = useState(false);
  const [openRechazar, setOpenRechazar] = useState(false);
  const [openDevolver, setOpenDevolver] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [observacion, setObservacion] = useState("");

  const aprobar = useAprobarRendicion(rendicionId);
  const rechazar = useRechazarRendicion(rendicionId);
  const devolver = useDevolverRendicion(rendicionId);

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

  async function handleDevolver() {
    try {
      await devolver.mutateAsync(observacion.trim() || null);
      toast.success("Rendicion devuelta para corrección.");
      setOpenDevolver(false);
      setObservacion("");
    } catch (err) {
      toast.error((err as Error).message ?? "Error al devolver.");
    }
  }

  return (
    <>
      <div className="flex gap-2">
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
        {puedeDevolver && (
          <Button
            onClick={() => setOpenDevolver(true)}
            className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
            variant="outline"
          >
            <RotateCcw className="size-4" />
            Devolver
          </Button>
        )}
      </div>

      <Dialog open={openAprobar} onOpenChange={setOpenAprobar}>
        <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
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

      <Dialog open={openRechazar} onOpenChange={setOpenRechazar}>
        <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
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

      <DevolverDialogContent
        open={openDevolver}
        observacion={observacion}
        onObservacionChange={setObservacion}
        onConfirm={handleDevolver}
        onCancel={() => {
          setOpenDevolver(false);
          setObservacion("");
        }}
        isPending={devolver.isPending}
      />
    </>
  );
}
