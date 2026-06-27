import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2 } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { DataTable } from "@/components/common/data-table";
import { SearchBar } from "@/components/common/search-bar";
import { Pagination } from "@/components/common/pagination";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "@/components/common/toast";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/common/drawer";
import { Button } from "@/components/ui/button";

import {
  useClientes,
  useCrearCliente,
  useActualizarCliente,
  useEliminarCliente,
} from "@/hooks/entities/use-clientes";
import { useCompany } from "@/contexts/company-context";
import { emptyToNull } from "@/utils/formatters";

import type { DataTableColumn } from "@/components/common/data-table";
import type { Cliente, ClienteInsert, ClienteUpdate } from "@/types/entities";
import type { ListParams } from "@/types/common";

import { ClienteForm } from "@/components/clientes/cliente-form";
import { EMPTY_CLIENTE, clienteToForm } from "@/components/clientes/cliente-types";
import type { ClienteFormValues } from "@/components/clientes/cliente-types";

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes · Viatik" }] }),
  component: ClientesPage,
});

function ClientesPage() {
  return (
    <AppShell>
      <ClientesContent />
    </AppShell>
  );
}

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
    { key: "ruc", header: "RUC", cell: (row) => row.ruc ?? "—" },
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
    { key: "telefono", header: "Teléfono", cell: (row) => row.telefono ?? "—" },
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
            aria-label="Editar cliente"
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
            aria-label="Eliminar cliente"
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
          onChange={(v) => {
            setSearch(v);
            setParams((p) => ({ ...p, page: 1 }));
          }}
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
              defaultValues={editingCliente ? clienteToForm(editingCliente) : EMPTY_CLIENTE}
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
