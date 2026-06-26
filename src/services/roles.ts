import { createCrudService } from "./_factory";
import type { Rol, RolInsert, RolUpdate } from "@/types/entities";

/** Roles globales — sin empresa_id ni soft-delete. */
export const rolesService = createCrudService<Rol, RolInsert, RolUpdate>("roles", {
  searchCols: ["nombre", "codigo"],
  defaultSort: { column: "nombre", ascending: true },
});
