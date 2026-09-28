/**
 * Formulario para crear/editar productos del catálogo.
 */
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ProductoCatalogo } from "@/services/cotizaciones";
import type { Database } from "@/types/database";
import { useCompany } from "@/contexts/company-context";
import { useProveedores } from "@/hooks/entities/use-proveedores";

type ProductoPayload = Database["public"]["Tables"]["productos_catalogo"]["Insert"];

interface ProductoFormProps {
  open: boolean;
  producto?: ProductoCatalogo;
  onGuardar: (payload: ProductoPayload) => Promise<void>;
  onClose: () => void;
}

interface FormData {
  nombre: string;
  tipo_item: string;
  fabricante: string;
  modelo: string;
  descripcion: string;
  descripcion_larga: string;
  descripcion_tecnica: string;
  foto_url: string;
  proveedor_id: string;
  unidad_medida: string;
  precio_referencial: string;
  dias_entrega_est: string;
  meses_garantia: string;
  para_cotizar: boolean;
  estado: string;
}

export function ProductoForm({ open, producto, onGuardar, onClose }: ProductoFormProps) {
  const { empresaActivaId } = useCompany();
  const { data: proveedoresData } = useProveedores({ filters: { es_internacional: true }, pageSize: 200 });
  const proveedores = proveedoresData?.rows ?? [];

  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: {
      nombre: "",
      tipo_item: "producto",
      fabricante: "",
      modelo: "",
      descripcion: "",
      descripcion_larga: "",
      descripcion_tecnica: "",
      foto_url: "",
      proveedor_id: "",
      unidad_medida: "unidad",
      precio_referencial: "",
      dias_entrega_est: "",
      meses_garantia: "",
      para_cotizar: true,
      estado: "activo",
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        producto
          ? {
              nombre: producto.nombre,
              tipo_item: producto.tipo_item,
              fabricante: producto.fabricante ?? "",
              modelo: producto.modelo ?? "",
              descripcion: producto.descripcion ?? "",
              descripcion_larga: producto.descripcion_larga ?? "",
              descripcion_tecnica: producto.descripcion_tecnica ?? "",
              foto_url: producto.foto_url ?? "",
              proveedor_id: producto.proveedor_id ?? "",
              unidad_medida: producto.unidad_medida,
              precio_referencial: producto.precio_referencial?.toString() ?? "",
              dias_entrega_est: producto.dias_entrega_est?.toString() ?? "",
              meses_garantia: producto.meses_garantia?.toString() ?? "",
              para_cotizar: producto.para_cotizar,
              estado: producto.estado,
            }
          : {
              nombre: "", tipo_item: "producto", fabricante: "", modelo: "",
              descripcion: "", descripcion_larga: "", descripcion_tecnica: "",
              foto_url: "", proveedor_id: "", unidad_medida: "unidad",
              precio_referencial: "", dias_entrega_est: "", meses_garantia: "",
              para_cotizar: true, estado: "activo",
            },
      );
    }
  }, [open, producto, reset]);

  const onSubmit = async (data: FormData) => {
    const payload: ProductoPayload = {
      empresa_id: empresaActivaId!,
      nombre: data.nombre.trim(),
      tipo_item: data.tipo_item,
      fabricante: data.fabricante.trim() || undefined,
      modelo: data.modelo.trim() || undefined,
      descripcion: data.descripcion.trim() || undefined,
      descripcion_larga: data.descripcion_larga.trim() || undefined,
      descripcion_tecnica: data.descripcion_tecnica.trim() || undefined,
      foto_url: data.foto_url.trim() || undefined,
      proveedor_id: data.proveedor_id || undefined,
      unidad_medida: data.unidad_medida,
      precio_referencial: data.precio_referencial ? parseFloat(data.precio_referencial) : undefined,
      dias_entrega_est: data.dias_entrega_est ? parseInt(data.dias_entrega_est) : undefined,
      meses_garantia: data.meses_garantia ? parseInt(data.meses_garantia) : undefined,
      para_cotizar: data.para_cotizar,
      estado: data.estado,
    };
    await onGuardar(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{producto ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre *</Label>
            <Input {...register("nombre", { required: true })} placeholder="Nombre del producto o servicio" />
          </div>

          {/* Tipo + Fabricante + Modelo */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={watch("tipo_item")} onValueChange={(v) => setValue("tipo_item", v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="producto">Producto</SelectItem>
                  <SelectItem value="servicio">Servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fabricante</Label>
              <Input {...register("fabricante")} placeholder="Ej. Protonmed" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Modelo</Label>
              <Input {...register("modelo")} placeholder="Ej. Q30" className="h-8 text-sm" />
            </div>
          </div>

          {/* Descripción comercial */}
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción breve</Label>
            <Input {...register("descripcion")} placeholder="Descripción corta" className="text-sm" />
          </div>

          {/* Descripción larga para propuesta comercial */}
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción larga (propuesta comercial)</Label>
            <Textarea
              {...register("descripcion_larga")}
              placeholder="Descripción detallada que aparecerá en la propuesta técnico-comercial"
              className="text-sm min-h-[80px]"
            />
          </div>

          {/* Descripción técnica */}
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción técnica</Label>
            <Textarea
              {...register("descripcion_tecnica")}
              placeholder="Especificaciones técnicas detalladas (aparecerán en la cotización)"
              className="text-sm min-h-[100px]"
            />
          </div>

          {/* Foto + Fabricante (proveedor) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">URL de la foto del producto</Label>
              <Input {...register("foto_url")} placeholder="https://..." className="text-sm h-8" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fabricante (proveedor internacional)</Label>
              <Select value={watch("proveedor_id")} onValueChange={(v) => setValue("proveedor_id", v === "_none" ? "" : v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Sin fabricante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin fabricante</SelectItem>
                  {proveedores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Unidad + Precio ref */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Unidad de medida</Label>
              <Input {...register("unidad_medida")} placeholder="unidad, kg, hora…" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Precio referencial (USD)</Label>
              <Input
                {...register("precio_referencial")}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Entrega + Garantía */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Días de entrega estimados</Label>
              <Input {...register("dias_entrega_est")} type="number" min="0" placeholder="120" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Meses de garantía</Label>
              <Input {...register("meses_garantia")} type="number" min="0" placeholder="24" className="h-8 text-sm" />
            </div>
          </div>

          {/* Estado + Para cotizar */}
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Disponible para cotizar</p>
              <p className="text-xs text-muted-foreground">
                Aparece en el selector al crear cotizaciones
              </p>
            </div>
            <Switch
              checked={watch("para_cotizar")}
              onCheckedChange={(v) => setValue("para_cotizar", v)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
