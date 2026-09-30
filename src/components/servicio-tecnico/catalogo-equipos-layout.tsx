/**
 * Catálogo de Equipos ST — Modalidades (izquierda) + Modelos (derecha)
 * Panel doble con selección: selecciona modalidad para ver sus modelos.
 */
import { useState } from "react";
import { Plus, Pencil, Power, PowerOff, Activity } from "lucide-react";
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
  useModalidades, useCrearModalidad, useActualizarModalidad,
  useModelosEquipo, useCrearModeloEquipo, useActualizarModeloEquipo,
  type Modalidad, type ModeloEquipo,
} from "@/hooks/entities/use-servicio-tecnico";
import { useProveedores } from "@/hooks/entities/use-proveedores";

// ── Diálogos Modalidad ────────────────────────────────────────────────────────

function ModalidadDialog({
  open, modalidad, onClose,
}: { open: boolean; modalidad: Modalidad | null; onClose: () => void }) {
  const crear = useCrearModalidad();
  const actualizar = useActualizarModalidad();
  const [codigo, setCodigo] = useState(modalidad?.codigo ?? "");
  const [nombre, setNombre] = useState(modalidad?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(modalidad?.descripcion ?? "");

  const isPending = crear.isPending || actualizar.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalidad) {
      await actualizar.mutateAsync({ id: modalidad.id, payload: { codigo, nombre, descripcion: descripcion || null } });
    } else {
      await crear.mutateAsync({ codigo, nombre, descripcion: descripcion || null });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{modalidad ? "Editar modalidad" : "Nueva modalidad"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Código *</Label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="NM"
                maxLength={6}
                required
              />
            </div>
            <div className="col-span-2">
              <Label>Nombre *</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Medicina Nuclear"
                required
              />
            </div>
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Descripción opcional…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!codigo || !nombre || isPending}>
              {isPending ? "Guardando…" : (modalidad ? "Guardar" : "Crear")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Diálogo Modelo ────────────────────────────────────────────────────────────

function ModeloDialog({
  open, modelo, modalidadId, onClose,
}: { open: boolean; modelo: ModeloEquipo | null; modalidadId: string; onClose: () => void }) {
  const crear = useCrearModeloEquipo();
  const actualizar = useActualizarModeloEquipo();
  const { data: provPag } = useProveedores();
  const fabricantes = (provPag?.rows ?? []).filter((p) => p.es_internacional === true);

  const [nombre, setNombre] = useState(modelo?.nombre ?? "");
  const [fabricanteId, setFabricanteId] = useState<string | null>(modelo?.fabricante_id ?? null);
  const [descripcion, setDescripcion] = useState(modelo?.descripcion ?? "");

  const isPending = crear.isPending || actualizar.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modelo) {
      await actualizar.mutateAsync({
        id: modelo.id,
        payload: { nombre, fabricante_id: fabricanteId, descripcion: descripcion || null },
      });
    } else {
      await crear.mutateAsync({
        modalidad_id: modalidadId,
        nombre,
        fabricante_id: fabricanteId,
        descripcion: descripcion || null,
      });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{modelo ? "Editar modelo" : "Nuevo modelo de equipo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Nombre del modelo *</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ECAM Nova"
              required
            />
          </div>
          <div>
            <Label>Fabricante (proveedor internacional)</Label>
            <Select
              value={fabricanteId ?? "none"}
              onValueChange={(v) => setFabricanteId(v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar fabricante…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sin fabricante —</SelectItem>
                {fabricantes.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fabricantes.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Agrega proveedores internacionales en el módulo Proveedores para usar este selector.
              </p>
            )}
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Descripción opcional…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!nombre || isPending}>
              {isPending ? "Guardando…" : (modelo ? "Guardar" : "Crear")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Layout principal ──────────────────────────────────────────────────────────

export function CatalogoEquiposLayout() {
  const { data: modalidades = [], isLoading: loadingModalidades } = useModalidades();
  const actualizarModalidad = useActualizarModalidad();

  const [modalidadSeleccionada, setModalidadSeleccionada] = useState<Modalidad | null>(null);
  const { data: modelos = [], isLoading: loadingModelos } = useModelosEquipo(modalidadSeleccionada?.id);
  const actualizarModelo = useActualizarModeloEquipo();

  // Diálogos
  const [modalModalidad, setModalModalidad] = useState<{ open: boolean; item: Modalidad | null }>({ open: false, item: null });
  const [modalModelo, setModalModelo] = useState<{ open: boolean; item: ModeloEquipo | null }>({ open: false, item: null });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Catálogo de Equipos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Define las modalidades y modelos de equipos médicos para la base instalada y protocolos de mantenimiento.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* ── Panel izquierdo: Modalidades ── */}
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
            <span className="text-sm font-semibold">Modalidades</span>
            <Button size="sm" variant="outline" onClick={() => setModalModalidad({ open: true, item: null })}>
              <Plus className="size-3.5 mr-1" /> Nueva
            </Button>
          </div>

          {loadingModalidades ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : modalidades.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Sin modalidades. Crea la primera.
            </div>
          ) : (
            <div className="divide-y">
              {modalidades.map((m) => (
                <button
                  key={m.id}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors ${
                    modalidadSeleccionada?.id === m.id ? "bg-primary/5 border-l-2 border-primary" : ""
                  } ${!m.activa ? "opacity-50" : ""}`}
                  onClick={() => setModalidadSeleccionada(m)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold bg-muted px-1.5 py-0.5 rounded">
                      {m.codigo}
                    </span>
                    <span className="text-sm font-medium">{m.nombre}</span>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="p-1 hover:text-primary"
                      onClick={() => setModalModalidad({ open: true, item: m })}
                      title="Editar"
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      className="p-1 hover:text-muted-foreground"
                      onClick={() => actualizarModalidad.mutate({ id: m.id, payload: { activa: !m.activa } })}
                      title={m.activa ? "Desactivar" : "Activar"}
                    >
                      {m.activa ? <PowerOff className="size-3" /> : <Power className="size-3" />}
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Panel derecho: Modelos ── */}
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
            <span className="text-sm font-semibold">
              {modalidadSeleccionada
                ? `Modelos — ${modalidadSeleccionada.codigo}`
                : "Modelos"}
            </span>
            {modalidadSeleccionada && (
              <Button size="sm" variant="outline" onClick={() => setModalModelo({ open: true, item: null })}>
                <Plus className="size-3.5 mr-1" /> Nuevo
              </Button>
            )}
          </div>

          {!modalidadSeleccionada ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground text-sm gap-2">
              <Activity className="size-8 opacity-30" />
              <p>Selecciona una modalidad para ver sus modelos</p>
            </div>
          ) : loadingModelos ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : modelos.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Sin modelos para {modalidadSeleccionada.nombre}.
            </div>
          ) : (
            <div className="divide-y">
              {modelos.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-muted/20 ${!m.activo ? "opacity-50" : ""}`}
                >
                  <div>
                    <p className="text-sm font-medium">{m.nombre}</p>
                    {(m.proveedor?.nombre ?? m.fabricante) && (
                      <p className="text-xs text-muted-foreground">
                        {m.proveedor?.nombre ?? m.fabricante}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="icon" className="size-6"
                      onClick={() => setModalModelo({ open: true, item: m })}
                      title="Editar"
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="size-6 text-muted-foreground"
                      onClick={() => actualizarModelo.mutate({ id: m.id, payload: { activo: !m.activo } })}
                      title={m.activo ? "Desactivar" : "Activar"}
                    >
                      {m.activo ? <PowerOff className="size-3" /> : <Power className="size-3" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Diálogos */}
      <ModalidadDialog
        open={modalModalidad.open}
        modalidad={modalModalidad.item}
        onClose={() => setModalModalidad({ open: false, item: null })}
      />
      {modalidadSeleccionada && (
        <ModeloDialog
          open={modalModelo.open}
          modelo={modalModelo.item}
          modalidadId={modalidadSeleccionada.id}
          onClose={() => setModalModelo({ open: false, item: null })}
        />
      )}
    </div>
  );
}
