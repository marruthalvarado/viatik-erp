import type { UseFormReturn } from "react-hook-form";
import { Percent } from "lucide-react";
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
import type { FacturaEmitida } from "@/services/facturas-emitidas";
import type { FacturaXmlData } from "@/services/factura-xml-parser";
import type { FormValues } from "./factura-types";
import { ValorNetoPreviewWrapper } from "./valor-neto-preview";

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
}

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
}: FacturaDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{editando ? "Editar factura" : "Nueva factura"}</DrawerTitle>
          <DrawerDescription>
            {xmlParsed && !editando
              ? `Datos cargados desde ${xmlParsed.xml_content ? "XML" : "PDF"} · ${xmlParsed.numero}`
              : "Completa los datos de la factura emitida."}
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

              <div className="grid grid-cols-4 gap-3">
                {(["subtotal", "descuento", "iva", "total"] as const).map((f) => (
                  <FormField
                    key={f}
                    control={form.control}
                    name={f}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="capitalize">
                          {f === "iva" ? "IVA" : f.charAt(0).toUpperCase() + f.slice(1)}
                        </FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
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
