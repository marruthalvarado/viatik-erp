/**
 * inventario-types.ts
 * Schemas y tipos de formularios para el módulo de inventario.
 */
import { z } from "zod";

// ── Producto catálogo ────────────────────────────────────────────────────────
export const productoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().optional(),
  tipo_seguimiento: z.enum(["unidad", "lote"]),
  unidad_medida: z.string().min(1, "Unidad requerida"),
  categoria_id: z.string().optional(),
  estado: z.enum(["activo", "descontinuado"]),
});

export type ProductoFormValues = z.infer<typeof productoSchema>;

export const EMPTY_PRODUCTO: ProductoFormValues = {
  nombre: "",
  descripcion: "",
  tipo_seguimiento: "unidad",
  unidad_medida: "unidad",
  categoria_id: "",
  estado: "activo",
};

// ── Importación ──────────────────────────────────────────────────────────────
export const importacionSchema = z.object({
  numero_liquidacion: z.string().optional(),
  referencia_dai: z.string().optional(),
  fecha: z.string().min(1, "Fecha requerida"),
  proveedor_id: z.string().optional(),
  bodega_destino_id: z.string().optional(),
  pais_origen: z.string().optional(),
  fob_total: z.coerce.number().min(0),
  seguro: z.coerce.number().min(0),
  flete: z.coerce.number().min(0),
  ajustes: z.coerce.number().min(0),
  arancel: z.coerce.number().min(0),
  fodinfa: z.coerce.number().min(0),
  iva_importacion: z.coerce.number().min(0),
  total_liquidado: z.coerce.number().min(0),
  estado: z.enum(["En tránsito", "Recibida", "Parcial"]),
  observacion: z.string().optional(),
});

export type ImportacionFormValues = z.infer<typeof importacionSchema>;

export const EMPTY_IMPORTACION: ImportacionFormValues = {
  numero_liquidacion: "",
  referencia_dai: "",
  fecha: new Date().toISOString().slice(0, 10),
  proveedor_id: "",
  bodega_destino_id: "",
  pais_origen: "",
  fob_total: 0,
  seguro: 0,
  flete: 0,
  ajustes: 0,
  arancel: 0,
  fodinfa: 0,
  iva_importacion: 0,
  total_liquidado: 0,
  estado: "En tránsito",
  observacion: "",
};

// ── Línea de importación ─────────────────────────────────────────────────────
export const lineaSchema = z.object({
  producto_id: z.string().optional(),
  descripcion_original: z.string().min(1, "Descripción requerida"),
  fob_linea: z.coerce.number().min(0),
  cantidad: z.coerce.number().min(1),
  unidad_medida: z.string().optional(),
});

export type LineaFormValues = z.infer<typeof lineaSchema>;

export const EMPTY_LINEA: LineaFormValues = {
  producto_id: "",
  descripcion_original: "",
  fob_linea: 0,
  cantidad: 1,
  unidad_medida: "",
};

// ── Movimiento ───────────────────────────────────────────────────────────────
export const movimientoSchema = z.object({
  tipo: z.enum(["Asignación", "Transferencia", "Venta", "Consumo", "Devolución", "Baja"]),
  fecha: z.string().min(1),
  cantidad: z.coerce.number().min(0.001),
  bodega_destino_id: z.string().optional(),
  proyecto_id: z.string().optional(),
  observacion: z.string().optional(),
});

export type MovimientoFormValues = z.infer<typeof movimientoSchema>;
