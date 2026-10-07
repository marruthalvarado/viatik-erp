/**
 * costeo-form.tsx
 * Formulario de costeo de importación — reemplaza el Excel.
 * Calcula en tiempo real: FOB → CIF → aterrizaje → PVP.
 */
import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Calculator, Package, DollarSign, Percent } from "lucide-react";
import { toast } from "sonner";

import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Badge }    from "@/components/ui/badge";
import { Switch }   from "@/components/ui/switch";

import { useCrearCosteo, useActualizarCosteo } from "@/hooks/entities/use-costeos";
import { useProveedores }                       from "@/hooks/entities/use-proveedores";
import { useProyectos }                         from "@/hooks/entities/use-proyectos";
import type { CosteoConRelaciones, CosteoDatos, CosteoComponentePayload } from "@/services/costeos";

// ── Helpers de formato ───────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

const fmtNum = (n: number) =>
  new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// ── Schema ────────────────────────────────────────────────────────────────────
const componenteSchema = z.object({
  orden:           z.number().default(0),
  tipo:            z.enum(["equipo_base", "componente_opcional", "servicio_adicional"]).default("componente_opcional"),
  descripcion:     z.string().min(1, "Requerido"),
  fabricante:      z.string().optional(),
  modelo:          z.string().optional(),
  moneda:          z.enum(["USD", "EUR"]).default("USD"),
  precio_unitario: z.coerce.number().min(0).default(0),
  tipo_cambio:     z.coerce.number().min(0).default(1),
  precio_usd:      z.coerce.number().min(0).default(0),
  cantidad:        z.coerce.number().min(1).default(1),
  subtotal_usd:    z.coerce.number().min(0).default(0),
  incluir_en_fob:  z.boolean().default(true),
  notas:           z.string().optional(),
});

const costeoSchema = z.object({
  proveedor_id:                 z.string().min(1, "Selecciona un proveedor"),
  proyecto_id:                  z.string().optional(),
  descripcion_producto:         z.string().min(1, "Requerido"),
  moneda_proveedor:             z.enum(["USD", "EUR"]).default("USD"),
  precio_fob:                   z.coerce.number().min(0).default(0),
  tipo_cambio_eur:              z.coerce.number().min(0).default(1.08),
  flete_estimado:               z.coerce.number().min(0).default(0),
  seguro_estimado:              z.coerce.number().min(0).default(0),
  agente_aduanas_est:           z.coerce.number().min(0).default(0),
  bodega_est:                   z.coerce.number().min(0).default(0),
  otros_logistica:              z.coerce.number().min(0).default(0),
  codigo_nandina:               z.string().optional(),
  fodinfa_pct:                  z.coerce.number().min(0).max(100).default(0.5),
  arancel_pct:                  z.coerce.number().min(0).max(100).default(0),
  isd_pct:                      z.coerce.number().min(0).max(100).default(5),
  iva_importacion_pct:          z.coerce.number().min(0).max(100).default(15),
  instalacion:                  z.coerce.number().min(0).default(0),
  entrenamiento:                z.coerce.number().min(0).default(0),
  gastos_admin_fabrica:         z.coerce.number().min(0).default(0),
  fee_agente_comercial:         z.coerce.number().min(0).default(0),
  garantia_reserva:             z.coerce.number().min(0).default(0),
  mantenimiento_preventivo_res: z.coerce.number().min(0).default(0),
  comision_venta_pct:           z.coerce.number().min(0).max(100).default(0),
  margen_empresa_pct:           z.coerce.number().min(0).max(99).default(0),
  pvp_privado:                  z.coerce.number().min(0).default(0),
  pvp_general:                  z.coerce.number().min(0).default(0),
  notas:                        z.string().optional(),
  componentes:                  z.array(componenteSchema).default([]),
});

type CosteoFormValues = z.infer<typeof costeoSchema>;

// ── Cálculo en vivo ───────────────────────────────────────────────────────────
interface Totales {
  fob_base:       number;
  total_comp:     number;
  fob_total:      number;
  cif:            number;
  fodinfa:        number;
  arancel:        number;
  isd:            number;
  iva_imp:        number;
  costo_aterr:    number;
  servicios:      number;
  garantia_tot:   number;
  costo_total:    number;
  comision:       number;
  pvp_sugerido:   number;
}

function calcular(v: CosteoFormValues): Totales {
  const fob_base = v.moneda_proveedor === "EUR"
    ? v.precio_fob * v.tipo_cambio_eur
    : v.precio_fob;

  const total_comp = (v.componentes ?? [])
    .filter((c) => c.incluir_en_fob)
    .reduce((s, c) => s + c.subtotal_usd, 0);

  const fob_total   = fob_base + total_comp;
  const cif         = fob_total + v.flete_estimado + v.seguro_estimado;
  const fodinfa     = Math.round(cif * v.fodinfa_pct / 100 * 100) / 100;
  const arancel     = Math.round(cif * v.arancel_pct / 100 * 100) / 100;
  const isd         = Math.round(fob_total * v.isd_pct / 100 * 100) / 100;
  const iva_imp     = Math.round((cif + fodinfa + arancel) * v.iva_importacion_pct / 100 * 100) / 100;
  const costo_aterr = cif + fodinfa + arancel + isd + iva_imp
    + v.agente_aduanas_est + v.bodega_est + v.otros_logistica;
  const servicios   = v.instalacion + v.entrenamiento + v.gastos_admin_fabrica + v.fee_agente_comercial;
  const garantia_tot = v.garantia_reserva + v.mantenimiento_preventivo_res;
  const costo_total  = costo_aterr + servicios + garantia_tot;
  const comision     = Math.round(costo_total * v.comision_venta_pct / 100 * 100) / 100;

  let pvp_sugerido = 0;
  if (v.margen_empresa_pct > 0 && v.margen_empresa_pct < 100) {
    pvp_sugerido = Math.round((costo_total + comision) / (1 - v.margen_empresa_pct / 100) * 100) / 100;
  } else {
    pvp_sugerido = costo_total + comision;
  }

  return { fob_base, total_comp, fob_total, cif, fodinfa, arancel, isd, iva_imp,
    costo_aterr, servicios, garantia_tot, costo_total, comision, pvp_sugerido };
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  open:     boolean;
  onClose:  () => void;
  editando: CosteoConRelaciones | null;
}

// ── Componente ────────────────────────────────────────────────────────────────
export function CosteoForm({ open, onClose, editando }: Props) {
  const crear     = useCrearCosteo();
  const actualizar = useActualizarCosteo();
  const { data: proveedores = [] } = useProveedores();
  const { data: proyectos   = [] } = useProyectos();

  // Solo proveedores internacionales
  const proveedoresInt = proveedores.filter((p) => p.es_internacional && p.estado === "activo");

  const form = useForm<CosteoFormValues>({
    resolver: zodResolver(costeoSchema),
    defaultValues: {
      moneda_proveedor: "USD",
      tipo_cambio_eur:  1.08,
      fodinfa_pct:      0.5,
      isd_pct:          5,
      iva_importacion_pct: 15,
      componentes:      [],
    },
  });

  const { fields: compFields, append: appendComp, remove: removeComp } =
    useFieldArray({ control: form.control, name: "componentes" });

  // Cargar datos al editar
  useEffect(() => {
    if (!open) return;
    if (editando) {
      form.reset({
        proveedor_id:                 editando.proveedor_id,
        proyecto_id:                  editando.proyecto_id ?? undefined,
        descripcion_producto:         editando.descripcion_producto,
        moneda_proveedor:             editando.moneda_proveedor,
        precio_fob:                   editando.precio_fob,
        tipo_cambio_eur:              editando.tipo_cambio_eur,
        flete_estimado:               editando.flete_estimado,
        seguro_estimado:              editando.seguro_estimado,
        agente_aduanas_est:           editando.agente_aduanas_est,
        bodega_est:                   editando.bodega_est,
        otros_logistica:              editando.otros_logistica,
        codigo_nandina:               editando.codigo_nandina ?? undefined,
        fodinfa_pct:                  editando.fodinfa_pct,
        arancel_pct:                  editando.arancel_pct,
        isd_pct:                      editando.isd_pct,
        iva_importacion_pct:          editando.iva_importacion_pct,
        instalacion:                  editando.instalacion,
        entrenamiento:                editando.entrenamiento,
        gastos_admin_fabrica:         editando.gastos_admin_fabrica,
        fee_agente_comercial:         editando.fee_agente_comercial,
        garantia_reserva:             editando.garantia_reserva,
        mantenimiento_preventivo_res: editando.mantenimiento_preventivo_res,
        comision_venta_pct:           editando.comision_venta_pct,
        margen_empresa_pct:           editando.margen_empresa_pct,
        pvp_privado:                  editando.pvp_privado,
        pvp_general:                  editando.pvp_general,
        notas:                        editando.notas ?? undefined,
        componentes: (editando.componentes ?? []).map((c) => ({
          orden:           c.orden,
          tipo:            c.tipo,
          descripcion:     c.descripcion,
          fabricante:      c.fabricante ?? undefined,
          modelo:          c.modelo ?? undefined,
          moneda:          c.moneda,
          precio_unitario: c.precio_unitario,
          tipo_cambio:     c.tipo_cambio,
          precio_usd:      c.precio_usd,
          cantidad:        c.cantidad,
          subtotal_usd:    c.subtotal_usd,
          incluir_en_fob:  c.incluir_en_fob,
          notas:           c.notas ?? undefined,
        })),
      });
    } else {
      form.reset({
        moneda_proveedor: "USD",
        tipo_cambio_eur:  1.08,
        fodinfa_pct:      0.5,
        isd_pct:          5,
        iva_importacion_pct: 15,
        componentes:      [],
      });
    }
  }, [open, editando, form]);

  // Cálculo en tiempo real
  const watched  = form.watch();
  const totales  = calcular(watched);

  // Recalcular precio_usd y subtotal_usd de cada componente al cambiar moneda/tipo_cambio
  const updateComp = (idx: number, key: string, value: number | boolean | string) => {
    const comps = form.getValues("componentes");
    const comp  = { ...comps[idx], [key]: value };
    if (key === "precio_unitario" || key === "tipo_cambio" || key === "cantidad" || key === "moneda") {
      const tc         = key === "tipo_cambio" ? Number(value) : comp.tipo_cambio;
      const mu         = key === "moneda" ? String(value) : comp.moneda;
      const pu         = key === "precio_unitario" ? Number(value) : comp.precio_unitario;
      const qty        = key === "cantidad" ? Number(value) : comp.cantidad;
      comp.precio_usd   = mu === "EUR" ? Math.round(pu * tc * 100) / 100 : pu;
      comp.subtotal_usd = Math.round(comp.precio_usd * qty * 100) / 100;
    }
    form.setValue(`componentes.${idx}`, comp as typeof comps[0]);
  };

  const onSubmit = async (values: CosteoFormValues) => {
    const datos: CosteoDatos = {
      proveedor_id:                 values.proveedor_id,
      proyecto_id:                  values.proyecto_id || null,
      descripcion_producto:         values.descripcion_producto,
      moneda_proveedor:             values.moneda_proveedor,
      precio_fob:                   values.precio_fob,
      tipo_cambio_eur:              values.tipo_cambio_eur,
      flete_estimado:               values.flete_estimado,
      seguro_estimado:              values.seguro_estimado,
      agente_aduanas_est:           values.agente_aduanas_est,
      bodega_est:                   values.bodega_est,
      otros_logistica:              values.otros_logistica,
      codigo_nandina:               values.codigo_nandina || null,
      fodinfa_pct:                  values.fodinfa_pct,
      arancel_pct:                  values.arancel_pct,
      isd_pct:                      values.isd_pct,
      iva_importacion_pct:          values.iva_importacion_pct,
      instalacion:                  values.instalacion,
      entrenamiento:                values.entrenamiento,
      gastos_admin_fabrica:         values.gastos_admin_fabrica,
      fee_agente_comercial:         values.fee_agente_comercial,
      garantia_reserva:             values.garantia_reserva,
      mantenimiento_preventivo_res: values.mantenimiento_preventivo_res,
      comision_venta_pct:           values.comision_venta_pct,
      margen_empresa_pct:           values.margen_empresa_pct,
      pvp_privado:                  values.pvp_privado || totales.pvp_sugerido,
      pvp_general:                  values.pvp_general  || totales.pvp_sugerido,
      notas:                        values.notas || null,
    };

    const componentes: CosteoComponentePayload[] = (values.componentes ?? []).map((c, i) => ({
      orden:           i,
      tipo:            c.tipo,
      descripcion:     c.descripcion,
      fabricante:      c.fabricante || null,
      modelo:          c.modelo || null,
      moneda:          c.moneda,
      precio_unitario: c.precio_unitario,
      tipo_cambio:     c.tipo_cambio,
      precio_usd:      c.precio_usd,
      cantidad:        c.cantidad,
      subtotal_usd:    c.subtotal_usd,
      incluir_en_fob:  c.incluir_en_fob,
      notas:           c.notas || null,
    }));

    try {
      if (editando) {
        await actualizar.mutateAsync({ id: editando.id, datos, componentes });
        toast.success("Costeo actualizado");
      } else {
        const { numero } = await crear.mutateAsync({ datos, componentes });
        toast.success(`Costeo ${numero} creado`);
      }
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const moneda = form.watch("moneda_proveedor");
  const isPending = crear.isPending || actualizar.isPending;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Calculator className="size-5 text-primary" />
            {editando ? `Editar ${editando.numero}` : "Nuevo Costeo de Importación"}
          </SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">

            {/* ─── Bloque 1: Producto y proveedor ─── */}
            <Section title="Producto y Proveedor">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="descripcion_producto"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Descripción del producto *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Analizador de gases modelo XR-200" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="proveedor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proveedor internacional *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar proveedor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {proveedoresInt.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                          ))}
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
                      <FormLabel>Proyecto (opcional)</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sin proyecto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Sin proyecto</SelectItem>
                          {proyectos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Section>

            {/* ─── Bloque 2: Precio FOB ─── */}
            <Section title="Precio FOB del Proveedor">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <FormField
                  control={form.control}
                  name="moneda_proveedor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moneda</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="precio_fob"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio FOB ({moneda}) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {moneda === "EUR" && (
                  <FormField
                    control={form.control}
                    name="tipo_cambio_eur"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo cambio EUR→USD</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.0001" min="0" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
                <div className="flex flex-col justify-end">
                  <Label className="text-xs text-muted-foreground mb-1">FOB en USD</Label>
                  <div className="h-10 flex items-center px-3 bg-muted rounded-md font-mono text-sm font-medium">
                    {fmt(totales.fob_base)}
                  </div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="codigo_nandina"
                render={({ field }) => (
                  <FormItem className="mt-4 max-w-xs">
                    <FormLabel>Partida arancelaria NANDINA (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="ej: 9027.80.00" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </Section>

            {/* ─── Bloque 3: Componentes opcionales ─── */}
            <Section title="Componentes y Accesorios Adicionales">
              <div className="space-y-3">
                {compFields.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    Sin componentes adicionales. Agrega los accesorios o módulos opcionales que incluya esta cotización.
                  </p>
                )}

                {compFields.map((field, idx) => {
                  const comp = form.watch(`componentes.${idx}`);
                  return (
                    <div key={field.id} className="border rounded-lg p-3 bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {comp.tipo === "equipo_base"         ? "Base"
                            : comp.tipo === "servicio_adicional"  ? "Servicio"
                            : "Accesorio"}
                          </Badge>
                          <span className="text-sm font-medium">{comp.descripcion || `Ítem ${idx + 1}`}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive"
                          onClick={() => removeComp(idx)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="sm:col-span-2">
                          <Label className="text-xs">Descripción *</Label>
                          <Input
                            className="h-8 text-sm"
                            value={comp.descripcion}
                            onChange={(e) => updateComp(idx, "descripcion", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Tipo</Label>
                          <Select
                            value={comp.tipo}
                            onValueChange={(v) => updateComp(idx, "tipo", v)}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="componente_opcional">Accesorio</SelectItem>
                              <SelectItem value="servicio_adicional">Servicio</SelectItem>
                              <SelectItem value="equipo_base">Equipo base</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Moneda</Label>
                          <Select
                            value={comp.moneda}
                            onValueChange={(v) => updateComp(idx, "moneda", v)}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Precio unitario ({comp.moneda})</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-8 text-sm"
                            value={comp.precio_unitario}
                            onChange={(e) => updateComp(idx, "precio_unitario", Number(e.target.value))}
                          />
                        </div>
                        {comp.moneda === "EUR" && (
                          <div>
                            <Label className="text-xs">Tipo cambio EUR→USD</Label>
                            <Input
                              type="number"
                              step="0.0001"
                              min="0"
                              className="h-8 text-sm"
                              value={comp.tipo_cambio}
                              onChange={(e) => updateComp(idx, "tipo_cambio", Number(e.target.value))}
                            />
                          </div>
                        )}
                        <div>
                          <Label className="text-xs">Cantidad</Label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            className="h-8 text-sm"
                            value={comp.cantidad}
                            onChange={(e) => updateComp(idx, "cantidad", Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Subtotal USD</Label>
                          <div className="h-8 flex items-center px-2 bg-muted rounded-md font-mono text-sm">
                            {fmt(comp.subtotal_usd)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <Switch
                            id={`fob-${idx}`}
                            checked={comp.incluir_en_fob}
                            onCheckedChange={(v) => updateComp(idx, "incluir_en_fob", v)}
                          />
                          <Label htmlFor={`fob-${idx}`} className="text-xs cursor-pointer">
                            Incluir en FOB (aduana)
                          </Label>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    appendComp({
                      orden: compFields.length,
                      tipo: "componente_opcional",
                      descripcion: "",
                      moneda: "USD",
                      precio_unitario: 0,
                      tipo_cambio: 1,
                      precio_usd: 0,
                      cantidad: 1,
                      subtotal_usd: 0,
                      incluir_en_fob: true,
                    })
                  }
                >
                  <Plus className="size-4" />
                  Agregar componente
                </Button>

                {compFields.length > 0 && (
                  <div className="flex justify-end">
                    <span className="text-sm text-muted-foreground">
                      Total componentes en FOB:&nbsp;
                      <span className="font-medium font-mono">{fmt(totales.total_comp)}</span>
                    </span>
                  </div>
                )}
              </div>
            </Section>

            {/* ─── Bloque 4: Logística ─── */}
            <Section title="Logística y Transporte Internacional">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <NumField form={form} name="flete_estimado"     label="Flete (USD)" />
                <NumField form={form} name="seguro_estimado"    label="Seguro (USD)" />
                <NumField form={form} name="agente_aduanas_est" label="Agente de aduanas (USD)" />
                <NumField form={form} name="bodega_est"         label="Bodega / Almacenaje (USD)" />
                <NumField form={form} name="otros_logistica"    label="Otros logística (USD)" />
                <div className="flex flex-col justify-end">
                  <Label className="text-xs text-muted-foreground mb-1">CIF (FOB + Flete + Seguro)</Label>
                  <div className="h-10 flex items-center px-3 bg-primary/5 rounded-md font-mono text-sm font-semibold text-primary">
                    {fmt(totales.cif)}
                  </div>
                </div>
              </div>
            </Section>

            {/* ─── Bloque 5: Impuestos ─── */}
            <Section title="Impuestos de Importación">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <PctField form={form} name="fodinfa_pct"         label="FODINFA (%)" calc={totales.fodinfa} />
                <PctField form={form} name="arancel_pct"         label="Arancel (%)" calc={totales.arancel} />
                <PctField form={form} name="isd_pct"             label="ISD (% sobre FOB)" calc={totales.isd} />
                <PctField form={form} name="iva_importacion_pct" label="IVA Importación (%)" calc={totales.iva_imp} />
              </div>
              <div className="mt-3 flex justify-end">
                <CostBox
                  label="Costo de aterrizaje"
                  value={totales.costo_aterr}
                  highlight
                  note="CIF + impuestos + logística local"
                />
              </div>
            </Section>

            {/* ─── Bloque 6: Servicios propios ─── */}
            <Section title="Servicios de la Empresa">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumField form={form} name="instalacion"          label="Instalación (USD)" />
                <NumField form={form} name="entrenamiento"        label="Entrenamiento (USD)" />
                <NumField form={form} name="gastos_admin_fabrica" label="Gastos admin. fábrica (USD)" />
                <NumField form={form} name="fee_agente_comercial" label="Fee agente comercial (USD)" />
              </div>
            </Section>

            {/* ─── Bloque 7: Reservas de posventa ─── */}
            <Section title="Reservas de Garantía y Mantenimiento">
              <p className="text-xs text-muted-foreground mb-3">
                Estima el costo de importar repuestos en garantía y los mantenimientos preventivos incluidos.
                Estos montos entran al costo total pero son visibles por separado para seguimiento de rentabilidad.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <NumField form={form} name="garantia_reserva"             label="Reserva de garantía (USD)" />
                <NumField form={form} name="mantenimiento_preventivo_res" label="Reserva mantenimiento preventivo (USD)" />
              </div>
            </Section>

            {/* ─── Bloque 8: Margen y PVP ─── */}
            <Section title="Margen y Precio de Venta">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <PctField form={form} name="comision_venta_pct" label="Comisión de venta (%)" calc={totales.comision} />
                <div>
                  <Label className="text-xs">Margen empresa (%)</Label>
                  <FormField
                    control={form.control}
                    name="margen_empresa_pct"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="99"
                              className="pr-8"
                              {...field}
                            />
                            <Percent className="absolute right-2.5 top-2.5 size-3.5 text-muted-foreground" />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">PVP sugerido</Label>
                  <div className="h-10 flex items-center px-3 bg-green-50 border border-green-200 rounded-md font-mono text-base font-bold text-green-700">
                    {fmt(totales.pvp_sugerido)}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Costo total {fmt(totales.costo_total)} ÷ (1 - {fmtNum(form.watch("margen_empresa_pct"))}%)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <FormField
                  control={form.control}
                  name="pvp_privado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <DollarSign className="size-3.5" />
                        PVP Privado (USD)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={fmtNum(totales.pvp_sugerido)}
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pvp_general"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <DollarSign className="size-3.5" />
                        PVP General (USD)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={fmtNum(totales.pvp_sugerido)}
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Section>

            {/* ─── Notas ─── */}
            <Section title="Notas internas">
              <FormField
                control={form.control}
                name="notas"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Observaciones, supuestos del costeo, condiciones del proveedor..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </Section>

            {/* ─── Resumen ─── */}
            <div className="sticky bottom-0 bg-background border-t pt-4 mt-4 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <CostBox label="Costo aterrizaje"   value={totales.costo_aterr} />
                  <CostBox label="Servicios propios"  value={totales.servicios} />
                  <CostBox label="Costo total"        value={totales.costo_total} highlight />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Guardando..." : editando ? "Guardar cambios" : "Crear costeo"}
                  </Button>
                </div>
              </div>
            </div>

          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-5 border-b last:border-b-0">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <span className="w-1.5 h-4 bg-primary rounded-full inline-block" />
        {title}
      </h3>
      {children}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NumField({ form, name, label }: { form: any; name: string; label: string }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }: { field: React.InputHTMLAttributes<HTMLInputElement> }) => (
        <FormItem>
          <FormLabel className="text-xs">{label}</FormLabel>
          <FormControl>
            <Input type="number" step="0.01" min="0" className="h-9" {...field} value={(field.value as number) || 0} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PctField({ form, name, label, calc }: { form: any; name: string; label: string; calc: number }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }: { field: React.InputHTMLAttributes<HTMLInputElement> }) => (
        <FormItem>
          <FormLabel className="text-xs">{label}</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                className="h-9 pr-7"
                {...field}
                value={(field.value as number) || 0}
              />
              <Percent className="absolute right-2 top-2.5 size-3 text-muted-foreground" />
            </div>
          </FormControl>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{fmt(calc)}</p>
        </FormItem>
      )}
    />
  );
}

function CostBox({ label, value, highlight, note }: {
  label:      string;
  value:      number;
  highlight?: boolean;
  note?:      string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm font-semibold ${highlight ? "text-primary text-base" : ""}`}>
        {new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value)}
      </span>
      {note && <span className="text-[10px] text-muted-foreground">{note}</span>}
    </div>
  );
}
