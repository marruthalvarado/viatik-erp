import { createEntityHooks } from "../_factory";
import { empresasService } from "@/services/empresas";
import type { Empresa } from "@/types/entities";

const hooks = createEntityHooks("empresas", empresasService);
export const useEmpresas = hooks.useList;
export const useEmpresa = hooks.useOne;
export const useCrearEmpresa = hooks.useCreate;
export const useActualizarEmpresa = hooks.useUpdate;
export const useEliminarEmpresa = hooks.useDelete;
