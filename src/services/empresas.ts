import { createCrudService } from "./_factory";
import type { Empresa, EmpresaInsert, EmpresaUpdate } from "@/types/entities";

export const empresasService = createCrudService<Empresa, EmpresaInsert, EmpresaUpdate>(
  "empresas",
  {
    searchCols: ["nombre", "ruc", "codigo", "correo"],
    defaultSort: { column: "created_at", ascending: false },
    softDeleteCol: "deleted_at",
  },
);
