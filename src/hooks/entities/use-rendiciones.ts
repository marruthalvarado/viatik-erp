import { createEntityHooks } from "../_factory";
import { rendicionesService } from "@/services/rendiciones";
import type { Rendicion } from "@/types/entities";

const hooks = createEntityHooks("rendiciones", rendicionesService);
export const useRendiciones = hooks.useList;
export const useRendicion = hooks.useOne;
export const useCrearRendicion = hooks.useCreate;
export const useActualizarRendicion = hooks.useUpdate;
export const useEliminarRendicion = hooks.useDelete;
