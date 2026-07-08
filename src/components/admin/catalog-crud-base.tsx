import { useState } from "react";
import { z } from "zod";
import { Plus, Pencil, Trash2 } from "lucide-react";

import { DataTable } from "@/components/common/data-table";
import { SearchBar } from "@/components/common/search-bar";
import { DeleteDialog } from "@/components/common/delete-dialog";
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
  useCategoriasGasto,
  useCrearCategoriaGasto,
  useActualizarCategoriaGasto,
  useEliminarCategoriaGasto,
  useEstadosGasto,
  useCrearEstadoGasto,
  useActualizarEstadoGasto,
  useEliminarEstadoGasto,
  useMonedas,
  useCrearMoneda,
  useActualizarMoneda,
  useEliminarMoneda,
  useOrigenesGasto,
  useCrearOrigenGasto,
  useActualizarOrigenGasto,
  useEliminarOrigenGasto,
  useCategoriasDocumento,
  useCrearCategoriaDocumento,
  useActualizarCategoriaDocumento,
  useEliminarCategoriaDocumento,
  useTiposDocumento,
  useCrearTipoDocumento,
  useActualizarTipoDocumento,
  useEliminarTipoDocumento,
  useEstadosRendicion,
  useCrearEstadoRendicion,
  useActualizarEstadoRendicion,
  useEliminarEstadoRendicion,
  useTiposRendicion,
  useCrearTipoRendicion,
  useActualizarTipoRendicion,
  useEliminarTipoRendicion,
} from "@/hooks/entities/use-catalogs";
import { emptyToNull } from "@/utils/formatters";

import type { DataTableColumn } from "@/components/common/data-table";
import type {
  CategoriaGasto,
  CategoriaGastoInsert,
  CategoriaGastoUpdate,
  EstadoGasto,
  EstadoGastoInsert,
  EstadoGastoUpdate,
  Moneda,
  MonedaInsert,
  MonedaUpdate,
  OrigenGasto,
  OrigenGastoInsert,
  OrigenGastoUpdate,
  CategoriaDocumento,
  CategoriaDocumentoInsert,
  CategoriaDocumentoUpdate,
  TipoDocumento,
  TipoDocumentoInsert,
  TipoDocumentoUpdate,
  EstadoRendicion,
  EstadoRendicionInsert,
  EstadoRendicionUpdate,
  TipoRendicion,
  TipoRendicionInsert,
  TipoRendicionUpdate,
} from "@/types/entities";

// ─── Generic catalog row shape ────────────────────────────────────────────────

interface SimpleCatalogRow {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  created_at?: string | null;
}

interface SimpleCatalogCrudProps<TRow extends SimpleCatalogRow> {
  title: string;
  rows: TRow[];
  isLoading: boolean;
  error: Error | null;
  pkField?: keyof TRow;
  isPendingCreate: boolean;
  isPendingUpdate: boolean;
  isPendingDelete: boolean;
  onSave: (
    values: { codigo: string; nombre: string; descripcion: string | null },
    existing: TRow | null,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function SimpleCatalogCrud<TRow extends SimpleCatalogRow>({
  title,
  rows,
  isLoading,
  error,
  pkField = "id" as keyof TRow,
  isPendingCreate,
  isPendingUpdate,
  isPendingDelete,
  onSave,
  onDelete,
}: SimpleCatalogCrudProps<TRow>) {
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<TRow | null>(null);
  const [deletingRow, setDeletingRow] = useState<TRow | null>(null);

  const catalogSchema = z.object({
    codigo: z.string().min(1, "El código es requerido"),
    nombre: z.string().min(1, "El nombre es requerido"),
    descripcion: z.string().nullable().optional(),
  });

  type CatalogFormValues = z.infer<typeof catalogSchema>;

  const filtered = search
    ? rows.filter(
        (r) =>
          r.codigo.toLowerCase().includes(search.toLowerCase()) ||
          r.nombre.toLowerCase().includes(search.toLowerCase()),
      )
    : rows;

  function toForm(r: TRow): CatalogFormValues {
    return { codigo: r.codigo, nombre: r.nombre, descripcion: r.descripcion ?? "" };
  }

  async function handleSubmit(values: CatalogFormValues) {
    await onSave(
      {
        codigo: values.codigo,
        nombre: values.nombre,
        descripcion: emptyToNull(values.descripcion),
      },
      editingRow,
    );
    setDrawerOpen(false);
    setEditingRow(null);
  }

  async function handleDelete() {
    if (!deletingRow) return;
    await onDelete(String(deletingRow[pkField]));
    setDeletingRow(null);
  }

  const columns: DataTableColumn<TRow>[] = [
    {
      key: "codigo",
      header: "Código",
      className: "w-28",
      cell: (row) => <span className="font-mono text-xs">{row.codigo}</span>,
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
      key: "acciones",
      header: "",
      className: "w-[88px]",
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Editar ${row.nombre}`}
            onClick={(e) => {
              e.stopPropagation();
              setEditingRow(row);
              setDrawerOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label={`Eliminar ${row.nombre}`}
            onClick={(e) => {
              e.stopPropagation();
              setDeletingRow(row);
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
        <h2 className="text-base font-semibold">{title}</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditingRow(null);
            setDrawerOpen(true);
          }}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          Nuevo
        </Button>
      </div>
      <div className="mb-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={`Buscar en ${title.toLowerCase()}...`}
        />
      </div>
      {error ? (
        <EmptyState title="Error" description={error.message} />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          getRowId={(row) => String(row[pkField])}
          emptyTitle={`Sin ${title.toLowerCase()}`}
          emptyDescription={`Agrega el primer registro de ${title.toLowerCase()}.`}
          emptyAction={
            <Button
              size="sm"
              onClick={() => {
                setEditingRow(null);
                setDrawerOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Nuevo
            </Button>
          }
        />
      )}

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerOpen(false);
            setEditingRow(null);
          }
        }}
      >
        <DrawerContent className="sm:max-w-md">
          <DrawerHeader>
            <DrawerTitle>{editingRow ? `Editar ${title}` : `Nuevo en ${title}`}</DrawerTitle>
            <DrawerDescription>
              {editingRow
                ? "Modifica los datos del registro."
                : "Agrega un nuevo registro al catálogo."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <EntityForm
              schema={catalogSchema}
              defaultValues={
                editingRow ? toForm(editingRow) : { codigo: "", nombre: "", descripcion: "" }
              }
              onSubmit={handleSubmit}
              onCancel={() => {
                setDrawerOpen(false);
                setEditingRow(null);
              }}
              loading={isPendingCreate || isPendingUpdate}
              submitLabel={editingRow ? "Guardar cambios" : "Crear registro"}
            >
              {(form) => (
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="codigo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código *</FormLabel>
                        <FormControl>
                          <Input placeholder="COD" {...field} className="font-mono" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre del registro" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="descripcion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Descripción opcional"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </EntityForm>
          </div>
        </DrawerContent>
      </Drawer>

      <DeleteDialog
        open={!!deletingRow}
        onOpenChange={(open) => !open && setDeletingRow(null)}
        entityLabel={`"${deletingRow?.nombre ?? ""}"`}
        onConfirm={handleDelete}
        loading={isPendingDelete}
      />
    </>
  );
}

// ─── Catalog section connectors ───────────────────────────────────────────────
