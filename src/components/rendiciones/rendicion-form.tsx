import { useState, useRef } from "react";
import { Plus } from "lucide-react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EntityForm } from "@/components/common/entity-form";
import { toast } from "@/components/common/toast";

import { useCrearProyecto } from "@/hooks/entities/use-proyectos";
import { useCompany } from "@/contexts/company-context";

import { rendicionSchema } from "./rendicion-types";
import type { RendicionFormValues } from "./rendicion-types";
import type { UseFormSetValue } from "react-hook-form";

interface RendicionFormProps {
  defaultValues: RendicionFormValues;
  onSubmit: (values: RendicionFormValues) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
  proyectos: Array<{ id: string; nombre: string }>;
  estados: Array<{ id: string; nombre: string; codigo: string }>;
  tipos: Array<{ id: string; nombre: string; codigo: string }>;
}

export function RendicionForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading,
  submitLabel,
  proyectos,
  estados,
  tipos,
}: RendicionFormProps) {
  const { empresaActivaId } = useCompany();
  const crearProyecto = useCrearProyecto();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoDescripcion, setNuevoDescripcion] = useState("");
  const [extraProyectos, setExtraProyectos] = useState<Array<{ id: string; nombre: string }>>([]);

  // Ref para acceder a form.setValue desde fuera del render prop
  const setValueRef = useRef<UseFormSetValue<RendicionFormValues> | null>(null);

  const todosProyectos = [...proyectos, ...extraProyectos];

  async function handleCrearProyecto() {
    if (!nuevoNombre.trim() || !empresaActivaId) return;
    try {
      const nuevo = await crearProyecto.mutateAsync({
        empresa_id: empresaActivaId,
        nombre: nuevoNombre.trim(),
        descripcion: nuevoDescripcion.trim() || null,
        estado_financiero: "en_curso",
      } as Parameters<typeof crearProyecto.mutateAsync>[0]);
      setExtraProyectos((prev) => [...prev, { id: nuevo.id, nombre: nuevo.nombre }]);
      setValueRef.current?.("proyecto_id", nuevo.id);
      setDialogOpen(false);
      setNuevoNombre("");
      setNuevoDescripcion("");
      toast.success(`Proyecto "${nuevo.nombre}" creado.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear el proyecto.");
    }
  }

  return (
    <>
      <EntityForm
        schema={rendicionSchema}
        defaultValues={defaultValues}
        onSubmit={onSubmit}
        onCancel={onCancel}
        loading={loading}
        submitLabel={submitLabel}
      >
        {(form) => {
          // Sync ref on every render (safe — not a hook call)
          setValueRef.current = form.setValue;

          return (
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="numero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numero *</FormLabel>
                    <FormControl>
                      <Input placeholder="REN-2025-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fecha_rendicion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="proyecto_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Proyecto *</FormLabel>
                    <div className="flex gap-2">
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecciona un proyecto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {todosProyectos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        aria-label="Crear nuevo proyecto"
                        onClick={() => setDialogOpen(true)}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="motivo"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Motivo del viaje</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Visita a cliente, mantenimiento, capacitacion"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Descripcion</FormLabel>
                    <FormControl>
                      <Input placeholder="Notas adicionales" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo_rendicion_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select
                      value={field.value ?? "__none__"}
                      onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sin tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Sin tipo</SelectItem>
                        {tipos.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estado_rendicion_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select
                      value={field.value ?? "__none__"}
                      onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sin estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Sin estado</SelectItem>
                        {estados.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="col-span-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Anticipos
              </p>

              <FormField
                control={form.control}
                name="anticipo_efectivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anticipo en efectivo</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="anticipo_credito"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anticipo en tarjeta</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          );
        }}
      </EntityForm>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo proyecto</DialogTitle>
            <DialogDescription>
              Crea un proyecto rapido. Puedes completar los detalles desde el modulo Proyectos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Nombre *</label>
              <Input
                placeholder="Ej: Proyecto Ecuador 2025"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCrearProyecto();
                }}
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Descripcion</label>
              <Input
                placeholder="Opcional"
                value={nuevoDescripcion}
                onChange={(e) => setNuevoDescripcion(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setNuevoNombre("");
                setNuevoDescripcion("");
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={!nuevoNombre.trim() || crearProyecto.isPending}
              onClick={() => void handleCrearProyecto()}
            >
              {crearProyecto.isPending ? "Creando..." : "Crear proyecto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
