import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Loader2, ChevronsUpDown, Check } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
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
import { cn } from "@/lib/utils";
import type { GastoEmpresa } from "@/services/gastos-empresa";
import type { FacturaXmlData } from "@/services/factura-xml-parser";
import { MONEDAS_EXTRANJERAS, type GastoEmpresaFormValues } from "./gasto-empresa-types";

interface CategoriaItem { id: string; nombre: string }
interface ProveedorItem { id: string; nombre: string; identificacion?: string | null }
interface ProyectoItem { id: string; nombre: string }

interface GastoEmpresaDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<GastoEmpresaFormValues>;
  editando: GastoEmpresa | null;
  xmlParsed: FacturaXmlData | null;
  onSubmit: (values: GastoEmpresaFormValues) => Promise<void>;
  categorias: CategoriaItem[];
  proveedores: ProveedorItem[];
  proyectos: ProyectoItem[];
  rucPorProveedor: Map<string, string>;
  crearIsPending: boolean;
  actualizarIsPending: boolean;
}

export function GastoEmpresaDrawer({
  open,
  onOpenChange,
  form,
  editando,
  xmlParsed,
  onSubmit,
  categorias,
  proveedores,
  proyectos,
  rucPorProveedor,
  crearIsPending,
  actualizarIsPending,
}: GastoEmpresaDrawerProps) {
  const [proveedorOpen, setProveedorOpen] = useState(false);

  // Auto-cálculo: iva = subtotal * iva_pct/100, total = subtotal + iva
  const watchedSubtotal = form.watch("subtotal");
  const watchedIvaPct = form.watch("iva_pct");
  useEffect(() => {
    const sub = Number(watchedSubtotal) || 0;
    const pct = Number(watchedIvaPct) || 0;
    const ivaAmt = Math.round(sub * pct) / 100;
    form.setValue("iva", ivaAmt, { shouldValidate: false });
    form.setValue("total", parseFloat((sub + ivaAmt).toFixed(2)), { shouldValidate: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedSubtotal, watchedIvaPct]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{editando ? "Editar gasto" : "Nuevo gasto empresa"}</DrawerTitle>
          <DrawerDescription>
            {xmlParsed && !editando
              ? `Datos del comprobante · ${xmlParsed.numero}`
              : "Completa los datos del gasto operativo."}
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              <div className="grid grid-cols-2 gap-4">
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
                <FormField
                  control={form.control}
                  name="responsable"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsable <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre del responsable" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Input placeholder="Servicio de internet, arriendo, suministros…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="numero_documento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>N° Factura <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="001-001-000000123" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ruc_emisor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RUC emisor <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="1790000000001" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="categoria_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                        value={field.value ?? "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sin categoría" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Sin categoría</SelectItem>
                          {categorias.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
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
                  render={({ field }) => {
                    const selected = proveedores.find((p) => p.id === field.value);
                    return (
                      <FormItem>
                        <FormLabel>Proveedor</FormLabel>
                        <Popover open={proveedorOpen} onOpenChange={setProveedorOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between font-normal text-sm h-9 px-3"
                              >
                                <span className={cn("truncate", !selected && "text-muted-foreground")}>
                                  {selected ? selected.nombre : "Sin proveedor"}
                                </span>
                                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[280px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar proveedor..." />
                              <CommandList>
                                <CommandEmpty>Sin resultados.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="__none__"
                                    onSelect={() => {
                                      field.onChange(null);
                                      setProveedorOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 size-4", !field.value ? "opacity-100" : "opacity-0")} />
                                    Sin proveedor
                                  </CommandItem>
                                  {proveedores.map((p) => (
                                    <CommandItem
                                      key={p.id}
                                      value={`${p.nombre} ${p.identificacion ?? rucPorProveedor.get(p.id) ?? ""}`}
                                      onSelect={() => {
                                        field.onChange(p.id);
                                        const ruc = p.identificacion ?? rucPorProveedor.get(p.id) ?? null;
                                        if (ruc) form.setValue("ruc_emisor", ruc);
                                        setProveedorOpen(false);
                                      }}
                                    >
                                      <Check className={cn("mr-2 size-4", field.value === p.id ? "opacity-100" : "opacity-0")} />
                                      <div>
                                        <div>{p.nombre}</div>
                                        {(p.identificacion ?? rucPorProveedor.get(p.id)) && (
                                          <div className="text-xs text-muted-foreground">
                                            {p.identificacion ?? rucPorProveedor.get(p.id)}
                                          </div>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              <FormField
                control={form.control}
                name="proyecto_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proyecto <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
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
                          <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Moneda de origen (importaciones) */}
              <div className="rounded-lg border border-dashed px-3 pt-3 pb-2 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Moneda de origen
                </p>
                <FormField
                  control={form.control}
                  name="moneda_origen"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moneda</FormLabel>
                      <Select
                        value={field.value ?? "__usd__"}
                        onValueChange={(v) => {
                          field.onChange(v === "__usd__" ? null : v);
                          if (v === "__usd__") {
                            form.setValue("monto_origen", null);
                            form.setValue("tipo_cambio", null);
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="USD — Dólar (por defecto)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__usd__">USD — Dólar (por defecto)</SelectItem>
                          {MONEDAS_EXTRANJERAS.map((m) => (
                            <SelectItem key={m.code} value={m.code}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {form.watch("moneda_origen") && (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="monto_origen"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monto ({form.watch("moneda_origen")})</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={field.value ?? ""}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || null;
                                field.onChange(v);
                                const tc = form.getValues("tipo_cambio") ?? 0;
                                if (v && tc) {
                                  form.setValue("subtotal", parseFloat((v * tc).toFixed(2)));
                                  form.setValue("total", parseFloat((v * tc).toFixed(2)));
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tipo_cambio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de cambio (a USD)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.000001"
                              min="0"
                              placeholder="1.000000"
                              value={field.value ?? ""}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || null;
                                field.onChange(v);
                                const mo = form.getValues("monto_origen") ?? 0;
                                if (mo && v) {
                                  form.setValue("subtotal", parseFloat((mo * v).toFixed(2)));
                                  form.setValue("total", parseFloat((mo * v).toFixed(2)));
                                }
                              }}
                            />
                          </FormControl>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Tipo indicado por el banco
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Subtotal + % IVA */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="subtotal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtotal (base)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="iva_pct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>% IVA</FormLabel>
                      <Select
                        value={String(field.value ?? 0)}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="0%" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="12">12%</SelectItem>
                          <SelectItem value="15">15%</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* IVA y Total (calculados automáticamente) */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="iva"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IVA</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          readOnly
                          className="bg-muted/40 cursor-default"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          readOnly
                          className="bg-muted/40 cursor-default font-medium"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="es_deducible"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div>
                      <FormLabel className="cursor-pointer">Gasto deducible</FormLabel>
                      <p className="text-[11px] text-muted-foreground">
                        Desmarca si este gasto no aplica para deducción de IR.
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observación <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Proveedor, número de comprobante, detalle…"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={crearIsPending || actualizarIsPending}>
                  {(crearIsPending || actualizarIsPending) && (
                    <Loader2 className="size-3 mr-1.5 animate-spin" />
                  )}
                  {editando ? "Guardar cambios" : "Registrar gasto"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
