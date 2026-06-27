/**
 * Resumen ejecutivo del Dashboard BI.
 *
 * Contiene:
 *   · Tabla de rendiciones pendientes (drill-down a /rendiciones)
 *   · Tabla de top proveedores (drill-down a /proveedores)
 */
import { ArrowRight } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { StatusBadge } from "@/components/common/status-badge";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { RendicionEstadoRow, TopProveedorRow } from "@/types/reportes";

// ─── Rendiciones pendientes ────────────────────────────────────────────────────

interface RendicionesPendientesProps {
  data: RendicionEstadoRow[];
  loading: boolean;
  onNavigate: () => void;
}

export function BiRendicionesPendientes({ data, loading, onNavigate }: RendicionesPendientesProps) {
  const pendientes = data
    .filter((r) => r.estado_codigo === "enviada" || r.estado_codigo === "en_revision")
    .slice(0, 8);

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Rendiciones pendientes</h2>
        <button
          type="button"
          onClick={onNavigate}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
          aria-label="Ver todas las rendiciones"
        >
          Ver todas <ArrowRight className="size-3" />
        </button>
      </div>

      {loading ? (
        <LoadingState variant="skeleton" rows={4} />
      ) : pendientes.length === 0 ? (
        <EmptyState title="Sin rendiciones pendientes" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">N°</th>
                <th className="pb-2 font-medium">Usuario</th>
                <th className="pb-2 font-medium">Fecha</th>
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {pendientes.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b last:border-0 hover:bg-accent/30"
                  onClick={onNavigate}
                >
                  <td className="py-2 font-mono">{r.numero ?? "—"}</td>
                  <td className="py-2 max-w-[120px] truncate">{r.usuario_nombre ?? "—"}</td>
                  <td className="py-2 tabular-nums">{formatDate(r.fecha_rendicion)}</td>
                  <td className="py-2">
                    <StatusBadge>{r.estado_nombre ?? r.estado_codigo ?? "—"}</StatusBadge>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCurrency(r.total_facturado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── Top proveedores (tabla) ───────────────────────────────────────────────────

interface TopProveedoresTableProps {
  data: TopProveedorRow[];
  loading: boolean;
  onNavigate: () => void;
}

export function BiTopProveedoresTable({ data, loading, onNavigate }: TopProveedoresTableProps) {
  const top = data.slice(0, 8);

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Top proveedores</h2>
        <button
          type="button"
          onClick={onNavigate}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
          aria-label="Ver todos los proveedores"
        >
          Ver todos <ArrowRight className="size-3" />
        </button>
      </div>

      {loading ? (
        <LoadingState variant="skeleton" rows={4} />
      ) : top.length === 0 ? (
        <EmptyState title="Sin datos de proveedores" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Proveedor</th>
                <th className="pb-2 font-medium">Categoría</th>
                <th className="pb-2 text-right font-medium">Total</th>
                <th className="pb-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {top.map((p) => (
                <tr
                  key={p.proveedor_id}
                  className="cursor-pointer border-b last:border-0 hover:bg-accent/30"
                  onClick={onNavigate}
                >
                  <td className="py-2 max-w-[120px] truncate font-medium">{p.nombre}</td>
                  <td className="py-2 max-w-[100px] truncate text-muted-foreground">
                    {p.categoria_principal || "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(p.total)}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {p.pct_total?.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
