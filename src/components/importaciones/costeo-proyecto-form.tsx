/**
 * costeo-proyecto-form.tsx
 * Formulario para crear/editar un Costeo de Proyecto.
 * Permite agrupar múltiples productos, definir gastos compartidos de
 * importación y calcular precio de venta del proyecto completo.
 */
import { useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { Plus, Trash2, Info, ChevronDown, ChevronRight, Package2 } from "lucide-react";
import { toast } from "sonner";

import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Switch }   from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

import { useCompany }                 from "@/contexts/company-context";
import { useProyectosSimples }        from "@/hooks/entities/use-dashboard";
import { useCotizaciones }            from "@/hooks/entities/use-cotizaciones";
import {
  useCrearCosteoProyecto,
  useActualizarCosteoProyecto,
  useImportarItemsDesdeCotizacion,
  useComponentesProyectoItem,
  useCopiarComponentesAProyectoItem,
  useSincronizarComponentesProyectoItem,
} from "@/hooks/entities/use-costeos-proyecto";
import {
  calcularFobDesdeComponentes,
  type ComponenteProyectoEstado,
} from "@/services/costeos-proyecto";
import type {
  CosteoProyectoConItems,
  CosteoProyectoDatos,
  CosteoProyectoItemPayload,
} from "@/services/costeos-proyecto";

// ── Tipos del formulario ──────────────────────────────────────────────────────

interface ItemForm {
  orden: number;
  costeo_id: string;
  descripcion: string;
  fabricante: string;
  modelo: string;
  codigo_nandina: string;
  cantidad: number;
  precio_fob_unitario_usd: number;
  fodinfa_pct: string;
  arancel_pct: string;
  isd_pct: string;
  iva_importacion_pct: string;
}

interface FormData {
  proyecto_id: string;
  cotizacion_id: string;
  descripcion: string;
  estado: "borrador" | "finalizado";
  flete_total: number;
  seguro_total: number;
  agente_aduanas: number;
  bodega: number;
  otros_logistica: number;
  fodinfa_pct: number;
  arancel_pct: number;
  isd_pct: number;
  iva_importacion_pct: number;
  margen_empresa_pct: number;
  comision_venta_pct: number;
  gastos_admin_pct: number;
  notas: string;
  items: ItemForm[];
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  costeo?: CosteoProyectoConItems | null;
  defaultProyectoId?: string;
}

// ── Helper de formato ─────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

const ITEM_VACIO: ItemForm = {
  orden: 0, costeo_id: "", descripcion: "", fabricante: "", modelo: "",
  codigo_nandina: "", cantidad: 1, precio_fob_unitario_usd: 0,
  fodinfa_pct: "", arancel_pct: "", isd_pct: "", iva_importacion_pct: "",
};

// ── Cálculo live en el cliente (preview antes de guardar) ─────────────────────
function calcItem(
  item: ItemForm,
  gastos: { flete: number; seguro: number; agente: number; bodega: number; otros: number },
  totalFob: number,
  tasas: { fodinfa_pct: number; arancel_pct: number; isd_pct: number; iva_importacion_pct: number },
  precios: { margen_pct: number; comision_pct: number; admin_pct: number },
) {
  const qty     = Number(item.cantidad) || 1;
  const fobItem = Math.round(qty * (Number(item.precio_fob_unitario_usd) || 0) * 100) / 100;
  const ratio   = totalFob > 0 ? fobItem / totalFob : 0;

  const fleteP  = Math.round(gastos.flete  * ratio * 100) / 100;
  const seguroP = Math.round(gastos.seguro * ratio * 100) / 100;
  const agenteP = Math.round(gastos.agente * ratio * 100) / 100;
  const bodegaP = Math.round(gastos.bodega * ratio * 100) / 100;
  const otrosP  = Math.round(gastos.otros  * ratio * 100) / 100;

  const fod = Number(item.fodinfa_pct)       || tasas.fodinfa_pct;
  const ara = Number(item.arancel_pct)       || tasas.arancel_pct;
  const isd = Number(item.isd_pct)           || tasas.isd_pct;
  const iva = Number(item.iva_importacion_pct) || tasas.iva_importacion_pct;

  const cif         = fobItem + fleteP + seguroP;
  const fodindaUsd  = Math.round(cif * fod / 100 * 100) / 100;
  const arancelUsd  = Math.round(cif * ara / 100 * 100) / 100;
  const isdUsd      = Math.round(fobItem * isd / 100 * 100) / 100;
  const ivaUsd      = Math.round((cif + fodindaUsd + arancelUsd) * iva / 100 * 100) / 100;
  const aterrizaje  = Math.round((fobItem + fleteP + seguroP + agenteP + bodegaP + otrosP + fodindaUsd + arancelUsd + isdUsd + ivaUsd) * 100) / 100;
  const aterrizajeU = qty > 0 ? Math.round(aterrizaje / qty * 100) / 100 : 0;
  const divisor     = 1 - precios.margen_pct / 100 - precios.comision_pct / 100 - precios.admin_pct / 100;
  const pvpU        = divisor > 0 ? Math.round(aterrizajeU / divisor * 100) / 100 : aterrizajeU;
  const pvpTotal    = Math.round(pvpU * qty * 100) / 100;

  return { fobItem, aterrizaje, aterrizajeU, pvpU, pvpTotal };
}

// ── Panel de componentes por ítem ─────────────────────────────────────────────

interface ComponenteItemPanelProps {
  item_id: string;
  costeo_id: string;
  onFobChange: (fob: number) => void;
}

function ComponenteItemPanel({ item_id, costeo_id, onFobChange }: ComponenteItemPanelProps) {
  const [open, setOpen] = useState(false);
  // Optimistic local state — mirrors DB but responds instantly to toggles
  const [localComps, setLocalComps] = useState<ComponenteProyectoEstado[]>([]);
  const { data: dbComps = [], isLoading } = useComponentesProyectoItem(item_id);
  const copiar     = useCopiarComponentesAProyectoItem();
  const sincronizar = useSincronizarComponentesProyectoItem();

  // Sync DB → local whenever DB data changes
  useEffect(() => { setLocalComps(dbComps); }, [dbComps]);

  // Copy components from costeo on first open (RPC is idempotent — no-op if already copied)
  useEffect(() => {
    if (!open || isLoading) return;
    copiar.mutate({ item_id, costeo_id });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item_id, costeo_id]);

  const handleToggle = (componente_id: string, activo: boolean) => {
    const updated = localComps.map((c) =>
      c.componente_id === componente_id ? { ...c, activo } : c,
    );
    setLocalComps(updated);
    sincronizar.mutate({
      item_id,
      componentes: updated.map((c) => ({ componente_id: c.componente_id, activo: c.activo })),
    });
    onFobChange(calcularFobDesdeComponentes(updated));
  };

  const activeCount = localComps.filter((c) => c.activo).length;

  return (
    <div className="mt-2 border-t pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <Package2 className="size-3.5" />
        Componentes / accesorios
        {localComps.length > 0 && (
          <span className="text-[10px] bg-muted rounded px-1 py-0.5">
            {activeCount}/{localComps.length} activos
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5 pl-4">
          {(isLoading || copiar.isPending) ? (
            <p className="text-xs text-muted-foreground">Cargando componentes…</p>
          ) : localComps.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Este costeo no tiene componentes registrados.
            </p>
          ) : (
            <>
              {localComps.map((comp) => (
                <div
                  key={comp.componente_id}
                  className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs transition-opacity ${comp.activo ? "bg-background" : "bg-muted/30 opacity-60"}`}
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <span className={comp.activo ? "text-foreground" : "text-muted-foreground line-through"}>
                      {comp.descripcion}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {comp.incluir_en_fob ? fmt(comp.subtotal_usd) : "excl. FOB"}
                    </span>
                  </div>
                  <Switch
                    checked={comp.activo}
                    onCheckedChange={(v) => handleToggle(comp.componente_id, v)}
                    disabled={sincronizar.isPending}
                  />
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground pt-0.5">
                FOB desde componentes activos:{" "}
                <strong className="text-foreground">
                  {fmt(calcularFobDesdeComponentes(localComps))}
                </strong>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente ────────────────────────────────────────────────────────────────

export function CosteoProyectoForm({ open, onClose, costeo, defaultProyectoId }: Props) {
  const { empresaActivaId } = useCompany();
  const { data: proyectos = [] } = useProyectosSimples(empresaActivaId ?? null);
  const { data: cotizaciones = [] } = useCotizaciones();
  const crear     = useCrearCosteoProyecto();
  const actualizar = useActualizarCosteoProyecto();
  const importar  = useImportarItemsDesdeCotizacion();

  const esEdicion = !!costeo;

  const { register, control, handleSubmit, watch, reset, setValue } = useForm<FormData>({
    defaultValues: {
      proyecto_id: defaultProyectoId ?? "",
      cotizacion_id: "",
      descripcion: "",
      estado: "borrador",
      flete_total: 0, seguro_total: 0, agente_aduanas: 0, bodega: 0, otros_logistica: 0,
      fodinfa_pct: 0.5, arancel_pct: 0, isd_pct: 5, iva_importacion_pct: 15,
      margen_empresa_pct: 0, comision_venta_pct: 0, gastos_admin_pct: 0,
      notas: "",
      items: [{ ...ITEM_VACIO }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    if (costeo) {
      reset({
        proyecto_id:        costeo.proyecto_id        ?? "",
        cotizacion_id:      costeo.cotizacion_id      ?? "",
        descripcion:        costeo.descripcion        ?? "",
        estado:             costeo.estado,
        flete_total:        costeo.flete_total,
        seguro_total:       costeo.seguro_total,
        agente_aduanas:     costeo.agente_aduanas,
        bodega:             costeo.bodega,
        otros_logistica:    costeo.otros_logistica,
        fodinfa_pct:        costeo.fodinfa_pct,
        arancel_pct:        costeo.arancel_pct,
        isd_pct:            costeo.isd_pct,
        iva_importacion_pct: costeo.iva_importacion_pct,
        margen_empresa_pct: costeo.margen_empresa_pct,
        comision_venta_pct: costeo.comision_venta_pct,
        gastos_admin_pct:   costeo.gastos_admin_pct,
        notas:              costeo.notas ?? "",
        items: costeo.items.map((it) => ({
          orden:                  it.orden,
          costeo_id:              it.costeo_id      ?? "",
          descripcion:            it.descripcion,
          fabricante:             it.fabricante     ?? "",
          modelo:                 it.modelo         ?? "",
          codigo_nandina:         it.codigo_nandina ?? "",
          cantidad:               it.cantidad,
          precio_fob_unitario_usd: it.precio_fob_unitario_usd,
          fodinfa_pct:            it.fodinfa_pct != null ? String(it.fodinfa_pct) : "",
          arancel_pct:            it.arancel_pct  != null ? String(it.arancel_pct)  : "",
          isd_pct:                it.isd_pct      != null ? String(it.isd_pct)      : "",
          iva_importacion_pct:    it.iva_importacion_pct != null ? String(it.iva_importacion_pct) : "",
        })),
      });
    } else {
      reset({
        proyecto_id: defaultProyectoId ?? "",
        cotizacion_id: "",
        descripcion: "",
        estado: "borrador",
        flete_total: 0, seguro_total: 0, agente_aduanas: 0, bodega: 0, otros_logistica: 0,
        fodinfa_pct: 0.5, arancel_pct: 0, isd_pct: 5, iva_importacion_pct: 15,
        margen_empresa_pct: 0, comision_venta_pct: 0, gastos_admin_pct: 0,
        notas: "",
        items: [{ ...ITEM_VACIO }],
      });
    }
  }, [open, costeo, defaultProyectoId, reset]);

  // Watch para cálculo live
  const watchItems        = watch("items");
  const watchFlete        = watch("flete_total");
  const watchSeguro       = watch("seguro_total");
  const watchAgente       = watch("agente_aduanas");
  const watchBodega       = watch("bodega");
  const watchOtros        = watch("otros_logistica");
  const watchFodinfa      = watch("fodinfa_pct");
  const watchArancel      = watch("arancel_pct");
  const watchIsd          = watch("isd_pct");
  const watchIva          = watch("iva_importacion_pct");
  const watchMargen       = watch("margen_empresa_pct");
  const watchComision     = watch("comision_venta_pct");
  const watchAdmin        = watch("gastos_admin_pct");

  const gastos = {
    flete: Number(watchFlete) || 0, seguro: Number(watchSeguro) || 0,
    agente: Number(watchAgente) || 0, bodega: Number(watchBodega) || 0,
    otros: Number(watchOtros) || 0,
  };
  const tasas = {
    fodinfa_pct: Number(watchFodinfa) || 0.5,
    arancel_pct: Number(watchArancel) || 0,
    isd_pct: Number(watchIsd) || 5,
    iva_importacion_pct: Number(watchIva) || 15,
  };
  const precios = {
    margen_pct: Number(watchMargen) || 0,
    comision_pct: Number(watchComision) || 0,
    admin_pct: Number(watchAdmin) || 0,
  };

  const totalFob = watchItems.reduce(
    (s, it) => s + (Number(it.cantidad) || 1) * (Number(it.precio_fob_unitario_usd) || 0), 0,
  );
  const calcItems = watchItems.map((it) => calcItem(it, gastos, totalFob, tasas, precios));
  const totalAterrizaje = calcItems.reduce((s, c) => s + c.aterrizaje, 0);
  const totalVenta      = calcItems.reduce((s, c) => s + c.pvpTotal, 0);

  // Importar desde cotización
  const handleImportarCotizacion = async (cotizacion_id: string) => {
    if (!cotizacion_id) return;
    try {
      const items = await importar.mutateAsync(cotizacion_id);
      const itemsForms: ItemForm[] = items.map((it, i) => ({
        ...ITEM_VACIO,
        orden: i,
        descripcion: it.descripcion,
        fabricante: it.fabricante ?? "",
        modelo: it.modelo ?? "",
        cantidad: it.cantidad,
      }));
      setValue("items", itemsForms.length > 0 ? itemsForms : [{ ...ITEM_VACIO }]);
      toast.success(`${items.length} producto(s) importados de la cotización`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onSubmit = async (data: FormData) => {
    const datos: CosteoProyectoDatos = {
      proyecto_id:        data.proyecto_id        || undefined,
      cotizacion_id:      data.cotizacion_id      || undefined,
      descripcion:        data.descripcion,
      estado:             data.estado,
      flete_total:        Number(data.flete_total),
      seguro_total:       Number(data.seguro_total),
      agente_aduanas:     Number(data.agente_aduanas),
      bodega:             Number(data.bodega),
      otros_logistica:    Number(data.otros_logistica),
      fodinfa_pct:        Number(data.fodinfa_pct),
      arancel_pct:        Number(data.arancel_pct),
      isd_pct:            Number(data.isd_pct),
      iva_importacion_pct: Number(data.iva_importacion_pct),
      margen_empresa_pct: Number(data.margen_empresa_pct),
      comision_venta_pct: Number(data.comision_venta_pct),
      gastos_admin_pct:   Number(data.gastos_admin_pct),
      notas:              data.notas || undefined,
    };

    const items: CosteoProyectoItemPayload[] = data.items.map((it, i) => ({
      orden:                  i,
      costeo_id:              it.costeo_id || undefined,
      descripcion:            it.descripcion,
      fabricante:             it.fabricante || undefined,
      modelo:                 it.modelo || undefined,
      codigo_nandina:         it.codigo_nandina || undefined,
      cantidad:               Number(it.cantidad) || 1,
      precio_fob_unitario_usd: Number(it.precio_fob_unitario_usd) || 0,
      fodinfa_pct:            it.fodinfa_pct !== "" ? Number(it.fodinfa_pct) : undefined,
      arancel_pct:            it.arancel_pct !== "" ? Number(it.arancel_pct) : undefined,
      isd_pct:                it.isd_pct     !== "" ? Number(it.isd_pct)     : undefined,
      iva_importacion_pct:    it.iva_importacion_pct !== "" ? Number(it.iva_importacion_pct) : undefined,
    }));

    try {
      if (esEdicion && costeo) {
        await actualizar.mutateAsync({ id: costeo.id, datos, items });
        toast.success("Costeo de proyecto actualizado");
      } else {
        const result = await crear.mutateAsync({ datos, items });
        toast.success(`Costeo ${result.numero} creado`);
      }
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const isPending = crear.isPending || actualizar.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? `Editar ${costeo?.numero}` : "Nuevo Costeo de Proyecto"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* ── Sección: Información general ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Descripción del proyecto *</Label>
              <Input {...register("descripcion", { required: true })} placeholder="Ej: Equipos médicos Hospital X — Fase 2" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Proyecto vinculado (opcional)</Label>
              <Controller
                control={control}
                name="proyecto_id"
                render={({ field }) => (
                  <select {...field} className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">— Sin proyecto —</option>
                    {proyectos.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Cotización vinculada (opcional)</Label>
              <Controller
                control={control}
                name="cotizacion_id"
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    onChange={(e) => {
                      field.onChange(e);
                      if (!esEdicion && e.target.value) {
                        handleImportarCotizacion(e.target.value);
                      }
                    }}
                  >
                    <option value="">— Sin cotización —</option>
                    {cotizaciones.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.numero} — {c.razon_social}
                      </option>
                    ))}
                  </select>
                )}
              />
              <p className="text-[10px] text-muted-foreground">
                Al seleccionar una cotización en modo creación, sus productos se importan automáticamente.
              </p>
            </div>
          </div>

          {/* ── Sección: Gastos de importación compartidos ── */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Gastos de importación compartidos (USD)</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { name: "flete_total",    label: "Flete total" },
                { name: "seguro_total",   label: "Seguro" },
                { name: "agente_aduanas", label: "Agente aduanas" },
                { name: "bodega",         label: "Bodega" },
                { name: "otros_logistica",label: "Otros" },
              ].map(({ name, label }) => (
                <div key={name} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register(name as keyof FormData)}
                    className="text-right"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Sección: Tasas arancelarias por defecto ── */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              Tasas arancelarias (%) — por defecto para todos los ítems
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger><Info className="size-3.5 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent><p className="text-xs max-w-xs">Puedes sobreescribir estas tasas por ítem individualmente.</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { name: "fodinfa_pct",        label: "FODINFA %" },
                { name: "arancel_pct",         label: "Arancel %" },
                { name: "isd_pct",             label: "ISD %" },
                { name: "iva_importacion_pct", label: "IVA importación %" },
              ].map(({ name, label }) => (
                <div key={name} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <Input type="number" step="0.01" min="0" {...register(name as keyof FormData)} className="text-right" />
                </div>
              ))}
            </div>
          </div>

          {/* ── Sección: Precio de venta ── */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Parámetros de precio de venta (%)</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { name: "margen_empresa_pct", label: "Margen empresa" },
                { name: "comision_venta_pct", label: "Comisión ventas" },
                { name: "gastos_admin_pct",   label: "Gastos admin." },
              ].map(({ name, label }) => (
                <div key={name} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <Input type="number" step="0.01" min="0" max="100" {...register(name as keyof FormData)} className="text-right" />
                </div>
              ))}
            </div>
          </div>

          {/* ── Sección: Productos ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Productos ({fields.length})</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => append({ ...ITEM_VACIO, orden: fields.length })}
                className="gap-1.5"
              >
                <Plus className="size-3.5" />
                Agregar producto
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((field, idx) => {
                const calc = calcItems[idx];
                // DB item id available only in edit mode (after save)
                const dbItemId = esEdicion ? costeo?.items[idx]?.id : undefined;
                const itemCosteoId = watch(`items.${idx}.costeo_id`);
                return (
                  <div key={field.id} className="rounded-lg border bg-muted/20 p-3 space-y-3">
                    {/* Fila 1: descripción + fabricante + modelo */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Descripción *</Label>
                        <Input {...register(`items.${idx}.descripcion`)} placeholder="Nombre del producto" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Fabricante</Label>
                        <Input {...register(`items.${idx}.fabricante`)} placeholder="Ej: Siemens" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Modelo</Label>
                        <Input {...register(`items.${idx}.modelo`)} placeholder="Referencia" className="h-8 text-sm" />
                      </div>
                    </div>

                    {/* Fila 2: cantidad + FOB + NANDINA + tasas propias */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Cantidad</Label>
                        <Input type="number" step="1" min="1" {...register(`items.${idx}.cantidad`)} className="h-8 text-sm text-right" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">FOB unitario (USD)</Label>
                        <Input type="number" step="0.01" min="0" {...register(`items.${idx}.precio_fob_unitario_usd`)} className="h-8 text-sm text-right" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">NANDINA</Label>
                        <Input {...register(`items.${idx}.codigo_nandina`)} placeholder="84.79.89.00" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Arancel %</Label>
                        <Input type="number" step="0.01" min="0" {...register(`items.${idx}.arancel_pct`)} placeholder="header" className="h-8 text-sm text-right" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">ISD %</Label>
                        <Input type="number" step="0.01" min="0" {...register(`items.${idx}.isd_pct`)} placeholder="header" className="h-8 text-sm text-right" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">IVA imp. %</Label>
                        <Input type="number" step="0.01" min="0" {...register(`items.${idx}.iva_importacion_pct`)} placeholder="header" className="h-8 text-sm text-right" />
                      </div>
                    </div>

                    {/* Fila 3: resultados del cálculo */}
                    {calc && calc.fobItem > 0 && (
                      <div className="flex items-center justify-between bg-background rounded-md border px-3 py-1.5 text-xs text-muted-foreground">
                        <span>FOB total: <strong className="text-foreground">{fmt(calc.fobItem)}</strong></span>
                        <span>Costo aterrizaje total: <strong className="text-foreground">{fmt(calc.aterrizaje)}</strong></span>
                        <span>Unitario: <strong className="text-foreground">{fmt(calc.aterrizajeU)}</strong></span>
                        <span>PVP sugerido: <strong className="text-green-700">{fmt(calc.pvpTotal)}</strong></span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-6 text-destructive hover:text-destructive"
                          onClick={() => remove(idx)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    )}
                    {(!calc || calc.fobItem === 0) && (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-6 text-destructive hover:text-destructive"
                          onClick={() => remove(idx)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    )}

                    {/* Panel de componentes — solo en modo edición cuando el ítem tiene costeo asignado */}
                    {dbItemId && itemCosteoId && (
                      <ComponenteItemPanel
                        item_id={dbItemId}
                        costeo_id={itemCosteoId}
                        onFobChange={(fob) =>
                          setValue(`items.${idx}.precio_fob_unitario_usd`, fob)
                        }
                      />
                    )}
                    {!dbItemId && itemCosteoId && (
                      <p className="text-[10px] text-muted-foreground border-t pt-2 mt-1 italic">
                        Guarda el costeo para gestionar componentes de este ítem.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Resumen ── */}
          {totalFob > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold mb-3">Resumen del proyecto</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Total FOB</p>
                  <p className="font-semibold">{fmt(totalFob)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gastos importación</p>
                  <p className="font-semibold">{fmt(gastos.flete + gastos.seguro + gastos.agente + gastos.bodega + gastos.otros)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total costo aterrizaje</p>
                  <p className="font-semibold text-orange-700">{fmt(totalAterrizaje)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total precio venta sugerido</p>
                  <p className="font-semibold text-green-700">{fmt(totalVenta)}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Notas + Estado ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Notas internas</Label>
              <Textarea {...register("notas")} rows={2} placeholder="Observaciones adicionales…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Estado</Label>
              <Controller
                control={control}
                name="estado"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="borrador">Borrador</SelectItem>
                      <SelectItem value="finalizado">Finalizado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* ── Acciones ── */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear costeo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
