/**
 * Schema, tipos y helpers para el formulario de Viajes.
 * Interno al módulo rendiciones; no exportar desde rutas.
 */
import { z } from "zod";
import type { Viaje } from "@/types/entities";

export const viajeSchema = z.object({
  destino: z.string().min(1, "El destino es requerido"),
  numero: z.string().nullable().optional(),
  fecha_inicio: z.string().nullable().optional(),
  fecha_fin: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  distancia_km: z.number().nonnegative("Debe ser positivo").nullable().optional(),
  vehiculo_propio: z.boolean().nullable().optional(),
});

export type ViajeFormValues = z.infer<typeof viajeSchema>;

export const EMPTY_VIAJE: ViajeFormValues = {
  destino: "",
  numero: "",
  fecha_inicio: "",
  fecha_fin: "",
  observaciones: "",
  distancia_km: null,
  vehiculo_propio: false,
};

export function viajeToForm(v: Viaje): ViajeFormValues {
  return {
    destino: v.destino,
    numero: v.numero ?? "",
    fecha_inicio: v.fecha_inicio ?? "",
    fecha_fin: v.fecha_fin ?? "",
    observaciones: v.observaciones ?? "",
    distancia_km: v.distancia_km ?? null,
    vehiculo_propio: v.vehiculo_propio ?? false,
  };
}
