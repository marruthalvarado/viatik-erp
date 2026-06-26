import { createEntityHooks } from "../_factory";
import { rolesService } from "@/services/roles";

const hooks = createEntityHooks("roles", rolesService);
export const useRoles = hooks.useList;
export const useRol = hooks.useOne;
export const useCrearRol = hooks.useCreate;
export const useActualizarRol = hooks.useUpdate;
export const useEliminarRol = hooks.useDelete;
