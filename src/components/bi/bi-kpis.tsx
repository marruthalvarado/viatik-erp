/**
 * KPI cards del Dashboard Ejecutivo BI.
 * Consume ResumenEjecutivoResponse, EjecucionPresupuestaria, TiemposWorkflow y
 * el conteo de viajes para calcular los 7 indicadores principales.
 */
import {
  Wallet,
  BarChart3,
  PiggyBank,
  ClipboardList,
  CheckCircle2,
  Timer,
  Plane,
} from "lucide-react";

import { MetricCard } from "@/components/common/metric-card";
import { formatCurrency } from "@/utils/formatters";
import type { ResumenEjecutivoResponse } from "@/types/reportes";

interface BiKpisProps {
  resumen: ResumenEjecutivoResponse | null | undefined;
  presupuestoEjecutado: number;
  presupuestoDisponible: number;
  avgHorasAprobacion: number | null;
  gastoPorViaje: number | null;
  loading: boolean;
}

export function BiKpis({
  resumen,
  presupuestoEjecutado,
  presupuestoDisponible,
  avgHorasAprobacion,
  gastoPorViaje,
  loading,
}: BiKpisProps) {
  const kpis = resumen?.kpis;
  const blank = loading ? "—" : undefined;
  const v = (n: number | null | undefined) => formatCurrency(n ?? 0);

  const pctEjecutado =
    presupuestoEjecutado + presupuestoDisponible > 0
      ? Math.round((presupuestoEjecutado / (presupuestoEjecutado + presupuestoDisponible)) * 100)
      : null;

  return (
    <div className="space-y-4">
      {/* Fila 1 — financieros */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total gastos"
          value={blank ?? v(kpis?.total_facturado)}
          icon={Wallet}
          hint={
            kpis?.total_reembolsable != null
              ? `${formatCurrency(kpis.total_reembolsable)} reembolsable`
              : undefined
          }
        />
        <MetricCard
          label="Presupuesto ejecutado"
          value={blank ?? v(presupuestoEjecutado)}
          icon={BarChart3}
          hint={pctEjecutado != null ? `${pctEjecutado}% del total` : undefined}
          trend={
            pctEjecutado != null && pctEjecutado > 90
              ? { direction: "down", value: `${pctEjecutado}%` }
              : pctEjecutado != null
                ? { direction: "up", value: `${pctEjecutado}%` }
                : undefined
          }
        />
        <MetricCard
          label="Presupuesto disponible"
          value={blank ?? v(presupuestoDisponible)}
          icon={PiggyBank}
          hint={
            presupuestoDisponible < 0
              ? "Sobre presupuesto"
              : presupuestoDisponible === 0
                ? "Sin margen"
                : undefined
          }
        />
        <MetricCard
          label="Gasto promedio por viaje"
          value={blank ?? (gastoPorViaje != null ? v(gastoPorViaje) : "—")}
          icon={Plane}
        />
      </div>

      {/* Fila 2 — operativos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Rendiciones pendientes"
          value={blank ?? String(kpis?.pendientes ?? "—")}
          icon={ClipboardList}
          hint={
            kpis?.tasa_aprobacion != null ? `${kpis.tasa_aprobacion}% tasa aprobación` : undefined
          }
        />
        <MetricCard
          label="Rendiciones aprobadas"
          value={blank ?? String(kpis?.rendiciones_aprobadas ?? "—")}
          icon={CheckCircle2}
          hint={
            kpis?.rendiciones_rechazadas != null
              ? `${kpis.rendiciones_rechazadas} rechazadas`
              : undefined
          }
        />
        <MetricCard
          label="Tiempo promedio aprobación"
          value={
            loading
              ? "—"
              : avgHorasAprobacion != null
                ? avgHorasAprobacion < 24
                  ? `${avgHorasAprobacion.toFixed(1)} h`
                  : `${(avgHorasAprobacion / 24).toFixed(1)} días`
                : "—"
          }
          icon={Timer}
          hint={avgHorasAprobacion != null ? "desde envío hasta aprobación" : undefined}
        />
      </div>
    </div>
  );
}
