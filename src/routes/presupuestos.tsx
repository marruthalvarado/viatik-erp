import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Plus, Pencil, Trash2 } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { DataTable } from "@/components/common/data-table";
import { SearchBar } from "@/components/common/search-bar";
import { Pagination } from "@/components/common/pagination";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { EntityForm } from "@/components/common/entity-form";
import { EmptyState } from "@/components/common/empty-state";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  usePresupuestos,
  useCrearPresupuesto,
  useActualizarPresupuesto,
  useEliminarPresupuesto,
} from "@/hooks/entities/use-presupuestos";
import { useProyectos } from "@/hooks/entities/use-proyectos";
import { useCompany } from "@/contexts/company-context";
import { formatCurrency, emptyToNull } from "@/utils/formatters";

import type { DataTableColumn } from "@/components/common/data-table";
import type { Presupuesto, PresupuestoInsert, PresupuestoUpdate } from "@/types/entities";
import type { ListParams } from "@/types/common";

export const Route = createFileRoute("/presupuestos")({
  head: () => ({ meta: [{ title: "Presupuestos · Viatik" }] }),
  component: PresupuestosPage,
});

// ─── Schema ────────────────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear();

const presupuestoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  anio: z
    .number({ invalid_type_error: "El año es requerido" })
    .int("Debe ser un año entero")
    .min(2000, "Año mínimo 2000")
    .max(2100, "Año máximo 2100"),
  codigo: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  proyecto_id: z.string().nullable().optional(),
  activo: z.boolean().nullable().optional(),
  valor_total: z.number().nonnegative("Debe ser positivo").nullable().optional(),
});

type PresupuestoFormValues = z.infer<typeof presupuestoSchema>;

const EMPTY_FORM: PresupuestoFormValues = {
  nombre: "",
  anio: currentYear,
  codigo: "",
  descripcion: "",
  proyecto_id: null,
  activo: true,
  valor_total: null,
};

function presupuestoToForm(p: Presupuesto): PresupuestoFormValues {
  return {
    nombre: p.nombre,
    anio: p.anio,
    codigo: p.codigo ?? "",
    descripcion: p.descripcion ?? "",
    proyecto_id: p.proyecto_id ?? null,
    activo: p.activo ?? true,
    valor_total: p.valor_total ?? null,
  };
}

// ─── Route component ───────────────────────────────────────────────────────────

function PresupuestosPage() {
  return (
    <AppShell>
      <PresupuestosContent />
    </AppShell>
  );
}

// ─── Content ───────────────────────────────────────────────────────────────────

function PresupuestosContent() {
  const { empresaActivaId } = useCompany();
  const [params, setParams] = useState<ListParams>({ page: 1, pageSize: 25 });
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPresupuesto, setEditingPresupuesto] = useState<Presupuesto | null>(null);
  const [deletingPresupuesto, setDeletingPresupuesto] = useState<Presupuesto | null>(null);

  const { data, isLoading, error } = usePresupuestos({ ...params, search });
  const { data: proyectosData } = useProyectos({ pageSize: 200 });
  const crear = useCrearPresupuesto();
  const actualizar = useActualizarPresupuesto();
  const eliminar = useEliminarPresupuesto();

  const proyectos = proyectosData?.rows ?? [];

  function proyectoNombre(id: string | null | undefined): string {
    if (!id) return "—";
    return proyectos.find((p) => p.id === id)?.nombre ?? id;
  }

  // ─── Columns ─────────────────────────────────────────────────────────────────

  const columns: DataTableColumn<Presupuesto>[] = [
    {
      key: "codigo",
      header: "Código",
      className: "w-24",
      cell: (row) => <span className="text-xs text-muted-foreground">{row.codigo ?? "—"}</span>,
    },
    {
      key: "nombre",
      header: "Nombre",
      cell: (row) => (
        <div>
          <p className="text-sm font-medium">{row.nombre}</p>
          {row.descripcion && <p className="text-xs text-muted-foreground">{row.descripcion}</p>}
        </div>
      ),
    },
    {
      key: "anio",
      header: "Año",
      className: "w-20",
      cell: (row) => <span className="tabular-nums">{row.anio}</span>,
    },
    {
      key: "proyecto",
      header: "Proyecto",
      cell: (row) => proyectoNombre(row.proyecto_id),
    },
    {
      key: "valor_total",
      header: "Total",
      align: "right",
      cell: (row) => <span className="tabular-nums">{formatCurrency(row.valor_total)}</span>,
    },
    {
      key: "activo",
      header: "Estado",
      cell: (row) => (
        <StatusBadge tone={row.activo ? "success" : "neutral"}>
          {row.activo ? "Activo" : "Inactivo"}
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
            aria-label="Editar presupuesto"
            onClick={(e) => {
              e.stopPropagation();
              setEditingPresupuesto(row);
              setDrawerOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label="Eliminar presupuesto"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingPresupuesto(row);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  function handleSearchChange(value: string) {
    setSearch(value);
    setParams((p) => ({ ...p, page: 1 }));
  }

  function handleOpenNew() {
    setEditingPresupuesto(null);
    setDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setDrawerOpen(false);
    setEditingPresupuesto(null);
  }

  async function handleSubmit(values: PresupuestoFormValues) {
    if (!empresaActivaId) {
      toast.error("Selecciona una empresa activa antes de continuar.");
      return;
    }
    try {
      if (editingPresupuesto) {
        const payload: PresupuestoUpdate = {
          nombre: values.nombre,
          anio: values.anio,
          codigo: emptyToNull(values.codigo),
          descripcion: emptyToNull(values.descripcion),
          proyecto_id: values.proyecto_id ?? null,
          activo: values.activo ?? true,
          valor_total: values.valor_total ?? null,
        };
        await actualizar.mutateAsync({ id: editingPresupuesto.id, payload });
        toast.success("Presupuesto actualizado correctamente.");
      } else {
        const payload: PresupuestoInsert = {
          empresa_id: empresaActivaId,
          nombre: values.nombre,
          anio: values.anio,
          codigo: emptyToNull(values.codigo),
          descripcion: emptyToNull(values.descripcion),
          proyecto_id: values.proyecto_id ?? null,
          activo: values.activo ?? true,
          valor_total: values.valor_total ?? null,
        };
        await crear.mutateAsync(payload);
        toast.success("Presupuesto creado correctamente.");
      }
      handleCloseDrawer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el presupuesto.");
    }
  }

  async function handleDelete() {
    if (!deletingPresupuesto) return;
    try {
      await eliminar.mutateAsync(deletingPresupuesto.id);
      toast.success(`"${deletingPresupuesto.nombre}" eliminado.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el presupuesto.");
    } finally {
      setDeletingPresupuesto(null);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Presupuestos"
        description="Planificación y control presupuestario."
        breadcrumbs={[{ label: "Presupuestos" }]}
        actions={
          <Button onClick={handleOpenNew} size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Nuevo presupuesto
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder="Buscar por nombre, código, descripción..."
        />
      </div>

      {error ? (
        <EmptyState
          title="Error al cargar presupuestos"
          description={error instanceof Error ? error.message : "Ocurrió un error inesperado."}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.rows ?? []}
            isLoading={isLoading}
            getRowId={(row) => row.id}
            emptyTitle="Sin presupuestos"
            emptyDescription="Crea tu primer presupuesto con el botón Nuevo presupuesto."
            emptyAction={
              <Button size="sm" onClick={handleOpenNew} className="gap-1.5">
                <Plus className="size-4" />
                Nuevo presupuesto
              </Button>
            }
          />

          {data && data.total > 0 && (
            <div className="mt-3">
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={(page) => setParams((p) => ({ ...p, page }))}
              />
            </div>
          )}
        </>
      )}

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseDrawer();
        }}
      >
        <DrawerContent className="sm:max-w-lg">
          <DrawerHeader>
            <DrawerTitle>
              {editingPresupuesto ? "Editar presupuesto" : "Nuevo presupuesto"}
            </DrawerTitle>
            <DrawerDescription>
              {editingPresupuesto
                ? "Modifica los datos del presupuesto."
                : "Completa los datos para crear un presupuesto."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-6 pb-6">
            <PresupuestoForm
              defaultValues={
                editingPresupuesto ? presupuestoToForm(editingPresupuesto) : EMPTY_FORM
              }
              onSubmit={handleSubmit}
              onCancel={handleCloseDrawer}
              loading={crear.isPending || actualizar.isPending}
              submitLabel={editingPresupuesto ? "Guardar cambios" : "Crear presupuesto"}
              proyectos={proyectos}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <DeleteDialog
        open={!!deletingPresupuesto}
        onOpenChange={(open) => {
          if (!open) setDeletingPresupuesto(null);
        }}
        entityLabel={`el presupuesto "${deletingPresupuesto?.nombre ?? ""}"`}
        onConfirm={handleDelete}
        loading={eliminar.isPending}
      />
    </>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

interface PresupuestoFormProps {
  defaultValues: PresupuestoFormValues;
  onSubmit: (values: PresupuestoFormValues) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
  proyectos: Array<{ id: string; nombre: string }>;
}

function PresupuestoForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading,
  submitLabel,
  proyectos,
}: PresupuestoFormProps) {
  return (
    <EntityForm
      schema={presupuestoSchema}
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
            name="nombre"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Nombre *</FormLabel>
                <FormControl>
                  <Input placeholder="Presupuesto Operativo 2025" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="anio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Año *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="2025"
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
            name="codigo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código</FormLabel>
                <FormControl>
                  <Input placeholder="PRES-001" {...field} value={field.value ?? ""} />
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
                <FormLabel>Descripción</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Descripción del presupuesto"
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
            name="proyecto_id"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Proyecto</FormLabel>
                <Select
                  value={field.value ?? "__none__"}
                  onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin proyecto" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Sin proyecto</SelectItem>
                    {proyectos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
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
            name="valor_total"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor total</FormLabel>
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
            name="activo"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value ?? true} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="cursor-pointer font-normal">Presupuesto activo</FormLabel>
              </FormItem>
            )}
          />
        </div>
      )}
    </EntityForm>
  );
}
