import { createEntityHooks } from "../_factory";
import { viajesService } from "@/services/viajes";
import type { Viaje } from "@/types/entities";

const hooks = createEntityHooks("viajes", viajesService);
export const useViajes = hooks.useList;
export const useViaje = hooks.useOne;
export const useCrearViaje = hooks.useCreate;
export const useActualizarViaje = hooks.useUpdate;
export const useEliminarViaje = hooks.useDelete;
