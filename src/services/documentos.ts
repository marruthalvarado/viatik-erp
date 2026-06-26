import { createCrudService } from "./_factory";
import type { Documento, DocumentoInsert, DocumentoUpdate } from "@/types/entities";

export const documentosService = createCrudService<Documento, DocumentoInsert, DocumentoUpdate>(
  "documentos",
  {
    empresaCol: "empresa_id",
    searchCols: ["nombre_archivo", "hash_archivo"],
    defaultSort: { column: "created_at", ascending: false },
    softDeleteCol: "deleted_at",
  },
);
