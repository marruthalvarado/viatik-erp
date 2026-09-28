/**
 * Formulario: Crear / Editar Contrato de Mantenimiento
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
import { useEquiposInstalados } from "@/hooks/entities/use-servicio-tecnico";
import type { ContratoConRelaciones, ContratoPayload } from "@/services/servicio-tecnico/contratos-mantenimiento";

interface Props {
  open: boolean;
  contrato?: ContratoConRelaciones | null;
  onSubmit: (payload: ContratoPayload, equipos: string[]) => Promise<void>;
  onClose: () => void;
}

const ESTADO_OPTS = [
  { value: "activo", label: "Activo" },
  { value: "vencido", label: "Vencido" },
  { value: "cancelado", label: "Cancelado" },
];

export function ContratoForm({ open, contrato, onSubmit, onClose }: Props) {
  const { data: clientesPag } = useClientes();
  const { data: proyectosPag } = useProyectos();
  const { data: equipos = [] } = useEquiposInstalados();
  const clientes = clientesPag?.rows ?? [];
  const proyectos = proyectosPag?.rows ?? [];

  const [form, setForm] = useState<ContratoPayload>({
    cliente_id: "",
    fecha_inicio: "",
    fecha_fin: "",
    periodicidad_meses: 1,
    estado: "activo",
    incluye_preventivos: true,
    incluye_correctivos: false,
  });
  const [equiposSeleccionados, setEquiposSeleccionados] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (contrato) {
      setForm({
        cliente_id: contrato.cliente_id ?? "",
        proyecto_id: contrato.proyecto_id,
        incluye_preventivos: contrato.incluye_preventivos ?? true,
        incluye_correctivos: contrato.incluye_correctivos ?? false,
        visitas_incluidas: contrato.visitas_incluidas,
        periodicidad_meses: contrato.periodicidad_meses ?? 1,
        fecha_inicio: contrato.fecha_inicio,
        fecha_fin: contrato.fecha_fin,
        valor_contrato: contrato.valor_contrato ?? undefined,
        estado: contrato.estado ?? "activo",
        observaciones: contrato.observaciones,
      });
      setEquiposSeleccionados(
        contrato.equipos?.map((e) => e.equipo_id).filter(Boolean) as string[] ?? []
      );
    } else {
      setForm({
        cliente_id: "",
        fecha_inicio: "",
        fecha_fin: "",
        periodicidad_meses: 1,
        estado: "activo",
        incluye_preventivos: true,
        incluye_correctivos: false,
      });
      setEquiposSeleccionados([]);
    }
  }, [contrato, open]);

  const set = (k: keyof ContratoPayload, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleEquipo = (id: string) =>
    setEquiposSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(form, equiposSeleccionados);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const equiposFiltrados = form.cliente_id
    ? equipos.filter((e) => e.cliente_id === form.cliente_id)
    : equipos;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contrato ? "Editar contrato" : "Nuevo contrato de mantenimiento"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Cliente *</Label>
            <Select
              value={form.cliente_id}
              onValueChange={(v) => { set("cliente_id", v); setEquiposSeleccionados([]); }}
              required
            >
              <SelectTrigger><SelectValue placeholder="Seleccionar cliente…" /></SelectTrigger>
              <SelectContent>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha inicio *</Label>
              <Input
                type="date"
                value={form.fecha_inicio}
                onChange={(e) => set("fecha_inicio", e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Fecha fin *</Label>
              <Input
                type="date"
                value={form.fecha_fin}
                onChange={(e) => set("fecha_fin", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Periodicidad (meses)</Label>
              <Input
                type="number"
                min={1}
                value={form.periodicidad_meses ?? 1}
                onChange={(e) => set("periodicidad_meses", parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <Label>Visitas incluidas</Label>
              <Input
                type="number"
                min={0}
                value={form.visitas_incluidas ?? ""}
                onChange={(e) => set("visitas_incluidas", e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Ilimitadas"
              />
            </div>
          </div>

          <div>
            <Label>Valor del contrato ($)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.valor_contrato ?? ""}
              onChange={(e) => set("valor_contrato", e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label>Servicios incluidos</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.incluye_preventivos ?? false}
                  onChange={(e) => set("incluye_preventivos", e.target.checked)}
                  className="size-4"
                />
                Mantenimiento preventivo
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.incluye_correctivos ?? false}
                  onChange={(e) => set("incluye_correctivos", e.target.checked)}
                  className="size-4"
                />
                Correctivos
              </label>
            </div>
          </div>

          <div>
            <Label>Estado</Label>
            <Select value={form.estado ?? "activo"} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADO_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {equiposFiltrados.length > 0 && (
            <div>
              <Label>Equipos cubiertos</Label>
              <div className="mt-1 max-h-40 overflow-y-auto rounded border divide-y text-sm">
                {equiposFiltrados.map((eq) => (
                  <label key={eq.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={equiposSeleccionados.includes(eq.id)}
                      onChange={() => toggleEquipo(eq.id)}
                      className="size-4"
                    />
                    <span>{eq.nombre}</span>
                    {eq.numero_serie && (
                      <span className="text-muted-foreground ml-auto">S/N: {eq.numero_serie}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Observaciones</Label>
            <Textarea
              value={form.observaciones ?? ""}
              onChange={(e) => set("observaciones", e.target.value || null)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !form.cliente_id || !form.fecha_inicio || !form.fecha_fin}>
              {loading ? "Guardando…" : contrato ? "Guardar cambios" : "Crear contrato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
