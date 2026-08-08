/**
 * KPIs del Dashboard — orientados al negocio.
 * Fila 1: Ingresos, Costos, Margen, Por cobrar
 * Fila 2: Rendiciones, Proyectos, Viajeros, Score IA
 */
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  ClipboardList,
  FolderKanban,
  Users,
  Brain,
  Wallet,
  Clock,
} from "lucide-react";

import { MetricCard } from "@/components/common/metric-card";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import type { DashboardEjecutivo, DashboardIA, KpisNegocio } from "@/services/dashboard";

interface DashboardKpisProps {
  ejecutivo: DashboardEjecutivo | null | undefined;
  kpisNegocio: KpisNegocio | null | undefined;
  ia: DashboardIA | null | undefined;
  loading: boolean;
}

export function DashboardKpis({ ejecutivo, kpisNegocio, ia, loading }: DashboardKpisProps) {
  const v = (n: number | null | undefined) => formatCurrency(n ?? 0);
  const n = (x: number | null | undefined) => formatNumber(x ?? 0);
  const blank = loading ? "—" : undefined;

  const margen = kpisNegocio?.margen ?? 0;
  const margenPct = kpisNegocio?.margen_pct;
  const margenPositivo = margen >= 0;

  return (
    <div className="space-y-4">
      {/* Fila 1 — KPIs financieros del negocio */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Ingresos"
          value={blank ?? v(kpisNegocio?.ingresos)}
          icon={DollarSign}
          hint="Facturas emitidas al cliente"
        />
        <MetricCard
          label="Costos totales"
          value={blank ?? v(kpisNegocio?.costos)}
          icon={Wallet}
          hint="Empresa + viáticos"
        />
        <MetricCard
          label="Margen bruto"
          value={blank ?? v(Math.abs(margen))}
          icon={margenPositivo ? TrendingUp : TrendingDown}
          hint={
            margenPct !== null && margenPct !== undefined
              ? `${margenPositivo ? "+" : "-"}${Math.abs(margenPct)}% del ingreso`
              : undefined
          }
        />
        <MetricCard
          label="Por cobrar"
          value={blank ?? v(kpisNegocio?.por_cobrar)}
          icon={Clock}
          hint={kpisNegocio?.cobrado ? `Cobrado: ${v(kpisNegocio.cobrado)}` : undefined}
        />
      </div>

      {/* Fila 2 — KPIs operativos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Rendiciones"
          value={blank ?? n(ejecutivo?.total_rendiciones)}
          icon={ClipboardList}
          hint={ejecutivo?.total_anticipos ? `Anticipos: ${v(ejecutivo.total_anticipos)}` : undefined}
        />
        <MetricCard
          label="Proyectos activos"
          value={blank ?? n(ejecutivo?.total_proyectos_con_movimiento)}
          icon={FolderKanban}
        />
        <MetricCard
          label="Viajeros activos"
          value={blank ?? n(ejecutivo?.total_usuarios_con_movimiento)}
          icon={Users}
        />
        <MetricCard
          label="Score IA"
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

      {/* Fila de contexto: desglose de costos */}
      {kpisNegocio && !loading && kpisNegocio.costos > 0 && (
        <div className="rounded-lg border bg-muted/30 px-4 py-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">Total costos:</span>{" "}
            {v(kpisNegocio.costos)}
          </span>
          <span>
            <span className="font-medium text-foreground">Ingresos:</span>{" "}
            {v(kpisNegocio.ingresos)}
          </span>
          {ejecutivo?.total_reembolsable ? (
            <span>
              <span className="font-medium text-foreground">Reembolsable:</span>{" "}
              {v(ejecutivo.total_reembolsable)}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
