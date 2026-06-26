import { createEntityHooks } from "../_factory";
import { politicasService } from "@/services/politicas";

const hooks = createEntityHooks("politicas", politicasService);
export const usePoliticas = hooks.useList;
export const usePolitica = hooks.useOne;
export const useCrearPolitica = hooks.useCreate;
export const useActualizarPolitica = hooks.useUpdate;
export const useEliminarPolitica = hooks.useDelete;
