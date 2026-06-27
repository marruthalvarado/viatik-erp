import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";

import type { CrudService } from "@/services/_factory";
import type { ID, ListParams, Paginated } from "@/types/common";
import { useCompany } from "@/contexts/company-context";

/**
 * Hooks CRUD estandarizados sobre TanStack Query a partir de un servicio
 * generado con `createCrudService`. Incluye:
 *  - scoping automático por empresa_id activa
 *  - cache + invalidación
 *  - paginación, búsqueda, filtros (vía ListParams)
 *  - estados de loading/error de TanStack Query
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCrudService = CrudService<any, any, any>;

// `any` en posiciones no inferidas es necesario: TInsert/TUpdate aparecen en
// posiciones contravariantes (parámetros de función), lo que hace que `unknown`
// falle la condición y los tipos resuelvan a `never`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RowOf<S> = S extends CrudService<infer R, any, any> ? R : never;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InsertOf<S> = S extends CrudService<any, infer I, any> ? I : never;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UpdateOf<S> = S extends CrudService<any, any, infer U> ? U : never;

export function createEntityHooks<S extends AnyCrudService>(key: string, service: S) {
  type TRow = RowOf<S>;
  type TInsert = InsertOf<S>;
  type TUpdate = UpdateOf<S>;

  function useList(
    params: ListParams = {},
    options?: Omit<UseQueryOptions<Paginated<TRow>>, "queryKey" | "queryFn">,
  ) {
    const { empresaActivaId } = useCompany();
    const empresaId = service.empresaCol ? (params.empresaId ?? empresaActivaId) : undefined;
    const finalParams: ListParams = { ...params, empresaId };

    return useQuery<Paginated<TRow>>({
      queryKey: [key, "list", finalParams],
      queryFn: () => service.listar(finalParams),
      staleTime: 2 * 60_000, // 2 min — dato CRUD tiene ciclo de vida razonable
      ...options,
    });
  }

  function useOne(
    id: ID | null | undefined,
    options?: Omit<UseQueryOptions<TRow | null>, "queryKey" | "queryFn">,
  ) {
    return useQuery<TRow | null>({
      queryKey: [key, "one", id],
      queryFn: () => service.obtener(id as ID),
      enabled: !!id,
      staleTime: 5 * 60_000, // 5 min — registros individuales cambian poco
      ...options,
    });
  }

  function useCreate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (payload: TInsert) => service.crear(payload),
      onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
    });
  }

  function useUpdate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, payload }: { id: ID; payload: TUpdate }) =>
        service.actualizar(id, payload),
      onSuccess: (_data, vars) => {
        qc.invalidateQueries({ queryKey: [key] });
        qc.invalidateQueries({ queryKey: [key, "one", vars.id] });
      },
    });
  }

  function useDelete() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id: ID) => service.eliminar(id),
      onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
    });
  }

  return { useList, useOne, useCreate, useUpdate, useDelete };
}
