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

import { PresupuestoForm } from "@/components/presupuestos/presupuesto-form";
import { EMPTY_PRESUPUESTO, presupuestoToForm } from "@/components/presupuestos/presupuesto-types";
import type { PresupuestoFormValues } from "@/components/presupuestos/presupuesto-types";

export const Route = createFileRoute("/presupuestos")({
  head: () => ({ meta: [{ title: "Presupuestos · Viatik" }] }),
  component: PresupuestosPage,
});

function PresupuestosPage() {
  return (
    <AppShell>
      <PresupuestosContent />
    </AppShell>
  );
}

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
  const proyectoNombre = (id: string | null | undefined) =>
    id ? (proyectos.find((p) => p.id === id)?.nombre ?? id) : "—";

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
    { key: "proyecto", header: "Proyecto", cell: (row) => proyectoNombre(row.proyecto_id) },
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
          onChange={(v) => {
            setSearch(v);
            setParams((p) => ({ ...p, page: 1 }));
          }}
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
                editingPresupuesto ? presupuestoToForm(editingPresupuesto) : EMPTY_PRESUPUESTO
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
