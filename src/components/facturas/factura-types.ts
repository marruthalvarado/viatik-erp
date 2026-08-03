import { z } from "zod";

// ─── Schema & tipos ───────────────────────────────────────────────────────────

export const facturaSchema = z.object({
  numero: z.string().min(1, "Requerido"),
  fecha: z.string().min(1, "Requerido"),
  tipo: z.enum(["factura", "nota_credito"]),
  ruc_cliente: z.string().nullable().optional(),
  razon_social: z.string().min(1, "Requerido"),
  subtotal: z.coerce.number().min(0),
  descuento: z.coerce.number().min(0),
  iva: z.coerce.number().min(0),
  total: z.coerce.number().min(0),
  proyecto_id: z.string().nullable().optional(),
  observacion: z.string().nullable().optional(),
  clave_acceso: z.string().nullable().optional(),
  retencion_iva_pct: z.coerce.number().min(0).max(100),
  retencion_ir_pct: z.coerce.number().min(0).max(100),
  fecha_vencimiento: z.string().nullable().optional(),
});

export type FormValues = z.infer<typeof facturaSchema>;

export type EstadoCobro = "pendiente" | "parcial" | "cobrado" | "vencido";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Calcula el valor neto a cobrar descontando retenciones fiscales.
 *  Cada retención se redondea individualmente al centavo (comportamiento fiscal Ecuador). */
export function calcValorNeto(
  total: number,
  iva: number,
  subtotal: number,
  retIvaPct: number,
  retIrPct: number,
): number {
  const retIvaMonto = Math.round(iva * retIvaPct) / 100;
  const retIrMonto = Math.round(subtotal * retIrPct) / 100;
  return Math.round((total - retIvaMonto - retIrMonto) * 100) / 100;
}

/** Días de atraso respecto a la fecha de vencimiento (0 si no venció o no tiene fecha). */
export function calcDiasAtraso(fechaVencimiento: string | null | undefined): number {
  if (!fechaVencimiento) return 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fechaVencimiento + "T00:00:00");
  return Math.max(0, Math.floor((hoy.getTime() - venc.getTime()) / 86_400_000));
}

export function calcEstadoCobro(
  valorNeto: number,
  cobrado: number,
  fechaVencimiento?: string | null,
): EstadoCobro {
  if (cobrado >= valorNeto - 0.001) return "cobrado";
  if (fechaVencimiento && calcDiasAtraso(fechaVencimiento) > 0) return "vencido";
  if (cobrado > 0) return "parcial";
  return "pendiente";
}

export const BADGE_COBRO: Record<EstadoCobro, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  parcial: "bg-blue-100 text-blue-700",
  cobrado: "bg-emerald-100 text-emerald-700",
  vencido: "bg-red-100 text-red-700",
};
