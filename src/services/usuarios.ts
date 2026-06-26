import { createCrudService } from "./_factory";
import type { Usuario, UsuarioInsert, UsuarioUpdate } from "@/types/entities";

// `usuarios` se relaciona con empresas vía `empresas_usuarios`.
export const usuariosService = createCrudService<Usuario, UsuarioInsert, UsuarioUpdate>(
  "usuarios",
  {
    searchCols: ["nombres", "apellidos", "cargo"],
    defaultSort: { column: "created_at", ascending: false },
    softDeleteCol: "deleted_at",
  },
);
