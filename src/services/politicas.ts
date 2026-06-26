import { createCrudService } from "./_factory";
import type { Politica, PoliticaInsert, PoliticaUpdate } from "@/types/entities";

/** Políticas de reembolso por empresa. */
export const politicasService = createCrudService<Politica, PoliticaInsert, PoliticaUpdate>(
  "politicas",
  {
    empresaCol: "empresa_id",
    searchCols: ["nombre", "codigo"],
    defaultSort: { column: "nombre", ascending: true },
  },
);
