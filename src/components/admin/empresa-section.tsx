import { useState } from "react";
import { z } from "zod";
import { Pencil } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { EntityForm } from "@/components/common/entity-form";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useEmpresas, useActualizarEmpresa } from "@/hooks/entities/use-empresas";
import { useMonedas } from "@/hooks/entities/use-catalogs";
import { useCompany } from "@/contexts/company-context";
import { emptyToNull } from "@/utils/formatters";

import type { Empresa, EmpresaUpdate } from "@/types/entities";

const empresaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  codigo: z.string().nullable().optional(),
  ruc: z.string().nullable().optional(),
  correo: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "Correo inválido" }),
  telefono: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  moneda_base: z.string().nullable().optional(),
});

type EmpresaFormValues = z.infer<typeof empresaSchema>;

export function EmpresaSection() {
  const { empresaActivaId } = useCompany();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data } = useEmpresas({ pageSize: 100 });
  const actualizar = useActualizarEmpresa();
  const { data: monedasData } = useMonedas({ pageSize: 200 });

  const empresa = data?.rows.find((e) => e.id === empresaActivaId) ?? null;
  const monedas = monedasData?.rows ?? [];

  function toForm(e: Empresa): EmpresaFormValues {
    return {
      nombre: e.nombre,
      codigo: e.codigo ?? "",
      ruc: e.ruc ?? "",
      correo: e.correo ?? "",
      telefono: e.telefono ?? "",
      direccion: e.direccion ?? "",
      estado: e.estado ?? "activo",
      moneda_base: e.moneda_base ?? "",
    };
  }

  async function handleSubmit(values: EmpresaFormValues) {
    if (!empresa) return;
    try {
      const payload: EmpresaUpdate = {
        nombre: values.nombre,
        codigo: emptyToNull(values.codigo),
        ruc: emptyToNull(values.ruc),
        correo: emptyToNull(values.correo),
        telefono: emptyToNull(values.telefono),
        direccion: emptyToNull(values.direccion),
        estado: values.estado ?? null,
        moneda_base: emptyToNull(values.moneda_base),
      };
      await actualizar.mutateAsync({ id: empresa.id, payload });
      toast.success("Empresa actualizada.");
      setDrawerOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar la empresa.");
    }
  }

  if (!empresa)
    return (
      <EmptyState
        title="Sin empresa activa"
        description="Selecciona una empresa activa en el menú superior."
      />
    );

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Perfil de la empresa</h2>
        <Button size="sm" variant="outline" onClick={() => setDrawerOpen(true)} className="gap-1.5">
          <Pencil className="size-3.5" />
          Editar
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="grid grid-cols-2 gap-0 divide-x divide-y">
          {[
            ["Nombre", empresa.nombre],
            ["Código", empresa.codigo ?? "—"],
            ["RUC / Identificación", empresa.ruc ?? "—"],
            ["Correo", empresa.correo ?? "—"],
            ["Teléfono", empresa.telefono ?? "—"],
            ["Dirección", empresa.direccion ?? "—"],
            ["Moneda base", empresa.moneda_base ?? "—"],
            ["Estado", empresa.estado ?? "—"],
          ].map(([label, value]) => (
            <div key={label} className="px-4 py-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-sm font-medium">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <Drawer open={drawerOpen} onOpenChange={(open) => !open && setDrawerOpen(false)}>
        <DrawerContent className="sm:max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Editar empresa</DrawerTitle>
            <DrawerDescription>Datos generales de la empresa activa.</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-6 pb-6">
            <EntityForm
              schema={empresaSchema}
              defaultValues={toForm(empresa)}
              onSubmit={handleSubmit}
              onCancel={() => setDrawerOpen(false)}
              loading={actualizar.isPending}
              submitLabel="Guardar cambios"
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
                          <Input placeholder="Empresa S.A." {...field} />
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
                          <Input placeholder="EMP-001" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ruc"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RUC / Identificación</FormLabel>
                        <FormControl>
                          <Input placeholder="20123456789" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="correo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="info@empresa.com"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="telefono"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="+51 999 999 999"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="direccion"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Dirección</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Av. Principal 123"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="moneda_base"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Moneda base</FormLabel>
                        <Select
                          value={field.value ?? "__none__"}
                          onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">Sin moneda</SelectItem>
                            {monedas.map((m) => (
                              <SelectItem key={m.codigo} value={m.codigo}>
                                {m.nombre} ({m.codigo})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="estado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select value={field.value ?? "activo"} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="activo">Activo</SelectItem>
                            <SelectItem value="inactivo">Inactivo</SelectItem>
                            <SelectItem value="suspendido">Suspendido</SelectItem>
                          </SelectContent>
                        </Select>
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
    </>
  );
}
