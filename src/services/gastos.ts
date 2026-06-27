import { createCrudService } from "./_factory";
import type { Gasto, GastoInsert, GastoUpdate } from "@/types/entities";

export const gastosService = createCrudService<Gasto, GastoInsert, GastoUpdate>("gastos", {
  empresaCol: "empresa_id",
  searchCols: ["descripcion", "numero_documento", "observaciones"],
  defaultSort: { column: "fecha", ascending: false },
  softDeleteCol: "deleted_at",
});
