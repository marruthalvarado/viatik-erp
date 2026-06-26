/**
 * Hooks para tablas de catálogo (sin empresa_id ni soft-delete).
 * Exporta los 5 hooks por catálogo para soportar CRUD completo en Admin.
 */
import { createEntityHooks } from "../_factory";
import {
  categoriasGastoService,
  estadosGastoService,
  monedasService,
  origenesGastoService,
  categoriasDocumentoService,
  tiposDocumentoService,
  estadosRendicionService,
  tiposRendicionService,
} from "@/services/catalogs";

// Categorias de Gasto
const cgHooks = createEntityHooks("categorias_gasto", categoriasGastoService);
export const useCategoriasGasto = cgHooks.useList;
export const useCrearCategoriaGasto = cgHooks.useCreate;
export const useActualizarCategoriaGasto = cgHooks.useUpdate;
export const useEliminarCategoriaGasto = cgHooks.useDelete;

// Estados de Gasto
const egHooks = createEntityHooks("estados_gasto", estadosGastoService);
export const useEstadosGasto = egHooks.useList;
export const useCrearEstadoGasto = egHooks.useCreate;
export const useActualizarEstadoGasto = egHooks.useUpdate;
export const useEliminarEstadoGasto = egHooks.useDelete;

// Monedas
const monHooks = createEntityHooks("monedas", monedasService);
export const useMonedas = monHooks.useList;
export const useCrearMoneda = monHooks.useCreate;
export const useActualizarMoneda = monHooks.useUpdate;
export const useEliminarMoneda = monHooks.useDelete;

// Origenes de Gasto
const ogHooks = createEntityHooks("origenes_gasto", origenesGastoService);
export const useOrigenesGasto = ogHooks.useList;
export const useCrearOrigenGasto = ogHooks.useCreate;
export const useActualizarOrigenGasto = ogHooks.useUpdate;
export const useEliminarOrigenGasto = ogHooks.useDelete;

// Categorias de Documento
const cdHooks = createEntityHooks("categorias_documento", categoriasDocumentoService);
export const useCategoriasDocumento = cdHooks.useList;
export const useCrearCategoriaDocumento = cdHooks.useCreate;
export const useActualizarCategoriaDocumento = cdHooks.useUpdate;
export const useEliminarCategoriaDocumento = cdHooks.useDelete;

// Tipos de Documento
const tdHooks = createEntityHooks("tipos_documento", tiposDocumentoService);
export const useTiposDocumento = tdHooks.useList;
export const useCrearTipoDocumento = tdHooks.useCreate;
export const useActualizarTipoDocumento = tdHooks.useUpdate;
export const useEliminarTipoDocumento = tdHooks.useDelete;

// Estados de Rendicion
const erHooks = createEntityHooks("estados_rendicion", estadosRendicionService);
export const useEstadosRendicion = erHooks.useList;
export const useCrearEstadoRendicion = erHooks.useCreate;
export const useActualizarEstadoRendicion = erHooks.useUpdate;
export const useEliminarEstadoRendicion = erHooks.useDelete;

// Tipos de Rendicion
const trHooks = createEntityHooks("tipos_rendicion", tiposRendicionService);
export const useTiposRendicion = trHooks.useList;
export const useCrearTipoRendicion = trHooks.useCreate;
export const useActualizarTipoRendicion = trHooks.useUpdate;
export const useEliminarTipoRendicion = trHooks.useDelete;
