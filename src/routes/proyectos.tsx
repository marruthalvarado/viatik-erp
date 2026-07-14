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
  useProyectos,
  useCrearProyecto,
  useActualizarProyecto,
  useEliminarProyecto,
} from "@/hooks/entities/use-proyectos";
import { useClientes } from "@/hooks/entities/use-clientes";
import { useRolUsuarioEnEmpresa } from "@/hooks/entities/use-workflow";
import { useCompany } from "@/contexts/company-context";
import { formatCurrency, formatDate, emptyToNull } from "@/utils/formatters";

import type { DataTableColumn } from "@/components/common/data-table";
import type { Proyecto, ProyectoInsert, ProyectoUpdate } from "@/types/entities";
import type { ListParams } from "@/types/common";

import { ProyectoForm } from "@/components/proyectos/proyecto-form";
import { EMPTY_PROYECTO, proyectoToForm } from "@/components/proyectos/proyecto-types";
import type { ProyectoFormValues } from "@/components/proyectos/proyecto-types";

export const Route = createFileRoute("/proyectos")({
  head: () => ({ meta: [{ title: "Proyectos · VIATIQ" }] }),
  component: ProyectosPage,
});

function ProyectosPage() {
  return (
    <AppShell>
      <ProyectosContent />
    </AppShell>
  );
}

function ProyectosContent() {
  const { empresaActivaId } = useCompany();
  const [params, setParams] = useState<ListParams>({ page: 1, pageSize: 25 });
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProyecto, setEditingProyecto] = useState<Proyecto | null>(null);
  const [deletingProyecto, setDeletingProyecto] = useState<Proyecto | null>(null);

  const { data, isLoading, error } = useProyectos({ ...params, search });
  const { data: clientesData } = useClientes({ pageSize: 200 });
  const crear = useCrearProyecto();
  const actualizar = useActualizarProyecto();
  const eliminar = useEliminarProyecto();
  const { data: rolData } = useRolUsuarioEnEmpresa();
  const puedeCrear = (rolData?.rol_codigo ?? "usuario") !== "usuario";

  const clientes = clientesData?.rows ?? [];
  const clienteNombre = (id: string) => clientes.find((c) => c.id === id)?.nombre ?? id;

  const columns: DataTableColumn<Proyecto>[] = [
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
          {row.descripcion && (
            <p className="text-xs text-muted-foreground line-clamp-1">{row.descripcion}</p>
          )}
        </div>
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      cell: (row) => <span className="text-sm">{clienteNombre(row.cliente_id)}</span>,
    },
    {
      key: "fechas",
      header: "Fechas",
      cell: (row) => (
        <div className="text-xs text-muted-foreground">
          {row.fecha_inicio ? <p>Inicio: {formatDate(row.fecha_inicio)}</p> : null}
          {row.fecha_fin ? <p>Fin: {formatDate(row.fecha_fin)}</p> : null}
          {!row.fecha_inicio && !row.fecha_fin && "—"}
        </div>
      ),
    },
    {
      key: "presupuesto",
      header: "Presupuesto",
      align: "right",
      cell: (row) =>
        row.presupuesto !== null && row.presupuesto !== undefined
          ? formatCurrency(row.presupuesto)
          : "—",
    },
    {
      key: "estado_financiero",
      header: "Estado",
      cell: (row) => {
        if (!row.estado_financiero) return <span className="text-muted-foreground">—</span>;
        const tone =
          row.estado_financiero === "en_curso"
            ? "info"
            : row.estado_financiero === "finalizado"
              ? "success"
              : row.estado_financiero === "cancelado"
                ? "danger"
                : row.estado_financiero === "en_pausa"
                  ? "warning"
                  : "neutral";
        const label = row.estado_financiero
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        return <StatusBadge tone={tone}>{label}</StatusBadge>;
      },
    },
    {
      key: "acciones",
      header: "",
      className: "w-[88px]",
      cell: (row) =>
        puedeCrear ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Editar proyecto"
              onClick={(e) => {
                e.stopPropagation();
                setEditingProyecto(row);
                setDrawerOpen(true);
              }}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              aria-label="Eliminar proyecto"
              onClick={(e) => {
                e.stopPropagation();
                setDeletingProyecto(row);
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : null,
    },
  ];

  function handleOpenNew() {
    setEditingProyecto(null);
    setDrawerOpen(true);
  }
  function handleCloseDrawer() {
    setDrawerOpen(false);
    setEditingProyecto(null);
  }

  async function handleSubmit(values: ProyectoFormValues) {
    if (!empresaActivaId) {
      toast.error("Selecciona una empresa activa antes de continuar.");
      return;
    }
    try {
      if (editingProyecto) {
        const payload: ProyectoUpdate = {
          nombre: values.nombre,
          codigo: emptyToNull(values.codigo),
          descripcion: emptyToNull(values.descripcion),
          cliente_id: values.cliente_id,
          fecha_inicio: emptyToNull(values.fecha_inicio),
          fecha_fin: emptyToNull(values.fecha_fin),
          presupuesto: values.presupuesto ?? null,
          valor_contrato: values.valor_contrato ?? null,
          estado_financiero: values.estado_financiero ?? null,
        };
        await actualizar.mutateAsync({ id: editingProyecto.id, payload });
        toast.success("Proyecto actualizado correctamente.");
      } else {
        const payload: ProyectoInsert = {
          empresa_id: empresaActivaId,
          nombre: values.nombre,
          codigo: emptyToNull(values.codigo),
          descripcion: emptyToNull(values.descripcion),
          cliente_id: values.cliente_id,
          fecha_inicio: emptyToNull(values.fecha_inicio),
          fecha_fin: emptyToNull(values.fecha_fin),
          presupuesto: values.presupuesto ?? null,
          valor_contrato: values.valor_contrato ?? null,
          estado_financiero: values.estado_financiero ?? "en_curso",
        };
        await crear.mutateAsync(payload);
        toast.success("Proyecto creado correctamente.");
      }
      handleCloseDrawer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    }
  }

  async function handleDelete() {
    if (!deletingProyecto) return;
    try {
      await eliminar.mutateAsync(deletingProyecto.id);
      toast.success('"' + deletingProyecto.nombre + '" eliminado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el proyecto.");
    } finally {
      setDeletingProyecto(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Proyectos"
        description="Centros de costo y trazabilidad por proyecto."
        breadcrumbs={[{ label: "Proyectos" }]}
        actions={
          puedeCrear ? (
            <Button onClick={handleOpenNew} size="sm" className="gap-1.5">
              <Plus className="size-4" />
              Nuevo proyecto
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setParams((p) => ({ ...p, page: 1 }));
          }}
          placeholder="Buscar por nombre, código, descripción..."
        />
      </div>

      {error ? (
        <EmptyState
          title="Error al cargar proyectos"
          description={error instanceof Error ? error.message : "Ocurrió un error inesperado."}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.rows ?? []}
            isLoading={isLoading}
            getRowId={(row) => row.id}
            emptyTitle="Sin proyectos"
            emptyDescription="Agrega tu primer proyecto con el botón Nuevo proyecto."
            emptyAction={
              puedeCrear ? (
                <Button size="sm" onClick={handleOpenNew} className="gap-1.5">
                  <Plus className="size-4" />
                  Nuevo proyecto
                </Button>
              ) : undefined
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
            <DrawerTitle>{editingProyecto ? "Editar proyecto" : "Nuevo proyecto"}</DrawerTitle>
            <DrawerDescription>
              {editingProyecto
                ? "Modifica los datos del proyecto."
                : "Completa los datos para agregar un nuevo proyecto."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <ProyectoForm
              defaultValues={editingProyecto ? proyectoToForm(editingProyecto) : EMPTY_PROYECTO}
              onSubmit={handleSubmit}
              onCancel={handleCloseDrawer}
              loading={crear.isPending || actualizar.isPending}
              submitLabel={editingProyecto ? "Guardar cambios" : "Crear proyecto"}
              clientes={clientes}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <DeleteDialog
        open={!!deletingProyecto}
        onOpenChange={(open) => {
          if (!open) setDeletingProyecto(null);
        }}
        entityLabel={'el proyecto "' + (deletingProyecto?.nombre ?? "") + '"'}
        onConfirm={handleDelete}
        loading={eliminar.isPending}
      />
    </>
  );
}
