/**
 * politicas-section.tsx
 * Gestión de políticas de reembolso — sección del módulo Administración.
 * Arquitectura: Componente → Hook → Service → Supabase
 */
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";

import { DataTable } from "@/components/common/data-table";
import { SearchBar } from "@/components/common/search-bar";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "@/components/common/toast";
import { Button } from "@/components/ui/button";

import {
  usePoliticas,
  useCrearPolitica,
  useActualizarPolitica,
  useEliminarPolitica,
} from "@/hooks/entities/use-politicas";
import { useCompany } from "@/contexts/company-context";
import { emptyToNull } from "@/utils/formatters";

import type { DataTableColumn } from "@/components/common/data-table";
import type { Politica, PoliticaInsert, PoliticaUpdate } from "@/types/entities";

import { PoliticaFormDrawer } from "./politica-form";
import type { PoliticaFormValues } from "./politica-types";

export function PoliticasSection() {
  const { empresaActivaId } = useCompany();
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPolitica, setEditingPolitica] = useState<Politica | null>(null);
  const [deletingPolitica, setDeletingPolitica] = useState<Politica | null>(null);

  const { data, isLoading, error } = usePoliticas({ pageSize: 100, search });
  const crear = useCrearPolitica();
  const actualizar = useActualizarPolitica();
  const eliminar = useEliminarPolitica();

  function openCreate() {
    setEditingPolitica(null);
    setDrawerOpen(true);
  }

  async function handleSubmit(values: PoliticaFormValues) {
    if (!empresaActivaId) {
      toast.error("Selecciona una empresa activa.");
      return;
    }
    try {
      const common = {
        nombre: values.nombre,
        codigo: emptyToNull(values.codigo),
        descripcion: emptyToNull(values.descripcion),
        activo: values.activo ?? true,
        aprobador_id: values.aprobador_id ?? null,
        valor_km: values.valor_km ?? null,
        km_ciudad_por_dia: values.km_ciudad_por_dia ?? null,
        tope_desayuno: values.tope_desayuno ?? null,
        tope_almuerzo: values.tope_almuerzo ?? null,
        tope_cena: values.tope_cena ?? null,
        tope_hospedaje: values.tope_hospedaje ?? null,
        tope_miscelaneo: values.tope_miscelaneo ?? null,
        paga_combustible: values.paga_combustible ?? false,
        paga_peajes: values.paga_peajes ?? false,
        acepta_facturas_fuera_rango: values.acepta_facturas_fuera_rango ?? true,
      };
      if (editingPolitica) {
        await actualizar.mutateAsync({ id: editingPolitica.id, payload: common as PoliticaUpdate });
        toast.success("Política actualizada.");
      } else {
        await crear.mutateAsync({ ...common, empresa_id: empresaActivaId } as PoliticaInsert);
        toast.success("Política creada.");
      }
      setDrawerOpen(false);
      setEditingPolitica(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar la política.");
    }
  }

  async function handleDelete() {
    if (!deletingPolitica) return;
    try {
      await eliminar.mutateAsync(deletingPolitica.id);
      toast.success(`Política "${deletingPolitica.nombre}" eliminada.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar la política.");
    } finally {
      setDeletingPolitica(null);
    }
  }

  const columns: DataTableColumn<Politica>[] = [
    {
      key: "nombre",
      header: "Nombre",
      cell: (row) => (
        <div>
          <p className="text-sm font-medium">{row.nombre}</p>
          {row.codigo && <p className="text-xs text-muted-foreground">{row.codigo}</p>}
        </div>
      ),
    },
    {
      key: "valor_km",
      header: "Valor /km",
      align: "right",
      cell: (row) => (
        <span className="tabular-nums text-sm">
          {row.valor_km != null ? `${row.valor_km}` : "—"}
        </span>
      ),
    },
    {
      key: "tope_hospedaje",
      header: "Tope hospedaje",
      align: "right",
      cell: (row) => (
        <span className="tabular-nums text-sm">
          {row.tope_hospedaje != null ? `${row.tope_hospedaje}` : "—"}
        </span>
      ),
    },
    {
      key: "activo",
      header: "Estado",
      cell: (row) => (
        <StatusBadge tone={row.activo ? "success" : "neutral"}>
          {row.activo ? "Activa" : "Inactiva"}
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
            aria-label="Editar política"
            onClick={(e) => {
              e.stopPropagation();
              setEditingPolitica(row);
              setDrawerOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label="Eliminar política"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingPolitica(row);
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
        <h2 className="text-base font-semibold">Políticas de reembolso</h2>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="size-4" />
          Nueva política
        </Button>
      </div>
      <div className="mb-3">
        <SearchBar value={search} onChange={(v) => setSearch(v)} placeholder="Buscar política..." />
      </div>
      {error ? (
        <EmptyState
          title="Error"
          description={error instanceof Error ? error.message : "Error inesperado."}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          isLoading={isLoading}
          getRowId={(row) => row.id}
          emptyTitle="Sin políticas"
          emptyDescription="Define políticas de reembolso para los empleados."
          emptyAction={
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="size-4" />
              Nueva política
            </Button>
          }
        />
      )}

      <PoliticaFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setEditingPolitica(null);
        }}
        editing={editingPolitica}
        loading={crear.isPending || actualizar.isPending}
        onSubmit={handleSubmit}
      />

      <DeleteDialog
        open={!!deletingPolitica}
        onOpenChange={(open) => !open && setDeletingPolitica(null)}
        entityLabel={`la política "${deletingPolitica?.nombre ?? ""}"`}
        onConfirm={handleDelete}
        loading={eliminar.isPending}
      />
    </>
  );
}
