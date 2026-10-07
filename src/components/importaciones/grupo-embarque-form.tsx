/**
 * grupo-embarque-form.tsx
 * Formulario para crear / editar un Grupo de Embarque.
 */
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCrearGrupoEmbarque,
  useActualizarGrupoEmbarque,
} from "@/hooks/entities/use-grupos-embarque";
import type { GrupoConImportaciones } from "@/services/importaciones-grupo";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  descripcion: z.string().optional(),
  fecha: z.string().min(1, "Requerido"),
  flete_total: z.coerce.number().min(0),
  seguro_total: z.coerce.number().min(0),
  otros_logistica: z.coerce.number().min(0),
  estado: z.enum(["Abierto", "Prorrateado", "Cerrado"]),
  observacion: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  editando: GrupoConImportaciones | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GrupoEmbarqueForm({ open, onClose, editando }: Props) {
  const crear = useCrearGrupoEmbarque();
  const actualizar = useActualizarGrupoEmbarque();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      descripcion: "",
      fecha: new Date().toISOString().slice(0, 10),
      flete_total: 0,
      seguro_total: 0,
      otros_logistica: 0,
      estado: "Abierto",
      observacion: "",
    },
  });

  useEffect(() => {
    if (editando) {
      form.reset({
        descripcion: editando.descripcion ?? "",
        fecha: editando.fecha,
        flete_total: editando.flete_total,
        seguro_total: editando.seguro_total,
        otros_logistica: editando.otros_logistica,
        estado: editando.estado as FormValues["estado"],
        observacion: editando.observacion ?? "",
      });
    } else {
      form.reset({
        descripcion: "",
        fecha: new Date().toISOString().slice(0, 10),
        flete_total: 0,
        seguro_total: 0,
        otros_logistica: 0,
        estado: "Abierto",
        observacion: "",
      });
    }
  }, [editando, form]);

  async function onSubmit(values: FormValues) {
    try {
      if (editando) {
        await actualizar.mutateAsync({ id: editando.id, payload: values });
      } else {
        await crear.mutateAsync(values);
      }
      onClose();
    } catch (e) {
      form.setError("root", { message: (e as Error).message });
    }
  }

  const isPending = crear.isPending || actualizar.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editando ? "Editar grupo de embarque" : "Nuevo grupo de embarque"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Descripción */}
            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Contenedor Marzo 2026 — Proveedor A + B" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fecha */}
            <FormField
              control={form.control}
              name="fecha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de arribo</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Costos compartidos */}
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="flete_total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flete total (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="seguro_total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seguro total (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="otros_logistica"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Otros logística</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Estado */}
            <FormField
              control={form.control}
              name="estado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Abierto">Abierto</SelectItem>
                      <SelectItem value="Prorrateado">Prorrateado</SelectItem>
                      <SelectItem value="Cerrado">Cerrado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Observación */}
            <FormField
              control={form.control}
              name="observacion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observación</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando…" : editando ? "Actualizar" : "Crear grupo"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
