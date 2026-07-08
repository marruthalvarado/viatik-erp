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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

import {
  useGastos,
  useCrearGasto,
  useActualizarGasto,
  useEliminarGasto,
} from "@/hooks/entities/use-gastos";
import { useRendiciones } from "@/hooks/entities/use-rendiciones";
import { useProveedores } from "@/hooks/entities/use-proveedores";
import { useCategoriasGasto, useEstadosGasto, useMonedas } from "@/hooks/entities/use-catalogs";
import { usePoliticas } from "@/hooks/entities/use-politicas";
import { useCompany } from "@/contexts/company-context";
import { formatCurrency, formatDate, emptyToNull } from "@/utils/formatters";

import type { DataTableColumn } from "@/components/common/data-table";
import type { Gasto, GastoInsert, GastoUpdate, Politica } from "@/types/entities";
import type { ListParams } from "@/types/common";

import { GastoForm } from "@/components/gastos/gasto-form";
import { EMPTY_FORM, gastoToForm } from "@/components/gastos/gasto-types";
import type { GastoFormValues } from "@/components/gastos/gasto-types";

export const Route = createFileRoute("/gastos")({
  head: () => ({ meta: [{ title: "Gastos · VIATIQ" }] }),
  component: GastosPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map category name (normalised) → policy tope field */
function topeParaCategoria(
  categoriaNombre: string,
  politica: Politica,
): { tope: number | null; label: string } {
  const n = categoriaNombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (n === "desayuno") return { tope: politica.tope_desayuno ?? null, label: "Desayuno" };
  if (n === "almuerzo") return { tope: politica.tope_almuerzo ?? null, label: "Almuerzo" };
  if (n === "cena") return { tope: politica.tope_cena ?? null, label: "Cena" };
  if (n.includes("hospedaje") || n.includes("alojamiento"))
    return { tope: politica.tope_hospedaje ?? null, label: "Hospedaje (por noche)" };
  if (n.includes("miscel")) return { tope: politica.tope_miscelaneo ?? null, label: "Misceláneos" };
  return { tope: null, label: "" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function GastosPage() {
  return (
    <AppShell>
      <GastosContent />
    </AppShell>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────

function GastosContent() {
  const { empresaActivaId } = useCompany();
  const [params, setParams] = useState<ListParams>({ page: 1, pageSize: 25 });
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingGasto, setEditingGasto] = useState<Gasto | null>(null);
  const [deletingGasto, setDeletingGasto] = useState<Gasto | null>(null);
  const [topeAlert, setTopeAlert] = useState<{
    message: string;
    pending: GastoFormValues;
  } | null>(null);

  const { data, isLoading, error } = useGastos({ ...params, search });
  const { data: rendicionesData } = useRendiciones({ pageSize: 200 });
  const { data: proveedoresData } = useProveedores({ pageSize: 200 });
  const { data: categoriasData } = useCategoriasGasto({ pageSize: 200 });
  const { data: estadosData } = useEstadosGasto({ pageSize: 200 });
  const { data: monedasData } = useMonedas({ pageSize: 200 });
  const { data: politicasData } = usePoliticas({ pageSize: 50 });

  const crear = useCrearGasto();
  const actualizar = useActualizarGasto();
  const eliminar = useEliminarGasto();

  const rendiciones = rendicionesData?.rows ?? [];
  const proveedores = proveedoresData?.rows ?? [];
  const categorias = categoriasData?.rows ?? [];
  const estados = estadosData?.rows ?? [];
  const monedas = monedasData?.rows ?? [];
  const politicas = politicasData?.rows ?? [];

  function rendicionLabel(id: string): string {
    return rendiciones.find((r) => r.id === id)?.numero ?? id;
  }

  function categoriaLabel(id: string | null | undefined): string {
    if (!id) return "—";
    return categorias.find((c) => c.id === id)?.nombre ?? "—";
  }

  function estadoTone(id: string | null | undefined): "success" | "danger" | "warning" | "neutral" {
    if (!id) return "neutral";
    const codigo = estados.find((e) => e.id === id)?.codigo ?? "";
    if (codigo === "aprobado") return "success";
    if (codigo === "rechazado") return "danger";
    if (codigo === "pendiente") return "warning";
    return "neutral";
  }

  function estadoLabel(id: string | null | undefined): string {
    if (!id) return "—";
    return estados.find((e) => e.id === id)?.nombre ?? "—";
  }

  // ─── Columns ─────────────────────────────────────────────────────────────────

  const columns: DataTableColumn<Gasto>[] = [
    {
      key: "fecha",
      header: "Fecha",
      className: "w-28",
      cell: (row) => <span className="text-sm tabular-nums">{formatDate(row.fecha)}</span>,
    },
    {
      key: "descripcion",
      header: "Descripción",
      cell: (row) => (
        <div>
          <p className="text-sm font-medium">{row.descripcion ?? "—"}</p>
          {row.numero_documento && (
            <p className="text-xs text-muted-foreground">Doc: {row.numero_documento}</p>
          )}
        </div>
      ),
    },
    {
      key: "rendicion",
      header: "Rendición",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{rendicionLabel(row.rendicion_id)}</span>
      ),
    },
    {
      key: "categoria",
      header: "Categoría",
      cell: (row) => categoriaLabel(row.categoria_gasto_id),
    },
    {
      key: "valor",
      header: "Valor",
      align: "right",
      cell: (row) => (
        <div className="text-right">
          <p className="text-sm tabular-nums">{formatCurrency(row.valor_factura)}</p>
          {row.moneda_codigo && row.moneda_codigo !== "CLP" && (
            <p className="text-xs text-muted-foreground">{row.moneda_codigo}</p>
          )}
        </div>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (row) =>
        row.estado_gasto_id ? (
          <StatusBadge tone={estadoTone(row.estado_gasto_id)}>
            {estadoLabel(row.estado_gasto_id)}
          </StatusBadge>
        ) : (
          <span className="text-muted-foreground">—</span>
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
            aria-label="Editar gasto"
            onClick={(e) => {
              e.stopPropagation();
              setEditingGasto(row);
              setDrawerOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label="Eliminar gasto"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingGasto(row);
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
    setEditingGasto(null);
    setDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setDrawerOpen(false);
    setEditingGasto(null);
  }

  async function saveGasto(values: GastoFormValues) {
    if (!empresaActivaId) {
      toast.error("Selecciona una empresa activa antes de continuar.");
      return;
    }
    if (editingGasto) {
      const payload: GastoUpdate = {
        rendicion_id: values.rendicion_id,
        descripcion: emptyToNull(values.descripcion),
        numero_documento: emptyToNull(values.numero_documento),
        fecha: emptyToNull(values.fecha),
        categoria_gasto_id: values.categoria_gasto_id ?? null,
        estado_gasto_id: values.estado_gasto_id ?? null,
        proveedor_id: values.proveedor_id ?? null,
        moneda_codigo: values.moneda_codigo ?? null,
        valor_factura: values.valor_factura ?? null,
        valor_moneda_origen: values.valor_moneda_origen ?? null,
        tipo_cambio: values.tipo_cambio ?? null,
        valor_reembolsable: values.valor_reembolsable ?? null,
        observaciones: emptyToNull(values.observaciones),
      };
      await actualizar.mutateAsync({ id: editingGasto.id, payload });
      toast.success("Gasto actualizado correctamente.");
    } else {
      const payload: GastoInsert = {
        empresa_id: empresaActivaId,
        rendicion_id: values.rendicion_id,
        descripcion: emptyToNull(values.descripcion),
        numero_documento: emptyToNull(values.numero_documento),
        fecha: emptyToNull(values.fecha),
        categoria_gasto_id: values.categoria_gasto_id ?? null,
        estado_gasto_id: values.estado_gasto_id ?? null,
        proveedor_id: values.proveedor_id ?? null,
        moneda_codigo: values.moneda_codigo ?? null,
        valor_factura: values.valor_factura ?? null,
        valor_moneda_origen: values.valor_moneda_origen ?? null,
        tipo_cambio: values.tipo_cambio ?? null,
        valor_reembolsable: values.valor_reembolsable ?? null,
        observaciones: emptyToNull(values.observaciones),
      };
      await crear.mutateAsync(payload);
      toast.success("Gasto registrado correctamente.");
    }
    handleCloseDrawer();
  }

  async function handleSubmit(values: GastoFormValues) {
    try {
      // ── Validación de tope de política ────────────────────────────────────
      const valor = values.valor_factura ?? 0;
      const rendicion = rendiciones.find((r) => r.id === values.rendicion_id);
      const politica = rendicion?.politica_id
        ? politicas.find((p) => p.id === rendicion.politica_id)
        : null;

      if (politica && valor > 0 && values.categoria_gasto_id) {
        const catNombre = categorias.find((c) => c.id === values.categoria_gasto_id)?.nombre ?? "";
        const { tope, label } = topeParaCategoria(catNombre, politica);
        if (tope !== null && valor > tope) {
          setTopeAlert({
            message: `La factura por ${formatCurrency(valor)} supera el tope de la política para ${label}: ${formatCurrency(tope)}. ¿Deseas agregarla de todas formas?`,
            pending: values,
          });
          return; // wait for user confirmation
        }
      }
      // ── Sin exceso, guardar directo ───────────────────────────────────────
      await saveGasto(values);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el gasto.");
    }
  }

  async function handleTopeConfirm() {
    if (!topeAlert) return;
    try {
      await saveGasto(topeAlert.pending);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el gasto.");
    } finally {
      setTopeAlert(null);
    }
  }

  async function handleDelete() {
    if (!deletingGasto) return;
    try {
      await eliminar.mutateAsync(deletingGasto.id);
      toast.success("Gasto eliminado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el gasto.");
    } finally {
      setDeletingGasto(null);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Gastos"
        description="Registro y seguimiento de gastos por rendición."
        breadcrumbs={[{ label: "Gastos" }]}
        actions={
          <Button onClick={handleOpenNew} size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Nuevo gasto
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder="Buscar por descripción, nro. documento..."
        />
      </div>

      {error ? (
        <EmptyState
          title="Error al cargar gastos"
          description={error instanceof Error ? error.message : "Ocurrió un error inesperado."}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.rows ?? []}
            isLoading={isLoading}
            getRowId={(row) => row.id}
            emptyTitle="Sin gastos"
            emptyDescription="Registra el primer gasto con el botón Nuevo gasto."
            emptyAction={
              <Button size="sm" onClick={handleOpenNew} className="gap-1.5">
                <Plus className="size-4" />
                Nuevo gasto
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

      {/* Drawer: nuevo / editar gasto */}
      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseDrawer();
        }}
      >
        <DrawerContent className="sm:max-w-lg">
          <DrawerHeader>
            <DrawerTitle>{editingGasto ? "Editar gasto" : "Nuevo gasto"}</DrawerTitle>
            <DrawerDescription>
              {editingGasto
                ? "Modifica los datos del gasto."
                : "Completa los datos para registrar un gasto."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <GastoForm
              defaultValues={editingGasto ? gastoToForm(editingGasto) : EMPTY_FORM}
              onSubmit={handleSubmit}
              onCancel={handleCloseDrawer}
              loading={crear.isPending || actualizar.isPending}
              submitLabel={editingGasto ? "Guardar cambios" : "Registrar gasto"}
              rendiciones={rendiciones}
              proveedores={proveedores}
              categorias={categorias}
              estados={estados}
              monedas={monedas}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Alerta: tope de política excedido */}
      <AlertDialog open={!!topeAlert} onOpenChange={(open) => !open && setTopeAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tope de política excedido</AlertDialogTitle>
            <AlertDialogDescription>{topeAlert?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTopeAlert(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleTopeConfirm()}>
              Agregar de todas formas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar eliminación */}
      <DeleteDialog
        open={!!deletingGasto}
        onOpenChange={(open) => {
          if (!open) setDeletingGasto(null);
        }}
        entityLabel="este gasto"
        onConfirm={handleDelete}
        loading={eliminar.isPending}
      />
    </>
  );
}
