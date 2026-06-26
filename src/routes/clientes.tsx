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
  useClientes,
  useCrearCliente,
  useActualizarCliente,
  useEliminarCliente,
} from "@/hooks/entities/use-clientes";
import { useCompany } from "@/contexts/company-context";

import type { DataTableColumn } from "@/components/common/data-table";
import type { Cliente, ClienteInsert, ClienteUpdate } from "@/types/entities";
import type { ListParams } from "@/types/common";

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes · Viatik" }] }),
  component: ClientesPage,
});

// ─── Schema ────────────────────────────────────────────────────────────────────

const clienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  nombre_comercial: z.string().nullable().optional(),
  codigo: z.string().nullable().optional(),
  ruc: z.string().nullable().optional(),
  correo: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Correo inválido",
    }),
  telefono: z.string().nullable().optional(),
  contacto_principal: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  meta_facturacion_anual: z
    .number()
    .nonnegative("Debe ser un número positivo")
    .nullable()
    .optional(),
});

type ClienteFormValues = z.infer<typeof clienteSchema>;

const EMPTY_FORM: ClienteFormValues = {
  nombre: "",
  nombre_comercial: "",
  codigo: "",
  ruc: "",
  correo: "",
  telefono: "",
  contacto_principal: "",
  estado: "activo",
  meta_facturacion_anual: null,
};

function clienteToForm(c: Cliente): ClienteFormValues {
  return {
    nombre: c.nombre,
    nombre_comercial: c.nombre_comercial ?? "",
    codigo: c.codigo ?? "",
    ruc: c.ruc ?? "",
    correo: c.correo ?? "",
    telefono: c.telefono ?? "",
    contacto_principal: c.contacto_principal ?? "",
    estado: c.estado ?? "activo",
    meta_facturacion_anual: c.meta_facturacion_anual ?? null,
  };
}

import { emptyToNull } from "@/utils/formatters";

// ─── Route component ───────────────────────────────────────────────────────────

function ClientesPage() {
  return (
    <AppShell>
      <ClientesContent />
    </AppShell>
  );
}

// ─── Content ───────────────────────────────────────────────────────────────────

function ClientesContent() {
  const { empresaActivaId } = useCompany();
  const [params, setParams] = useState<ListParams>({ page: 1, pageSize: 25 });
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deletingCliente, setDeletingCliente] = useState<Cliente | null>(null);

  const { data, isLoading, error } = useClientes({ ...params, search });
  const crear = useCrearCliente();
  const actualizar = useActualizarCliente();
  const eliminar = useEliminarCliente();

  // ─── Columns ─────────────────────────────────────────────────────────────────

  const columns: DataTableColumn<Cliente>[] = [
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
          {row.nombre_comercial && (
            <p className="text-xs text-muted-foreground">{row.nombre_comercial}</p>
          )}
        </div>
      ),
    },
    {
      key: "ruc",
      header: "RUC",
      cell: (row) => row.ruc ?? "—",
    },
    {
      key: "contacto",
      header: "Contacto",
      cell: (row) => (
        <div>
          {row.contacto_principal && <p className="text-sm">{row.contacto_principal}</p>}
          {row.correo && <p className="text-xs text-muted-foreground">{row.correo}</p>}
          {!row.contacto_principal && !row.correo && "—"}
        </div>
      ),
    },
    {
      key: "telefono",
      header: "Teléfono",
      cell: (row) => row.telefono ?? "—",
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
            onClick={(e) => {
              e.stopPropagation();
              setEditingCliente(row);
              setDrawerOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingCliente(row);
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
    setEditingCliente(null);
    setDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setDrawerOpen(false);
    setEditingCliente(null);
  }

  async function handleSubmit(values: ClienteFormValues) {
    if (!empresaActivaId) {
      toast.error("Selecciona una empresa activa antes de continuar.");
      return;
    }

    try {
      if (editingCliente) {
        const payload: ClienteUpdate = {
          nombre: values.nombre,
          nombre_comercial: emptyToNull(values.nombre_comercial),
          codigo: emptyToNull(values.codigo),
          ruc: emptyToNull(values.ruc),
          correo: emptyToNull(values.correo),
          telefono: emptyToNull(values.telefono),
          contacto_principal: emptyToNull(values.contacto_principal),
          estado: values.estado ?? null,
          meta_facturacion_anual: values.meta_facturacion_anual ?? null,
        };
        await actualizar.mutateAsync({ id: editingCliente.id, payload });
        toast.success("Cliente actualizado correctamente.");
      } else {
        const payload: ClienteInsert = {
          empresa_id: empresaActivaId,
          nombre: values.nombre,
          nombre_comercial: emptyToNull(values.nombre_comercial),
          codigo: emptyToNull(values.codigo),
          ruc: emptyToNull(values.ruc),
          correo: emptyToNull(values.correo),
          telefono: emptyToNull(values.telefono),
          contacto_principal: emptyToNull(values.contacto_principal),
          estado: values.estado ?? "activo",
          meta_facturacion_anual: values.meta_facturacion_anual ?? null,
        };
        await crear.mutateAsync(payload);
        toast.success("Cliente creado correctamente.");
      }
      handleCloseDrawer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    }
  }

  async function handleDelete() {
    if (!deletingCliente) return;
    try {
      await eliminar.mutateAsync(deletingCliente.id);
      toast.success('"' + deletingCliente.nombre + '" eliminado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el cliente.");
    } finally {
      setDeletingCliente(null);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Directorio y contactos comerciales."
        breadcrumbs={[{ label: "Clientes" }]}
        actions={
          <Button onClick={handleOpenNew} size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Nuevo cliente
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder="Buscar por nombre, RUC, correo, código..."
        />
      </div>

      {error ? (
        <EmptyState
          title="Error al cargar clientes"
          description={error instanceof Error ? error.message : "Ocurrió un error inesperado."}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.rows ?? []}
            isLoading={isLoading}
            getRowId={(row) => row.id}
            emptyTitle="Sin clientes"
            emptyDescription="Agrega tu primer cliente con el botón Nuevo cliente."
            emptyAction={
              <Button size="sm" onClick={handleOpenNew} className="gap-1.5">
                <Plus className="size-4" />
                Nuevo cliente
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
            <DrawerTitle>{editingCliente ? "Editar cliente" : "Nuevo cliente"}</DrawerTitle>
            <DrawerDescription>
              {editingCliente
                ? "Modifica los datos del cliente."
                : "Completa los datos para agregar un nuevo cliente."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-6 pb-6">
            <ClienteForm
              defaultValues={editingCliente ? clienteToForm(editingCliente) : EMPTY_FORM}
              onSubmit={handleSubmit}
              onCancel={handleCloseDrawer}
              loading={crear.isPending || actualizar.isPending}
              submitLabel={editingCliente ? "Guardar cambios" : "Crear cliente"}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <DeleteDialog
        open={!!deletingCliente}
        onOpenChange={(open) => {
          if (!open) setDeletingCliente(null);
        }}
        entityLabel={'el cliente "' + (deletingCliente?.nombre ?? "") + '"'}
        onConfirm={handleDelete}
        loading={eliminar.isPending}
      />
    </>
  );
}

// ─── Form component ────────────────────────────────────────────────────────────

interface ClienteFormProps {
  defaultValues: ClienteFormValues;
  onSubmit: (values: ClienteFormValues) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
}

function ClienteForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading,
  submitLabel,
}: ClienteFormProps) {
  return (
    <EntityForm
      schema={clienteSchema}
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
                  <Input placeholder="Nombre legal del cliente" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="nombre_comercial"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Nombre comercial</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Nombre comercial o fantasía"
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
            name="codigo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código</FormLabel>
                <FormControl>
                  <Input placeholder="CLI-001" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ruc"
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
                    placeholder="contacto@empresa.com"
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
            name="contacto_principal"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Contacto principal</FormLabel>
                <FormControl>
                  <Input placeholder="Nombre del contacto" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="estado"
            render={({ field }) => (
              <FormItem>
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
                    <SelectItem value="prospecto">Prospecto</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="meta_facturacion_anual"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meta facturación anual</FormLabel>
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
        </div>
      )}
    </EntityForm>
  );
}
