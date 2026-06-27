/**
 * catalog-crud.tsx — barrel de re-exportación
 *
 * Los componentes reales viven en:
 *   - catalog-crud-base.tsx   → SimpleCatalogCrud (genérico)
 *   - catalog-crud-sections.tsx → Secciones por catálogo
 *
 * Este archivo existe para mantener compatibilidad con imports existentes.
 */
export { SimpleCatalogCrud } from "./catalog-crud-base";
export {
  CatGastoSection,
  CatDocumentoSection,
  OrigenGastoSection,
  MonedasSection,
  EstadoGastoSection,
  EstadoRendicionSection,
  TipoRendicionSection,
  TipoDocumentoSection,
} from "./catalog-crud-sections";
