import { z } from "zod";
import type { Rendicion, Viaje } from "@/types/entities";
import { emptyToNull } from "@/utils/formatters";

// ---------------------------------------------------------------------------
// Schema principal de rendición (incluye sección viaje integrada)
// ---------------------------------------------------------------------------
export const rendicionSchema = z.object({
  // Cabecera
  numero: z.string().optional(), // auto-generado, no editable
  proyecto_id: z.string().min(1, "El proyecto es requerido"),
  descripcion: z.string().nullable().optional(),
  motivo: z.string().nullable().optional(),
  fecha_rendicion: z.string().nullable().optional(), // auto-llenado
  estado_rendicion_id: z.string().nullable().optional(),
  tipo_rendicion_id: z.string().nullable().optional(),
  anticipo_efectivo: z.number().nonnegative().nullable().optional(),
  anticipo_credito: z.number().nonnegative().nullable().optional(),

  // Sección Viaje (antes en pestaña separada)
  viaje_origen: z.string().nullable().optional(),
  viaje_destino: z.string().nullable().optional(),
  viaje_fecha_inicio: z.string().nullable().optional(),
  viaje_fecha_fin: z.string().nullable().optional(),
  viaje_vehiculo_propio: z.boolean().nullable().optional(),
  viaje_distancia_km: z.number().nonnegative().nullable().optional(),
});

export type RendicionFormValues = z.infer<typeof rendicionSchema>;

export const EMPTY_RENDICION: RendicionFormValues = {
  numero: "",
  proyecto_id: "",
  descripcion: "",
  motivo: "",
  fecha_rendicion: new Date().toISOString().split("T")[0],
  estado_rendicion_id: null,
  tipo_rendicion_id: null,
  anticipo_efectivo: null,
  anticipo_credito: null,
  // viaje
  viaje_origen: "",
  viaje_destino: "",
  viaje_fecha_inicio: "",
  viaje_fecha_fin: "",
  viaje_vehiculo_propio: false,
  viaje_distancia_km: null,
};

export function rendicionToForm(r: Rendicion, viaje?: Viaje | null): RendicionFormValues {
  return {
    numero: r.numero,
    proyecto_id: r.proyecto_id,
    descripcion: r.descripcion ?? "",
    motivo: r.motivo ?? "",
    fecha_rendicion: r.fecha_rendicion ?? "",
    estado_rendicion_id: r.estado_rendicion_id ?? null,
    tipo_rendicion_id: r.tipo_rendicion_id ?? null,
    anticipo_efectivo: r.anticipo_efectivo ?? null,
    anticipo_credito: r.anticipo_credito ?? null,
    // viaje fields come from the viajes table
    viaje_origen: viaje?.origen ?? "",
    viaje_destino: viaje?.destino ?? "",
    viaje_fecha_inicio: viaje?.fecha_inicio ?? "",
    viaje_fecha_fin: viaje?.fecha_fin ?? "",
    viaje_vehiculo_propio: viaje?.vehiculo_propio ?? false,
    viaje_distancia_km: viaje?.distancia_km ?? null,
  };
}

export { emptyToNull };

export function estadoTone(
  codigo: string | null | undefined,
): "success" | "danger" | "warning" | "info" | "neutral" {
  switch (codigo) {
    case "aprobada":
    case "liquidada":
      return "success";
    case "rechazada":
      return "danger";
    case "enviada":
    case "en_revision":
    case "devuelta":
      return "warning";
    case "registrada":
    case "borrador":
      return "neutral";
    default:
      return "info";
  }
}
