import { createCrudService } from "./_factory";
import type { Proveedor, ProveedorInsert, ProveedorUpdate } from "@/types/entities";

export const proveedoresService = createCrudService<Proveedor, ProveedorInsert, ProveedorUpdate>(
  "proveedores",
  {
    empresaCol: "empresa_id",
    searchCols: ["nombre", "correo", "identificacion", "codigo", "ciudad"],
    defaultSort: { column: "created_at", ascending: false },
    softDeleteCol: "deleted_at",
  },
);
