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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  useProveedores,
  useCrearProveedor,
  useActualizarProveedor,
  useEliminarProveedor,
} from "@/hooks/entities/use-proveedores";
import { useCompany } from "@/contexts/company-context";

import type { DataTableColumn } from "@/components/common/data-table";
import type { Proveedor, ProveedorInsert, ProveedorUpdate } from "@/types/entities";
import type { ListParams } from "@/types/common";

export const Route = createFileRoute("/proveedores")({
  head: () => ({ meta: [{ title: "Proveedores · Viatik" }] }),
  component: ProveedoresPage,
});

// ─── Schema ────────────────────────────────────────────────────────────────────

const proveedorSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  codigo: z.string().nullable().optional(),
  identificacion: z.string().nullable().optional(),
  correo: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Correo inválido",
    }),
  telefono: z.string().nullable().optional(),
  ciudad: z.string().nullable().optional(),
  pais: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
});

type ProveedorFormValues = z.infer<typeof proveedorSchema>;

const EMPTY_FORM: ProveedorFormValues = {
  nombre: "",
  codigo: "",
  identificacion: "",
  correo: "",
  telefono: "",
  ciudad: "",
  pais: "",
  estado: "activo",
};

function proveedorToForm(p: Proveedor): ProveedorFormValues {
  return {
    nombre: p.nombre,
    codigo: p.codigo ?? "",
    identificacion: p.identificacion ?? "",
    correo: p.correo ?? "",
    telefono: p.telefono ?? "",
    ciudad: p.ciudad ?? "",
    pais: p.pais ?? "",
    estado: p.estado ?? "activo",
  };
}

import { emptyToNull } from "@/utils/formatters";

// ─── Route component ───────────────────────────────────────────────────────────

function ProveedoresPage() {
  return (
    <AppShell>
      <ProveedoresContent />
    </AppShell>
  );
}

// ─── Content ───────────────────────────────────────────────────────────────────

function ProveedoresContent() {
  const { empresaActivaId } = useCompany();
  const [params, setParams] = useState<ListParams>({ page: 1, pageSize: 25 });
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [deletingProveedor, setDeletingProveedor] = useState<Proveedor | null>(null);

  const { data, isLoading, error } = useProveedores({ ...params, search });
  const crear = useCrearProveedor();
  const actualizar = useActualizarProveedor();
  const eliminar = useEliminarProveedor();

  // ─── Columns ─────────────────────────────────────────────────────────────────

  const columns: DataTableColumn<Proveedor>[] = [
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
          {row.identificacion && (
            <p className="text-xs text-muted-foreground">{row.identificacion}</p>
          )}
        </div>
      ),
    },
    {
      key: "contacto",
      header: "Contacto",
      cell: (row) => (
        <div>
          {row.correo && <p className="text-sm">{row.correo}</p>}
          {row.telefono && <p className="text-xs text-muted-foreground">{row.telefono}</p>}
          {!row.correo && !row.telefono && "—"}
        </div>
      ),
    },
    {
      key: "ubicacion",
      header: "Ubicación",
      cell: (row) => {
        const parts = [row.ciudad, row.pais].filter(Boolean).join(", ");
        return parts || "—";
      },
    },
    {
      key: "estado",
      header: "Estado",
      cell: (row) => {
        if (!row.estado) return <span className="text-muted-foreground">—</span>;
        const tone =
          row.estado === "activo" ? "success" : row.estado === "inactivo" ? "danger" : "neutral";
        return (
          <StatusBadge tone={tone}>
            {row.estado.charAt(0).toUpperCase() + row.estado.slice(1)}
          </StatusBadge>
        );
      },
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
            aria-label="Editar proveedor"
            onClick={(e) => {
              e.stopPropagation();
              setEditingProveedor(row);
              setDrawerOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label="Eliminar proveedor"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingProveedor(row);
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
    setEditingProveedor(null);
    setDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setDrawerOpen(false);
    setEditingProveedor(null);
  }

  async function handleSubmit(values: ProveedorFormValues) {
    if (!empresaActivaId) {
      toast.error("Selecciona una empresa activa antes de continuar.");
      return;
    }

    try {
      if (editingProveedor) {
        const payload: ProveedorUpdate = {
          nombre: values.nombre,
          codigo: emptyToNull(values.codigo),
          identificacion: emptyToNull(values.identificacion),
          correo: emptyToNull(values.correo),
          telefono: emptyToNull(values.telefono),
          ciudad: emptyToNull(values.ciudad),
          pais: emptyToNull(values.pais),
          estado: values.estado ?? null,
        };
        await actualizar.mutateAsync({ id: editingProveedor.id, payload });
        toast.success("Proveedor actualizado correctamente.");
      } else {
        const payload: ProveedorInsert = {
          empresa_id: empresaActivaId,
          nombre: values.nombre,
          codigo: emptyToNull(values.codigo),
          identificacion: emptyToNull(values.identificacion),
          correo: emptyToNull(values.correo),
          telefono: emptyToNull(values.telefono),
          ciudad: emptyToNull(values.ciudad),
          pais: emptyToNull(values.pais),
          estado: values.estado ?? "activo",
        };
        await crear.mutateAsync(payload);
        toast.success("Proveedor creado correctamente.");
      }
      handleCloseDrawer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    }
  }

  async function handleDelete() {
    if (!deletingProveedor) return;
    try {
      await eliminar.mutateAsync(deletingProveedor.id);
      toast.success('"' + deletingProveedor.nombre + '" eliminado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el proveedor.");
    } finally {
      setDeletingProveedor(null);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Proveedores"
        description="Catálogo de proveedores y condiciones de pago."
        breadcrumbs={[{ label: "Proveedores" }]}
        actions={
          <Button onClick={handleOpenNew} size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Nuevo proveedor
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder="Buscar por nombre, identificación, correo, ciudad..."
        />
      </div>

      {error ? (
        <EmptyState
          title="Error al cargar proveedores"
          description={error instanceof Error ? error.message : "Ocurrió un error inesperado."}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.rows ?? []}
            isLoading={isLoading}
            getRowId={(row) => row.id}
            emptyTitle="Sin proveedores"
            emptyDescription="Agrega tu primer proveedor con el botón Nuevo proveedor."
            emptyAction={
              <Button size="sm" onClick={handleOpenNew} className="gap-1.5">
                <Plus className="size-4" />
                Nuevo proveedor
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
            <DrawerTitle>{editingProveedor ? "Editar proveedor" : "Nuevo proveedor"}</DrawerTitle>
            <DrawerDescription>
              {editingProveedor
                ? "Modifica los datos del proveedor."
                : "Completa los datos para agregar un nuevo proveedor."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-6 pb-6">
            <ProveedorForm
              defaultValues={editingProveedor ? proveedorToForm(editingProveedor) : EMPTY_FORM}
              onSubmit={handleSubmit}
              onCancel={handleCloseDrawer}
              loading={crear.isPending || actualizar.isPending}
              submitLabel={editingProveedor ? "Guardar cambios" : "Crear proveedor"}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <DeleteDialog
        open={!!deletingProveedor}
        onOpenChange={(open) => {
          if (!open) setDeletingProveedor(null);
        }}
        entityLabel={'el proveedor "' + (deletingProveedor?.nombre ?? "") + '"'}
        onConfirm={handleDelete}
        loading={eliminar.isPending}
      />
    </>
  );
}

// ─── Form component ────────────────────────────────────────────────────────────

interface ProveedorFormProps {
  defaultValues: ProveedorFormValues;
  onSubmit: (values: ProveedorFormValues) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
}

function ProveedorForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading,
  submitLabel,
}: ProveedorFormProps) {
  return (
    <EntityForm
      schema={proveedorSchema}
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
                  <Input placeholder="Nombre del proveedor" {...field} />
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
                  <Input placeholder="PRV-001" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="identificacion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>RUC / Identificación</FormLabel>
                <FormControl>
                  <Input placeholder="20123456789" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="correo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="contacto@proveedor.com"
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
            name="telefono"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <Input placeholder="+51 999 999 999" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ciudad"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ciudad</FormLabel>
                <FormControl>
                  <Input placeholder="Lima" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="pais"
            render={({ field }) => (
              <FormItem>
                <FormLabel>País</FormLabel>
                <FormControl>
                  <Input placeholder="Perú" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="estado"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Estado</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? "activo"}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                    <SelectItem value="suspendido">Suspendido</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </EntityForm>
  );
}
