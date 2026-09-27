/**
 * use-cotizaciones.ts
 * Hooks React para el módulo de Cotizaciones.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/contexts/company-context";
import {
  getCotizaciones,
  getCotizacion,
  crearCotizacion,
  actualizarCotizacion,
  actualizarEstadoCotizacion,
  convertirCotizacionAFactura,
  getProductosCatalogoCotizar,
  createProductoCatalogo,
  updateProductoCatalogo,
  deleteProductoCatalogo,
  type CotizacionDatos,
  type CotizacionItemPayload,
  type EstadoCotizacion,
} from "@/services/cotizaciones";
import type { Database } from "@/types/database";

// ── Cotizaciones ─────────────────────────────────────────────────────────────

export function useCotizaciones() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["cotizaciones", empresaActivaId],
    queryFn: () => getCotizaciones(empresaActivaId!),
    enabled: !!empresaActivaId,
  });
}

export function useCotizacion(id: string | null | undefined) {
  return useQuery({
    queryKey: ["cotizacion", id],
    queryFn: () => getCotizacion(id!),
    enabled: !!id,
  });
}

export function useCrearCotizacion() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({
      datos,
      items,
    }: {
      datos: CotizacionDatos;
      items: CotizacionItemPayload[];
    }) => crearCotizacion(empresaActivaId!, datos, items),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["cotizaciones", empresaActivaId] }),
  });
}

export function useActualizarCotizacion() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({
      id,
      datos,
      items,
    }: {
      id: string;
      datos: CotizacionDatos;
      items: CotizacionItemPayload[];
    }) => actualizarCotizacion(id, datos, items),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: ["cotizaciones", empresaActivaId] });
      void qc.invalidateQueries({ queryKey: ["cotizacion", id] });
    },
  });
}

export function useActualizarEstadoCotizacion() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoCotizacion }) =>
      actualizarEstadoCotizacion(id, estado),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: ["cotizaciones", empresaActivaId] });
      void qc.invalidateQueries({ queryKey: ["cotizacion", id] });
    },
  });
}

export function useConvertirAFactura() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({
      cotizacion_id,
      numero_factura,
    }: {
      cotizacion_id: string;
      numero_factura?: string;
    }) => convertirCotizacionAFactura(cotizacion_id, numero_factura),
    onSuccess: (_, { cotizacion_id }) => {
      void qc.invalidateQueries({ queryKey: ["cotizaciones", empresaActivaId] });
      void qc.invalidateQueries({ queryKey: ["cotizacion", cotizacion_id] });
      void qc.invalidateQueries({ queryKey: ["facturas", empresaActivaId] });
    },
  });
}

// ── Catálogo de productos ────────────────────────────────────────────────────

export function useCatalogoCotizar() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["catalogo_cotizar", empresaActivaId],
    queryFn: () => getProductosCatalogoCotizar(empresaActivaId!),
    enabled: !!empresaActivaId,
  });
}

type ProductoInsert = Database["public"]["Tables"]["productos_catalogo"]["Insert"];
type ProductoUpdate = Database["public"]["Tables"]["productos_catalogo"]["Update"];

export function useCreateProductoCatalogo() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: (payload: ProductoInsert) => createProductoCatalogo(payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["catalogo_cotizar", empresaActivaId] }),
  });
}

export function useUpdateProductoCatalogo() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProductoUpdate }) =>
      updateProductoCatalogo(id, payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["catalogo_cotizar", empresaActivaId] }),
  });
}

export function useDeleteProductoCatalogo() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: (id: string) => deleteProductoCatalogo(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["catalogo_cotizar", empresaActivaId] }),
  });
}
