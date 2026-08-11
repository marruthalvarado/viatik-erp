/**
 * use-inventario.ts
 * Hooks para el módulo de inventario de bodega.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/contexts/company-context";
import {
  getProductosCatalogo, createProducto, updateProducto, deleteProducto,
  getImportaciones, getImportacion, createImportacion, updateImportacion,
  upsertLineas, recalcularProrrateo, generarUnidades,
  getUnidades, createUnidad, updateUnidad, registrarMovimiento, getMovimientos,
  getResumenInventario,
  type ProductoPayload, type ImportacionPayload, type ImportacionLineaPayload,
  type UnidadPayload, type MovimientoPayload,
} from "@/services/inventario";

// ── Productos catálogo ───────────────────────────────────────────────────────
export function useProductosCatalogo() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["productos_catalogo", empresaActivaId],
    queryFn: () => getProductosCatalogo(empresaActivaId!),
    enabled: !!empresaActivaId,
  });
}

export function useCreateProducto() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: (payload: ProductoPayload) => createProducto(payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["productos_catalogo", empresaActivaId] }),
  });
}

export function useUpdateProducto() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProductoPayload> }) =>
      updateProducto(id, payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["productos_catalogo", empresaActivaId] }),
  });
}

export function useDeleteProducto() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: (id: string) => deleteProducto(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["productos_catalogo", empresaActivaId] }),
  });
}

// ── Importaciones ─────────────────────────────────────────────────────────────
export function useImportaciones() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["importaciones", empresaActivaId],
    queryFn: () => getImportaciones(empresaActivaId!),
    enabled: !!empresaActivaId,
  });
}

export function useImportacion(id: string | undefined) {
  return useQuery({
    queryKey: ["importacion", id],
    queryFn: () => getImportacion(id!),
    enabled: !!id,
  });
}

export function useCreateImportacion() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({ payload, lineas }: { payload: ImportacionPayload; lineas: ImportacionLineaPayload[] }) =>
      createImportacion(payload, lineas),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["importaciones", empresaActivaId] }),
  });
}

export function useUpdateImportacion() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ImportacionPayload> }) =>
      updateImportacion(id, payload),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: ["importaciones", empresaActivaId] });
      void qc.invalidateQueries({ queryKey: ["importacion", id] });
    },
  });
}

export function useUpsertLineas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ importacion_id, lineas }: { importacion_id: string; lineas: ImportacionLineaPayload[] }) =>
      upsertLineas(importacion_id, lineas),
    onSuccess: (_, { importacion_id }) =>
      void qc.invalidateQueries({ queryKey: ["importacion", importacion_id] }),
  });
}

export function useRecalcularProrrateo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (importacion_id: string) => recalcularProrrateo(importacion_id),
    onSuccess: (_, importacion_id) =>
      void qc.invalidateQueries({ queryKey: ["importacion", importacion_id] }),
  });
}

export function useGenerarUnidades() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: (importacion_id: string) => generarUnidades(importacion_id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventario_unidades", empresaActivaId] });
      void qc.invalidateQueries({ queryKey: ["importaciones", empresaActivaId] });
      void qc.invalidateQueries({ queryKey: ["inventario_resumen", empresaActivaId] });
    },
  });
}

// ── Unidades de inventario ───────────────────────────────────────────────────
export function useUnidades(filtros?: { estado?: string; producto_id?: string; bodega_id?: string }) {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["inventario_unidades", empresaActivaId, filtros],
    queryFn: () => getUnidades(empresaActivaId!, filtros),
    enabled: !!empresaActivaId,
  });
}

export function useCreateUnidad() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: (payload: UnidadPayload) => createUnidad(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventario_unidades", empresaActivaId] });
      void qc.invalidateQueries({ queryKey: ["inventario_resumen", empresaActivaId] });
    },
  });
}

export function useUpdateUnidad() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateUnidad>[1] }) =>
      updateUnidad(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventario_unidades", empresaActivaId] });
      void qc.invalidateQueries({ queryKey: ["inventario_resumen", empresaActivaId] });
    },
  });
}

export function useRegistrarMovimiento() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: (payload: MovimientoPayload) => registrarMovimiento(payload),
    onSuccess: (_, payload) => {
      void qc.invalidateQueries({ queryKey: ["inventario_unidades", empresaActivaId] });
      void qc.invalidateQueries({ queryKey: ["movimientos", payload.unidad_id] });
      void qc.invalidateQueries({ queryKey: ["inventario_resumen", empresaActivaId] });
    },
  });
}

export function useMovimientos(unidad_id: string | undefined) {
  return useQuery({
    queryKey: ["movimientos", unidad_id],
    queryFn: () => getMovimientos(unidad_id!),
    enabled: !!unidad_id,
  });
}

export function useResumenInventario() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["inventario_resumen", empresaActivaId],
    queryFn: () => getResumenInventario(empresaActivaId!),
    enabled: !!empresaActivaId,
  });
}

// ── Bodegas (sucursales) ─────────────────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";

export function useBodegas() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["bodegas", empresaActivaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sucursales")
        .select("id, nombre")
        .eq("empresa_id", empresaActivaId!)
        .is("deleted_at", null)
        .order("nombre");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!empresaActivaId,
  });
}
