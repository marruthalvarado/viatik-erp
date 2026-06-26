import { createEntityHooks } from "../_factory";
import { proveedoresService } from "@/services/proveedores";
import type { Proveedor } from "@/types/entities";

const hooks = createEntityHooks("proveedores", proveedoresService);
export const useProveedores = hooks.useList;
export const useProveedor = hooks.useOne;
export const useCrearProveedor = hooks.useCreate;
export const useActualizarProveedor = hooks.useUpdate;
export const useEliminarProveedor = hooks.useDelete;
