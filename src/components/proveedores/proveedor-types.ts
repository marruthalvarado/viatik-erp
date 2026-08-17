import { z } from "zod";
import type { Proveedor } from "@/types/entities";

export const proveedorSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  codigo: z.string().nullable().optional(),
  identificacion: z.string().nullable().optional(),
  correo: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Correo inválido",
    }),
  telefono: z.string().nullable().optional(),
  ciudad: z.string().nullable().optional(),
  pais: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  es_internacional: z.boolean(),
});

export type ProveedorFormValues = z.infer<typeof proveedorSchema>;

export const EMPTY_PROVEEDOR: ProveedorFormValues = {
  nombre: "",
  codigo: "",
  identificacion: "",
  correo: "",
  telefono: "",
  ciudad: "",
  pais: "",
  estado: "activo",
  es_internacional: false,
};

export const EMPTY_PROVEEDOR_INTERNACIONAL: ProveedorFormValues = {
  ...EMPTY_PROVEEDOR,
  es_internacional: true,
};

export function proveedorToForm(p: Proveedor): ProveedorFormValues {
  return {
    nombre: p.nombre,
    codigo: p.codigo ?? "",
    identificacion: p.identificacion ?? "",
    correo: p.correo ?? "",
    telefono: p.telefono ?? "",
    ciudad: p.ciudad ?? "",
    pais: p.pais ?? "",
    estado: p.estado ?? "activo",
    es_internacional: p.es_internacional ?? false,
  };
}
