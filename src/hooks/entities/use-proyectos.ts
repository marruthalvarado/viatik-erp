import { createEntityHooks } from "../_factory";
import { proyectosService } from "@/services/proyectos";
import type { Proyecto } from "@/types/entities";

const hooks = createEntityHooks("proyectos", proyectosService);
export const useProyectos = hooks.useList;
export const useProyecto = hooks.useOne;
export const useCrearProyecto = hooks.useCreate;
export const useActualizarProyecto = hooks.useUpdate;
export const useEliminarProyecto = hooks.useDelete;
