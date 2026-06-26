import { z } from "zod";
import type { Gasto } from "@/types/entities";

// ─── Schema ────────────────────────────────────────────────────────────────────

export const gastoSchema = z.object({
  rendicion_id: z.string().min(1, "La rendición es requerida"),
  descripcion: z.string().nullable().optional(),
  numero_documento: z.string().nullable().optional(),
  fecha: z.string().nullable().optional(),
  categoria_gasto_id: z.string().nullable().optional(),
  estado_gasto_id: z.string().nullable().optional(),
  proveedor_id: z.string().nullable().optional(),
  moneda_codigo: z.string().nullable().optional(),
  valor_factura: z.number().nonnegative("Debe ser positivo").nullable().optional(),
  valor_moneda_origen: z.number().nonnegative("Debe ser positivo").nullable().optional(),
  tipo_cambio: z.number().nonnegative("Debe ser positivo").nullable().optional(),
  valor_reembolsable: z.number().nonnegative("Debe ser positivo").nullable().optional(),
  observaciones: z.string().nullable().optional(),
});

export type GastoFormValues = z.infer<typeof gastoSchema>;

// ─── Constants ─────────────────────────────────────────────────────────────────

export const EMPTY_FORM: GastoFormValues = {
  rendicion_id: "",
  descripcion: "",
  numero_documento: "",
  fecha: "",
  categoria_gasto_id: null,
  estado_gasto_id: null,
  proveedor_id: null,
  moneda_codigo: null,
  valor_factura: null,
  valor_moneda_origen: null,
  tipo_cambio: null,
  valor_reembolsable: null,
  observaciones: "",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function gastoToForm(g: Gasto): GastoFormValues {
  return {
    rendicion_id: g.rendicion_id,
    descripcion: g.descripcion ?? "",
    numero_documento: g.numero_documento ?? "",
    fecha: g.fecha ?? "",
    categoria_gasto_id: g.categoria_gasto_id ?? null,
    estado_gasto_id: g.estado_gasto_id ?? null,
    proveedor_id: g.proveedor_id ?? null,
    moneda_codigo: g.moneda_codigo ?? null,
    valor_factura: g.valor_factura ?? null,
    valor_moneda_origen: g.valor_moneda_origen ?? null,
    tipo_cambio: g.tipo_cambio ?? null,
    valor_reembolsable: g.valor_reembolsable ?? null,
    observaciones: g.observaciones ?? "",
  };
}
