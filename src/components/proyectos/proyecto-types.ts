import { z } from "zod";
import type { Proyecto } from "@/types/entities";

export const proyectoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  codigo: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  cliente_id: z.string().min(1, "El cliente es requerido"),
  fecha_inicio: z.string().nullable().optional(),
  fecha_fin: z.string().nullable().optional(),
  presupuesto: z.number().nonnegative("Debe ser positivo").nullable().optional(),
  valor_contrato: z.number().nonnegative("Debe ser positivo").nullable().optional(),
  estado_financiero: z.string().nullable().optional(),
});

export type ProyectoFormValues = z.infer<typeof proyectoSchema>;

export const EMPTY_PROYECTO: ProyectoFormValues = {
  nombre: "",
  codigo: "",
  descripcion: "",
  cliente_id: "",
  fecha_inicio: "",
  fecha_fin: "",
  presupuesto: null,
  valor_contrato: null,
  estado_financiero: "en_curso",
};

export function proyectoToForm(p: Proyecto): ProyectoFormValues {
  return {
    nombre: p.nombre,
    codigo: p.codigo ?? "",
    descripcion: p.descripcion ?? "",
    cliente_id: p.cliente_id,
    fecha_inicio: p.fecha_inicio ?? "",
    fecha_fin: p.fecha_fin ?? "",
    presupuesto: p.presupuesto ?? null,
    valor_contrato: p.valor_contrato ?? null,
    estado_financiero: p.estado_financiero ?? "en_curso",
  };
}
