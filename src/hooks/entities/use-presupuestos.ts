import { createEntityHooks } from "../_factory";
import { presupuestosService } from "@/services/presupuestos";
import type { Presupuesto } from "@/types/entities";

const hooks = createEntityHooks("presupuestos", presupuestosService);
export const usePresupuestos = hooks.useList;
export const usePresupuesto = hooks.useOne;
export const useCrearPresupuesto = hooks.useCreate;
export const useActualizarPresupuesto = hooks.useUpdate;
export const useEliminarPresupuesto = hooks.useDelete;
