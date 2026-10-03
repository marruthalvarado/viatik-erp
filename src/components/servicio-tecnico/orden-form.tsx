/**
 * Formulario: Crear / Editar Orden de Servicio
 */
import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useEquiposInstalados } from "@/hooks/entities/use-servicio-tecnico";
import { useClientes } from "@/hooks/entities/use-clientes";
import { useUsuarios } from "@/hooks/entities/use-usuarios";
import type { OrdenConRelaciones, OrdenServicioPayload, OsRepuestoPayload } from "@/services/servicio-tecnico/ordenes-servicio";

/** Convierte una cadena UTC de Supabase (ej. "2026-10-05T20:00:00+00:00") al
 *  formato que necesita datetime-local: "YYYY-MM-DDTHH:mm" en hora LOCAL. */
function utcToLocalInput(utcStr: string): string {
  const d = new Date(utcStr);
  const yyyy = d.getFullYear();
  const mo   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  const hh   = String(d.getHours()).padStart(2, "0");
  const mm   = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mo}-${dd}T${hh}:${mm}`;
}

/** Convierte la cadena "YYYY-MM-DDTHH:mm" del datetime-local (hora LOCAL) a
 *  ISO UTC para enviarlo a la RPC (PostgreSQL timestamptz). */
function localInputToUtcIso(localStr: string): string {
  return new Date(localStr).toISOString();
}

interface Props {
  open: boolean;
  orden?: OrdenConRelaciones | null;
  onSubmit: (payload: OrdenServicioPayload, repuestos: OsRepuestoPayload[]) => Promise<void>;
  onClose: () => void;
}

const TIPO_OPTS = [
  { value: "preventivo",   label: "Preventivo programado" },
  { value: "correctivo",   label: "Correctivo por avería" },
  { value: "instalacion",  label: "Instalación / puesta en marcha" },
  { value: "actualizacion",label: "Actualización / upgrade" },
  { value: "repuesto",     label: "Venta e instalación de repuesto" },
];

const COBRO_OPTS = [
  { value: "garantia",    label: "Garantía" },
  { value: "contrato",    label: "Contrato de mantenimiento" },
  { value: "por_visita",  label: "Por visita" },
  { value: "sin_costo",   label: "Sin costo" },
];

const ESTADO_OPTS = [
  { value: "pendiente",   label: "Pendiente" },
  { value: "programada",  label: "Programada" },
  { value: "en_proceso",  label: "En proceso" },
  { value: "completada",  label: "Completada" },
  { value: "cancelada",   label: "Cancelada" },
];

const emptyRepuesto = (): OsRepuestoPayload => ({
  descripcion: "",
  cantidad: 1,
  precio_unitario: 0,
});

export function OrdenForm({ open, orden, onSubmit, onClose }: Props) {
  const { data: equipos = [] } = useEquiposInstalados();
  const { data: clientesPag } = useClientes();
  const { data: usuariosPag } = useUsuarios();
  const clientes = clientesPag?.rows ?? [];
  const usuarios = usuariosPag?.rows ?? [];

  const [form, setForm] = useState<OrdenServicioPayload>({
    tipo: "correctivo",
    modalidad_cobro: "por_visita",
    equipo_id: "",
  });
  const [repuestos, setRepuestos] = useState<OsRepuestoPayload[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (orden) {
      setForm({
        tipo: orden.tipo,
        estado: orden.estado ?? "pendiente",
        modalidad_cobro: orden.modalidad_cobro ?? "por_visita",
        equipo_id: orden.equipo_id,
        cliente_id: orden.cliente_id,
        proyecto_id: orden.proyecto_id,
        contrato_id: orden.contrato_id,
        tecnico_id: orden.tecnico_id,
        fecha_programada: orden.fecha_programada
          ? utcToLocalInput(orden.fecha_programada)
          : undefined,
        descripcion_problema: orden.descripcion_problema,
        diagnostico: orden.diagnostico,
      });
      setRepuestos(
        (orden.repuestos ?? []).map((r) => ({
          descripcion: r.descripcion,
          cantidad: r.cantidad ?? 1,
          precio_unitario: r.precio_unitario ?? 0,
          notas: r.notas,
        }))
      );
    } else {
      setForm({ tipo: "correctivo", modalidad_cobro: "por_visita", equipo_id: "" });
      setRepuestos([]);
    }
  }, [orden, open]);

  const set = (k: keyof OrdenServicioPayload, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const updateRepuesto = (idx: number, k: keyof OsRepuestoPayload, v: unknown) =>
    setRepuestos((prev) => prev.map((r, i) => i === idx ? { ...r, [k]: v } : r));

  const removeRepuesto = (idx: number) =>
    setRepuestos((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Convertir fecha_programada de hora local a UTC ISO antes de enviar
      const payload = {
        ...form,
        fecha_programada: form.fecha_programada
          ? localInputToUtcIso(form.fecha_programada)
          : form.fecha_programada,
      };
      await onSubmit(payload, repuestos);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // Auto-fill cliente when selecting equipo
  const handleEquipoChange = (equipoId: string) => {
    const eq = equipos.find((e) => e.id === equipoId);
    set("equipo_id", equipoId);
    if (eq?.cliente_id && !form.cliente_id) {
      set("cliente_id", eq.cliente_id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{orden ? "Editar orden de servicio" : "Nueva orden de servicio"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de servicio *</Label>
              <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_OPTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Modalidad de cobro</Label>
              <Select value={form.modalidad_cobro ?? "por_visita"} onValueChange={(v) => set("modalidad_cobro", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COBRO_OPTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Equipo *</Label>
            <Select value={form.equipo_id} onValueChange={handleEquipoChange} required>
              <SelectTrigger><SelectValue placeholder="Seleccionar equipo…" /></SelectTrigger>
              <SelectContent>
                {equipos.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nombre}{e.numero_serie ? ` · S/N: ${e.numero_serie}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cliente</Label>
              <Select
                value={form.cliente_id ?? "none"}
                onValueChange={(v) => set("cliente_id", v === "none" ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Ninguno —</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>FE asignado</Label>
              <Select
                value={form.tecnico_id ?? "none"}
                onValueChange={(v) => set("tecnico_id", v === "none" ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sin asignar —</SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombres} {u.apellidos}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha programada</Label>
              <Input
                type="datetime-local"
                value={form.fecha_programada ?? ""}
                onChange={(e) => set("fecha_programada", e.target.value || null)}
              />
            </div>
            {orden && (
              <div>
                <Label>Estado</Label>
                <Select value={form.estado ?? "pendiente"} onValueChange={(v) => set("estado", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADO_OPTS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label>Descripción del problema / motivo</Label>
            <Textarea
              value={form.descripcion_problema ?? ""}
              onChange={(e) => set("descripcion_problema", e.target.value || null)}
              rows={2}
              placeholder="Describe el problema reportado o el motivo del servicio…"
            />
          </div>

          {orden && (
            <div>
              <Label>Diagnóstico</Label>
              <Textarea
                value={form.diagnostico ?? ""}
                onChange={(e) => set("diagnostico", e.target.value || null)}
                rows={2}
              />
            </div>
          )}

          {/* Repuestos / materiales */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Repuestos / materiales</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRepuestos((prev) => [...prev, emptyRepuesto()])}
              >
                <Plus className="size-3 mr-1" />Agregar
              </Button>
            </div>
            {repuestos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin repuestos registrados.</p>
            ) : (
              <div className="space-y-2">
                {repuestos.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-start">
                    <Input
                      value={r.descripcion}
                      onChange={(e) => updateRepuesto(i, "descripcion", e.target.value)}
                      placeholder="Descripción"
                      required
                    />
                    <Input
                      type="number"
                      min={1}
                      value={r.cantidad ?? 1}
                      onChange={(e) => updateRepuesto(i, "cantidad", parseInt(e.target.value) || 1)}
                      placeholder="Cant."
                      className="w-20"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={r.precio_unitario ?? 0}
                      onChange={(e) => updateRepuesto(i, "precio_unitario", parseFloat(e.target.value) || 0)}
                      placeholder="P.U."
                      className="w-24"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => removeRepuesto(i)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                {repuestos.length > 0 && (
                  <p className="text-xs text-right text-muted-foreground">
                    Total repuestos: ${repuestos.reduce((sum, r) => sum + (r.cantidad ?? 1) * (r.precio_unitario ?? 0), 0).toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !form.equipo_id}>
              {loading ? "Guardando…" : orden ? "Guardar cambios" : "Crear orden"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
