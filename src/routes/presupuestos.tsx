/**
 * Módulo Presupuestos — Tracker financiero por proyecto.
 *
 * Muestra todos los proyectos de la empresa con:
 *   - Presupuesto interno (proyectos.presupuesto)
 *   - Valor contrato con el cliente (proyectos.valor_contrato)
 *   - Ejecutado (suma de rendiciones)
 *   - Ganancia estimada (contrato − ejecutado)
 *
 * Permite editar Presupuesto y Valor Contrato desde aquí; son los mismos
 * campos que en el formulario de Proyectos.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, TrendingDown, TrendingUp } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { DataTable } from "@/components/common/data-table";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "@/components/common/toast";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/common/drawer";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { useResumenFinancieroProyectos } from "@/hooks/entities/use-dashboard";
import { useActualizarProyecto } from "@/hooks/entities/use-proyectos";
import { useCompany } from "@/contexts/company-context";
import { formatCurrency } from "@/utils/formatters";

import type { DataTableColumn } from "@/components/common/data-table";
import type { ResumenFinancieroProyecto } from "@/services/dashboard";

export const Route = createFileRoute("/presupuestos")({
  head: () => ({ meta: [{ title: "Presupuestos · VIATIQ" }] }),
  component: PresupuestosPage,
});

function PresupuestosPage() {
  return (
    <AppShell>
      <PresupuestosContent />
    </AppShell>
  );
}

const editSchema = z.object({
  presupuesto: z.coerce.number().min(0).nullable(),
  valor_contrato: z.coerce.number().min(0).nullable(),
});
type EditValues = z.infer<typeof editSchema>;

function GananciaCell({ ganancia, margen_pct }: { ganancia: number; margen_pct: number | null }) {
  const positive = ganancia >= 0;
  return (
    <div
      className={`flex items-center gap-1 tabular-nums font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}
    >
      {positive ? (
        <TrendingUp className="size-3.5 shrink-0" />
      ) : (
        <TrendingDown className="size-3.5 shrink-0" />
      )}
      <span>{formatCurrency(ganancia)}</span>
      {margen_pct !== null && (
        <span className="text-xs font-normal opacity-70">({margen_pct}%)</span>
      )}
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  if (max <= 0) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.min(100, Math.round((value / max) * 100));
  const over = value > max;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${over ? "bg-red-500" : "bg-indigo-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

function PresupuestosContent() {
  const { empresaActivaId } = useCompany();
  const { data, isLoading, error } = useResumenFinancieroProyectos(empresaActivaId);
  const actualizar = useActualizarProyecto();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ResumenFinancieroProyecto | null>(null);

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { presupuesto: null, valor_contrato: null },
  });

  function openEdit(row: ResumenFinancieroProyecto) {
    setEditing(row);
    form.reset({
      presupuesto: row.presupuesto || null,
      valor_contrato: row.valor_contrato || null,
    });
  }

  async function onSubmit(values: EditValues) {
    if (!editing) return;
    try {
      await actualizar.mutateAsync({
        id: editing.proyecto_id,
        payload: {
          presupuesto: values.presupuesto ?? null,
          valor_contrato: values.valor_contrato ?? null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["presupuestos", "resumen_financiero"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "proyectos"] });
      toast.success("Valores actualizados.");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar.");
    }
  }

  const columns: DataTableColumn<ResumenFinancieroProyecto>[] = [
    {
      key: "nombre",
      header: "Proyecto",
      cell: (row) => (
        <div>
          <p className="text-sm font-medium">{row.nombre}</p>
          {row.cliente_nombre && (
            <p className="text-xs text-muted-foreground">{row.cliente_nombre}</p>
          )}
        </div>
      ),
    },
    {
      key: "presupuesto",
      header: "Presupuesto",
      align: "right",
      cell: (row) =>
        row.presupuesto > 0 ? (
          <span className="tabular-nums text-sm">{formatCurrency(row.presupuesto)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "valor_contrato",
      header: "Valor contrato",
      align: "right",
      cell: (row) =>
        row.valor_contrato > 0 ? (
          <span className="tabular-nums text-sm">{formatCurrency(row.valor_contrato)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "facturado",
      header: "Facturado",
      align: "right",
      cell: (row) =>
        ((row as ResumenFinancieroProyecto & { facturado?: number }).facturado ?? 0 > 0) ? (
          <span className="tabular-nums text-sm font-medium text-emerald-700">
            {formatCurrency(
              (row as ResumenFinancieroProyecto & { facturado?: number }).facturado ?? 0,
            )}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "ejecutado",
      header: "Gastos (ejecutado)",
      align: "right",
      cell: (row) => (
        <div className="flex flex-col items-end gap-1">
          <span className="tabular-nums text-sm">{formatCurrency(row.ejecutado)}</span>
          <ProgressBar
            value={row.ejecutado}
            max={
              (row as ResumenFinancieroProyecto & { facturado?: number }).facturado ||
              row.valor_contrato ||
              row.presupuesto
            }
          />
        </div>
      ),
    },
    {
      key: "ganancia",
      header: "Ganancia",
      cell: (row) =>
        row.valor_contrato > 0 ||
        ((row as ResumenFinancieroProyecto & { facturado?: number }).facturado ?? 0) > 0 ? (
          <GananciaCell ganancia={row.ganancia} margen_pct={row.margen_pct} />
        ) : (
          <span className="text-xs text-muted-foreground">Sin datos</span>
        ),
    },
    {
      key: "acciones",
      header: "",
      className: "w-12",
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Editar presupuesto"
          onClick={(e) => {
            e.stopPropagation();
            openEdit(row);
          }}
        >
          <Pencil className="size-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Presupuestos"
        description="Control financiero por proyecto: presupuesto interno, contrato, ejecutado y ganancia."
        breadcrumbs={[{ label: "Presupuestos" }]}
      />

      {isLoading ? (
        <LoadingState label="Cargando proyectos..." />
      ) : error ? (
        <EmptyState
          title="Error al cargar"
          description={error instanceof Error ? error.message : "Error inesperado."}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={false}
          getRowId={(row) => row.proyecto_id}
          emptyTitle="Sin proyectos"
          emptyDescription="Crea proyectos en el módulo Proyectos para verlos aquí."
        />
      )}

      <Drawer
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DrawerContent className="sm:max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Valores financieros</DrawerTitle>
            <DrawerDescription>{editing?.nombre}</DrawerDescription>
          </DrawerHeader>
          <div className="px-6 pb-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="presupuesto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Presupuesto interno</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value === "" ? null : +e.target.value)
                          }
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Costo estimado del proyecto.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="valor_contrato"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor contrato</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value === "" ? null : +e.target.value)
                          }
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Lo cobrado al cliente.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditing(null)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={actualizar.isPending}>
                    Guardar
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
