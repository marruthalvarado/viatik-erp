import { createCrudService } from "./_factory";
import type {
  ParametroSistema,
  ParametroSistemaInsert,
  ParametroSistemaUpdate,
} from "@/types/entities";

/** Parámetros de sistema por empresa. */
export const parametrosService = createCrudService<
  ParametroSistema,
  ParametroSistemaInsert,
  ParametroSistemaUpdate
>("parametros_sistema", {
  empresaCol: "empresa_id",
  searchCols: ["clave", "descripcion"],
  defaultSort: { column: "clave", ascending: true },
});
