import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { EntityForm } from "@/components/common/entity-form";
import { cn } from "@/lib/utils";

import { gastoSchema } from "./gasto-types";
import type { GastoFormValues } from "./gasto-types";
import type { Politica } from "@/types/entities";
import type { UseFormReturn } from "react-hook-form";

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
  monedas: Array<{ codigo: string; nombre: string; simbolo: string | null }>;
  /** Callback para crear un proveedor nuevo desde el combobox */
  onCrearProveedor?: (nombre: string) => Promise<string | null>;
  /** Política activa de la empresa (para auto-calcular reembolsable) */
  politica?: Politica | null;
  /** Días del viaje (para calcular tope hospedaje) */
  viajeNoches?: number;
}

// ─── ProveedorCombobox ─────────────────────────────────────────────────────────

interface ProveedorComboboxProps {
  proveedores: Array<{ id: string; nombre: string }>;
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  onCrearProveedor?: (nombre: string) => Promise<string | null>;
}

function ProveedorCombobox({ proveedores, value, onChange, onCrearProveedor }: ProveedorComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const sortedProveedores = [...proveedores].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
  );

  const searchUpper = search.toUpperCase();
  const filtered = sortedProveedores.filter((p) =>
    p.nombre.toUpperCase().includes(searchUpper),
  );

  const selected = proveedores.find((p) => p.id === value);

  async function handleCrear() {
    if (!onCrearProveedor || !search.trim()) return;
    const nuevoId = await onCrearProveedor(search.trim().toUpperCase());
    if (nuevoId) {
      onChange(nuevoId);
      setOpen(false);
      setSearch("");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.nombre : "Buscar proveedor..."}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar o escribir nombre..."
            value={search}
            onValueChange={(v) => setSearch(v.toUpperCase())}
          />
          <CommandList>
            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.nombre}
                    onSelect={() => {
                      onChange(p.id);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn("mr-2 size-4", value === p.id ? "opacity-100" : "opacity-0")}
                    />
                    {p.nombre}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {filtered.length === 0 && !search.trim() && (
              <CommandEmpty>Sin resultados.</CommandEmpty>
            )}
            {search.trim() && onCrearProveedor && (
              <CommandGroup>
                <CommandItem
                  value={`__crear__${search}`}
                  onSelect={() => void handleCrear()}
                  className="text-primary"
                >
                  <span className="font-medium">+ Crear &ldquo;{search.trim().toUpperCase()}&rdquo;</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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
  monedas,
  onCrearProveedor,
  politica,
  viajeNoches = 1,
}: GastoFormProps) {
  const formRef = useRef<UseFormReturn<GastoFormValues> | null>(null);

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
        formRef.current = form;
        const categoriaId = form.watch("categoria_gasto_id");
        const valorFactura = form.watch("valor_factura");
        const monedaCodigo = form.watch("moneda_codigo");
        const proveedorId = form.watch("proveedor_id");

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
              name="numero_documento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nro. documento *</FormLabel>
                  <FormControl>
                    <Input placeholder="001-001-00001234" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fecha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha documento *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="proveedor_id"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Proveedor *</FormLabel>
                  <FormControl>
                    <ProveedorCombobox
                      proveedores={proveedores}
                      value={field.value}
                      onChange={field.onChange}
                      onCrearProveedor={onCrearProveedor}
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
              name="moneda_codigo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda *</FormLabel>
                  <Select
                    value={field.value ?? "USD"}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Moneda" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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

            {monedaCodigo && monedaCodigo !== "USD" && (
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
            )}

            <FormField
              control={form.control}
              name="valor_factura"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor factura *</FormLabel>
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
