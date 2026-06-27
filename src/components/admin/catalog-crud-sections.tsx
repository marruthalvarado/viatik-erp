/**
 * catalog-crud-sections.tsx
 *
 * Conectores de sección para cada catálogo del sistema.
 * Cada export es un componente autónomo que conecta un catálogo
 * específico con SimpleCatalogCrud usando sus propios hooks.
 *
 * Importar desde catalog-crud.tsx (re-exporta todo).
 */
import {
  useCategoriasGasto,
  useCrearCategoriaGasto,
  useActualizarCategoriaGasto,
  useEliminarCategoriaGasto,
  useEstadosGasto,
  useCrearEstadoGasto,
  useActualizarEstadoGasto,
  useEliminarEstadoGasto,
  useMonedas,
  useCrearMoneda,
  useActualizarMoneda,
  useEliminarMoneda,
  useOrigenesGasto,
  useCrearOrigenGasto,
  useActualizarOrigenGasto,
  useEliminarOrigenGasto,
  useCategoriasDocumento,
  useCrearCategoriaDocumento,
  useActualizarCategoriaDocumento,
  useEliminarCategoriaDocumento,
  useTiposDocumento,
  useCrearTipoDocumento,
  useActualizarTipoDocumento,
  useEliminarTipoDocumento,
  useEstadosRendicion,
  useCrearEstadoRendicion,
  useActualizarEstadoRendicion,
  useEliminarEstadoRendicion,
  useTiposRendicion,
  useCrearTipoRendicion,
  useActualizarTipoRendicion,
  useEliminarTipoRendicion,
} from "@/hooks/entities/use-catalogs";
import { toast } from "@/components/common/toast";
import { SimpleCatalogCrud } from "./catalog-crud-base";

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
  EstadoRendicion,
  EstadoRendicionInsert,
  EstadoRendicionUpdate,
  TipoRendicion,
  TipoRendicionInsert,
  TipoRendicionUpdate,
} from "@/types/entities";

type SimpleValues = { codigo: string; nombre: string; descripcion: string | null };

// ─── Categorías de Gasto ─────────────────────────────────────────────────────

export function CatGastoSection() {
  const { data, isLoading, error } = useCategoriasGasto({ pageSize: 200 });
  const crear = useCrearCategoriaGasto();
  const actualizar = useActualizarCategoriaGasto();
  const eliminar = useEliminarCategoriaGasto();

  async function onSave(values: SimpleValues, existing: CategoriaGasto | null) {
    if (existing) {
      await actualizar.mutateAsync({ id: existing.id, payload: values as CategoriaGastoUpdate });
      toast.success("Categoría actualizada.");
    } else {
      await crear.mutateAsync(values as CategoriaGastoInsert);
      toast.success("Categoría creada.");
    }
  }

  return (
    <SimpleCatalogCrud<CategoriaGasto>
      title="Categorías de Gasto"
      rows={data?.rows ?? []}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      isPendingCreate={crear.isPending}
      isPendingUpdate={actualizar.isPending}
      isPendingDelete={eliminar.isPending}
      onSave={onSave}
      onDelete={async (id) => {
        await eliminar.mutateAsync(id);
        toast.success("Categoría eliminada.");
      }}
    />
  );
}

// ─── Categorías de Documento ─────────────────────────────────────────────────

export function CatDocumentoSection() {
  const { data, isLoading, error } = useCategoriasDocumento({ pageSize: 200 });
  const crear = useCrearCategoriaDocumento();
  const actualizar = useActualizarCategoriaDocumento();
  const eliminar = useEliminarCategoriaDocumento();

  async function onSave(values: SimpleValues, existing: CategoriaDocumento | null) {
    if (existing) {
      await actualizar.mutateAsync({
        id: existing.id,
        payload: values as CategoriaDocumentoUpdate,
      });
      toast.success("Categoría actualizada.");
    } else {
      await crear.mutateAsync(values as CategoriaDocumentoInsert);
      toast.success("Categoría creada.");
    }
  }

  return (
    <SimpleCatalogCrud<CategoriaDocumento>
      title="Categorías de Documento"
      rows={data?.rows ?? []}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      isPendingCreate={crear.isPending}
      isPendingUpdate={actualizar.isPending}
      isPendingDelete={eliminar.isPending}
      onSave={onSave}
      onDelete={async (id) => {
        await eliminar.mutateAsync(id);
        toast.success("Categoría eliminada.");
      }}
    />
  );
}

// ─── Orígenes de Gasto ───────────────────────────────────────────────────────

export function OrigenGastoSection() {
  const { data, isLoading, error } = useOrigenesGasto({ pageSize: 200 });
  const crear = useCrearOrigenGasto();
  const actualizar = useActualizarOrigenGasto();
  const eliminar = useEliminarOrigenGasto();

  async function onSave(values: SimpleValues, existing: OrigenGasto | null) {
    if (existing) {
      await actualizar.mutateAsync({ id: existing.id, payload: values as OrigenGastoUpdate });
      toast.success("Origen actualizado.");
    } else {
      await crear.mutateAsync(values as OrigenGastoInsert);
      toast.success("Origen creado.");
    }
  }

  return (
    <SimpleCatalogCrud<OrigenGasto>
      title="Orígenes de Gasto"
      rows={data?.rows ?? []}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      isPendingCreate={crear.isPending}
      isPendingUpdate={actualizar.isPending}
      isPendingDelete={eliminar.isPending}
      onSave={onSave}
      onDelete={async (id) => {
        await eliminar.mutateAsync(id);
        toast.success("Origen eliminado.");
      }}
    />
  );
}

// ─── Monedas ─────────────────────────────────────────────────────────────────

export function MonedasSection() {
  const { data, isLoading, error } = useMonedas({ pageSize: 200 });
  const crear = useCrearMoneda();
  const actualizar = useActualizarMoneda();
  const eliminar = useEliminarMoneda();

  async function onSave(values: SimpleValues, existing: (Moneda & { id: string }) | null) {
    if (existing) {
      await actualizar.mutateAsync({
        id: existing.codigo,
        payload: { nombre: values.nombre } as MonedaUpdate,
      });
      toast.success("Moneda actualizada.");
    } else {
      await crear.mutateAsync({ codigo: values.codigo, nombre: values.nombre } as MonedaInsert);
      toast.success("Moneda creada.");
    }
  }

  return (
    <SimpleCatalogCrud<Moneda & { id: string }>
      title="Monedas"
      rows={(data?.rows ?? []).map((m) => ({ ...m, id: m.codigo }))}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      pkField="id"
      isPendingCreate={crear.isPending}
      isPendingUpdate={actualizar.isPending}
      isPendingDelete={eliminar.isPending}
      onSave={onSave}
      onDelete={async (codigo) => {
        await eliminar.mutateAsync(codigo);
        toast.success("Moneda eliminada.");
      }}
    />
  );
}

// ─── Estados de Gasto ────────────────────────────────────────────────────────

export function EstadoGastoSection() {
  const { data, isLoading, error } = useEstadosGasto({ pageSize: 200 });
  const crear = useCrearEstadoGasto();
  const actualizar = useActualizarEstadoGasto();
  const eliminar = useEliminarEstadoGasto();

  async function onSave(values: SimpleValues, existing: EstadoGasto | null) {
    const payload = { codigo: values.codigo, nombre: values.nombre };
    if (existing) {
      await actualizar.mutateAsync({ id: existing.id, payload: payload as EstadoGastoUpdate });
      toast.success("Estado actualizado.");
    } else {
      await crear.mutateAsync(payload as EstadoGastoInsert);
      toast.success("Estado creado.");
    }
  }

  return (
    <SimpleCatalogCrud<EstadoGasto>
      title="Estados de Gasto"
      rows={(data?.rows ?? []).map((r) => ({ ...r, descripcion: null }))}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      isPendingCreate={crear.isPending}
      isPendingUpdate={actualizar.isPending}
      isPendingDelete={eliminar.isPending}
      onSave={onSave}
      onDelete={async (id) => {
        await eliminar.mutateAsync(id);
        toast.success("Estado eliminado.");
      }}
    />
  );
}

// ─── Estados de Rendición ────────────────────────────────────────────────────

export function EstadoRendicionSection() {
  const { data, isLoading, error } = useEstadosRendicion({ pageSize: 200 });
  const crear = useCrearEstadoRendicion();
  const actualizar = useActualizarEstadoRendicion();
  const eliminar = useEliminarEstadoRendicion();

  async function onSave(values: SimpleValues, existing: EstadoRendicion | null) {
    const payload = { codigo: values.codigo, nombre: values.nombre };
    if (existing) {
      await actualizar.mutateAsync({ id: existing.id, payload: payload as EstadoRendicionUpdate });
      toast.success("Estado actualizado.");
    } else {
      await crear.mutateAsync(payload as EstadoRendicionInsert);
      toast.success("Estado creado.");
    }
  }

  return (
    <SimpleCatalogCrud<EstadoRendicion>
      title="Estados de Rendición"
      rows={(data?.rows ?? []).map((r) => ({ ...r, descripcion: null }))}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      isPendingCreate={crear.isPending}
      isPendingUpdate={actualizar.isPending}
      isPendingDelete={eliminar.isPending}
      onSave={onSave}
      onDelete={async (id) => {
        await eliminar.mutateAsync(id);
        toast.success("Estado eliminado.");
      }}
    />
  );
}

// ─── Tipos de Rendición ──────────────────────────────────────────────────────

export function TipoRendicionSection() {
  const { data, isLoading, error } = useTiposRendicion({ pageSize: 200 });
  const crear = useCrearTipoRendicion();
  const actualizar = useActualizarTipoRendicion();
  const eliminar = useEliminarTipoRendicion();

  async function onSave(values: SimpleValues, existing: TipoRendicion | null) {
    const payload = { codigo: values.codigo, nombre: values.nombre };
    if (existing) {
      await actualizar.mutateAsync({ id: existing.id, payload: payload as TipoRendicionUpdate });
      toast.success("Tipo actualizado.");
    } else {
      await crear.mutateAsync(payload as TipoRendicionInsert);
      toast.success("Tipo creado.");
    }
  }

  return (
    <SimpleCatalogCrud<TipoRendicion>
      title="Tipos de Rendición"
      rows={(data?.rows ?? []).map((r) => ({ ...r, descripcion: null }))}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      isPendingCreate={crear.isPending}
      isPendingUpdate={actualizar.isPending}
      isPendingDelete={eliminar.isPending}
      onSave={onSave}
      onDelete={async (id) => {
        await eliminar.mutateAsync(id);
        toast.success("Tipo eliminado.");
      }}
    />
  );
}

// ─── Tipos de Documento ──────────────────────────────────────────────────────

export function TipoDocumentoSection() {
  const { data, isLoading, error } = useTiposDocumento({ pageSize: 200 });
  const crear = useCrearTipoDocumento();
  const actualizar = useActualizarTipoDocumento();
  const eliminar = useEliminarTipoDocumento();

  async function onSave(values: SimpleValues, existing: TipoDocumento | null) {
    const payload = { codigo: values.codigo, nombre: values.nombre };
    if (existing) {
      await actualizar.mutateAsync({ id: existing.id, payload: payload as TipoDocumentoUpdate });
      toast.success("Tipo actualizado.");
    } else {
      await crear.mutateAsync(payload as TipoDocumentoInsert);
      toast.success("Tipo creado.");
    }
  }

  return (
    <SimpleCatalogCrud<TipoDocumento>
      title="Tipos de Documento"
      rows={(data?.rows ?? []).map((r) => ({ ...r, descripcion: null }))}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      isPendingCreate={crear.isPending}
      isPendingUpdate={actualizar.isPending}
      isPendingDelete={eliminar.isPending}
      onSave={onSave}
      onDelete={async (id) => {
        await eliminar.mutateAsync(id);
        toast.success("Tipo eliminado.");
      }}
    />
  );
}
