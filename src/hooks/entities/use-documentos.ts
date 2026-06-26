import { createEntityHooks } from "../_factory";
import { documentosService } from "@/services/documentos";
import type { Documento } from "@/types/entities";

const hooks = createEntityHooks("documentos", documentosService);
export const useDocumentos = hooks.useList;
export const useDocumento = hooks.useOne;
export const useCrearDocumento = hooks.useCreate;
export const useActualizarDocumento = hooks.useUpdate;
export const useEliminarDocumento = hooks.useDelete;
