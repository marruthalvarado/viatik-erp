/**
 * Formulario: Crear / Editar Equipo Instalado
 */
import { useState, useEffect } from "react";
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
import { useClientes } from "@/hooks/entities/use-clientes";
import { useProyectos } from "@/hooks/entities/use-proyectos";
import type { EquipoInstaladoConRelaciones, EquipoInstaladoPayload } from "@/services/servicio-tecnico/equipos-instalados";

interface Props {
  open: boolean;
  equipo?: EquipoInstaladoConRelaciones | null;
  onSubmit: (payload: EquipoInstaladoPayload) => Promise<void>;
  onClose: () => void;
}

const ESTADO_OPTS = [
  { value: "activo", label: "Activo" },
  { value: "en_mantenimiento", label: "En mantenimiento" },
  { value: "fuera_servicio", label: "Fuera de servicio" },
  { value: "baja", label: "Baja" },
];

export function EquipoForm({ open, equipo, onSubmit, onClose }: Props) {
  const { data: clientesPag } = useClientes();
  const { data: proyectosPag } = useProyectos();
  const clientes = clientesPag?.rows ?? [];
  const proyectos = proyectosPag?.rows ?? [];

  const [form, setForm] = useState<EquipoInstaladoPayload>({
    nombre: "",
    estado: "activo",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (equipo) {
      setForm({
        nombre: equipo.nombre,
        fabricante: equipo.fabricante,
        modelo: equipo.modelo,
        numero_serie: equipo.numero_serie,
        numero_parte: equipo.numero_parte,
        ubicacion_instalacion: equipo.ubicacion_instalacion,
        cliente_id: equipo.cliente_id,
        proyecto_id: equipo.proyecto_id,
        fecha_instalacion: equipo.fecha_instalacion,
        fecha_venta: equipo.fecha_venta,
        garantia_meses: equipo.garantia_meses ?? 12,
        estado: equipo.estado ?? "activo",
        requiere_mantenimiento: equipo.requiere_mantenimiento ?? false,
        frecuencia_mantenimiento_dias: equipo.frecuencia_mantenimiento_dias,
        proximo_mantenimiento: equipo.proximo_mantenimiento,
        notas: equipo.notas,
      });
    } else {
      setForm({ nombre: "", estado: "activo", garantia_meses: 12 });
    }
  }, [equipo, open]);

  const set = (k: keyof EquipoInstaladoPayload, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(form);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{equipo ? "Editar equipo" : "Nuevo equipo"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nombre del equipo *</Label>
            <Input
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              placeholder="Ej: Compresor de tornillo 10HP"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fabricante</Label>
              <Input
                value={form.fabricante ?? ""}
                onChange={(e) => set("fabricante", e.target.value || null)}
                placeholder="Ej: Atlas Copco"
              />
            </div>
            <div>
              <Label>Modelo</Label>
              <Input
                value={form.modelo ?? ""}
                onChange={(e) => set("modelo", e.target.value || null)}
                placeholder="Ej: GA15"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Número de serie</Label>
              <Input
                value={form.numero_serie ?? ""}
                onChange={(e) => set("numero_serie", e.target.value || null)}
              />
            </div>
            <div>
              <Label>Número de parte</Label>
              <Input
                value={form.numero_parte ?? ""}
                onChange={(e) => set("numero_parte", e.target.value || null)}
              />
            </div>
          </div>

          <div>
            <Label>Ubicación de instalación</Label>
            <Input
              value={form.ubicacion_instalacion ?? ""}
              onChange={(e) => set("ubicacion_instalacion", e.target.value || null)}
              placeholder="Ej: Planta Guayaquil — Piso 2"
            />
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
              <Label>Proyecto</Label>
              <Select
                value={form.proyecto_id ?? "none"}
                onValueChange={(v) => set("proyecto_id", v === "none" ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Ninguno —</SelectItem>
                  {proyectos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha de venta</Label>
              <Input
                type="date"
                value={form.fecha_venta ?? ""}
                onChange={(e) => set("fecha_venta", e.target.value || null)}
              />
            </div>
            <div>
              <Label>Fecha de instalación</Label>
              <Input
                type="date"
                value={form.fecha_instalacion ?? ""}
                onChange={(e) => set("fecha_instalacion", e.target.value || null)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Garantía (meses)</Label>
              <Input
                type="number"
                min={0}
                value={form.garantia_meses ?? 12}
                onChange={(e) => set("garantia_meses", parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Estado</Label>
              <Select
                value={form.estado ?? "activo"}
                onValueChange={(v) => set("estado", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADO_OPTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="req-mant"
                checked={form.requiere_mantenimiento ?? false}
                onChange={(e) => set("requiere_mantenimiento", e.target.checked)}
                className="size-4"
              />
              <Label htmlFor="req-mant">Requiere mantenimiento periódico</Label>
            </div>
            {form.requiere_mantenimiento && (
              <div className="grid grid-cols-2 gap-3 pl-6">
                <div>
                  <Label>Frecuencia (días)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.frecuencia_mantenimiento_dias ?? ""}
                    onChange={(e) =>
                      set("frecuencia_mantenimiento_dias", parseInt(e.target.value) || null)
                    }
                    placeholder="90"
                  />
                </div>
                <div>
                  <Label>Próximo mantenimiento</Label>
                  <Input
                    type="date"
                    value={form.proximo_mantenimiento ?? ""}
                    onChange={(e) => set("proximo_mantenimiento", e.target.value || null)}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea
              value={form.notas ?? ""}
              onChange={(e) => set("notas", e.target.value || null)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando…" : equipo ? "Guardar cambios" : "Crear equipo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
