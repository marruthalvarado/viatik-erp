import { createEntityHooks } from "../_factory";
import { gastosService } from "@/services/gastos";
import type { Gasto } from "@/types/entities";

const hooks = createEntityHooks("gastos", gastosService);
export const useGastos = hooks.useList;
export const useGasto = hooks.useOne;
export const useCrearGasto = hooks.useCreate;
export const useActualizarGasto = hooks.useUpdate;
export const useEliminarGasto = hooks.useDelete;
