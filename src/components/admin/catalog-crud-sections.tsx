/**
 * catalog-crud-sections.tsx
 *
 * Conectores de sección para cada catálogo del sistema.
 * Cada export es un componente autónomo que conecta un catálogo
 * específico con SimpleCatalogCrud usando sus propios hooks.
 *
 * Importar desde catalog-crud.tsx (re-exporta todo).
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { DataTable } from "@/components/common/data-table";
import { SearchBar } from "@/components/common/search-bar";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { EmptyState } from "@/components/common/empty-state";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/common/drawer";
import { EntityForm } from "@/components/common/entity-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { emptyToNull } from "@/utils/formatters";
import type { DataTableColumn } from "@/components/common/data-table";
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
import { toast } from "@/components/common/toast";
import { SimpleCatalogCrud } from "./catalog-crud-base";

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

type SimpleValues = { codigo: string; nombre: string; descripcion: string | null };

// ─── Categorías de Gasto (custom — incluye es_deducible y codigo_contable) ────

const catGastoSchema = z.object({
  codigo: z.string().min(1, "El código es requerido"),
  nombre: z.string().min(1, "El nombre es requerido"),
  codigo_contable: z.string().nullable().optional(),
  es_deducible: z.boolean().default(true),
});
type CatGastoForm = z.infer<typeof catGastoSchema>;

export function CatGastoSection() {
  const { data, isLoading, error } = useCategoriasGasto({ pageSize: 200 });
  const crear = useCrearCategoriaGasto();
  const actualizar = useActualizarCategoriaGasto();
  const eliminar = useEliminarCategoriaGasto();

  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<CategoriaGasto | null>(null);
  const [deletingRow, setDeletingRow] = useState<CategoriaGasto | null>(null);

  const form = useForm<CatGastoForm>({
    resolver: zodResolver(catGastoSchema),
    defaultValues: { codigo: "", nombre: "", codigo_contable: null, es_deducible: true },
  });

  const rows = data?.rows ?? [];
  const filtered = search
    ? rows.filter(
        (r) =>
          r.codigo.toLowerCase().includes(search.toLowerCase()) ||
          r.nombre.toLowerCase().includes(search.toLowerCase()) ||
          (r.codigo_contable ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : rows;

  function openNew() {
    setEditingRow(null);
    form.reset({ codigo: "", nombre: "", codigo_contable: null, es_deducible: true });
    setDrawerOpen(true);
  }

  function openEdit(row: CategoriaGasto) {
    setEditingRow(row);
    form.reset({
      codigo: row.codigo,
      nombre: row.nombre,
      codigo_contable: row.codigo_contable ?? null,
      es_deducible: row.es_deducible ?? true,
    });
    setDrawerOpen(true);
  }

  async function handleSubmit(values: CatGastoForm) {
    const payload: CategoriaGastoInsert = {
      codigo: values.codigo,
      nombre: values.nombre,
      codigo_contable: emptyToNull(values.codigo_contable) ?? null,
      es_deducible: values.es_deducible,
    };
    if (editingRow) {
      await actualizar.mutateAsync({ id: editingRow.id, payload: payload as CategoriaGastoUpdate });
      toast.success("Categoría actualizada.");
    } else {
      await crear.mutateAsync(payload);
      toast.success("Categoría creada.");
    }
    setDrawerOpen(false);
    setEditingRow(null);
  }

  const columns: DataTableColumn<CategoriaGasto>[] = [
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
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{row.nombre}</span>
          {row.codigo_contable && (
            <span className="text-xs text-muted-foreground font-mono">{row.codigo_contable}</span>
          )}
        </div>
      ),
    },
    {
      key: "es_deducible",
      header: "Deducible",
      className: "w-28 text-center",
      cell: (row) =>
        row.es_deducible ? (
          <Badge variant="outline" className="text-xs text-green-700 border-green-300">Deducible</Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-red-600 border-red-300">No deducible</Badge>
        ),
    },
    {
      key: "acciones",
      header: "",
      className: "w-[88px]",
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            aria-label={`Editar ${row.nombre}`}
            onClick={(e) => { e.stopPropagation(); openEdit(row); }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label={`Eliminar ${row.nombre}`}
            onClick={(e) => { e.stopPropagation(); setDeletingRow(row); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Categorías de Gasto</h3>
        <Button size="sm" onClick={openNew} disabled={crear.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Nueva
        </Button>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Buscar categoría…" />

      {error instanceof Error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : filtered.length === 0 && !isLoading ? (
        <EmptyState title="Sin categorías" description="Crea la primera categoría de gasto." />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} />
      )}

      {/* Drawer form */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{editingRow ? "Editar categoría" : "Nueva categoría"}</DrawerTitle>
            <DrawerDescription>
              Código contable según el Plan de Cuentas de la empresa.
            </DrawerDescription>
          </DrawerHeader>
          <EntityForm
            form={form}
            onSubmit={handleSubmit}
            isPending={editingRow ? actualizar.isPending : crear.isPending}
            submitLabel={editingRow ? "Guardar cambios" : "Crear categoría"}
          >
            <FormField
              control={form.control}
              name="codigo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código interno</FormLabel>
                  <FormControl><Input {...field} placeholder="ALIM" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl><Input {...field} placeholder="Alimentación" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="codigo_contable"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta contable <span className="text-muted-foreground">(opcional)</span></FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="6.1.2.001"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="es_deducible"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">Gasto deducible de IR</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Desactiva para categorías no deducibles (taxis, multas, sin sustento…)
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </EntityForm>
        </DrawerContent>
      </Drawer>

      {deletingRow && (
        <DeleteDialog
          open
          title={`¿Eliminar "${deletingRow.nombre}"?`}
          description="Esta categoría será eliminada permanentemente."
          isPending={eliminar.isPending}
          onConfirm={async () => {
            await eliminar.mutateAsync(deletingRow.id);
            toast.success("Categoría eliminada.");
            setDeletingRow(null);
          }}
          onCancel={() => setDeletingRow(null)}
        />
      )}
    </div>
  );
}

// ─── Categorías de Documento ─────────────────────────────────────────────────

export function CatDocumentoSection() {
  const { data, isLoading, error } = useCategoriasDocumento({ pageSize: 200 });
  const crear = useCrearCategoriaDocumento();
  const actualizar = useActualizarCategoriaDocumento();
  const eliminar = useEliminarCategoriaDocumento();

  async function onSave(values: SimpleValues, existing: CategoriaDocumento | null) {
    if (existing) {
      await actualizar.mutateAsync({
        id: existing.id,
        payload: values as CategoriaDocumentoUpdate,
      });
      toast.success("Categoría actualizada.");
    } else {
      await crear.mutateAsync(values as CategoriaDocumentoInsert);
      toast.success("Categoría creada.");
    }
  }

  return (
    <SimpleCatalogCrud<CategoriaDocumento>
      title="Categorías de Documento"
      rows={data?.rows ?? []}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      isPendingCreate={crear.isPending}
      isPendingUpdate={actualizar.isPending}
      isPendingDelete={eliminar.isPending}
      onSave={onSave}
      onDelete={async (id) => {
        await eliminar.mutateAsync(id);
        toast.success("Categoría eliminada.");
      }}
    />
  );
}

// ─── Orígenes de Gasto ───────────────────────────────────────────────────────

export function OrigenGastoSection() {
  const { data, isLoading, error } = useOrigenesGasto({ pageSize: 200 });
  const crear = useCrearOrigenGasto();
  const actualizar = useActualizarOrigenGasto();
  const eliminar = useEliminarOrigenGasto();

  async function onSave(values: SimpleValues, existing: OrigenGasto | null) {
    if (existing) {
      await actualizar.mutateAsync({ id: existing.id, payload: values as OrigenGastoUpdate });
      toast.success("Origen actualizado.");
    } else {
      await crear.mutateAsync(values as OrigenGastoInsert);
      toast.success("Origen creado.");
    }
  }

  return (
    <SimpleCatalogCrud<OrigenGasto>
      title="Orígenes de Gasto"
      rows={data?.rows ?? []}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      isPendingCreate={crear.isPending}
      isPendingUpdate={actualizar.isPending}
      isPendingDelete={eliminar.isPending}
      onSave={onSave}
      onDelete={async (id) => {
        await eliminar.mutateAsync(id);
        toast.success("Origen eliminado.");
      }}
    />
  );
}

// ─── Monedas ─────────────────────────────────────────────────────────────────

export function MonedasSection() {
  const { data, isLoading, error } = useMonedas({ pageSize: 200 });
  const crear = useCrearMoneda();
  const actualizar = useActualizarMoneda();
  const eliminar = useEliminarMoneda();

  async function onSave(values: SimpleValues, existing: (Moneda & { id: string }) | null) {
    if (existing) {
      await actualizar.mutateAsync({
        id: existing.codigo,
        payload: { nombre: values.nombre } as MonedaUpdate,
      });
      toast.success("Moneda actualizada.");
    } else {
      await crear.mutateAsync({ codigo: values.codigo, nombre: values.nombre } as MonedaInsert);
      toast.success("Moneda creada.");
    }
  }

  return (
    <SimpleCatalogCrud<Moneda & { id: string }>
      title="Monedas"
      rows={(data?.rows ?? []).map((m) => ({ ...m, id: m.codigo }))}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      pkField="id"
      isPendingCreate={crear.isPending}
      isPendingUpdate={actualizar.isPending}
      isPendingDelete={eliminar.isPending}
      onSave={onSave}
      onDelete={async (codigo) => {
        await eliminar.mutateAsync(codigo);
        toast.success("Moneda eliminada.");
      }}
    />
  );
}

// ─── Estados de Gasto ────────────────────────────────────────────────────────

export function EstadoGastoSection() {
  const { data, isLoading, error } = useEstadosGasto({ pageSize: 200 });
  const crear = useCrearEstadoGasto();
  const actualizar = useActualizarEstadoGasto();
  const eliminar = useEliminarEstadoGasto();

  async function onSave(values: SimpleValues, existing: EstadoGasto | null) {
    const payload = { codigo: values.codigo, nombre: values.nombre };
    if (existing) {
      await actualizar.mutateAsync({ id: existing.id, payload: payload as EstadoGastoUpdate });
      toast.success("Estado actualizado.");
    } else {
      await crear.mutateAsync(payload as EstadoGastoInsert);
      toast.success("Estado creado.");
    }
  }

  return (
    <SimpleCatalogCrud<EstadoGasto>
      title="Estados de Gasto"
      rows={(data?.rows ?? []).map((r) => ({ ...r, descripcion: null }))}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      isPendingCreate={crear.isPending}
      isPendingUpdate={actualizar.isPending}
      isPendingDelete={eliminar.isPending}
      onSave={onSave}
      onDelete={async (id) => {
        await eliminar.mutateAsync(id);
        toast.success("Estado eliminado.");
      }}
    />
  );
}

// ─── Estados de Rendición ────────────────────────────────────────────────────

export function EstadoRendicionSection() {
  const { data, isLoading, error } = useEstadosRendicion({ pageSize: 200 });
  const crear = useCrearEstadoRendicion();
  const actualizar = useActualizarEstadoRendicion();
  const eliminar = useEliminarEstadoRendicion();

  async function onSave(values: SimpleValues, existing: EstadoRendicion | null) {
    const payload = { codigo: values.codigo, nombre: values.nombre };
    if (existing) {
      await actualizar.mutateAsync({ id: existing.id, payload: payload as EstadoRendicionUpdate });
      toast.success("Estado actualizado.");
    } else {
      await crear.mutateAsync(payload as EstadoRendicionInsert);
      toast.success("Estado creado.");
    }
  }

  return (
    <SimpleCatalogCrud<EstadoRendicion>
      title="Estados de Rendición"
      rows={(data?.rows ?? []).map((r) => ({ ...r, descripcion: null }))}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      isPendingCreate={crear.isPending}
      isPendingUpdate={actualizar.isPending}
      isPendingDelete={eliminar.isPending}
      onSave={onSave}
      onDelete={async (id) => {
        await eliminar.mutateAsync(id);
        toast.success("Estado eliminado.");
      }}
    />
  );
}

// ─── Tipos de Rendición ──────────────────────────────────────────────────────

export function TipoRendicionSection() {
  const { data, isLoading, error } = useTiposRendicion({ pageSize: 200 });
  const crear = useCrearTipoRendicion();
  const actualizar = useActualizarTipoRendicion();
  const eliminar = useEliminarTipoRendicion();

  async function onSave(values: SimpleValues, existing: TipoRendicion | null) {
    const payload = { codigo: values.codigo, nombre: values.nombre };
    if (existing) {
      await actualizar.mutateAsync({ id: existing.id, payload: payload as TipoRendicionUpdate });
      toast.success("Tipo actualizado.");
    } else {
      await crear.mutateAsync(payload as TipoRendicionInsert);
      toast.success("Tipo creado.");
    }
  }

  return (
    <SimpleCatalogCrud<TipoRendicion>
      title="Tipos de Rendición"
      rows={(data?.rows ?? []).map((r) => ({ ...r, descripcion: null }))}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      isPendingCreate={crear.isPending}
      isPendingUpdate={actualizar.isPending}
      isPendingDelete={eliminar.isPending}
      onSave={onSave}
      onDelete={async (id) => {
        await eliminar.mutateAsync(id);
        toast.success("Tipo eliminado.");
      }}
    />
  );
}

// ─── Tipos de Documento ──────────────────────────────────────────────────────

export function TipoDocumentoSection() {
  const { data, isLoading, error } = useTiposDocumento({ pageSize: 200 });
  const crear = useCrearTipoDocumento();
  const actualizar = useActualizarTipoDocumento();
  const eliminar = useEliminarTipoDocumento();

  async function onSave(values: SimpleValues, existing: TipoDocumento | null) {
    const payload = { codigo: values.codigo, nombre: values.nombre };
    if (existing) {
      await actualizar.mutateAsync({ id: existing.id, payload: payload as TipoDocumentoUpdate });
      toast.success("Tipo actualizado.");
    } else {
      await crear.mutateAsync(payload as TipoDocumentoInsert);
      toast.success("Tipo creado.");
    }
  }

  return (
    <SimpleCatalogCrud<TipoDocumento>
      title="Tipos de Documento"
      rows={(data?.rows ?? []).map((r) => ({ ...r, descripcion: null }))}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      isPendingCreate={crear.isPending}
      isPendingUpdate={actualizar.isPending}
      isPendingDelete={eliminar.isPending}
      onSave={onSave}
      onDelete={async (id) => {
        await eliminar.mutateAsync(id);
        toast.success("Tipo eliminado.");
      }}
    />
  );
}
