/**
 * Servicios de catálogos: tablas de referencia sin empresa_id ni soft-delete.
 * Generados con createCrudService sin empresaCol.
 */
import { createCrudService } from "./_factory";
import type {
  CategoriaGasto,
  CategoriaGastoInsert,
  CategoriaGastoUpdate,
  EstadoGasto,
  EstadoGastoInsert,
  EstadoGastoUpdate,
  Moneda,
  MonedaInsert,
  MonedaUpdate,
  OrigenGasto,
  OrigenGastoInsert,
  OrigenGastoUpdate,
  CategoriaDocumento,
  CategoriaDocumentoInsert,
  CategoriaDocumentoUpdate,
  TipoDocumento,
  TipoDocumentoInsert,
  TipoDocumentoUpdate,
} from "@/types/entities";

export const categoriasGastoService = createCrudService<
  CategoriaGasto,
  CategoriaGastoInsert,
  CategoriaGastoUpdate
>("categorias_gasto", {
  searchCols: ["nombre", "codigo"],
  defaultSort: { column: "nombre", ascending: true },
});

export const estadosGastoService = createCrudService<
  EstadoGasto,
  EstadoGastoInsert,
  EstadoGastoUpdate
>("estados_gasto", {
  searchCols: ["nombre", "codigo"],
  defaultSort: { column: "nombre", ascending: true },
});

// monedas usa 'codigo' como PK (no 'id')
export const monedasService = createCrudService<Moneda, MonedaInsert, MonedaUpdate>("monedas", {
  pk: "codigo",
  searchCols: ["nombre", "codigo"],
  defaultSort: { column: "nombre", ascending: true },
});

export const origenesGastoService = createCrudService<
  OrigenGasto,
  OrigenGastoInsert,
  OrigenGastoUpdate
>("origenes_gasto", {
  searchCols: ["nombre", "codigo"],
  defaultSort: { column: "nombre", ascending: true },
});

export const categoriasDocumentoService = createCrudService<
  CategoriaDocumento,
  CategoriaDocumentoInsert,
  CategoriaDocumentoUpdate
>("categorias_documento", {
  searchCols: ["nombre", "codigo"],
  defaultSort: { column: "nombre", ascending: true },
});

export const tiposDocumentoService = createCrudService<
  TipoDocumento,
  TipoDocumentoInsert,
  TipoDocumentoUpdate
>("tipos_documento", {
  searchCols: ["nombre", "codigo"],
  defaultSort: { column: "nombre", ascending: true },
});

import type {
  EstadoRendicion,
  EstadoRendicionInsert,
  EstadoRendicionUpdate,
  TipoRendicion,
  TipoRendicionInsert,
  TipoRendicionUpdate,
} from "@/types/entities";

export const estadosRendicionService = createCrudService<
  EstadoRendicion,
  EstadoRendicionInsert,
  EstadoRendicionUpdate
>("estados_rendicion", {
  searchCols: ["nombre", "codigo"],
  defaultSort: { column: "nombre", ascending: true },
});

export const tiposRendicionService = createCrudService<
  TipoRendicion,
  TipoRendicionInsert,
  TipoRendicionUpdate
>("tipos_rendicion", {
  searchCols: ["nombre", "codigo"],
  defaultSort: { column: "nombre", ascending: true },
});
