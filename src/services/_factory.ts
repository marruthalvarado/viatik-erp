import { supabase } from "@/integrations/supabase/client";
import type { ListParams, Paginated, ID } from "@/types/common";

export interface CrudServiceOptions {
  /** Columna PK (default: 'id'). */
  pk?: string;
  /** Columna para scoping multi-empresa (ej: 'empresa_id'). Opcional. */
  empresaCol?: string;
  /** Columna(s) a usar en búsqueda ILIKE. */
  searchCols?: string[];
  /** Columnas a seleccionar por defecto. */
  selectCols?: string;
  /** Orden por defecto. */
  defaultSort?: { column: string; ascending: boolean };
  /** Filtra registros con soft-delete (default false). */
  softDeleteCol?: string;
}

/**
 * Fábrica genérica de servicios CRUD sobre Supabase.
 * Todas las consultas a `supabase.from(...)` pasan por aquí.
 */
export function createCrudService<TRow = unknown, TInsert = Partial<TRow>, TUpdate = Partial<TRow>>(
  table: string,
  options: CrudServiceOptions = {},
) {
  const {
    pk = "id",
    empresaCol,
    searchCols = [],
    selectCols = "*",
    defaultSort,
    softDeleteCol,
  } = options;

  // `as never` evita la unión gigante de nombres de tabla en el genérico.
  const from = () => supabase.from(table as never);

  async function listar(params: ListParams = {}): Promise<Paginated<TRow>> {
    const {
      page = 1,
      pageSize = 25,
      search,
      sortBy,
      sortDir = "desc",
      filters,
      empresaId,
    } = params;

    let q = from().select(selectCols, { count: "exact" }) as unknown as {
      eq: (c: string, v: unknown) => typeof q;
      is: (c: string, v: unknown) => typeof q;
      or: (s: string) => typeof q;
      order: (c: string, o: { ascending: boolean }) => typeof q;
      range: (a: number, b: number) => Promise<{
        data: TRow[] | null;
        error: { message: string } | null;
        count: number | null;
      }>;
    };

    if (empresaCol && empresaId) q = q.eq(empresaCol, empresaId);
    if (softDeleteCol) q = q.is(softDeleteCol, null);

    if (filters) {
      for (const [col, val] of Object.entries(filters)) {
        if (val === undefined || val === null || val === "") continue;
        q = q.eq(col, val);
      }
    }

    if (search && searchCols.length > 0) {
      const safe = search.replace(/[%,()]/g, "");
      q = q.or(searchCols.map((c) => `${c}.ilike.%${safe}%`).join(","));
    }

    const sort = sortBy
      ? { column: sortBy, ascending: sortDir === "asc" }
      : defaultSort;
    if (sort) q = q.order(sort.column, { ascending: sort.ascending });

    const fromIdx = (page - 1) * pageSize;
    const { data, error, count } = await q.range(fromIdx, fromIdx + pageSize - 1);
    if (error) throw new Error(error.message);

    return { rows: data ?? [], total: count ?? 0, page, pageSize };
  }

  async function obtener(id: ID): Promise<TRow | null> {
    const { data, error } = await from()
      .select(selectCols)
      .eq(pk, id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as TRow | null) ?? null;
  }

  async function crear(payload: TInsert): Promise<TRow> {
    const { data, error } = await from()
      .insert(payload as never)
      .select(selectCols)
      .single();
    if (error) throw new Error(error.message);
    return data as TRow;
  }

  async function actualizar(id: ID, payload: TUpdate): Promise<TRow> {
    const { data, error } = await from()
      .update(payload as never)
      .eq(pk, id)
      .select(selectCols)
      .single();
    if (error) throw new Error(error.message);
    return data as TRow;
  }

  async function eliminar(id: ID): Promise<void> {
    const { error } = await from().delete().eq(pk, id);
    if (error) throw new Error(error.message);
  }

  return {
    table,
    pk,
    empresaCol,
    from,
    listar,
    obtener,
    crear,
    actualizar,
    eliminar,
  };
}

export type CrudService<
  TRow = unknown,
  TInsert = Partial<TRow>,
  TUpdate = Partial<TRow>,
> = ReturnType<typeof createCrudService<TRow, TInsert, TUpdate>>;
