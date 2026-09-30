/**
 * Plantillas de Actividad — CRUD para mantenimiento preventivo
 * Permite definir qué actividades se auto-poblan en las órdenes según tipo OS y fabricante.
 */
import { useState } from "react";
import { Plus, Pencil, Power, PowerOff } from "lucide-react";
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
  usePlantillasActividad,
  useCrearPlantillaActividad,
  useActualizarPlantillaActividad,
} from "@/hooks/entities/use-servicio-tecnico";
import type { PlantillaActividad } from "@/services/servicio-tecnico/actividades";

// ── Constantes ────────────────────────────────────────────────────────────────

const PERIODICIDADES = [
  { value: "null", label: "Cada visita (sin periodicidad)" },
  { value: "30",   label: "Mensual (30 días)" },
  { value: "90",   label: "Trimestral (90 días)" },
  { value: "180",  label: "Semestral (180 días)" },
  { value: "365",  label: "Anual (365 días)" },
];

const TIPOS_OS = [
  { value: "all",          label: "Todos los tipos" },
  { value: "correctivo",   label: "Correctivo" },
  { value: "preventivo",   label: "Preventivo" },
  { value: "instalacion",  label: "Instalación" },
  { value: "garantia",     label: "Garantía" },
];

function periLabel(dias: number | null): string {
  if (dias == null) return "Cada visita";
  const found = PERIODICIDADES.find((p) => p.value === String(dias));
  return found ? found.label : `${dias} días`;
}

// ── Form interno ──────────────────────────────────────────────────────────────

interface FormState {
  nombre: string;
  descripcion: string;
  periodicidad_dias: string; // "null" | "30" | "90" | "180" | "365"
  aplica_tipo_os: string;    // "all" | tipo
}

const emptyForm = (): FormState => ({
  nombre: "",
  descripcion: "",
  periodicidad_dias: "null",
  aplica_tipo_os: "all",
});

function toPayload(f: FormState) {
  return {
    nombre: f.nombre.trim(),
    descripcion: f.descripcion.trim() || null,
    periodicidad_dias: f.periodicidad_dias === "null" ? null : parseInt(f.periodicidad_dias, 10),
    aplica_tipo_os: f.aplica_tipo_os === "all" ? null : f.aplica_tipo_os,
    fabricante_id: null as string | null,
    activa: true,
  };
}

// ── Diálogo crear / editar ────────────────────────────────────────────────────

interface PlantillaDialogProps {
  open: boolean;
  plantilla: PlantillaActividad | null; // null = crear
  onClose: () => void;
}

function PlantillaDialog({ open, plantilla, onClose }: PlantillaDialogProps) {
  const crearMut = useCrearPlantillaActividad();
  const actualizarMut = useActualizarPlantillaActividad();

  const [form, setForm] = useState<FormState>(() =>
    plantilla
      ? {
          nombre: plantilla.nombre,
          descripcion: plantilla.descripcion ?? "",
          periodicidad_dias: plantilla.periodicidad_dias == null
            ? "null"
            : String(plantilla.periodicidad_dias),
          aplica_tipo_os: plantilla.aplica_tipo_os ?? "all",
        }
      : emptyForm(),
  );

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const reset = () => setForm(plantilla
    ? {
        nombre: plantilla.nombre,
        descripcion: plantilla.descripcion ?? "",
        periodicidad_dias: plantilla.periodicidad_dias == null
          ? "null"
          : String(plantilla.periodicidad_dias),
        aplica_tipo_os: plantilla.aplica_tipo_os ?? "all",
      }
    : emptyForm());

  const isPending = crearMut.isPending || actualizarMut.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = toPayload(form);
    if (plantilla) {
      await actualizarMut.mutateAsync({ id: plantilla.id, payload });
    } else {
      await crearMut.mutateAsync(payload);
    }
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {plantilla ? "Editar plantilla" : "Nueva plantilla de actividad"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nombre de la actividad *</Label>
            <Input
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              placeholder="Ej: Cambio de filtros de aceite"
              required
            />
          </div>

          <div>
            <Label>Descripción / instrucciones</Label>
            <Textarea
              value={form.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
              placeholder="Pasos, herramientas necesarias, advertencias…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Periodicidad</Label>
              <Select
                value={form.periodicidad_dias}
                onValueChange={(v) => set("periodicidad_dias", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODICIDADES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Aplica a tipo de OS</Label>
              <Select
                value={form.aplica_tipo_os}
                onValueChange={(v) => set("aplica_tipo_os", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_OS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!form.nombre.trim() || isPending}>
              {isPending ? "Guardando…" : (plantilla ? "Guardar cambios" : "Crear plantilla")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Layout principal ──────────────────────────────────────────────────────────

export function PlantillasLayout() {
  const { data: plantillas = [], isLoading } = usePlantillasActividad();
  const actualizarMut = useActualizarPlantillaActividad();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<PlantillaActividad | null>(null);

  const openCrear = () => { setEditando(null); setDialogOpen(true); };
  const openEditar = (p: PlantillaActividad) => { setEditando(p); setDialogOpen(true); };
  const toggleActiva = (p: PlantillaActividad) =>
    actualizarMut.mutate({ id: p.id, payload: { activa: !p.activa } });

  return (
    <div className="p-6 space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Plantillas de actividad</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define las tareas que se auto-cargan en cada orden según el tipo y fabricante del equipo.
          </p>
        </div>
        <Button onClick={openCrear} size="sm">
          <Plus className="size-4 mr-1" /> Nueva plantilla
        </Button>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : plantillas.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-medium">Sin plantillas</p>
          <p className="text-sm mt-1">Crea la primera plantilla para que se carguen automáticamente en las órdenes.</p>
          <Button variant="outline" className="mt-4" onClick={openCrear}>
            <Plus className="size-4 mr-1" /> Crear primera plantilla
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Actividad</th>
                <th className="text-left px-4 py-3">Periodicidad</th>
                <th className="text-left px-4 py-3">Tipo OS</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {plantillas.map((p) => (
                <tr key={p.id} className={`hover:bg-muted/30 ${!p.activa ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.nombre}</p>
                    {p.descripcion && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {p.descripcion}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {periLabel(p.periodicidad_dias)}
                  </td>
                  <td className="px-4 py-3">
                    {p.aplica_tipo_os ? (
                      <Badge variant="secondary" className="capitalize">
                        {p.aplica_tipo_os}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Todos</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={p.activa ? "default" : "outline"}>
                      {p.activa ? "Activa" : "Inactiva"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => openEditar(p)}
                        title="Editar"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground"
                        onClick={() => toggleActiva(p)}
                        title={p.activa ? "Desactivar" : "Activar"}
                        disabled={actualizarMut.isPending}
                      >
                        {p.activa
                          ? <PowerOff className="size-3.5" />
                          : <Power className="size-3.5" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Nota explicativa */}
      {plantillas.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Las plantillas activas se auto-cargan al crear una orden de servicio cuando el tipo y fabricante coinciden.
          Las inactivas no se aplican pero conservan su configuración.
        </p>
      )}

      <PlantillaDialog
        open={dialogOpen}
        plantilla={editando}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
