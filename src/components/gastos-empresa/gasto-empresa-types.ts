import { z } from "zod";

export const MONEDAS_EXTRANJERAS = [
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — Libra esterlina" },
  { code: "CHF", label: "CHF — Franco suizo" },
  { code: "JPY", label: "JPY — Yen japonés" },
  { code: "CNY", label: "CNY — Yuan chino" },
  { code: "CAD", label: "CAD — Dólar canadiense" },
  { code: "AUD", label: "AUD — Dólar australiano" },
  { code: "SEK", label: "SEK — Corona sueca" },
  { code: "DKK", label: "DKK — Corona danesa" },
  { code: "NOK", label: "NOK — Corona noruega" },
];

export const gastoEmpresaSchema = z.object({
  fecha: z.string().min(1, "Requerido"),
  descripcion: z.string().min(1, "Requerido"),
  categoria_id: z.string().nullable().optional(),
  proveedor_id: z.string().nullable().optional(),
  proyecto_id: z.string().nullable().optional(),
  responsable: z.string().nullable().optional(),
  subtotal: z.coerce.number().min(0),
  iva_pct: z.coerce.number().min(0).max(100).default(0),
  iva: z.coerce.number().min(0),
  total: z.coerce.number().min(0),
  es_deducible: z.boolean(),
  clave_acceso: z.string().nullable().optional(),
  numero_documento: z.string().nullable().optional(),
  ruc_emisor: z.string().nullable().optional(),
  observacion: z.string().nullable().optional(),
  moneda_origen: z.string().nullable().optional(),
  monto_origen: z.coerce.number().nullable().optional(),
  tipo_cambio: z.coerce.number().nullable().optional(),
});

export type GastoEmpresaFormValues = z.infer<typeof gastoEmpresaSchema>;

/** Detecta el % IVA a partir de subtotal e iva almacenados (0, 12, 15 o 0 si no coincide). */
export function deriveIvaPct(subtotal: number, iva: number): number {
  if (!subtotal || !iva) return 0;
  const pct = Math.round((iva / subtotal) * 100);
  return [0, 12, 15].includes(pct) ? pct : 0;
}
