/**
 * producto-form.tsx
 * Formulario de creación/edición de productos del catálogo.
 */
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCategoriasGasto } from "@/hooks/entities/use-catalogs";
import {
  productoSchema, type ProductoFormValues, EMPTY_PRODUCTO,
} from "./inventario-types";
import type { ProductoCatalogo } from "@/services/inventario";

interface Props {
  initial?: ProductoCatalogo | null;
  onSubmit: (values: ProductoFormValues) => void;
  submitting?: boolean;
}

export function ProductoForm({ initial, onSubmit, submitting }: Props) {
  const { data: categoriasData } = useCategoriasGasto();
  const categorias = categoriasData?.rows ?? [];

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors },
    reset,
  } = useForm<ProductoFormValues>({
    resolver: zodResolver(productoSchema),
    defaultValues: EMPTY_PRODUCTO,
  });

  useEffect(() => {
    if (initial) {
      reset({
        nombre: initial.nombre,
        descripcion: initial.descripcion ?? "",
        tipo_seguimiento: initial.tipo_seguimiento as "unidad" | "lote",
        unidad_medida: initial.unidad_medida,
        categoria_id: initial.categoria_id ?? "",
        estado: initial.estado as "activo" | "descontinuado",
      });
    } else {
      reset(EMPTY_PRODUCTO);
    }
  }, [initial, reset]);

  const tipoSeg = watch("tipo_seguimiento");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label>Nombre *</Label>
        <Input {...register("nombre")} placeholder="Ej. Cassette reactivos Hematología" />
        {errors.nombre && <p className="mt-1 text-xs text-destructive">{errors.nombre.message}</p>}
      </div>

      <div>
        <Label>Descripción</Label>
        <Textarea {...register("descripcion")} rows={2} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo de seguimiento *</Label>
          <Select
            value={tipoSeg}
            onValueChange={(v) => setValue("tipo_seguimiento", v as "unidad" | "lote")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unidad">Por unidad (UNIT-XXXX)</SelectItem>
              <SelectItem value="lote">Por lote/caja (LOT-XXXX)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Unidad de medida *</Label>
          <Input
            {...register("unidad_medida")}
            placeholder={tipoSeg === "lote" ? "caja" : "unidad"}
          />
          {errors.unidad_medida && (
            <p className="mt-1 text-xs text-destructive">{errors.unidad_medida.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Categoría de gasto</Label>
          <Select
            value={watch("categoria_id") ?? ""}
            onValueChange={(v) => setValue("categoria_id", v === "_none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Sin categoría</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Estado</Label>
          <Select
            value={watch("estado")}
            onValueChange={(v) => setValue("estado", v as "activo" | "descontinuado")}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="descontinuado">Descontinuado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : initial ? "Actualizar" : "Crear producto"}
        </Button>
      </div>
    </form>
  );
}
