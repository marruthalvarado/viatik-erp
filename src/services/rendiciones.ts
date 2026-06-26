import { createCrudService } from "./_factory";
import type { Rendicion, RendicionInsert, RendicionUpdate } from "@/types/entities";

export const rendicionesService = createCrudService<Rendicion, RendicionInsert, RendicionUpdate>(
  "rendiciones",
  {
    empresaCol: "empresa_id",
    searchCols: ["numero", "descripcion"],
    defaultSort: { column: "fecha_rendicion", ascending: false },
    softDeleteCol: "deleted_at",
  },
);
