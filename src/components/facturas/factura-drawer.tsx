import { useState, useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Percent, ChevronsUpDown, Check } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { FacturaEmitida } from "@/services/facturas-emitidas";
import type { FacturaXmlData } from "@/services/factura-xml-parser";
import type { FormValues } from "./factura-types";
import { ValorNetoPreviewWrapper } from "./valor-neto-preview";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ClienteSimple {
  id: string;
  nombre: string;
  ruc: string | null;
}

interface FacturaDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<FormValues>;
  editando: FacturaEmitida | null;
  xmlParsed: FacturaXmlData | null;
  onSubmit: (values: FormValues) => Promise<void>;
  proyectos: Array<{ id: string; nombre: string }>;
  crearIsPending: boolean;
  actualizarIsPending: boolean;
  /** Lista de clientes de la empresa para el buscador */
  clientes: ClienteSimple[];
  /** IVA % por defecto desde parametros_sistema (fallback: 15) */
  defaultIvaPct: number;
}

// ─── ClienteCombobox ──────────────────────────────────────────────────────────

function ClienteCombobox({
  clientes,
  onSelect,
}: {
  clientes: ClienteSimple[];
  onSelect: (c: ClienteSimple) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const searchLower = search.toLowerCase();
  const filtered = clientes
    .filter(
      (c) =>
        c.nombre.toLowerCase().includes(searchLower) ||
        (c.ruc ?? "").includes(search),
    )
    .slice(0, 20);

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
          <span className="text-muted-foreground truncate">
            Buscar cliente en base de datos...
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Nombre o RUC..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtered.length === 0 && (
              <CommandEmpty>No encontrado. Ingresa los datos manualmente.</CommandEmpty>
            )}
            <CommandGroup>
              {filtered.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.nombre}
                  onSelect={() => {
                    onSelect(c);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check className={cn("mr-2 size-4 opacity-0")} />
                  <span className="font-medium">{c.nombre}</span>
                  {c.ruc && (
                    <span className="ml-2 text-xs text-muted-foreground">{c.ruc}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── FacturaDrawer ────────────────────────────────────────────────────────────

export function FacturaDrawer({
  open,
  onOpenChange,
  form,
  editando,
  xmlParsed,
  onSubmit,
  proyectos,
  crearIsPending,
  actualizarIsPending,
  clientes,
  defaultIvaPct,
}: FacturaDrawerProps) {
  // IVA % local — no se guarda en BD, sólo sirve para calcular iva$ y total
  const [ivaPct, setIvaPct] = useState(defaultIvaPct);

  // Sincronizar ivaPct cuando el drawer abre
  useEffect(() => {
    if (!open) return;
    if (editando) {
      const sub = Number(editando.subtotal);
      const iva = Number(editando.iva);
      setIvaPct(sub > 0 ? Math.round((iva / sub) * 10000) / 100 : defaultIvaPct);
    } else if (xmlParsed) {
      const sub = Number(xmlParsed.subtotal);
      const iva = Number(xmlParsed.iva);
      setIvaPct(sub > 0 ? Math.round((iva / sub) * 10000) / 100 : defaultIvaPct);
    } else {
      setIvaPct(defaultIvaPct);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calcular IVA$ y Total cuando cambia subtotal, descuento o ivaPct
  const subtotal = form.watch("subtotal");
  const descuento = form.watch("descuento");

  useEffect(() => {
    const sub = Number(subtotal) || 0;
    const desc = Number(descuento) || 0;
    const ivaAmt = Math.round(sub * ivaPct) / 100;
    const total = Math.round((sub - desc + ivaAmt) * 100) / 100;
    form.setValue("iva", ivaAmt, { shouldDirty: false, shouldValidate: false });
    form.setValue("total", total, { shouldDirty: false, shouldValidate: false });
  }, [subtotal, descuento, ivaPct]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClienteSelect(c: ClienteSimple) {
    form.setValue("ruc_cliente", c.ruc ?? "");
    form.setValue("razon_social", c.nombre);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{editando ? "Editar factura" : "Registrar factura"}</DrawerTitle>
          <DrawerDescription>
            {xmlParsed && !editando
              ? `Datos cargados desde ${xmlParsed.xml_content ? "XML" : "PDF"} · ${xmlParsed.numero}`
              : "Completa los datos de la factura emitida."}
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* Número y Fecha */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input placeholder="001-001-000000001" {...field} />
                      </FormControl>
                      <p className="text-[10px] text-amber-600 flex items-start gap-1 mt-0.5">
                        ⚠ Verifica que coincida con tu facturador (SRI u otro sistema).
                      </p>
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
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Tipo y Proyecto */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="factura">Factura</SelectItem>
                          <SelectItem value="nota_credito">Nota de Crédito</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="proyecto_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proyecto</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                        value={field.value ?? "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sin proyecto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Sin proyecto</SelectItem>
                          {proyectos.map((p) => (
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
              </div>

              {/* Buscador de cliente */}
              {clientes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Seleccionar cliente existente
                  </p>
                  <ClienteCombobox clientes={clientes} onSelect={handleClienteSelect} />
                </div>
              )}

              {/* RUC / Razón Social */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ruc_cliente"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RUC / ID Cliente</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="1791365372001"
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
                  name="razon_social"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razón Social</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre del cliente" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Subtotal, Descuento, IVA %, IVA $, Total */}
              <div className="space-y-3">
                {/* Fila 1: subtotal + descuento */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="subtotal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subtotal</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="descuento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descuento</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Fila 2: IVA % + IVA $ + Total (calculados) */}
                <div className="rounded-lg border border-dashed bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Percent className="size-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Cálculo de IVA
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {/* IVA % — editable */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium">IVA %</label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={ivaPct}
                          onChange={(e) => setIvaPct(Number(e.target.value) || 0)}
                          className="pr-6 text-sm"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          %
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Editable (default: {defaultIvaPct}%)
                      </p>
                    </div>

                    {/* IVA $ — calculado, readonly */}
                    <FormField
                      control={form.control}
                      name="iva"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">IVA $</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              readOnly
                              tabIndex={-1}
                              className="bg-muted/60 text-sm cursor-default"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Total — calculado, readonly */}
                    <FormField
                      control={form.control}
                      name="total"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Total</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              readOnly
                              tabIndex={-1}
                              className="bg-muted/60 font-semibold text-sm cursor-default"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Retenciones fiscales */}
              <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-3">
                <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                  <Percent className="size-3" />
                  Retenciones fiscales (agente de retención)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Si el cliente retiene impuestos, ingresa los porcentajes. El valor a cobrar se
                  calculará automáticamente. Deja en 0 si no aplica.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="retencion_iva_pct"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">
                          Ret. IVA{" "}
                          <span className="text-muted-foreground font-normal">(% del IVA)</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="0"
                              {...field}
                              className="pr-7"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              %
                            </span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="retencion_ir_pct"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">
                          Ret. IR{" "}
                          <span className="text-muted-foreground font-normal">
                            (% del subtotal)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="0"
                              {...field}
                              className="pr-7"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              %
                            </span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <ValorNetoPreviewWrapper form={form} />
              </div>

              {/* Observación */}
              <FormField
                control={form.control}
                name="observacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observación</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Descripción del producto / servicio"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Fecha de vencimiento */}
              <FormField
                control={form.control}
                name="fecha_vencimiento"
                render={({ field }) => {
                  const fechaEmision = form.watch("fecha");
                  function setDias(dias: number) {
                    if (!fechaEmision) return;
                    const d = new Date(fechaEmision + "T00:00:00");
                    d.setDate(d.getDate() + dias);
                    field.onChange(d.toISOString().split("T")[0]);
                  }
                  return (
                    <FormItem>
                      <FormLabel>
                        Fecha de vencimiento{" "}
                        <span className="text-muted-foreground font-normal">(opcional)</span>
                      </FormLabel>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {[15, 30, 60, 90].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDias(d)}
                            className="rounded border px-2 py-0.5 text-[10px] font-medium hover:bg-muted transition-colors"
                          >
                            {d}d
                          </button>
                        ))}
                        {field.value && (
                          <button
                            type="button"
                            onClick={() => field.onChange(null)}
                            className="rounded border px-2 py-0.5 text-[10px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={crearIsPending || actualizarIsPending}>
                  {editando ? "Guardar cambios" : "Registrar factura"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
