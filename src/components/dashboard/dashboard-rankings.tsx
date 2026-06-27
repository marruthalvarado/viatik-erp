/**
 * Tablas de rankings del Dashboard Ejecutivo:
 * - Top proveedores
 * - Top viajeros
 * - Top proyectos por gasto real
 */
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import type { DashboardProveedor, DashboardProyecto, TopViajero } from "@/services/dashboard";

// ─── Panel base ────────────────────────────────────────────────────────────────

function RankingPanel({
  title,
  loading,
  empty,
  onNavigate,
  navigateLabel,
  children,
}: {
  title: string;
  loading: boolean;
  empty: boolean;
  onNavigate?: () => void;
  navigateLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {onNavigate && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onNavigate}>
            {navigateLabel ?? "Ver todos"}
            <ExternalLink className="size-3" />
          </Button>
        )}
      </div>
      {loading ? (
        <LoadingState label="Cargando..." />
      ) : empty ? (
        <EmptyState title="Sin datos" />
      ) : (
        children
      )}
    </section>
  );
}

// ─── Top Proveedores ───────────────────────────────────────────────────────────

interface TopProveedoresProps {
  data: DashboardProveedor[];
  loading: boolean;
  onNavigate: () => void;
}

export function TopProveedores({ data, loading, onNavigate }: TopProveedoresProps) {
  return (
    <RankingPanel
      title="Top proveedores"
      loading={loading}
      empty={!loading && data.length === 0}
      onNavigate={onNavigate}
      navigateLabel="Ver proveedores"
    >
      <ul className="divide-y text-sm">
        {data.slice(0, 8).map((p, i) => (
          <li key={p.id ?? i} className="flex items-center gap-3 py-2">
            <span className="w-5 shrink-0 text-xs font-medium text-muted-foreground">{i + 1}</span>
            <span className="flex-1 truncate">{p.nombre ?? "—"}</span>
            <span className="text-xs text-muted-foreground">
              {formatNumber(p.cantidad_gastos ?? 0)} gastos
            </span>
            <span className="tabular-nums font-semibold">{formatCurrency(p.total_gastado)}</span>
          </li>
        ))}
      </ul>
    </RankingPanel>
  );
}

// ─── Top Viajeros ──────────────────────────────────────────────────────────────

interface TopViajerosProps {
  data: TopViajero[];
  loading: boolean;
}

export function TopViajeros({ data, loading }: TopViajerosProps) {
  return (
    <RankingPanel title="Top viajeros" loading={loading} empty={!loading && data.length === 0}>
      <ul className="divide-y text-sm">
        {data.slice(0, 8).map((v, i) => (
          <li key={v.usuario_id} className="flex items-center gap-3 py-2">
            <span className="w-5 shrink-0 text-xs font-medium text-muted-foreground">{i + 1}</span>
            <span className="flex-1 truncate">{v.nombre || v.usuario_id}</span>
            <span className="text-xs text-muted-foreground">
              {formatNumber(v.total_rendiciones)} rendiciones
            </span>
            <span className="tabular-nums font-semibold">{formatCurrency(v.total_gastado)}</span>
          </li>
        ))}
      </ul>
    </RankingPanel>
  );
}

// ─── Top Proyectos ─────────────────────────────────────────────────────────────

interface TopProyectosProps {
  data: DashboardProyecto[];
  loading: boolean;
  onNavigate: () => void;
}

export function TopProyectos({ data, loading, onNavigate }: TopProyectosProps) {
  return (
    <RankingPanel
      title="Top proyectos por gasto"
      loading={loading}
      empty={!loading && data.length === 0}
      onNavigate={onNavigate}
      navigateLabel="Ver proyectos"
    >
      <ul className="divide-y text-sm">
        {data.slice(0, 8).map((p, i) => {
          const pct =
            p.presupuesto && p.presupuesto > 0
              ? Math.round(((p.gasto_real ?? 0) / p.presupuesto) * 100)
              : null;
          const tone: "success" | "warning" | "danger" | "neutral" =
            pct === null ? "neutral" : pct > 100 ? "danger" : pct > 85 ? "warning" : "success";

          return (
            <li key={p.proyecto_id ?? i} className="flex items-center gap-3 py-2">
              <span className="w-5 shrink-0 text-xs font-medium text-muted-foreground">
                {i + 1}
              </span>
              <span className="flex-1 truncate">{p.nombre ?? "—"}</span>
              {pct !== null && <StatusBadge tone={tone}>{pct}%</StatusBadge>}
              <span className="tabular-nums font-semibold">{formatCurrency(p.gasto_real)}</span>
            </li>
          );
        })}
      </ul>
    </RankingPanel>
  );
}
