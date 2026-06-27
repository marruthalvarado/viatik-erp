import { createCrudService } from "./_factory";
import type { Presupuesto, PresupuestoInsert, PresupuestoUpdate } from "@/types/entities";

export const presupuestosService = createCrudService<
  Presupuesto,
  PresupuestoInsert,
  PresupuestoUpdate
>("presupuestos", {
  empresaCol: "empresa_id",
  searchCols: ["nombre", "codigo", "descripcion"],
  defaultSort: { column: "anio", ascending: false },
});
