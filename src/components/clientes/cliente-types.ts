import { z } from "zod";
import type { Cliente } from "@/types/entities";

export const clienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  nombre_comercial: z.string().nullable().optional(),
  codigo: z.string().nullable().optional(),
  ruc: z.string().nullable().optional(),
  correo: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Correo inválido",
    }),
  telefono: z.string().nullable().optional(),
  contacto_principal: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  meta_facturacion_anual: z
    .number()
    .nonnegative("Debe ser un número positivo")
    .nullable()
    .optional(),
});

export type ClienteFormValues = z.infer<typeof clienteSchema>;

export const EMPTY_CLIENTE: ClienteFormValues = {
  nombre: "",
  nombre_comercial: "",
  codigo: "",
  ruc: "",
  correo: "",
  telefono: "",
  contacto_principal: "",
  estado: "activo",
  meta_facturacion_anual: null,
};

export function clienteToForm(c: Cliente): ClienteFormValues {
  return {
    nombre: c.nombre,
    nombre_comercial: c.nombre_comercial ?? "",
    codigo: c.codigo ?? "",
    ruc: c.ruc ?? "",
    correo: c.correo ?? "",
    telefono: c.telefono ?? "",
    contacto_principal: c.contacto_principal ?? "",
    estado: c.estado ?? "activo",
    meta_facturacion_anual: c.meta_facturacion_anual ?? null,
  };
}
