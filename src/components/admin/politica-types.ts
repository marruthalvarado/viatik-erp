/**
 * politica-types.ts
 * Schema Zod, tipos y helpers de formulario para Política de reembolso.
 */
import { z } from "zod";
import type { Politica } from "@/types/entities";

export const politicaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  codigo: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  activo: z.boolean().nullable().optional(),
  aprobador_id: z.string().uuid().nullable().optional(),
  valor_km: z.number().nonnegative().nullable().optional(),
  km_ciudad_por_dia: z.number().nonnegative().nullable().optional(),
  tope_desayuno: z.number().nonnegative().nullable().optional(),
  tope_almuerzo: z.number().nonnegative().nullable().optional(),
  tope_cena: z.number().nonnegative().nullable().optional(),
  tope_hospedaje: z.number().nonnegative().nullable().optional(),
  tope_miscelaneo: z.number().nonnegative().nullable().optional(),
  paga_combustible: z.boolean().nullable().optional(),
  paga_peajes: z.boolean().nullable().optional(),
  acepta_facturas_fuera_rango: z.boolean().nullable().optional(),
});

export type PoliticaFormValues = z.infer<typeof politicaSchema>;

export const EMPTY_POLITICA: PoliticaFormValues = {
  nombre: "",
  codigo: "",
  descripcion: "",
  activo: true,
  aprobador_id: null,
  valor_km: null,
  km_ciudad_por_dia: null,
  tope_desayuno: null,
  tope_almuerzo: null,
  tope_cena: null,
  tope_hospedaje: null,
  tope_miscelaneo: null,
  paga_combustible: false,
  paga_peajes: false,
  acepta_facturas_fuera_rango: true,
};

export function toPoliticaForm(p: Politica): PoliticaFormValues {
  return {
    nombre: p.nombre,
    codigo: p.codigo ?? "",
    descripcion: p.descripcion ?? "",
    activo: p.activo ?? true,
    aprobador_id: p.aprobador_id ?? null,
    valor_km: p.valor_km ?? null,
    km_ciudad_por_dia: p.km_ciudad_por_dia ?? null,
    tope_desayuno: p.tope_desayuno ?? null,
    tope_almuerzo: p.tope_almuerzo ?? null,
    tope_cena: p.tope_cena ?? null,
    tope_hospedaje: p.tope_hospedaje ?? null,
    tope_miscelaneo: p.tope_miscelaneo ?? null,
    paga_combustible: p.paga_combustible ?? false,
    paga_peajes: p.paga_peajes ?? false,
    acepta_facturas_fuera_rango: p.acepta_facturas_fuera_rango ?? true,
  };
}
