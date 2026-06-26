import { z } from "zod";
import type { Documento } from "@/types/entities";

export const documentoSchema = z.object({
  rendicion_id: z.string().min(1, "La rendición es requerida"),
  nombre_archivo: z.string().nullable().optional(),
  categoria_documento_id: z.string().nullable().optional(),
  tipo_documento_id: z.string().nullable().optional(),
  procesado: z.boolean().nullable().optional(),
});

export type DocumentoFormValues = z.infer<typeof documentoSchema>;

export const EMPTY_DOCUMENTO: DocumentoFormValues = {
  rendicion_id: "",
  nombre_archivo: "",
  categoria_documento_id: null,
  tipo_documento_id: null,
  procesado: false,
};

export function documentoToForm(d: Documento): DocumentoFormValues {
  return {
    rendicion_id: d.rendicion_id,
    nombre_archivo: d.nombre_archivo ?? "",
    categoria_documento_id: d.categoria_documento_id ?? null,
    tipo_documento_id: d.tipo_documento_id ?? null,
    procesado: d.procesado ?? false,
  };
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
