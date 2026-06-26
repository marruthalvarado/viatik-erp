import { createCrudService } from "./_factory";
import type { Proyecto, ProyectoInsert, ProyectoUpdate } from "@/types/entities";

export const proyectosService = createCrudService<Proyecto, ProyectoInsert, ProyectoUpdate>(
  "proyectos",
  {
    empresaCol: "empresa_id",
    searchCols: ["nombre", "codigo", "descripcion"],
    defaultSort: { column: "created_at", ascending: false },
    softDeleteCol: "deleted_at",
  },
);
