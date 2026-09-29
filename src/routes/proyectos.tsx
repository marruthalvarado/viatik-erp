import { useState } from "react";
import {
  SortableHeaderContent,
  applySort,
  nextSort,
} from "@/components/common/sortable-header";
import type { SortState } from "@/components/common/sortable-header";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, BookOpen, X } from "lucide-react";

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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

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
import { BitacoraTab } from "@/components/bitacora/bitacora-tab";
import { TIPO_PROYECTO_LABELS } from "@/services/bitacora";
import type { TipoProyecto } from "@/services/bitacora";

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
  const [detailProyecto, setDetailProyecto] = useState<Proyecto | null>(null);

  const { data, isLoading, error } = useProyectos({ ...params, search });
  const { data: clientesData } = useClientes({ pageSize: 200 });
  const crear = useCrearProyecto();
  const actualizar = useActualizarProyecto();
  const eliminar = useEliminarProyecto();
  const { data: rolData } = useRolUsuarioEnEmpresa();
  const puedeCrear = (rolData?.rol_codigo ?? "usuario") !== "usuario";

  const clientes = clientesData?.rows ?? [];
  const clienteNombre = (id: string) => clientes.find((c) => c.id === id)?.nombre ?? id;

  const [sort, setSort] = useState<SortState>({ col: null, dir: "asc" });
  function handleSort(col: string) { setSort((prev) => nextSort(prev, col)); }
  function getProy(row: Proyecto, col: string): string | number {
    switch (col) {
      case "codigo": return row.codigo ?? "";
      case "nombre": return row.nombre ?? "";
      case "cliente": return clienteNombre(row.cliente_id);
      case "fecha": return row.fecha_inicio ?? "";
      case "presupuesto": return Number(row.presupuesto ?? 0);
      case "estado": return row.estado_financiero ?? "";
      default: return "";
    }
  }
  const sortedRows = applySort(data?.rows ?? [], sort, getProy);

  const columns: DataTableColumn<Proyecto>[] = [
    {
      key: "codigo",
      header: <SortableHeaderContent label="Código" col="codigo" sort={sort} onSort={handleSort} />,
      className: "w-24",
      cell: (row) => <span className="text-xs text-muted-foreground">{row.codigo ?? "—"}</span>,
    },
    {
      key: "nombre",
      header: <SortableHeaderContent label="Nombre" col="nombre" sort={sort} onSort={handleSort} />,
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
      header: <SortableHeaderContent label="Cliente" col="cliente" sort={sort} onSort={handleSort} />,
      cell: (row) => <span className="text-sm">{clienteNombre(row.cliente_id)}</span>,
    },
    {
      key: "fechas",
      header: <SortableHeaderContent label="Fechas" col="fecha" sort={sort} onSort={handleSort} />,
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
      header: <SortableHeaderContent label="Presupuesto" col="presupuesto" sort={sort} onSort={handleSort} align="right" />,
      align: "right",
      cell: (row) =>
        row.presupuesto !== null && row.presupuesto !== undefined
          ? formatCurrency(row.presupuesto)
          : "—",
    },
    {
      key: "estado_financiero",
      header: <SortableHeaderContent label="Estado" col="estado" sort={sort} onSort={handleSort} />,
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
      className: "w-[120px]",
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Ver bitácora"
            onClick={(e) => {
              e.stopPropagation();
              setDetailProyecto(row);
            }}
          >
            <BookOpen className="size-3.5" />
          </Button>
          {puedeCrear && (
            <>
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
            </>
          )}
        </div>
      ),
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
          tipo_proyecto: values.tipo_proyecto ?? null,
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
          tipo_proyecto: values.tipo_proyecto ?? "otro",
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

  // Tipo label helper
  const tipoLabel = (p: Proyecto) => {
    const raw = (p as unknown as Record<string, unknown>).tipo_proyecto as string | null;
    if (!raw || raw === "otro") return null;
    return TIPO_PROYECTO_LABELS[raw as TipoProyecto] ?? raw;
  };

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
            data={sortedRows}
            isLoading={isLoading}
            getRowId={(row) => row.id}
            emptyTitle="Sin proyectos"
            emptyDescription="Agrega tu primer proyecto con el botón Nuevo proyecto."
            onRowClick={(row) => setDetailProyecto(row)}
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

      {/* Detail Sheet con tabs */}
      <Sheet open={!!detailProyecto} onOpenChange={(open) => { if (!open) setDetailProyecto(null); }}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {detailProyecto && (
            <>
              <SheetHeader className="pb-4 border-b">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-lg truncate">{detailProyecto.nombre}</SheetTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {detailProyecto.codigo && (
                        <span className="text-xs text-muted-foreground font-mono">{detailProyecto.codigo}</span>
                      )}
                      {tipoLabel(detailProyecto) && (
                        <Badge variant="secondary" className="text-xs">{tipoLabel(detailProyecto)}</Badge>
                      )}
                      {detailProyecto.estado_financiero && (
                        <StatusBadge
                          tone={
                            detailProyecto.estado_financiero === "en_curso" ? "info"
                            : detailProyecto.estado_financiero === "finalizado" ? "success"
                            : detailProyecto.estado_financiero === "cancelado" ? "danger"
                            : "warning"
                          }
                        >
                          {detailProyecto.estado_financiero.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </StatusBadge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setDetailProyecto(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </SheetHeader>

              <Tabs defaultValue="bitacora" className="mt-4">
                <TabsList className="mb-4">
                  <TabsTrigger value="resumen">Resumen</TabsTrigger>
                  <TabsTrigger value="bitacora">Bitácora</TabsTrigger>
                </TabsList>

                {/* Resumen */}
                <TabsContent value="resumen">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Cliente</p>
                      <p className="font-medium">{clienteNombre(detailProyecto.cliente_id)}</p>
                    </div>
                    {detailProyecto.descripcion && (
                      <div className="col-span-2 space-y-0.5">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Descripción</p>
                        <p>{detailProyecto.descripcion}</p>
                      </div>
                    )}
                    {detailProyecto.fecha_inicio && (
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Fecha inicio</p>
                        <p>{formatDate(detailProyecto.fecha_inicio)}</p>
                      </div>
                    )}
                    {detailProyecto.fecha_fin && (
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Fecha fin</p>
                        <p>{formatDate(detailProyecto.fecha_fin)}</p>
                      </div>
                    )}
                    {detailProyecto.presupuesto !== null && detailProyecto.presupuesto !== undefined && (
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Presupuesto</p>
                        <p className="font-medium">{formatCurrency(detailProyecto.presupuesto)}</p>
                      </div>
                    )}
                    {detailProyecto.valor_contrato !== null && detailProyecto.valor_contrato !== undefined && (
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor contrato</p>
                        <p className="font-medium">{formatCurrency(detailProyecto.valor_contrato)}</p>
                      </div>
                    )}
                  </div>
                  {puedeCrear && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-6 gap-1.5"
                      onClick={() => {
                        setDetailProyecto(null);
                        setEditingProyecto(detailProyecto);
                        setDrawerOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                      Editar proyecto
                    </Button>
                  )}
                </TabsContent>

                {/* Bitácora */}
                <TabsContent value="bitacora">
                  <BitacoraTab proyectoId={detailProyecto.id} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Drawer crear/editar */}
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
