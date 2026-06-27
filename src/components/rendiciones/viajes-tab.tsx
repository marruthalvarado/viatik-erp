/**
 * ViajesTab — CRUD completo de viajes dentro de una rendición.
 * ViajeForm es un componente interno (no exportado).
 */
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";

import { DataTable } from "@/components/common/data-table";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { EntityForm } from "@/components/common/entity-form";
import { toast } from "@/components/common/toast";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/common/drawer";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  useViajes,
  useCrearViaje,
  useActualizarViaje,
  useEliminarViaje,
} from "@/hooks/entities/use-viajes";
import { emptyToNull } from "@/utils/formatters";
import { formatDate } from "@/utils/formatters";
import { viajeSchema, viajeToForm, EMPTY_VIAJE } from "./viaje-types";
import type { ViajeFormValues } from "./viaje-types";

import type { DataTableColumn } from "@/components/common/data-table";
import type { Viaje, ViajeInsert, ViajeUpdate } from "@/types/entities";

// ─── ViajeForm (interno) ───────────────────────────────────────────────────────

interface ViajeFormProps {
  defaultValues: ViajeFormValues;
  onSubmit: (values: ViajeFormValues) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
}

function ViajeForm({ defaultValues, onSubmit, onCancel, loading, submitLabel }: ViajeFormProps) {
  return (
    <EntityForm
      schema={viajeSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
      loading={loading}
      submitLabel={submitLabel}
    >
      {(form) => (
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="destino"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Destino *</FormLabel>
                <FormControl>
                  <Input placeholder="Ciudad, País" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="numero"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número</FormLabel>
                <FormControl>
                  <Input placeholder="VIA-001" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="distancia_km"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Distancia (km)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
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
            name="fecha_inicio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha inicio</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fecha_fin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha fin</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="observaciones"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Observaciones</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Observaciones del viaje"
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
            name="vehiculo_propio"
            render={({ field }) => (
              <FormItem className="col-span-2 flex flex-row items-center gap-3 space-y-0">
                <FormControl>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={field.value ?? false}
                    onChange={(e) => field.onChange(e.target.checked)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormLabel className="cursor-pointer font-normal">Vehículo propio</FormLabel>
              </FormItem>
            )}
          />
        </div>
      )}
    </EntityForm>
  );
}

// ─── ViajesTab (exportado) ────────────────────────────────────────────────────

export function ViajesTab({ rendicionId }: { rendicionId: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingViaje, setEditingViaje] = useState<Viaje | null>(null);
  const [deletingViaje, setDeletingViaje] = useState<Viaje | null>(null);

  const { data, isLoading } = useViajes({
    pageSize: 50,
    filters: { rendicion_id: rendicionId },
  });

  const crear = useCrearViaje();
  const actualizar = useActualizarViaje();
  const eliminar = useEliminarViaje();

  const viajes = data?.rows ?? [];

  function handleOpenNew() {
    setEditingViaje(null);
    setDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setDrawerOpen(false);
    setEditingViaje(null);
  }

  async function handleSubmit(values: ViajeFormValues) {
    try {
      if (editingViaje) {
        const payload: ViajeUpdate = {
          destino: values.destino,
          numero: emptyToNull(values.numero),
          fecha_inicio: emptyToNull(values.fecha_inicio),
          fecha_fin: emptyToNull(values.fecha_fin),
          observaciones: emptyToNull(values.observaciones),
          distancia_km: values.distancia_km ?? null,
          vehiculo_propio: values.vehiculo_propio ?? false,
        };
        await actualizar.mutateAsync({ id: editingViaje.id, payload });
        toast.success("Viaje actualizado.");
      } else {
        const payload: ViajeInsert = {
          rendicion_id: rendicionId,
          destino: values.destino,
          numero: emptyToNull(values.numero),
          fecha_inicio: emptyToNull(values.fecha_inicio),
          fecha_fin: emptyToNull(values.fecha_fin),
          observaciones: emptyToNull(values.observaciones),
          distancia_km: values.distancia_km ?? null,
          vehiculo_propio: values.vehiculo_propio ?? false,
        };
        await crear.mutateAsync(payload);
        toast.success("Viaje registrado.");
      }
      handleCloseDrawer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el viaje.");
    }
  }

  async function handleDelete() {
    if (!deletingViaje) return;
    try {
      await eliminar.mutateAsync(deletingViaje.id);
      toast.success("Viaje eliminado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el viaje.");
    } finally {
      setDeletingViaje(null);
    }
  }

  const columns: DataTableColumn<Viaje>[] = [
    {
      key: "destino",
      header: "Destino",
      cell: (row) => (
        <div>
          <p className="text-sm font-medium">{row.destino}</p>
          {row.numero && <p className="text-xs text-muted-foreground">#{row.numero}</p>}
        </div>
      ),
    },
    {
      key: "fechas",
      header: "Período",
      cell: (row) => (
        <span className="text-sm tabular-nums">
          {formatDate(row.fecha_inicio)}
          {row.fecha_fin ? ` → ${formatDate(row.fecha_fin)}` : ""}
        </span>
      ),
    },
    {
      key: "distancia_km",
      header: "Km",
      align: "right",
      className: "w-20",
      cell: (row) => (
        <span className="text-sm tabular-nums">
          {row.distancia_km != null ? `${row.distancia_km} km` : "—"}
        </span>
      ),
    },
    {
      key: "vehiculo_propio",
      header: "Vehículo",
      className: "w-28",
      cell: (row) => (
        <StatusBadge tone={row.vehiculo_propio ? "info" : "neutral"}>
          {row.vehiculo_propio ? "Propio" : "Sin vehículo"}
        </StatusBadge>
      ),
    },
    {
      key: "acciones",
      header: "",
      className: "w-[88px]",
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Editar viaje"
            onClick={(e) => {
              e.stopPropagation();
              setEditingViaje(row);
              setDrawerOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label="Eliminar viaje"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingViaje(row);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data?.total ?? 0} viaje{(data?.total ?? 0) !== 1 ? "s" : ""} registrado
          {(data?.total ?? 0) !== 1 ? "s" : ""}
        </p>
        <Button size="sm" className="gap-1.5" onClick={handleOpenNew}>
          <Plus className="size-4" />
          Nuevo viaje
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={viajes}
        isLoading={isLoading}
        getRowId={(row) => row.id}
        emptyTitle="Sin viajes"
        emptyDescription="Esta rendición no tiene viajes registrados."
        emptyAction={
          <Button size="sm" onClick={handleOpenNew} className="gap-1.5">
            <Plus className="size-4" />
            Nuevo viaje
          </Button>
        }
      />

      <Drawer open={drawerOpen} onOpenChange={(open) => !open && handleCloseDrawer()}>
        <DrawerContent className="sm:max-w-lg">
          <DrawerHeader>
            <DrawerTitle>{editingViaje ? "Editar viaje" : "Nuevo viaje"}</DrawerTitle>
            <DrawerDescription>
              {editingViaje
                ? "Modifica los datos del viaje."
                : "Registra los datos del viaje para esta rendición."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-6 pb-6">
            <ViajeForm
              defaultValues={editingViaje ? viajeToForm(editingViaje) : EMPTY_VIAJE}
              onSubmit={handleSubmit}
              onCancel={handleCloseDrawer}
              loading={crear.isPending || actualizar.isPending}
              submitLabel={editingViaje ? "Guardar cambios" : "Registrar viaje"}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <DeleteDialog
        open={!!deletingViaje}
        onOpenChange={(open) => !open && setDeletingViaje(null)}
        entityLabel={`el viaje a "${deletingViaje?.destino ?? ""}"`}
        onConfirm={handleDelete}
        loading={eliminar.isPending}
      />
    </>
  );
}
