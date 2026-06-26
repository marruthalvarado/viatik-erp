import { createEntityHooks } from "../_factory";
import { clientesService } from "@/services/clientes";
import type { Cliente } from "@/types/entities";

const hooks = createEntityHooks("clientes", clientesService);
export const useClientes = hooks.useList;
export const useCliente = hooks.useOne;
export const useCrearCliente = hooks.useCreate;
export const useActualizarCliente = hooks.useUpdate;
export const useEliminarCliente = hooks.useDelete;
