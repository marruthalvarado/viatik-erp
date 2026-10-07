/**
 * embarque-form.tsx
 * Formulario para crear/editar un embarque (liquidación DAI).
 * Incluye: datos DAI, valores aduaneros, líneas de productos.
 */
import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Calculator, FileUp } from "lucide-react";
import { toast } from "sonner";

import { parseLiquidacionPdf } from "@/services/importaciones-pdf-parser";

import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Label }     from "@/components/ui/label";
import { Textarea }  from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";

import { useCrearEmbarque, useActualizarEmbarque } from "@/hooks/entities/use-embarques";
import { useProveedores }    from "@/hooks/entities/use-proveedores";
import { useCosteos }        from "@/hooks/entities/use-costeos";
import type { EmbarqueConLineas, EstadoEmbarque } from "@/services/importaciones-embarques";

// ── Schema ────────────────────────────────────────────────────────────────────

const lineaSchema = z.object({
  producto_id:          z.string().optional().nullable(),
  descripcion_original: z.string().min(1, "Requerido"),
  fob_linea:            z.coerce.number().min(0),
  cantidad:             z.coerce.number().min(0.0001),
  unidad_medida:        z.string().optional().nullable(),
  peso_kg:              z.coerce.number().optional().nullable(),
  pais_origen:          z.string().optional().nullable(),
  observacion:          z.string().optional().nullable(),
});

const schema = z.object({
  numero_liquidacion: z.string().optional().nullable(),
  referencia_dai:     z.string().optional().nullable(),
  fecha:              z.string().min(1, "Requerido"),
  proveedor_id:       z.string().optional().nullable(),
  pais_origen:        z.string().optional().nullable(),
  costeo_id:          z.string().optional().nullable(),
  fob_total:          z.coerce.number().min(0),
  seguro:             z.coerce.number().min(0),
  flete:              z.coerce.number().min(0),
  ajustes:            z.coerce.number(),
  valor_aduanas:      z.coerce.number().min(0),
  arancel:            z.coerce.number().min(0),
  fodinfa:            z.coerce.number().min(0),
  iva_importacion:    z.coerce.number().min(0),
  total_liquidado:    z.coerce.number().min(0),
  estado:             z.enum(["En tránsito", "Recibida", "Parcial"]),
  observacion:        z.string().optional().nullable(),
  lineas:             z.array(lineaSchema).default([]),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:      boolean;
  onClose:   () => void;
  editando?: EmbarqueConLineas | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const n = (v: unknown) => (typeof v === "number" ? v : 0);

function toDefault(e?: EmbarqueConLineas | null): FormValues {
  if (!e) {
    return {
      numero_liquidacion: "",
      referencia_dai:     "",
      fecha:              new Date().toISOString().slice(0, 10),
      proveedor_id:       null,
      pais_origen:        "",
      costeo_id:          null,
      fob_total:          0,
      seguro:             0,
      flete:              0,
      ajustes:            0,
      valor_aduanas:      0,
      arancel:            0,
      fodinfa:            0,
      iva_importacion:    0,
      total_liquidado:    0,
      estado:             "En tránsito",
      observacion:        "",
      lineas:             [],
    };
  }
  return {
    numero_liquidacion: e.numero_liquidacion ?? "",
    referencia_dai:     e.referencia_dai     ?? "",
    fecha:              e.fecha,
    proveedor_id:       e.proveedor_id       ?? null,
    pais_origen:        e.pais_origen        ?? "",
    costeo_id:          e.costeo_id          ?? null,
    fob_total:          n(e.fob_total),
    seguro:             n(e.seguro),
    flete:              n(e.flete),
    ajustes:            n(e.ajustes),
    valor_aduanas:      n(e.valor_aduanas),
    arancel:            n(e.arancel),
    fodinfa:            n(e.fodinfa),
    iva_importacion:    n(e.iva_importacion),
    total_liquidado:    n(e.total_liquidado),
    estado:             (e.estado as EstadoEmbarque) ?? "En tránsito",
    observacion:        e.observacion        ?? "",
    lineas:             (e.lineas ?? []).map((l) => ({
      producto_id:          l.producto_id          ?? null,
      descripcion_original: l.descripcion_original,
      fob_linea:            n(l.fob_linea),
      cantidad:             n(l.cantidad),
      unidad_medida:        l.unidad_medida        ?? null,
      peso_kg:              l.peso_kg              ?? null,
      pais_origen:          l.pais_origen          ?? null,
      observacion:          l.observacion          ?? null,
    })),
  };
}

// ── Componente ────────────────────────────────────────────────────────────────

export function EmbarqueForm({ open, onClose, editando }: Props) {
  const crear      = useCrearEmbarque();
  const actualizar = useActualizarEmbarque();
  const { data: proveedores = [] } = useProveedores();
  const [parsindoPdf, setParsandoPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsandoPdf(true);
    try {
      const parsed = await parseLiquidacionPdf(file);
      if (parsed.numero_liquidacion) form.setValue("numero_liquidacion", parsed.numero_liquidacion);
      if (parsed.fecha)              form.setValue("fecha", parsed.fecha);
      if (parsed.arancel != null)    form.setValue("arancel", parsed.arancel);
      if (parsed.fodinfa != null)    form.setValue("fodinfa", parsed.fodinfa);
      if (parsed.iva_importacion != null) form.setValue("iva_importacion", parsed.iva_importacion);
      // total_liquidado se auto-calcula con el useEffect, pero lo seteamos como fallback
      if (parsed.total_liquidado != null) form.setValue("total_liquidado", parsed.total_liquidado);
      toast.success("Liquidación PDF importada");
    } catch (err) {
      toast.error("No se pudo leer el PDF: " + (err as Error).message);
    } finally {
      setParsandoPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }
  const { data: costeos     = [] } = useCosteos();

  // Sólo proveedores internacionales
  const interns = proveedores.filter((p) => (p as { es_internacional?: boolean }).es_internacional);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefault(editando),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineas",
  });

  useEffect(() => {
    form.reset(toDefault(editando));
  }, [editando, open]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calcular valor_aduanas = fob + seguro + flete + ajustes
  const watchFob    = form.watch("fob_total");
  const watchSeguro = form.watch("seguro");
  const watchFlete  = form.watch("flete");
  const watchAjust  = form.watch("ajustes");

  useEffect(() => {
    const va = n(watchFob) + n(watchSeguro) + n(watchFlete) + n(watchAjust);
    form.setValue("valor_aduanas", parseFloat(va.toFixed(2)));
  }, [watchFob, watchSeguro, watchFlete, watchAjust]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calcular total_liquidado = valor_aduanas + arancel + fodinfa + iva
  const watchVA     = form.watch("valor_aduanas");
  const watchAranc  = form.watch("arancel");
  const watchFodin  = form.watch("fodinfa");
  const watchIva    = form.watch("iva_importacion");

  useEffect(() => {
    const tl = n(watchVA) + n(watchAranc) + n(watchFodin) + n(watchIva);
    form.setValue("total_liquidado", parseFloat(tl.toFixed(2)));
  }, [watchVA, watchAranc, watchFodin, watchIva]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function onSubmit(values: FormValues) {
    const { lineas, ...datos } = values;
    try {
      if (editando) {
        await actualizar.mutateAsync({ id: editando.id, datos, lineas });
        toast.success("Embarque actualizado");
      } else {
        const res = await crear.mutateAsync({ datos: datos as Parameters<typeof crear.mutateAsync>[0]["datos"], lineas });
        toast.success(`Embarque ${res.numero_embarque} creado`);
      }
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const isSaving = crear.isPending || actualizar.isPending;

  const numInput = (
    name: keyof Omit<FormValues, "lineas" | "estado" | "proveedor_id" | "costeo_id" | "pais_origen" | "observacion" | "numero_liquidacion" | "referencia_dai" | "fecha">,
    label: string
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              step="0.01"
              min="0"
              {...field}
              value={field.value ?? 0}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {editando ? `Editar embarque ${editando.numero_embarque ?? ""}` : "Nuevo embarque"}
          </SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">

            {/* ── Sección: Datos DAI ──────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Datos DAI / Liquidación
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  disabled={parsindoPdf}
                  onClick={() => pdfInputRef.current?.click()}
                >
                  <FileUp className="size-3" />
                  {parsindoPdf ? "Leyendo…" : "Cargar PDF liquidación"}
                </Button>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="numero_liquidacion" render={({ field }) => (
                  <FormItem>
                    <FormLabel>N° liquidación</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} placeholder="DAI-2026-XXXXX" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="referencia_dai" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referencia interna</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fecha" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="estado" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="En tránsito">En tránsito</SelectItem>
                        <SelectItem value="Recibida">Recibida</SelectItem>
                        <SelectItem value="Parcial">Parcial</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="proveedor_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proveedor internacional</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">— Sin proveedor —</SelectItem>
                        {interns.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="pais_origen" render={({ field }) => (
                  <FormItem>
                    <FormLabel>País de origen</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} placeholder="Alemania" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* ── Sección: Valores aduaneros ──────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Valores aduaneros (USD)
              </p>
              <div className="grid grid-cols-3 gap-3">
                {numInput("fob_total",       "FOB total")}
                {numInput("seguro",          "Seguro")}
                {numInput("flete",           "Flete")}
                {numInput("ajustes",         "Ajustes")}
                <FormField control={form.control} name="valor_aduanas" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor aduanas (CIF)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} readOnly className="bg-muted" />
                    </FormControl>
                  </FormItem>
                )} />
                {numInput("arancel",         "Arancel")}
                {numInput("fodinfa",         "FODINFA")}
                {numInput("iva_importacion", "IVA importación")}
                <FormField control={form.control} name="total_liquidado" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total liquidado</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} readOnly className="bg-muted font-semibold" />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
            </div>

            {/* ── Sección: Vincular costeo ────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Comparar con costeo estimado
              </p>
              <FormField control={form.control} name="costeo_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Costeo (opcional)</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                    <FormControl>
                      <SelectTrigger className="w-72"><SelectValue placeholder="Sin costeo vinculado" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">— Sin costeo —</SelectItem>
                      {costeos.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.numero} — {c.descripcion_producto}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* ── Sección: Líneas del DAI ─────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Líneas de productos
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({
                    producto_id: null,
                    descripcion_original: "",
                    fob_linea: 0,
                    cantidad: 1,
                    unidad_medida: null,
                    peso_kg: null,
                    pais_origen: null,
                    observacion: null,
                  })}
                >
                  <Plus className="size-4 mr-1" /> Agregar línea
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
                  Sin líneas. Agrega al menos una para prorratear el costo.
                </p>
              )}

              <div className="space-y-3">
                {fields.map((field, i) => (
                  <div key={field.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Línea {i + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => remove(i)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <Label className="text-xs">Descripción original DAI</Label>
                        <Input
                          {...form.register(`lineas.${i}.descripcion_original`)}
                          placeholder="Texto del DAI…"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">FOB línea (USD)</Label>
                        <Input
                          type="number" step="0.01" min="0"
                          {...form.register(`lineas.${i}.fob_linea`)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Cantidad</Label>
                        <Input
                          type="number" step="0.0001" min="0.0001"
                          {...form.register(`lineas.${i}.cantidad`)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unidad</Label>
                        <Input
                          {...form.register(`lineas.${i}.unidad_medida`)}
                          placeholder="und, kg…"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Peso (kg)</Label>
                        <Input
                          type="number" step="0.001"
                          {...form.register(`lineas.${i}.peso_kg`)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Observación ─────────────────────────────────────────────── */}
            <FormField control={form.control} name="observacion" render={({ field }) => (
              <FormItem>
                <FormLabel>Observación</FormLabel>
                <FormControl>
                  <Textarea {...field} value={field.value ?? ""} rows={2} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <SheetFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Guardando…" : editando ? "Actualizar" : "Crear embarque"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
