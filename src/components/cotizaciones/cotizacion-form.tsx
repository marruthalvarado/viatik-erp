/**
 * Formulario de nueva/editar cotización.
 * Cabecera + tabla de ítems (mixtos: catálogo o texto libre) + términos de pago.
 */
import { useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { Plus, Trash2, GripVertical, Search, UserSearch } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  useCrearCotizacion,
  useActualizarCotizacion,
  useCatalogoCotizar,
} from "@/hooks/entities/use-cotizaciones";
import { useClientes } from "@/hooks/entities/use-clientes";
import type { CotizacionConItems, CotizacionDatos, CotizacionItemPayload } from "@/services/cotizaciones";
import { useCompany } from "@/contexts/company-context";

interface TerminoPago { concepto: string; porcentaje: number }

interface ItemForm {
  catalogo_id: string;
  descripcion: string;
  fabricante: string;
  modelo: string;
  cantidad: number;
  precio_unitario: number;
  descuento_pct: number;
  dias_entrega: string;
  meses_garantia: string;
  notas: string;
}

interface FormData {
  razon_social: string;
  ruc_cliente: string;
  email_cliente: string;
  asunto: string;
  fecha: string;
  valida_hasta: string;
  lugar_entrega: string;
  dias_entrega: string;
  meses_garantia: string;
  notas: string;
  observacion_interna: string;
  iva_pct: number;
  terminos_pago: TerminoPago[];
  items: ItemForm[];
}

interface Props {
  open: boolean;
  cotizacion?: CotizacionConItems;
  onClose: () => void;
}

const hoy = new Date().toISOString().split("T")[0];
const en30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

const ITEM_DEFAULT: ItemForm = {
  catalogo_id: "", descripcion: "", fabricante: "", modelo: "",
  cantidad: 1, precio_unitario: 0, descuento_pct: 0,
  dias_entrega: "", meses_garantia: "", notas: "",
};

export function CotizacionForm({ open, cotizacion, onClose }: Props) {
  const { empresaActivaId } = useCompany();
  const { data: catalogo = [] } = useCatalogoCotizar();
  const { data: clientesData } = useClientes();
  const clientes = clientesData?.rows ?? [];
  const crear = useCrearCotizacion();
  const actualizar = useActualizarCotizacion();

  const [busquedaCatalogo, setBusquedaCatalogo] = useState("");
  const [popoverIdx, setPopoverIdx] = useState<number | null>(null);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [popoverCliente, setPopoverCliente] = useState(false);

  const { control, register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: {
      razon_social: "", ruc_cliente: "", email_cliente: "", asunto: "",
      fecha: hoy, valida_hasta: en30,
      lugar_entrega: "", dias_entrega: "120", meses_garantia: "24",
      notas: "", observacion_interna: "",
      iva_pct: 15,
      terminos_pago: [
        { concepto: "Anticipo (firma contrato)", porcentaje: 40 },
        { concepto: "Pre-embarque", porcentaje: 30 },
        { concepto: "Entrega e instalación", porcentaje: 30 },
      ],
      items: [{ ...ITEM_DEFAULT }],
    },
  });

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({ control, name: "items" });
  const { fields: terminoFields, append: appendTermino, remove: removeTermino } = useFieldArray({ control, name: "terminos_pago" });

  useEffect(() => {
    if (!open) return;
    if (cotizacion) {
      reset({
        razon_social: cotizacion.razon_social,
        ruc_cliente: cotizacion.ruc_cliente ?? "",
        email_cliente: cotizacion.email_cliente ?? "",
        asunto: cotizacion.asunto ?? "",
        fecha: cotizacion.fecha,
        valida_hasta: cotizacion.valida_hasta ?? en30,
        lugar_entrega: cotizacion.lugar_entrega ?? "",
        dias_entrega: cotizacion.dias_entrega?.toString() ?? "120",
        meses_garantia: cotizacion.meses_garantia?.toString() ?? "24",
        notas: cotizacion.notas ?? "",
        observacion_interna: cotizacion.observacion_interna ?? "",
        iva_pct: cotizacion.iva_pct,
        terminos_pago: cotizacion.terminos_pago?.length
          ? cotizacion.terminos_pago
          : [
              { concepto: "Anticipo (firma contrato)", porcentaje: 40 },
              { concepto: "Pre-embarque", porcentaje: 30 },
              { concepto: "Entrega e instalación", porcentaje: 30 },
            ],
        items: cotizacion.items.map((it) => ({
          catalogo_id: it.catalogo_id ?? "",
          descripcion: it.descripcion,
          fabricante: it.fabricante ?? "",
          modelo: it.modelo ?? "",
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          descuento_pct: it.descuento_pct,
          dias_entrega: it.dias_entrega?.toString() ?? "",
          meses_garantia: it.meses_garantia?.toString() ?? "",
          notas: it.notas ?? "",
        })),
      });
    } else {
      reset({
        razon_social: "", ruc_cliente: "", email_cliente: "", asunto: "",
        fecha: hoy, valida_hasta: en30,
        lugar_entrega: "", dias_entrega: "120", meses_garantia: "24",
        notas: "", observacion_interna: "",
        iva_pct: 15,
        terminos_pago: [
          { concepto: "Anticipo (firma contrato)", porcentaje: 40 },
          { concepto: "Pre-embarque", porcentaje: 30 },
          { concepto: "Entrega e instalación", porcentaje: 30 },
        ],
        items: [{ ...ITEM_DEFAULT }],
      });
    }
  }, [open, cotizacion, reset]);

  const watchItems = watch("items");
  const watchIva = watch("iva_pct");

  const subtotal = watchItems.reduce((s, it) => {
    const neto = it.precio_unitario * it.cantidad * (1 - (it.descuento_pct || 0) / 100);
    return s + neto;
  }, 0);
  const iva = subtotal * (watchIva || 15) / 100;
  const total = subtotal + iva;
  const fmtMoney = (n: number) => `$${n.toLocaleString("es-EC", { minimumFractionDigits: 2 })}`;

  const clientesFiltrados = clientes.filter((c) => {
    const q = busquedaCliente.toLowerCase();
    return (
      (c.nombre ?? "").toLowerCase().includes(q) ||
      (c.nombre_comercial ?? "").toLowerCase().includes(q) ||
      (c.ruc ?? "").includes(q)
    );
  });

  const handleSelectCliente = (clienteId: string) => {
    const c = clientes.find((cl) => cl.id === clienteId);
    if (!c) return;
    setValue("razon_social", c.nombre_comercial ?? c.nombre ?? "");
    setValue("ruc_cliente", c.ruc ?? "");
    setValue("email_cliente", c.correo ?? "");
    setPopoverCliente(false);
    setBusquedaCliente("");
  };

  const handleSelectCatalogo = (idx: number, productoId: string) => {
    const p = catalogo.find((c) => c.id === productoId);
    if (!p) return;
    setValue(`items.${idx}.catalogo_id`, p.id);
    setValue(`items.${idx}.descripcion`, p.descripcion_tecnica ?? p.descripcion ?? p.nombre);
    setValue(`items.${idx}.fabricante`, p.fabricante ?? "");
    setValue(`items.${idx}.modelo`, p.modelo ?? "");
    setValue(`items.${idx}.precio_unitario`, p.precio_referencial ?? 0);
    setValue(`items.${idx}.dias_entrega`, p.dias_entrega_est?.toString() ?? "");
    setValue(`items.${idx}.meses_garantia`, p.meses_garantia?.toString() ?? "");
    setPopoverIdx(null);
    setBusquedaCatalogo("");
  };

  const onSubmit = async (data: FormData) => {
    const datos: CotizacionDatos = {
      razon_social: data.razon_social.trim(),
      ruc_cliente: data.ruc_cliente.trim() || undefined,
      email_cliente: data.email_cliente.trim() || undefined,
      asunto: data.asunto.trim() || undefined,
      fecha: data.fecha,
      valida_hasta: data.valida_hasta || undefined,
      lugar_entrega: data.lugar_entrega.trim() || undefined,
      dias_entrega: data.dias_entrega ? parseInt(data.dias_entrega) : undefined,
      meses_garantia: data.meses_garantia ? parseInt(data.meses_garantia) : undefined,
      notas: data.notas.trim() || undefined,
      observacion_interna: data.observacion_interna.trim() || undefined,
      iva_pct: data.iva_pct,
      terminos_pago: data.terminos_pago.filter((t) => t.concepto && t.porcentaje > 0),
    };

    const items: CotizacionItemPayload[] = data.items.map((it, idx) => ({
      orden: idx,
      catalogo_id: it.catalogo_id || undefined,
      descripcion: it.descripcion.trim(),
      fabricante: it.fabricante.trim() || undefined,
      modelo: it.modelo.trim() || undefined,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      descuento_pct: it.descuento_pct || 0,
      dias_entrega: it.dias_entrega ? parseInt(it.dias_entrega) : undefined,
      meses_garantia: it.meses_garantia ? parseInt(it.meses_garantia) : undefined,
      notas: it.notas.trim() || undefined,
    }));

    try {
      if (cotizacion) {
        await actualizar.mutateAsync({ id: cotizacion.id, datos, items });
        toast.success("Cotización actualizada");
      } else {
        const res = await crear.mutateAsync({ datos, items });
        toast.success(`Cotización ${res.numero} creada`);
      }
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const catalogoFiltrado = catalogo.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busquedaCatalogo.toLowerCase()) ||
      (p.fabricante ?? "").toLowerCase().includes(busquedaCatalogo.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {cotizacion ? `Editar ${cotizacion.numero}` : "Nueva cotización"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* ── Búsqueda de cliente existente ── */}
          <div className="flex items-center gap-2">
            <Popover open={popoverCliente} onOpenChange={setPopoverCliente}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs">
                  <UserSearch className="size-3.5" />
                  Buscar cliente existente
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-2 space-y-1" align="start">
                <Input
                  placeholder="Nombre, nombre comercial o RUC…"
                  className="h-7 text-xs"
                  value={busquedaCliente}
                  onChange={(e) => setBusquedaCliente(e.target.value)}
                  autoFocus
                />
                <div className="max-h-52 overflow-y-auto space-y-0.5">
                  {clientesFiltrados.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-2">Sin resultados</p>
                  )}
                  {clientesFiltrados.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted"
                      onClick={() => handleSelectCliente(c.id)}
                    >
                      <div className="font-medium">{c.nombre_comercial ?? c.nombre}</div>
                      {(c.ruc || c.correo) && (
                        <div className="text-muted-foreground">
                          {c.ruc}{c.ruc && c.correo ? " · " : ""}{c.correo}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">o completa los datos manualmente</span>
          </div>

          {/* ── Cabecera del cliente ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Razón social del cliente *</Label>
              <Input {...register("razon_social", { required: true })} placeholder="Nombre del cliente" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">RUC / ID</Label>
              <Input {...register("ruc_cliente")} placeholder="1234567890001" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input {...register("email_cliente")} type="email" placeholder="cliente@empresa.com" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha</Label>
              <Input {...register("fecha")} type="date" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Válida hasta</Label>
              <Input {...register("valida_hasta")} type="date" className="h-9 text-sm" />
            </div>
          </div>

          {/* ── Asunto ── */}
          <div className="space-y-1.5">
            <Label className="text-xs">Asunto / Referencia de la propuesta</Label>
            <Input
              {...register("asunto")}
              placeholder="Ej. Suministro e instalación de equipos de diagnóstico por imagen"
              className="text-sm"
            />
          </div>

          {/* ── Condiciones generales ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Lugar de entrega</Label>
              <Input {...register("lugar_entrega")} placeholder="Quito, Ecuador" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Días de entrega</Label>
              <Input {...register("dias_entrega")} type="number" min="0" placeholder="120" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Meses de garantía</Label>
              <Input {...register("meses_garantia")} type="number" min="0" placeholder="24" className="h-9 text-sm" />
            </div>
          </div>

          <Separator />

          {/* ── Ítems ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Ítems</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendItem({ ...ITEM_DEFAULT })}
              >
                <Plus className="size-3.5 mr-1" /> Agregar ítem
              </Button>
            </div>

            {itemFields.map((field, idx) => {
              const it = watchItems[idx];
              const neto = (it?.precio_unitario ?? 0) * (it?.cantidad ?? 1) * (1 - (it?.descuento_pct ?? 0) / 100);
              return (
                <div key={field.id} className="rounded-lg border p-3 space-y-3">
                  {/* Fila 1: selector de catálogo + fabricante + modelo */}
                  <div className="flex items-start gap-2">
                    <GripVertical className="size-4 mt-2 text-muted-foreground shrink-0" />
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      {/* Selector catálogo */}
                      <div className="space-y-1">
                        <Label className="text-xs">Catálogo</Label>
                        <Popover
                          open={popoverIdx === idx}
                          onOpenChange={(o) => setPopoverIdx(o ? idx : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start font-normal">
                              <Search className="size-3 mr-1 text-muted-foreground" />
                              {it?.catalogo_id
                                ? (catalogo.find((c) => c.id === it.catalogo_id)?.nombre ?? "Seleccionado")
                                : "Buscar en catálogo…"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-2 space-y-1">
                            <Input
                              placeholder="Buscar…"
                              className="h-7 text-xs"
                              value={busquedaCatalogo}
                              onChange={(e) => setBusquedaCatalogo(e.target.value)}
                              autoFocus
                            />
                            <div className="max-h-48 overflow-y-auto space-y-0.5">
                              <button
                                type="button"
                                className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted text-muted-foreground"
                                onClick={() => {
                                  setValue(`items.${idx}.catalogo_id`, "");
                                  setPopoverIdx(null);
                                }}
                              >
                                — Texto libre (sin catálogo)
                              </button>
                              {catalogoFiltrado.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className={cn(
                                    "w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted",
                                    it?.catalogo_id === p.id && "bg-muted font-medium",
                                  )}
                                  onClick={() => handleSelectCatalogo(idx, p.id)}
                                >
                                  <div className="font-medium">{p.nombre}</div>
                                  {p.fabricante && (
                                    <div className="text-muted-foreground">{p.fabricante} {p.modelo}</div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Fabricante</Label>
                        <Input {...register(`items.${idx}.fabricante`)} placeholder="Fabricante" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Modelo</Label>
                        <Input {...register(`items.${idx}.modelo`)} placeholder="Modelo" className="h-8 text-sm" />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 mt-5 text-destructive"
                      disabled={itemFields.length === 1}
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  {/* Fila 2: descripción técnica */}
                  <div className="ml-6 space-y-1">
                    <Label className="text-xs">Descripción técnica *</Label>
                    <Textarea
                      {...register(`items.${idx}.descripcion`, { required: true })}
                      placeholder="Especificaciones técnicas detalladas del producto o servicio"
                      className="text-sm min-h-[72px]"
                    />
                  </div>

                  {/* Fila 3: cantidad + precio + descuento + neto */}
                  <div className="ml-6 grid grid-cols-5 gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Cantidad</Label>
                      <Controller
                        control={control}
                        name={`items.${idx}.cantidad`}
                        render={({ field }) => (
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            className="h-8 text-sm"
                            value={field.value}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        )}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Precio unit. (USD)</Label>
                      <Controller
                        control={control}
                        name={`items.${idx}.precio_unitario`}
                        render={({ field }) => (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="h-8 text-sm"
                            value={field.value}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        )}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Descuento %</Label>
                      <Controller
                        control={control}
                        name={`items.${idx}.descuento_pct`}
                        render={({ field }) => (
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            className="h-8 text-sm"
                            value={field.value}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        )}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Días entrega</Label>
                      <Input {...register(`items.${idx}.dias_entrega`)} type="number" min="0" className="h-8 text-sm" placeholder="120" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Precio neto</Label>
                      <div className="h-8 flex items-center font-mono text-sm font-medium px-1">
                        {fmtMoney(neto)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* ── Términos de pago ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Términos de pago</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendTermino({ concepto: "", porcentaje: 0 })}
              >
                <Plus className="size-3.5 mr-1" /> Agregar tramo
              </Button>
            </div>
            {terminoFields.map((field, idx) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input
                  {...register(`terminos_pago.${idx}.concepto`)}
                  placeholder="Ej. Anticipo al firmar"
                  className="h-8 text-sm flex-1"
                />
                <div className="flex items-center gap-1 w-24">
                  <Controller
                    control={control}
                    name={`terminos_pago.${idx}.porcentaje`}
                    render={({ field: f }) => (
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        className="h-8 text-sm"
                        value={f.value}
                        onChange={(e) => f.onChange(parseInt(e.target.value) || 0)}
                      />
                    )}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive"
                  onClick={() => removeTermino(idx)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Separator />

          {/* ── Notas + IVA ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Notas al cliente</Label>
              <Textarea {...register("notas")} className="text-sm min-h-[80px]" placeholder="Condiciones, aclaraciones…" />
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">% IVA</Label>
                <Controller
                  control={control}
                  name="iva_pct"
                  render={({ field }) => (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8 w-24 text-sm"
                      value={field.value}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  )}
                />
              </div>

              {/* Totales */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">{fmtMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA {watchIva}%</span>
                  <span className="font-mono">{fmtMoney(iva)}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="font-mono">{fmtMoney(total)}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Guardando…" : cotizacion ? "Actualizar" : "Crear cotización"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
