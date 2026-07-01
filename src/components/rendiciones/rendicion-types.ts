import { z } from "zod";
import type { Rendicion } from "@/types/entities";
import { emptyToNull } from "@/utils/formatters";

export const rendicionSchema = z.object({
  numero: z.string().min(1, "El número es requerido"),
  proyecto_id: z.string().min(1, "El proyecto es requerido"),
  descripcion: z.string().nullable().optional(),
  motivo: z.string().nullable().optional(),
  fecha_rendicion: z.string().nullable().optional(),
  estado_rendicion_id: z.string().nullable().optional(),
  tipo_rendicion_id: z.string().nullable().optional(),
  anticipo_efectivo: z.number().nonnegative().nullable().optional(),
  anticipo_credito: z.number().nonnegative().nullable().optional(),
});

export type RendicionFormValues = z.infer<typeof rendicionSchema>;

export const EMPTY_RENDICION: RendicionFormValues = {
  numero: "",
  proyecto_id: "",
  descripcion: "",
  motivo: "",
  fecha_rendicion: "",
  estado_rendicion_id: null,
  tipo_rendicion_id: null,
  anticipo_efectivo: null,
  anticipo_credito: null,
};

export function rendicionToForm(r: Rendicion): RendicionFormValues {
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
  };
}

export { emptyToNull };

export function estadoTone(
  codigo: string | null | undefined,
): "success" | "danger" | "warning" | "info" | "neutral" {
  switch (codigo) {
    case "aprobada":
      return "success";
    case "rechazada":
      return "danger";
    case "enviada":
    case "en_revision":
      return "warning";
    case "borrador":
      return "neutral";
    default:
      return "info";
  }
}
