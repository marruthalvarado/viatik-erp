import { z } from "zod";
import type { Presupuesto } from "@/types/entities";

const currentYear = new Date().getFullYear();

export const presupuestoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  anio: z
    .number({ invalid_type_error: "El año es requerido" })
    .int("Debe ser un año entero")
    .min(2000, "Año mínimo 2000")
    .max(2100, "Año máximo 2100"),
  codigo: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  proyecto_id: z.string().nullable().optional(),
  activo: z.boolean().nullable().optional(),
  valor_total: z.number().nonnegative("Debe ser positivo").nullable().optional(),
});

export type PresupuestoFormValues = z.infer<typeof presupuestoSchema>;

export const EMPTY_PRESUPUESTO: PresupuestoFormValues = {
  nombre: "",
  anio: currentYear,
  codigo: "",
  descripcion: "",
  proyecto_id: null,
  activo: true,
  valor_total: null,
};

export function presupuestoToForm(p: Presupuesto): PresupuestoFormValues {
  return {
    nombre: p.nombre,
    anio: p.anio,
    codigo: p.codigo ?? "",
    descripcion: p.descripcion ?? "",
    proyecto_id: p.proyecto_id ?? null,
    activo: p.activo ?? true,
    valor_total: p.valor_total ?? null,
  };
}
