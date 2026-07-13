import { useEffect } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntityForm } from "@/components/common/entity-form";

import { gastoSchema } from "./gasto-types";
import type { GastoFormValues } from "./gasto-types";
import type { Politica } from "@/types/entities";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function computarTope(catNombre: string, politica: Politica, noches: number): number | null {
  const n = catNombre.toLowerCase();
  if (n.includes("hospedaje") || n.includes("hotel") || n.includes("alojamiento")) {
    return (politica.tope_hospedaje ?? 0) * Math.max(noches, 1);
  }
  if (n.includes("desayuno")) return politica.tope_desayuno;
  if (n.includes("almuerzo")) return politica.tope_almuerzo;
  if (n.includes("cena")) return politica.tope_cena;
  if (n.includes("miscel")) return politica.tope_miscelaneo;
  return null;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface GastoFormProps {
  defaultValues: GastoFormValues;
  onSubmit: (values: GastoFormValues) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
  rendiciones: Array<{ id: string; numero: string }>;
  proveedores: Array<{ id: string; nombre: string }>;
  categorias: Array<{ id: string; nombre: string }>;
  estados: Array<{ id: string; nombre: string; codigo: string }>;
  monedas: Array<{ codigo: string; nombre: string; simbolo: string | null }>;
  /** Política activa de la empresa (para auto-calcular reembolsable) */
  politica?: Politica | null;
  /** Días del viaje (para calcular tope hospedaje) */
  viajeNoches?: number;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function GastoForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading,
  submitLabel,
  rendiciones,
  proveedores,
  categorias,
  estados,
  monedas,
  politica,
  viajeNoches = 1,
}: GastoFormProps) {
  return (
    <EntityForm
      schema={gastoSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
      loading={loading}
      submitLabel={submitLabel}
    >
      {(form) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const categoriaId = form.watch("categoria_gasto_id");
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const valorFactura = form.watch("valor_factura");

        const catNombre = categorias.find((c) => c.id === categoriaId)?.nombre ?? "";
        const tope = politica ? computarTope(catNombre, politica, viajeNoches) : null;
        const excedeTope = tope != null && tope > 0 && (valorFactura ?? 0) > tope;

        // Auto-calcular reembolsable cuando cambia categoria o valor_factura
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => {
          if (valorFactura == null || !politica) return;
          const computed = tope != null ? Math.min(valorFactura, tope) : valorFactura;
          form.setValue("valor_reembolsable", computed, { shouldValidate: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [categoriaId, valorFactura]);

        return (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="rendicion_id"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Rendición *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una rendición" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rendiciones.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.numero}
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
              name="fecha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="numero_documento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nro. documento</FormLabel>
                  <FormControl>
                    <Input placeholder="001-001-00001234" {...field} value={field.value ?? ""} />
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
                      placeholder="Descripción del gasto"
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
              name="categoria_gasto_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select
                    value={field.value ?? "__none__"}
                    onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Sin categoría</SelectItem>
                      {categorias.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre}
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
              name="estado_gasto_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select
                    value={field.value ?? "__none__"}
                    onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin estado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Sin estado</SelectItem>
                      {estados.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nombre}
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
              name="proveedor_id"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Proveedor</FormLabel>
                  <Select
                    value={field.value ?? "__none__"}
                    onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin proveedor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Sin proveedor</SelectItem>
                      {proveedores.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre}
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
              name="moneda_codigo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda</FormLabel>
                  <Select
                    value={field.value ?? "__none__"}
                    onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Moneda" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {monedas.map((m) => (
                        <SelectItem key={m.codigo} value={m.codigo}>
                          {m.codigo} — {m.nombre}
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
              name="tipo_cambio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de cambio</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="1.0000"
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
              name="valor_factura"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor factura</FormLabel>
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
              name="valor_reembolsable"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>Valor reembolsable</FormLabel>
                    {excedeTope && (
                      <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                        ⚠ Excede tope
                      </span>
                    )}
                  </div>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
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
              name="observaciones"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Observaciones adicionales"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );
      }}
    </EntityForm>
  );
}
