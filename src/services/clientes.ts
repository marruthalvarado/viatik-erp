import { createCrudService } from "./_factory";
import type { Cliente, ClienteInsert, ClienteUpdate } from "@/types/entities";

export const clientesService = createCrudService<Cliente, ClienteInsert, ClienteUpdate>(
  "clientes",
  {
    empresaCol: "empresa_id",
    searchCols: ["nombre", "nombre_comercial", "correo", "ruc", "codigo"],
    defaultSort: { column: "created_at", ascending: false },
    softDeleteCol: "deleted_at",
  },
);
