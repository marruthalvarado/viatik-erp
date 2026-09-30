/**
 * Protocolos de Mantenimiento Preventivo
 * Flujo: seleccionar modelo → protocolo → ver/editar secciones → actividades
 */
import { useState } from "react";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  ClipboardCheck, Activity, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useModalidades, useModelosEquipo,
  useProtocolos, useProtocoloDetalle,
  useCrearProtocolo, useActualizarProtocolo,
  useCrearSeccion, useEliminarSeccion,
  useCrearActividadProtocolo, useActualizarActividadProtocolo, useEliminarActividadProtocolo,
  type Protocolo, type ProtocoloSeccion, type ProtocoloActividad,
} from "@/hooks/entities/use-servicio-tecnico";
import type { TipoCampoActividad } from "@/services/servicio-tecnico/protocolos";

// ── Constantes ────────────────────────────────────────────────────────────────

const INTERVALOS = [
  { value: "null", label: "Cada visita" },
  { value: "6",   label: "Semestral (6 meses)" },
  { value: "12",  label: "Anual (12 meses)" },
  { value: "24",  label: "Bienal (24 meses)" },
  { value: "60",  label: "Quinquenal (60 meses)" },
];

const TIPOS_CAMPO: { value: TipoCampoActividad; label: string; badge: string }[] = [
  { value: "check3",   label: "Check OK/No OK/N.A.", badge: "default" },
  { value: "medicion", label: "Medición con tolerancia", badge: "secondary" },
  { value: "texto",    label: "Observación libre", badge: "outline" },
  { value: "foto",     label: "Foto de evidencia", badge: "outline" },
];

function intervalLabel(meses: number | null) {
  if (meses == null) return "Cada visita";
  const found = INTERVALOS.find((i) => i.value === String(meses));
  return found?.label ?? `${meses} meses`;
}

function tipoBadge(tipo: TipoCampoActividad) {
  const t = TIPOS_CAMPO.find((x) => x.value === tipo);
  return t?.label ?? tipo;
}

// ── Diálogo protocolo ─────────────────────────────────────────────────────────

function ProtocoloDialog({
  open, protocolo, modeloId, onClose,
}: { open: boolean; protocolo: Protocolo | null; modeloId: string; onClose: () => void }) {
  const crear = useCrearProtocolo();
  const actualizar = useActualizarProtocolo();
  const [nombre, setNombre] = useState(protocolo?.nombre ?? "");
  const [version, setVersion] = useState(protocolo?.version ?? "");
  const [descripcion, setDescripcion] = useState(protocolo?.descripcion ?? "");
  const isPending = crear.isPending || actualizar.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (protocolo) {
      await actualizar.mutateAsync({ id: protocolo.id, payload: { nombre, version: version || null, descripcion: descripcion || null } });
    } else {
      await crear.mutateAsync({ modelo_id: modeloId, nombre, version: version || null, descripcion: descripcion || null });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{protocolo ? "Editar protocolo" : "Nuevo protocolo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="CHL ECAM Safety Check and PM" required />
          </div>
          <div>
            <Label>Versión</Label>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="003.2023-02-07" />
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!nombre || isPending}>{isPending ? "Guardando…" : (protocolo ? "Guardar" : "Crear")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Diálogo sección ───────────────────────────────────────────────────────────

function SeccionDialog({
  open, protocoloId, proximoNumero, onClose,
}: { open: boolean; protocoloId: string; proximoNumero: number; onClose: () => void }) {
  const crear = useCrearSeccion();
  const [titulo, setTitulo] = useState("");
  const [intervalo, setIntervalo] = useState("null");
  const [descFrecuencia, setDescFrecuencia] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await crear.mutateAsync({
      protocolo_id: protocoloId,
      numero: proximoNumero,
      titulo,
      intervalo_meses: intervalo === "null" ? null : parseInt(intervalo),
      descripcion_frecuencia: descFrecuencia || null,
    });
    setTitulo(""); setIntervalo("null"); setDescFrecuencia("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva sección</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Basic Maintenance (every 6 months)" required />
          </div>
          <div>
            <Label>Frecuencia</Label>
            <Select value={intervalo} onValueChange={setIntervalo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERVALOS.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nota de frecuencia</Label>
            <Input
              value={descFrecuencia}
              onChange={(e) => setDescFrecuencia(e.target.value)}
              placeholder="First time 6 months after installation"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!titulo || crear.isPending}>{crear.isPending ? "Guardando…" : "Crear sección"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Diálogo actividad ─────────────────────────────────────────────────────────

function ActividadDialog({
  open, actividad, seccionId, proximoOrden, onClose,
}: {
  open: boolean;
  actividad: ProtocoloActividad | null;
  seccionId: string;
  proximoOrden: number;
  onClose: () => void;
}) {
  const crear = useCrearActividadProtocolo();
  const actualizar = useActualizarActividadProtocolo();
  const [desc, setDesc] = useState(actividad?.descripcion ?? "");
  const [numeroPaso, setNumeroPaso] = useState(actividad?.numero_paso ?? "");
  const [refProc, setRefProc] = useState(actividad?.referencia_proc ?? "");
  const [tipo, setTipo] = useState<TipoCampoActividad>(actividad?.tipo_campo ?? "check3");
  const [valorMin, setValorMin] = useState(actividad?.valor_min != null ? String(actividad.valor_min) : "");
  const [valorMax, setValorMax] = useState(actividad?.valor_max != null ? String(actividad.valor_max) : "");
  const [unidad, setUnidad] = useState(actividad?.unidad ?? "");
  const [esCritico, setEsCritico] = useState(actividad?.es_critico ?? false);
  const [notas, setNotas] = useState(actividad?.notas ?? "");

  const isPending = crear.isPending || actualizar.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      descripcion: desc,
      numero_paso: numeroPaso || null,
      referencia_proc: refProc || null,
      tipo_campo: tipo,
      valor_min: tipo === "medicion" && valorMin ? parseFloat(valorMin) : null,
      valor_max: tipo === "medicion" && valorMax ? parseFloat(valorMax) : null,
      unidad: tipo === "medicion" && unidad ? unidad : null,
      es_critico: esCritico,
      notas: notas || null,
    };
    if (actividad) {
      await actualizar.mutateAsync({ id: actividad.id, payload });
    } else {
      await crear.mutateAsync({ seccion_id: seccionId, orden: proximoOrden, ...payload });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{actividad ? "Editar actividad" : "Nueva actividad"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>N° de paso</Label>
              <Input value={numeroPaso} onChange={(e) => setNumeroPaso(e.target.value)} placeholder="2.1.1" />
            </div>
            <div className="col-span-2">
              <Label>Referencia procedimiento</Label>
              <Input value={refProc} onChange={(e) => setRefProc(e.target.value)} placeholder="6.5.1" />
            </div>
          </div>
          <div>
            <Label>Descripción *</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Dust removed from detectors" required />
          </div>
          <div>
            <Label>Tipo de campo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoCampoActividad)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_CAMPO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {tipo === "medicion" && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Valor mín.</Label>
                <Input type="number" step="any" value={valorMin} onChange={(e) => setValorMin(e.target.value)} />
              </div>
              <div>
                <Label>Valor máx.</Label>
                <Input type="number" step="any" value={valorMax} onChange={(e) => setValorMax(e.target.value)} />
              </div>
              <div>
                <Label>Unidad</Label>
                <Input value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="V, mV, °C…" />
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="critico" checked={esCritico} onChange={(e) => setEsCritico(e.target.checked)} className="size-4" />
            <Label htmlFor="critico" className="cursor-pointer">Actividad crítica (requiere atención inmediata si falla)</Label>
          </div>
          <div>
            <Label>Notas / instrucciones</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Instrucciones adicionales…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!desc || isPending}>{isPending ? "Guardando…" : (actividad ? "Guardar" : "Agregar")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Sección con sus actividades (acordeón) ────────────────────────────────────

function SeccionRow({
  seccion,
  onNuevaActividad,
  onEditarActividad,
}: {
  seccion: ProtocoloSeccion & { actividades: ProtocoloActividad[] };
  onNuevaActividad: (seccionId: string, proximoOrden: number) => void;
  onEditarActividad: (actividad: ProtocoloActividad) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const eliminarSeccion = useEliminarSeccion();
  const eliminarActividad = useEliminarActividadProtocolo();

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header de sección */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b">
        <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <span className="text-xs font-bold text-muted-foreground w-5">{seccion.numero}</span>
        <div className="flex-1">
          <span className="text-sm font-semibold">{seccion.titulo}</span>
          {seccion.descripcion_frecuencia && (
            <span className="ml-2 text-xs text-muted-foreground">({seccion.descripcion_frecuencia})</span>
          )}
        </div>
        <Badge variant="secondary" className="text-xs">
          {intervalLabel(seccion.intervalo_meses)}
        </Badge>
        <Button
          variant="ghost" size="sm" className="h-6 text-xs gap-1"
          onClick={() => onNuevaActividad(seccion.id, seccion.actividades.length + 1)}
        >
          <Plus className="size-3" /> Actividad
        </Button>
        <Button
          variant="ghost" size="icon" className="size-6 text-destructive hover:text-destructive"
          onClick={() => { if (confirm("¿Eliminar esta sección y todas sus actividades?")) eliminarSeccion.mutate(seccion.id); }}
          disabled={eliminarSeccion.isPending}
          title="Eliminar sección"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>

      {/* Actividades */}
      {expanded && (
        <div>
          {seccion.actividades.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Sin actividades. Agrega la primera.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/20 text-muted-foreground uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2 w-16">Paso</th>
                  <th className="text-left px-3 py-2">Descripción</th>
                  <th className="text-left px-3 py-2 w-28">Tipo</th>
                  <th className="text-left px-3 py-2 w-20">Ref. Proc.</th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {seccion.actividades.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{a.numero_paso ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-1.5">
                        {a.es_critico && (
                          <span className="text-[10px] bg-destructive/10 text-destructive px-1 rounded shrink-0 mt-0.5">CRÍTICO</span>
                        )}
                        <span>{a.descripcion}</span>
                      </div>
                      {a.tipo_campo === "medicion" && a.valor_min != null && (
                        <span className="text-muted-foreground">
                          [{a.valor_min} – {a.valor_max} {a.unidad}]
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px]">{tipoBadge(a.tipo_campo)}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground font-mono">{a.referencia_proc ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-0.5 justify-end">
                        <Button
                          variant="ghost" size="icon" className="size-5"
                          onClick={() => onEditarActividad(a)}
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="size-5 text-destructive"
                          onClick={() => { if (confirm("¿Eliminar actividad?")) eliminarActividad.mutate(a.id); }}
                          disabled={eliminarActividad.isPending}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Layout principal ──────────────────────────────────────────────────────────

export function ProtocolosLayout() {
  const { data: modalidades = [], isLoading: loadingModalidades } = useModalidades();

  const [modalidadId, setModalidadId] = useState<string>("");
  const { data: modelos = [] } = useModelosEquipo(modalidadId || undefined);

  const [modeloId, setModeloId] = useState<string>("");
  const { data: protocolos = [], isLoading: loadingProtocolos } = useProtocolos(modeloId || undefined);

  const [protocoloId, setProtocoloId] = useState<string>("");
  const { data: protocolo, isLoading: loadingDetalle } = useProtocoloDetalle(protocoloId || null);

  // Diálogos
  const [dlgProtocolo, setDlgProtocolo] = useState<{ open: boolean; item: Protocolo | null }>({ open: false, item: null });
  const [dlgSeccion, setDlgSeccion] = useState(false);
  const [dlgActividad, setDlgActividad] = useState<{
    open: boolean;
    seccionId: string;
    proximoOrden: number;
    item: ProtocoloActividad | null;
  }>({ open: false, seccionId: "", proximoOrden: 1, item: null });

  const actualizarProtocolo = useActualizarProtocolo();

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Protocolos de Mantenimiento</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Define las actividades de mantenimiento preventivo por modelo de equipo.
        </p>
      </div>

      {/* Selector: Modalidad → Modelo → Protocolo */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Modalidad</Label>
          <Select value={modalidadId} onValueChange={(v) => { setModalidadId(v); setModeloId(""); setProtocoloId(""); }}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona modalidad…" />
            </SelectTrigger>
            <SelectContent>
              {modalidades.filter((m) => m.activa).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="font-mono mr-2">{m.codigo}</span> {m.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Modelo</Label>
          <Select
            value={modeloId}
            onValueChange={(v) => { setModeloId(v); setProtocoloId(""); }}
            disabled={!modalidadId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona modelo…" />
            </SelectTrigger>
            <SelectContent>
              {modelos.filter((m) => m.activo).map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Protocolo</Label>
          <div className="flex gap-2">
            <Select value={protocoloId} onValueChange={setProtocoloId} disabled={!modeloId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecciona protocolo…" />
              </SelectTrigger>
              <SelectContent>
                {protocolos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {modeloId && (
              <Button
                size="icon" variant="outline"
                onClick={() => setDlgProtocolo({ open: true, item: null })}
                title="Nuevo protocolo"
              >
                <Plus className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Contenido del protocolo seleccionado */}
      {!protocoloId && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <BookOpen className="size-12 opacity-20" />
          <p className="text-sm">Selecciona modalidad, modelo y protocolo para ver sus actividades</p>
        </div>
      )}

      {protocoloId && loadingDetalle && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      )}

      {protocolo && (
        <div className="space-y-4">
          {/* Cabecera del protocolo */}
          <div className="flex items-center justify-between border rounded-lg px-4 py-3 bg-muted/20">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="size-4 text-primary" />
                <span className="font-semibold">{protocolo.nombre}</span>
                {protocolo.version && (
                  <Badge variant="outline" className="text-xs">v{protocolo.version}</Badge>
                )}
                {!protocolo.activo && <Badge variant="destructive" className="text-xs">Inactivo</Badge>}
              </div>
              {protocolo.descripcion && (
                <p className="text-xs text-muted-foreground mt-0.5">{protocolo.descripcion}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setDlgProtocolo({ open: true, item: protocolo })}
              >
                <Pencil className="size-3.5 mr-1" /> Editar
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => setDlgSeccion(true)}
              >
                <Plus className="size-3.5 mr-1" /> Nueva sección
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => actualizarProtocolo.mutate({ id: protocolo.id, payload: { activo: !protocolo.activo } })}
              >
                {protocolo.activo ? "Desactivar" : "Activar"}
              </Button>
            </div>
          </div>

          {/* Secciones */}
          {protocolo.secciones.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              <Activity className="size-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin secciones. Agrega la primera sección del protocolo.</p>
              <Button variant="outline" className="mt-3" onClick={() => setDlgSeccion(true)}>
                <Plus className="size-4 mr-1" /> Agregar sección
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {protocolo.secciones.map((s) => (
                <SeccionRow
                  key={s.id}
                  seccion={s}
                  onNuevaActividad={(seccionId, orden) =>
                    setDlgActividad({ open: true, seccionId, proximoOrden: orden, item: null })
                  }
                  onEditarActividad={(actividad) =>
                    setDlgActividad({ open: true, seccionId: actividad.seccion_id, proximoOrden: actividad.orden, item: actividad })
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Diálogos */}
      {modeloId && (
        <ProtocoloDialog
          open={dlgProtocolo.open}
          protocolo={dlgProtocolo.item}
          modeloId={modeloId}
          onClose={() => setDlgProtocolo({ open: false, item: null })}
        />
      )}
      {protocoloId && (
        <SeccionDialog
          open={dlgSeccion}
          protocoloId={protocoloId}
          proximoNumero={(protocolo?.secciones.length ?? 0) + 1}
          onClose={() => setDlgSeccion(false)}
        />
      )}
      {dlgActividad.open && (
        <ActividadDialog
          open={dlgActividad.open}
          actividad={dlgActividad.item}
          seccionId={dlgActividad.seccionId}
          proximoOrden={dlgActividad.proximoOrden}
          onClose={() => setDlgActividad({ open: false, seccionId: "", proximoOrden: 1, item: null })}
        />
      )}
    </div>
  );
}
