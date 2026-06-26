import { createCrudService } from "./_factory";
import type { Viaje, ViajeInsert, ViajeUpdate } from "@/types/entities";

// `viajes` no tiene empresa_id propio: se scoping vía rendicion_id.
export const viajesService = createCrudService<Viaje, ViajeInsert, ViajeUpdate>(
  "viajes",
  {
    searchCols: ["numero", "destino", "observaciones"],
    defaultSort: { column: "fecha_inicio", ascending: false },
  },
);
