import { useState, useRef } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { cn } from "@/lib/utils";

import { useCrearProyecto } from "@/hooks/entities/use-proyectos";
import { useCompany } from "@/contexts/company-context";

import { rendicionSchema } from "./rendicion-types";
import type { RendicionFormValues } from "./rendicion-types";
import type { UseFormReturn } from "react-hook-form";

// Roles que pueden crear proyectos
const ROLES_PUEDE_CREAR_PROYECTO = ["admin", "aprobador"];

interface RendicionFormProps {
  defaultValues: RendicionFormValues;
  onSubmit: (values: RendicionFormValues) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
  proyectos: Array<{ id: string; nombre: string }>;
  tipos: Array<{ id: string; nombre: string; codigo: string }>;
  rolCodigo: string | null | undefined;
  isEditing?: boolean;
}

export function RendicionForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading,
  submitLabel,
  proyectos,
  tipos,
  rolCodigo,
  isEditing = false,
}: RendicionFormProps) {
  const { empresaActivaId } = useCompany();
  const crearProyecto = useCrearProyecto();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [proyectoPopoverOpen, setProyectoPopoverOpen] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoDescripcion, setNuevoDescripcion] = useState("");
  const [extraProyectos, setExtraProyectos] = useState<Array<{ id: string; nombre: string }>>([]);

  const formRef = useRef<UseFormReturn<RendicionFormValues> | null>(null);

  const todosProyectos = [...proyectos, ...extraProyectos];
  const puedeCrearProyecto = ROLES_PUEDE_CREAR_PROYECTO.includes(rolCodigo ?? "");

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
      formRef.current?.setValue("proyecto_id", nuevo.id);
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
          formRef.current = form;
          const vehiculoPropio = form.watch("viaje_vehiculo_propio");

          return (
            <div className="grid grid-cols-2 gap-4">
              {/* ── Número (auto-generado) ─────────────────────── */}
              <FormField
                control={form.control}
                name="numero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        disabled
                        placeholder="Se generará automáticamente"
                        className="bg-muted text-muted-foreground cursor-not-allowed"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ── Fecha (auto-llenado, no editable) ────────── */}
              <FormField
                control={form.control}
                name="fecha_rendicion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ""}
                        disabled
                        className="bg-muted text-muted-foreground cursor-not-allowed"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ── Proyecto (combobox con búsqueda) ──────────── */}
              <FormField
                control={form.control}
                name="proyecto_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Proyecto *</FormLabel>
                    <div className="flex gap-2">
                      <Popover open={proyectoPopoverOpen} onOpenChange={setProyectoPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "flex-1 justify-between font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value
                                ? (todosProyectos.find((p) => p.id === field.value)?.nombre ??
                                  "Proyecto no encontrado")
                                : "Selecciona o busca un proyecto"}
                              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar proyecto..." />
                            <CommandList>
                              <CommandEmpty>Sin resultados.</CommandEmpty>
                              <CommandGroup>
                                {todosProyectos.map((p) => (
                                  <CommandItem
                                    key={p.id}
                                    value={p.nombre}
                                    onSelect={() => {
                                      field.onChange(p.id);
                                      setProyectoPopoverOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 size-4",
                                        field.value === p.id ? "opacity-100" : "opacity-0",
                                      )}
                                    />
                                    {p.nombre}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      {puedeCrearProyecto && (
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
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ── Motivo ────────────────────────────────────── */}
              <FormField
                control={form.control}
                name="motivo"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Motivo del viaje</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Visita a cliente, mantenimiento, capacitación"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ── Descripción ───────────────────────────────── */}
              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Input placeholder="Notas adicionales" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ── Tipo ─────────────────────────────────────── */}
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

              {/* ── Anticipos ─────────────────────────────────── */}
              <p className="col-span-2 mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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

              {/* ── Sección Viaje ─────────────────────────────── */}
              <div className="col-span-2 mt-2 rounded-md border border-border bg-muted/30 px-4 py-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Datos del Viaje
                </p>
                {!isEditing && (
                  <p className="mb-4 text-xs text-muted-foreground">
                    Registra los datos del viaje para esta rendición
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="viaje_origen"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ciudad Origen</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Quito" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="viaje_destino"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ciudad Destino</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Guayaquil" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="viaje_fecha_inicio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha Inicio</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="viaje_fecha_fin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha Fin</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="viaje_vehiculo_propio"
                    render={({ field }) => (
                      <FormItem className="col-span-2 flex flex-row items-center gap-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer font-normal">
                          Vehículo propio
                        </FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="viaje_distancia_km"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className={cn(!vehiculoPropio && "text-muted-foreground")}>
                          Distancia (km)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder="0"
                            disabled={!vehiculoPropio}
                            className={cn(!vehiculoPropio && "bg-muted cursor-not-allowed")}
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
              </div>
            </div>
          );
        }}
      </EntityForm>

      {/* Dialog: crear proyecto rápido */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo proyecto</DialogTitle>
            <DialogDescription>
              Crea un proyecto rápido. Puedes completar los detalles desde el módulo Proyectos.
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
              <label className="text-sm font-medium">Descripción</label>
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
