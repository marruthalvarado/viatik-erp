import { createEntityHooks } from "../_factory";
import { usuariosService } from "@/services/usuarios";
import type { Usuario } from "@/types/entities";

const hooks = createEntityHooks("usuarios", usuariosService);
export const useUsuarios = hooks.useList;
export const useUsuario = hooks.useOne;
export const useCrearUsuario = hooks.useCreate;
export const useActualizarUsuario = hooks.useUpdate;
export const useEliminarUsuario = hooks.useDelete;
