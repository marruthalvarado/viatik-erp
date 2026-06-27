/**
 * Tarjetas KPI del Dashboard Ejecutivo.
 * Consume vw_dashboard_ejecutivo + presupuesto activo + IA score.
 */
import {
  Wallet,
  Receipt,
  ClipboardList,
  TrendingUp,
  Brain,
  Users,
  ArrowDownLeft,
  FolderKanban,
} from "lucide-react";

import { MetricCard } from "@/components/common/metric-card";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import type { DashboardEjecutivo, DashboardIA } from "@/services/dashboard";

interface DashboardKpisProps {
  ejecutivo: DashboardEjecutivo | null | undefined;
  presupuestoTotal: number;
  ia: DashboardIA | null | undefined;
  loading: boolean;
}

export function DashboardKpis({ ejecutivo, presupuestoTotal, ia, loading }: DashboardKpisProps) {
  const dash = ejecutivo;
  const v = (n: number | null | undefined) => formatCurrency(n ?? 0);
  const n = (x: number | null | undefined) => formatNumber(x ?? 0);
  const blank = loading ? "—" : undefined;

  return (
    <div className="space-y-4">
      {/* Fila 1 — financieros */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total gastado" value={blank ?? v(dash?.total_gastado)} icon={Wallet} />
        <MetricCard
          label="Reembolsable"
          value={blank ?? v(dash?.total_reembolsable)}
          icon={ArrowDownLeft}
        />
        <MetricCard label="Anticipos" value={blank ?? v(dash?.total_anticipos)} icon={Receipt} />
        <MetricCard
          label="Presupuesto activo"
          value={blank ?? v(presupuestoTotal)}
          icon={TrendingUp}
          hint={
            presupuestoTotal > 0 && dash?.total_gastado
              ? `${Math.round((dash.total_gastado / presupuestoTotal) * 100)}% ejecutado`
              : undefined
          }
        />
      </div>

      {/* Fila 2 — operativos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Rendiciones"
          value={blank ?? n(dash?.total_rendiciones)}
          icon={ClipboardList}
        />
        <MetricCard
          label="Proyectos activos"
          value={blank ?? n(dash?.total_proyectos_con_movimiento)}
          icon={FolderKanban}
        />
        <MetricCard
          label="Viajeros activos"
          value={blank ?? n(dash?.total_usuarios_con_movimiento)}
          icon={Users}
        />
        <MetricCard
          label="Score IA promedio"
          value={
            loading
              ? "—"
              : ia?.score_promedio !== null && ia?.score_promedio !== undefined
                ? Number(ia.score_promedio).toFixed(1)
                : "—"
          }
          hint={ia?.total_auditorias ? `${n(ia.total_auditorias)} auditorías` : undefined}
          icon={Brain}
        />
      </div>
    </div>
  );
}
