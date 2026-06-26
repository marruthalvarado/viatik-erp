import { useState } from "react";
import { z } from "zod";
import { Plus, Pencil, Trash2 } from "lucide-react";

import { DataTable } from "@/components/common/data-table";
import { SearchBar } from "@/components/common/search-bar";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { StatusBadge } from "@/components/common/status-badge";
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
  usePoliticas,
  useCrearPolitica,
  useActualizarPolitica,
  useEliminarPolitica,
} from "@/hooks/entities/use-politicas";
import { useCompany } from "@/contexts/company-context";
import { emptyToNull } from "@/utils/formatters";

import type { DataTableColumn } from "@/components/common/data-table";
import type { Politica, PoliticaInsert, PoliticaUpdate } from "@/types/entities";

const politicaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  codigo: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  activo: z.boolean().nullable().optional(),
  valor_km: z.number().nonnegative().nullable().optional(),
  tope_almuerzo: z.number().nonnegative().nullable().optional(),
  tope_cena: z.number().nonnegative().nullable().optional(),
  tope_desayuno: z.number().nonnegative().nullable().optional(),
  tope_hospedaje: z.number().nonnegative().nullable().optional(),
  tope_miscelaneo: z.number().nonnegative().nullable().optional(),
  paga_combustible: z.boolean().nullable().optional(),
  paga_peajes: z.boolean().nullable().optional(),
});

type PoliticaFormValues = z.infer<typeof politicaSchema>;

const EMPTY_POLITICA: PoliticaFormValues = {
  nombre: "",
  codigo: "",
  descripcion: "",
  activo: true,
  valor_km: null,
  tope_almuerzo: null,
  tope_cena: null,
  tope_desayuno: null,
  tope_hospedaje: null,
  tope_miscelaneo: null,
  paga_combustible: false,
  paga_peajes: false,
};

function toPoliticaForm(p: Politica): PoliticaFormValues {
  return {
    nombre: p.nombre,
    codigo: p.codigo ?? "",
    descripcion: p.descripcion ?? "",
    activo: p.activo ?? true,
    valor_km: p.valor_km ?? null,
    tope_almuerzo: p.tope_almuerzo ?? null,
    tope_cena: p.tope_cena ?? null,
    tope_desayuno: p.tope_desayuno ?? null,
    tope_hospedaje: p.tope_hospedaje ?? null,
    tope_miscelaneo: p.tope_miscelaneo ?? null,
    paga_combustible: p.paga_combustible ?? false,
    paga_peajes: p.paga_peajes ?? false,
  };
}

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
        valor_km: values.valor_km ?? null,
        tope_almuerzo: values.tope_almuerzo ?? null,
        tope_cena: values.tope_cena ?? null,
        tope_desayuno: values.tope_desayuno ?? null,
        tope_hospedaje: values.tope_hospedaje ?? null,
        tope_miscelaneo: values.tope_miscelaneo ?? null,
        paga_combustible: values.paga_combustible ?? false,
        paga_peajes: values.paga_peajes ?? false,
      };
      if (editingPolitica) {
        const payload: PoliticaUpdate = common;
        await actualizar.mutateAsync({ id: editingPolitica.id, payload });
        toast.success("Política actualizada.");
      } else {
        const payload: PoliticaInsert = { ...common, empresa_id: empresaActivaId };
        await crear.mutateAsync(payload);
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
        <Button
          size="sm"
          onClick={() => {
            setEditingPolitica(null);
            setDrawerOpen(true);
          }}
          className="gap-1.5"
        >
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
            <Button
              size="sm"
              onClick={() => {
                setEditingPolitica(null);
                setDrawerOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Nueva política
            </Button>
          }
        />
      )}

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerOpen(false);
            setEditingPolitica(null);
          }
        }}
      >
        <DrawerContent className="sm:max-w-lg">
          <DrawerHeader>
            <DrawerTitle>{editingPolitica ? "Editar política" : "Nueva política"}</DrawerTitle>
            <DrawerDescription>Define topes y condiciones de reembolso.</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-6 pb-6">
            <EntityForm
              schema={politicaSchema}
              defaultValues={editingPolitica ? toPoliticaForm(editingPolitica) : EMPTY_POLITICA}
              onSubmit={handleSubmit}
              onCancel={() => {
                setDrawerOpen(false);
                setEditingPolitica(null);
              }}
              loading={crear.isPending || actualizar.isPending}
              submitLabel={editingPolitica ? "Guardar cambios" : "Crear política"}
            >
              {(form) => (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Nombre *</FormLabel>
                        <FormControl>
                          <Input placeholder="Política estándar" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="codigo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código</FormLabel>
                        <FormControl>
                          <Input placeholder="POL-001" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="valor_km"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor por km</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value === "" ? null : Number(e.target.value))
                            }
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="descripcion"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Descripción de la política"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <p className="col-span-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Topes de reembolso
                  </p>

                  {(
                    [
                      "tope_desayuno",
                      "tope_almuerzo",
                      "tope_cena",
                      "tope_hospedaje",
                      "tope_miscelaneo",
                    ] as const
                  ).map((fieldName) => {
                    const labels: Record<string, string> = {
                      tope_desayuno: "Desayuno",
                      tope_almuerzo: "Almuerzo",
                      tope_cena: "Cena",
                      tope_hospedaje: "Hospedaje",
                      tope_miscelaneo: "Misceláneo",
                    };
                    return (
                      <FormField
                        key={fieldName}
                        control={form.control}
                        name={fieldName}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{labels[fieldName]}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === "" ? null : Number(e.target.value),
                                  )
                                }
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    );
                  })}

                  <div className="col-span-2 flex flex-col gap-3">
                    {(["paga_combustible", "paga_peajes", "activo"] as const).map((fieldName) => {
                      const labels: Record<string, string> = {
                        paga_combustible: "Paga combustible",
                        paga_peajes: "Paga peajes",
                        activo: "Política activa",
                      };
                      return (
                        <FormField
                          key={fieldName}
                          control={form.control}
                          name={fieldName}
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center gap-3 space-y-0">
                              <FormControl>
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-input"
                                  checked={field.value ?? false}
                                  onChange={(e) => field.onChange(e.target.checked)}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                              </FormControl>
                              <FormLabel className="cursor-pointer font-normal">
                                {labels[fieldName]}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </EntityForm>
          </div>
        </DrawerContent>
      </Drawer>

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
