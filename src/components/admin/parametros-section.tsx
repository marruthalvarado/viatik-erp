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
  useParametros,
  useCrearParametro,
  useActualizarParametro,
  useEliminarParametro,
} from "@/hooks/entities/use-parametros";
import { useCompany } from "@/contexts/company-context";
import { emptyToNull } from "@/utils/formatters";

import type { DataTableColumn } from "@/components/common/data-table";
import type {
  ParametroSistema,
  ParametroSistemaInsert,
  ParametroSistemaUpdate,
} from "@/types/entities";

const parametroSchema = z.object({
  clave: z.string().min(1, "La clave es requerida"),
  valor: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
});

type ParametroFormValues = z.infer<typeof parametroSchema>;

export function ParametrosSection() {
  const { empresaActivaId } = useCompany();
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingParam, setEditingParam] = useState<ParametroSistema | null>(null);
  const [deletingParam, setDeletingParam] = useState<ParametroSistema | null>(null);

  const { data, isLoading, error } = useParametros({ pageSize: 100, search });
  const crear = useCrearParametro();
  const actualizar = useActualizarParametro();
  const eliminar = useEliminarParametro();

  function toForm(p: ParametroSistema): ParametroFormValues {
    return { clave: p.clave, valor: p.valor ?? "", descripcion: p.descripcion ?? "" };
  }

  async function handleSubmit(values: ParametroFormValues) {
    if (!empresaActivaId) {
      toast.error("Selecciona una empresa activa.");
      return;
    }
    try {
      if (editingParam) {
        const payload: ParametroSistemaUpdate = {
          clave: values.clave,
          valor: emptyToNull(values.valor),
          descripcion: emptyToNull(values.descripcion),
        };
        await actualizar.mutateAsync({ id: editingParam.id, payload });
        toast.success("Parámetro actualizado.");
      } else {
        const payload: ParametroSistemaInsert = {
          empresa_id: empresaActivaId,
          clave: values.clave,
          valor: emptyToNull(values.valor),
          descripcion: emptyToNull(values.descripcion),
        };
        await crear.mutateAsync(payload);
        toast.success("Parámetro creado.");
      }
      setDrawerOpen(false);
      setEditingParam(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el parámetro.");
    }
  }

  async function handleDelete() {
    if (!deletingParam) return;
    try {
      await eliminar.mutateAsync(deletingParam.id);
      toast.success(`Parámetro "${deletingParam.clave}" eliminado.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el parámetro.");
    } finally {
      setDeletingParam(null);
    }
  }

  const columns: DataTableColumn<ParametroSistema>[] = [
    {
      key: "clave",
      header: "Clave",
      className: "w-48",
      cell: (row) => <span className="font-mono text-xs">{row.clave}</span>,
    },
    {
      key: "valor",
      header: "Valor",
      cell: (row) => <span className="text-sm">{row.valor ?? "—"}</span>,
    },
    {
      key: "descripcion",
      header: "Descripción",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{row.descripcion ?? "—"}</span>
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
            aria-label="Editar parámetro"
            onClick={(e) => {
              e.stopPropagation();
              setEditingParam(row);
              setDrawerOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label="Eliminar parámetro"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingParam(row);
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
        <h2 className="text-base font-semibold">Parámetros del sistema</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditingParam(null);
            setDrawerOpen(true);
          }}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          Nuevo parámetro
        </Button>
      </div>
      <div className="mb-3">
        <SearchBar
          value={search}
          onChange={(v) => setSearch(v)}
          placeholder="Buscar clave o descripción..."
        />
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
          emptyTitle="Sin parámetros"
          emptyDescription="Agrega parámetros de configuración para la empresa."
          emptyAction={
            <Button
              size="sm"
              onClick={() => {
                setEditingParam(null);
                setDrawerOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Nuevo parámetro
            </Button>
          }
        />
      )}

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerOpen(false);
            setEditingParam(null);
          }
        }}
      >
        <DrawerContent className="sm:max-w-lg">
          <DrawerHeader>
            <DrawerTitle>{editingParam ? "Editar parámetro" : "Nuevo parámetro"}</DrawerTitle>
            <DrawerDescription>
              Los parámetros configuran el comportamiento del sistema.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <EntityForm
              schema={parametroSchema}
              defaultValues={
                editingParam ? toForm(editingParam) : { clave: "", valor: "", descripcion: "" }
              }
              onSubmit={handleSubmit}
              onCancel={() => {
                setDrawerOpen(false);
                setEditingParam(null);
              }}
              loading={crear.isPending || actualizar.isPending}
              submitLabel={editingParam ? "Guardar cambios" : "Crear parámetro"}
            >
              {(form) => (
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="clave"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Clave *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="LIMITE_GASTOS_DIARIO"
                            {...field}
                            className="font-mono"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="valor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor</FormLabel>
                        <FormControl>
                          <Input placeholder="1000" {...field} value={field.value ?? ""} />
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
                            placeholder="Límite diario de gastos por empleado"
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
        open={!!deletingParam}
        onOpenChange={(open) => !open && setDeletingParam(null)}
        entityLabel={`el parámetro "${deletingParam?.clave ?? ""}"`}
        onConfirm={handleDelete}
        loading={eliminar.isPending}
      />
    </>
  );
}
