/**
 * SortableHeader — <th> clickable con indicador de sort.
 * Utilitarios applySort + applyColFilters para sort/filter client-side.
 * Compartido por todos los módulos de lista del ERP.
 */
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SortState {
  col: string | null;
  dir: "asc" | "desc";
}

export type RowValue = string | number | boolean | null | undefined;

// ─── SortableHeader ───────────────────────────────────────────────────────────

interface SortableHeaderProps {
  label: string;
  col: string;
  sort: SortState;
  onSort: (col: string) => void;
  align?: "left" | "right";
  className?: string;
}

export function SortableHeader({
  label,
  col,
  sort,
  onSort,
  align = "left",
  className,
}: SortableHeaderProps) {
  const active = sort.col === col;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      className={cn(
        "px-4 py-3 font-medium cursor-pointer select-none whitespace-nowrap group",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      onClick={() => onSort(col)}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon
          className={cn(
            "size-3 shrink-0 transition-opacity",
            active ? "opacity-70" : "opacity-0 group-hover:opacity-40",
          )}
        />
      </span>
    </th>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Toggle sort: mismo col → flip dir; col distinto → asc. */
export function nextSort(prev: SortState, col: string): SortState {
  return prev.col === col
    ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
    : { col, dir: "asc" };
}

/** Ordena una copia de `data` según `sort` usando `getValue` para extraer valores. */
export function applySort<T>(
  data: T[],
  sort: SortState,
  getValue: (row: T, col: string) => RowValue,
): T[] {
  if (!sort.col) return data;
  const col = sort.col;
  return [...data].sort((a, b) => {
    const va = getValue(a, col);
    const vb = getValue(b, col);
    if (va === vb) return 0;
    if (typeof va === "number" && typeof vb === "number") {
      return sort.dir === "asc" ? va - vb : vb - va;
    }
    const sa = String(va ?? "").toLowerCase();
    const sb = String(vb ?? "").toLowerCase();
    const cmp = sa.localeCompare(sb, "es");
    return sort.dir === "asc" ? cmp : -cmp;
  });
}

/** Filtra `data` por texto en cada columna activa de `filters`. */
export function applyColFilters<T>(
  data: T[],
  filters: Record<string, string>,
  getValue: (row: T, col: string) => RowValue,
): T[] {
  const active = Object.entries(filters).filter(([, v]) => v.trim());
  if (!active.length) return data;
  return data.filter((row) =>
    active.every(([col, val]) =>
      String(getValue(row, col) ?? "")
        .toLowerCase()
        .includes(val.toLowerCase().trim()),
    ),
  );
}

// ─── SortableHeaderContent ────────────────────────────────────────────────────
// Versión sin <th> para usar dentro del `header: ReactNode` de DataTable.

interface SortableHeaderContentProps {
  label: string;
  col: string;
  sort: SortState;
  onSort: (col: string) => void;
  align?: "left" | "right";
}

export function SortableHeaderContent({
  label,
  col,
  sort,
  onSort,
  align = "left",
}: SortableHeaderContentProps) {
  const active = sort.col === col;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={cn(
        "group inline-flex items-center gap-1 cursor-pointer select-none whitespace-nowrap",
        align === "right" && "flex-row-reverse",
      )}
    >
      {label}
      <Icon
        className={cn(
          "size-3 shrink-0 transition-opacity",
          active ? "opacity-70" : "opacity-0 group-hover:opacity-40",
        )}
      />
    </button>
  );
}

// ─── Filter input cell ────────────────────────────────────────────────────────

interface FilterCellProps {
  col: string;
  filters: Record<string, string>;
  onChange: (col: string, val: string) => void;
  align?: "left" | "right";
  placeholder?: string;
}

export function FilterCell({
  col,
  filters,
  onChange,
  align = "left",
  placeholder = "Filtrar…",
}: FilterCellProps) {
  return (
    <td className="px-2 py-1">
      <input
        type="text"
        value={filters[col] ?? ""}
        onChange={(e) => onChange(col, e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded border border-muted bg-background px-2 py-0.5 text-[10px]",
          "text-foreground placeholder:text-muted-foreground/50",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          align === "right" && "text-right",
        )}
      />
    </td>
  );
}
