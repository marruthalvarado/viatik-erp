import { createEntityHooks } from "../_factory";
import { parametrosService } from "@/services/parametros";

const hooks = createEntityHooks("parametros_sistema", parametrosService);
export const useParametros = hooks.useList;
export const useParametro = hooks.useOne;
export const useCrearParametro = hooks.useCreate;
export const useActualizarParametro = hooks.useUpdate;
export const useEliminarParametro = hooks.useDelete;
