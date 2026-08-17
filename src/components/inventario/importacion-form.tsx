/**
 * importacion-form.tsx
 * Formulario de liquidación aduanera (DAI) con líneas de productos.
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useProveedores, useCrearProveedor } from "@/hooks/entities/use-proveedores";
import { useBodegas } from "@/hooks/entities/use-inventario";
import { useProductosCatalogo } from "@/hooks/entities/use-inventario";
import { useCompany } from "@/contexts/company-context";
import { toast } from "@/components/common/toast";
import { emptyToNull } from "@/utils/formatters";
import {
  importacionSchema, type ImportacionFormValues, EMPTY_IMPORTACION,
  type LineaFormValues, EMPTY_LINEA,
} from "./inventario-types";

interface Props {
  onSubmit: (values: ImportacionFormValues, lineas: LineaFormValues[]) => void;
  submitting?: boolean;
}

export function ImportacionForm({ onSubmit, submitting }: Props) {
  const { empresaActivaId } = useCompany();
  // Solo proveedores internacionales en el form de importación
  const { data: proveedoresData, refetch: refetchProveedores } = useProveedores({
    pageSize: 200,
    filters: { es_internacional: true },
  });
  const proveedores = proveedoresData?.rows ?? [];
  const crearProveedor = useCrearProveedor();
  const { data: bodegas = [] } = useBodegas();
  const { data: productos = [] } = useProductosCatalogo();

  const [lineas, setLineas] = useState<LineaFormValues[]>([{ ...EMPTY_LINEA }]);

  // Estado del mini-form de proveedor internacional
  const [nuevoProvDialog, setNuevoProvDialog] = useState(false);
  const [nuevoProvNombre, setNuevoProvNombre] = useState("");
  const [nuevoProvPais, setNuevoProvPais] = useState("");

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors },
  } = useForm<ImportacionFormValues>({
    resolver: zodResolver(importacionSchema),
    defaultValues: EMPTY_IMPORTACION,
  });

  // Calcular valor_aduanas automáticamente
  const fob = watch("fob_total") ?? 0;
  const seguro = watch("seguro") ?? 0;
  const flete = watch("flete") ?? 0;
  const ajustes = watch("ajustes") ?? 0;
  const valorAduanas = Number(fob) + Number(seguro) + Number(flete) + Number(ajustes);

  // valor_aduanas is computed on submit, not stored in form state

  function handleLineaChange(idx: number, field: keyof LineaFormValues, value: string | number) {
    setLineas((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function addLinea() { setLineas((p) => [...p, { ...EMPTY_LINEA }]); }
  function removeLinea(idx: number) { setLineas((p) => p.filter((_, i) => i !== idx)); }

  function handleFormSubmit(values: ImportacionFormValues) {
    onSubmit(values, lineas);
  }

  async function handleCrearProveedorInternacional() {
    if (!nuevoProvNombre.trim() || !empresaActivaId) return;
    try {
      const nuevo = await crearProveedor.mutateAsync({
        empresa_id: empresaActivaId,
        nombre: nuevoProvNombre.trim(),
        pais: emptyToNull(nuevoProvPais),
        es_internacional: true,
        estado: "activo",
      });
      await refetchProveedores();
      setValue("proveedor_id", nuevo.id);
      setNuevoProvDialog(false);
      setNuevoProvNombre("");
      setNuevoProvPais("");
      toast.success(`Proveedor "${nuevo.nombre}" creado.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear el proveedor.");
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      {/* Datos generales */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>N° Liquidación / DAI</Label>
          <Input {...register("numero_liquidacion")} placeholder="Ej. 050-2026-10-00001" />
        </div>
        <div>
          <Label>Referencia interna</Label>
          <Input {...register("referencia_dai")} placeholder="Ej. IMP-2026-01" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Fecha *</Label>
          <Input type="date" {...register("fecha")} />
          {errors.fecha && <p className="mt-1 text-xs text-destructive">{errors.fecha.message}</p>}
        </div>
        <div>
          <Label>Proveedor internacional</Label>
          <div className="flex gap-1.5">
            <Select
              value={watch("proveedor_id") ?? ""}
              onValueChange={(v) => setValue("proveedor_id", v === "_none" ? "" : v)}
            >
              <SelectTrigger className="flex-1"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Sin proveedor —</SelectItem>
                {proveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}{p.pais ? ` · ${p.pais}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              title="Agregar proveedor internacional"
              onClick={() => setNuevoProvDialog(true)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
        <div>
          <Label>Bodega destino</Label>
          <Select
            value={watch("bodega_destino_id") ?? ""}
            onValueChange={(v) => setValue("bodega_destino_id", v === "_none" ? "" : v)}
          >
            <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">— Sin bodega —</SelectItem>
              {bodegas.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>País de origen</Label>
          <Input {...register("pais_origen")} placeholder="Ej. China" />
        </div>
        <div>
          <Label>Estado</Label>
          <Select
            value={watch("estado")}
            onValueChange={(v) => setValue("estado", v as ImportacionFormValues["estado"])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="En tránsito">En tránsito</SelectItem>
              <SelectItem value="Recibida">Recibida</SelectItem>
              <SelectItem value="Parcial">Parcial</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Valores aduaneros */}
      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Valores liquidación (USD)
        </p>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <Label>FOB Total *</Label>
            <Input type="number" step="0.01" {...register("fob_total")} />
          </div>
          <div>
            <Label>Seguro</Label>
            <Input type="number" step="0.01" {...register("seguro")} />
          </div>
          <div>
            <Label>Flete</Label>
            <Input type="number" step="0.01" {...register("flete")} />
          </div>
          <div>
            <Label>Ajustes</Label>
            <Input type="number" step="0.01" {...register("ajustes")} />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <Label>Valor en Aduana</Label>
            <Input
              type="number"
              step="0.01"
              value={valorAduanas.toFixed(2)}
              readOnly
              className="bg-muted"
            />
          </div>
          <div>
            <Label>Arancel</Label>
            <Input type="number" step="0.01" {...register("arancel")} />
          </div>
          <div>
            <Label>FODINFA</Label>
            <Input type="number" step="0.01" {...register("fodinfa")} />
          </div>
          <div>
            <Label>IVA Importación</Label>
            <Input type="number" step="0.01" {...register("iva_importacion")} />
          </div>
        </div>
        <div className="max-w-[180px]">
          <Label className="font-semibold">Total Liquidado *</Label>
          <Input type="number" step="0.01" {...register("total_liquidado")} />
        </div>
      </div>

      {/* Líneas de productos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Líneas de productos
          </p>
          <Button type="button" variant="outline" size="sm" onClick={addLinea}>
            <Plus className="size-3 mr-1" /> Agregar línea
          </Button>
        </div>

        <div className="space-y-2">
          {lineas.map((linea, idx) => (
            <div key={idx} className="rounded border p-3 space-y-2">
              <div className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-4">
                  <Label className="text-xs">Descripción *</Label>
                  <Input
                    value={linea.descripcion_original}
                    onChange={(e) => handleLineaChange(idx, "descripcion_original", e.target.value)}
                    placeholder="Texto del DAI"
                    className="text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">Producto</Label>
                  <Select
                    value={linea.producto_id ?? ""}
                    onValueChange={(v) => handleLineaChange(idx, "producto_id", v === "_none" ? "" : v)}
                  >
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Sin asociar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Sin producto —</SelectItem>
                      {(productos ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.codigo ? `[${p.codigo}] ` : ""}{p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">FOB línea</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={linea.fob_linea}
                    onChange={(e) => handleLineaChange(idx, "fob_linea", parseFloat(e.target.value) || 0)}
                    className="text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Cantidad</Label>
                  <Input
                    type="number"
                    min="1"
                    value={linea.cantidad}
                    onChange={(e) => handleLineaChange(idx, "cantidad", parseFloat(e.target.value) || 1)}
                    className="text-sm"
                  />
                </div>
                <div className="col-span-1 flex items-end pb-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    onClick={() => removeLinea(idx)}
                    disabled={lineas.length === 1}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Observación</Label>
        <Textarea {...register("observacion")} rows={2} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : "Crear importación"}
        </Button>
      </div>

      {/* Mini-form: nuevo proveedor internacional */}
      <Dialog open={nuevoProvDialog} onOpenChange={setNuevoProvDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="size-4 text-muted-foreground" />
              Nuevo proveedor internacional
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label htmlFor="np-nombre">Nombre *</Label>
              <Input
                id="np-nombre"
                value={nuevoProvNombre}
                onChange={(e) => setNuevoProvNombre(e.target.value)}
                placeholder="Ej. Hikvision Co., Ltd."
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="np-pais">País</Label>
              <Input
                id="np-pais"
                value={nuevoProvPais}
                onChange={(e) => setNuevoProvPais(e.target.value)}
                placeholder="Ej. China"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setNuevoProvDialog(false);
                setNuevoProvNombre("");
                setNuevoProvPais("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!nuevoProvNombre.trim() || crearProveedor.isPending}
              onClick={handleCrearProveedorInternacional}
            >
              {crearProveedor.isPending ? "Creando…" : "Crear proveedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
