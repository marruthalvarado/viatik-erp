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
  useRendiciones,
  useCrearRendicion,
  useActualizarRendicion,
  useEliminarRendicion,
} from "@/hooks/entities/use-rendiciones";
import { useProyectos } from "@/hooks/entities/use-proyectos";
import { useEstadosRendicion, useTiposRendicion } from "@/hooks/entities/use-catalogs";
import { useCompany } from "@/contexts/company-context";
import { useAuth } from "@/contexts/auth-context";
import { formatCurrency, formatDate, emptyToNull } from "@/utils/formatters";

import type { DataTableColumn } from "@/components/common/data-table";
import type { Rendicion, RendicionInsert, RendicionUpdate } from "@/types/entities";
import type { ListParams } from "@/types/common";

import { RendicionForm } from "@/components/rendiciones/rendicion-form";
import {
  EMPTY_RENDICION,
  rendicionToForm,
  estadoTone,
} from "@/components/rendiciones/rendicion-types";
import type { RendicionFormValues } from "@/components/rendiciones/rendicion-types";
import { RendicionDetail } from "@/components/rendiciones/rendicion-detail";

export const Route = createFileRoute("/rendiciones")({
  head: () => ({ meta: [{ title: "Rendiciones · VIATIQ" }] }),
  component: RendicionesPage,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

function RendicionesPage() {
  return (
    <AppShell>
      <RendicionesContent />
    </AppShell>
  );
}

// ─── Content (state machine: list ↔ detail) ───────────────────────────────────

function RendicionesContent() {
  const [selectedRendicion, setSelectedRendicion] = useState<Rendicion | null>(null);

  if (selectedRendicion) {
    return (
      <RendicionDetail
        rendicion={selectedRendicion}
        onBack={() => setSelectedRendicion(null)}
        onUpdated={(updated) => setSelectedRendicion(updated)}
      />
    );
  }

  return <RendicionesList onSelect={setSelectedRendicion} />;
}

// ─── List view ────────────────────────────────────────────────────────────────

interface RendicionesListProps {
  onSelect: (r: Rendicion) => void;
}

function RendicionesList({ onSelect }: RendicionesListProps) {
  const { empresaActivaId } = useCompany();
  const { user } = useAuth();

  const [params, setParams] = useState<ListParams>({ page: 1, pageSize: 25 });
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRendicion, setEditingRendicion] = useState<Rendicion | null>(null);
  const [deletingRendicion, setDeletingRendicion] = useState<Rendicion | null>(null);

  const { data, isLoading, error } = useRendiciones({ ...params, search });
  const { data: proyectosData } = useProyectos({ pageSize: 200 });
  const { data: estadosData } = useEstadosRendicion({ pageSize: 100 });
  const { data: tiposData } = useTiposRendicion({ pageSize: 100 });

  const crear = useCrearRendicion();
  const actualizar = useActualizarRendicion();
  const eliminar = useEliminarRendicion();

  const proyectos = proyectosData?.rows ?? [];
  const estados = estadosData?.rows ?? [];
  const tipos = tiposData?.rows ?? [];

  function proyectoNombre(id: string) {
    return proyectos.find((p) => p.id === id)?.nombre ?? id;
  }
  function estadoCodigo(id: string | null | undefined) {
    return id ? (estados.find((e) => e.id === id)?.codigo ?? null) : null;
  }
  function estadoNombreFn(id: string | null | undefined) {
    return id ? (estados.find((e) => e.id === id)?.nombre ?? id) : "—";
  }

  const columns: DataTableColumn<Rendicion>[] = [
    {
      key: "numero",
      header: "Número",
      className: "w-32",
      cell: (row) => <span className="font-mono text-sm font-medium">{row.numero}</span>,
    },
    {
      key: "descripcion",
      header: "Descripción / Proyecto",
      cell: (row) => (
        <div>
          {row.descripcion && <p className="text-sm font-medium">{row.descripcion}</p>}
          <p className="text-xs text-muted-foreground">{proyectoNombre(row.proyecto_id)}</p>
        </div>
      ),
    },
    {
      key: "fecha_rendicion",
      header: "Fecha",
      className: "w-28",
      cell: (row) => (
        <span className="text-sm tabular-nums">{formatDate(row.fecha_rendicion)}</span>
      ),
    },
    {
      key: "totales",
      header: "Total facturado",
      align: "right",
      cell: (row) => (
        <span className="tabular-nums text-sm">{formatCurrency(row.total_facturado)}</span>
      ),
    },
    {
      key: "saldo",
      header: "Saldo",
      align: "right",
      cell: (row) => (
        <span className={`tabular-nums text-sm ${(row.saldo ?? 0) < 0 ? "text-destructive" : ""}`}>
          {formatCurrency(row.saldo)}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (row) => (
        <StatusBadge tone={estadoTone(estadoCodigo(row.estado_rendicion_id))}>
          {estadoNombreFn(row.estado_rendicion_id)}
        </StatusBadge>
      ),
    },
    {
      key: "acciones",
      header: "",
      className: "w-[120px]",
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            aria-label="Ver detalle de rendición"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(row);
            }}
          >
            Ver
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Editar rendición"
            onClick={(e) => {
              e.stopPropagation();
              setEditingRendicion(row);
              setDrawerOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label="Eliminar rendición"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingRendicion(row);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  function handleSearchChange(value: string) {
    setSearch(value);
    setParams((p) => ({ ...p, page: 1 }));
  }

  function handleOpenNew() {
    setEditingRendicion(null);
    setDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setDrawerOpen(false);
    setEditingRendicion(null);
  }

  async function handleSubmit(values: RendicionFormValues) {
    if (!empresaActivaId || !user?.id) {
      toast.error("Sesión no válida o empresa no seleccionada.");
      return;
    }
    try {
      if (editingRendicion) {
        const payload: RendicionUpdate = {
          numero: values.numero,
          proyecto_id: values.proyecto_id,
          descripcion: emptyToNull(values.descripcion),
          fecha_rendicion: emptyToNull(values.fecha_rendicion),
          estado_rendicion_id: values.estado_rendicion_id ?? null,
          tipo_rendicion_id: values.tipo_rendicion_id ?? null,
        };
        await actualizar.mutateAsync({ id: editingRendicion.id, payload });
        toast.success("Rendición actualizada correctamente.");
      } else {
        const payload: RendicionInsert = {
          empresa_id: empresaActivaId,
          usuario_id: user.id,
          numero: values.numero,
          proyecto_id: values.proyecto_id,
          descripcion: emptyToNull(values.descripcion),
          fecha_rendicion: emptyToNull(values.fecha_rendicion),
          estado_rendicion_id: values.estado_rendicion_id ?? null,
          tipo_rendicion_id: values.tipo_rendicion_id ?? null,
        };
        await crear.mutateAsync(payload);
        toast.success("Rendición creada correctamente.");
      }
      handleCloseDrawer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar la rendición.");
    }
  }

  async function handleDelete() {
    if (!deletingRendicion) return;
    try {
      await eliminar.mutateAsync(deletingRendicion.id);
      toast.success(`Rendición "${deletingRendicion.numero}" eliminada.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar la rendición.");
    } finally {
      setDeletingRendicion(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Rendiciones"
        description="Gestiona rendiciones de gastos y reembolsos."
        breadcrumbs={[{ label: "Rendiciones" }]}
        actions={
          <Button onClick={handleOpenNew} size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Nueva rendición
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder="Buscar por número, descripción..."
        />
      </div>

      {error ? (
        <EmptyState
          title="Error al cargar rendiciones"
          description={error instanceof Error ? error.message : "Ocurrió un error inesperado."}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.rows ?? []}
            isLoading={isLoading}
            getRowId={(row) => row.id}
            onRowClick={onSelect}
            emptyTitle="Sin rendiciones"
            emptyDescription="Crea tu primera rendición con el botón Nueva rendición."
            emptyAction={
              <Button size="sm" onClick={handleOpenNew} className="gap-1.5">
                <Plus className="size-4" />
                Nueva rendición
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
            <DrawerTitle>{editingRendicion ? "Editar rendición" : "Nueva rendición"}</DrawerTitle>
            <DrawerDescription>
              {editingRendicion
                ? "Modifica los datos de la rendición."
                : "Completa los datos para crear una rendición."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-6 pb-6">
            <RendicionForm
              defaultValues={editingRendicion ? rendicionToForm(editingRendicion) : EMPTY_RENDICION}
              onSubmit={handleSubmit}
              onCancel={handleCloseDrawer}
              loading={crear.isPending || actualizar.isPending}
              submitLabel={editingRendicion ? "Guardar cambios" : "Crear rendición"}
              proyectos={proyectos}
              estados={estados}
              tipos={tipos}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <DeleteDialog
        open={!!deletingRendicion}
        onOpenChange={(open) => {
          if (!open) setDeletingRendicion(null);
        }}
        entityLabel={`la rendición "${deletingRendicion?.numero ?? ""}"`}
        onConfirm={handleDelete}
        loading={eliminar.isPending}
      />
    </>
  );
}
