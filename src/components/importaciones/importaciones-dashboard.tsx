/**
 * importaciones-dashboard.tsx
 * Dashboard de Importaciones: KPIs, evolución mensual y reporte comparativo
 * estimado (costeo) vs real (DAI liquidado).
 */
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Ship, Truck, CheckCircle2, DollarSign, TrendingUp, TrendingDown,
} from "lucide-react";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { useEmbarques } from "@/hooks/entities/use-embarques";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

const pct = (real: number, est: number) =>
  est === 0 ? 0 : ((real - est) / est) * 100;

// ── Componente ────────────────────────────────────────────────────────────────

export function ImportacionesDashboard() {
  const { data: embarques = [], isLoading } = useEmbarques();

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total      = embarques.length;
    const transito   = embarques.filter((e) => e.estado === "En tránsito").length;
    const recibidas  = embarques.filter((e) => e.estado === "Recibida").length;
    const totalFob   = embarques.reduce((s, e) => s + (e.fob_total ?? 0), 0);
    const totalLiq   = embarques.reduce((s, e) => s + (e.total_liquidado ?? 0), 0);

    // Comparativa con costeos
    const conCosteo  = embarques.filter((e) => e.costeo);
    const totalEst   = conCosteo.reduce((s, e) => s + (e.costeo?.costo_aterrizaje_usd ?? 0), 0);
    const totalReal  = conCosteo.reduce((s, e) => s + (e.total_liquidado ?? 0), 0);
    const delta      = totalReal - totalEst;

    return { total, transito, recibidas, totalFob, totalLiq, totalEst, totalReal, delta, conCosteo: conCosteo.length };
  }, [embarques]);

  // ── Evolución mensual ──────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const byMonth: Record<string, { mes: string; fob: number; liquidado: number }> = {};
    embarques.forEach((e) => {
      const key = e.fecha?.slice(0, 7) ?? ""; // YYYY-MM
      if (!key) return;
      if (!byMonth[key]) byMonth[key] = { mes: key, fob: 0, liquidado: 0 };
      byMonth[key].fob        += e.fob_total      ?? 0;
      byMonth[key].liquidado  += e.total_liquidado ?? 0;
    });
    return Object.values(byMonth)
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((d) => ({
        ...d,
        mes: format(new Date(d.mes + "-01"), "MMM yy", { locale: es }),
      }));
  }, [embarques]);

  // ── Tabla comparativa ──────────────────────────────────────────────────────
  const comparativo = useMemo(
    () => embarques.filter((e) => e.costeo).map((e) => ({
      id:         e.id,
      embarque:   e.numero_embarque ?? "—",
      costeo:     e.costeo!.numero,
      estimado:   e.costeo!.costo_aterrizaje_usd,
      real:       e.total_liquidado ?? 0,
      delta:      (e.total_liquidado ?? 0) - e.costeo!.costo_aterrizaje_usd,
      pct:        pct(e.total_liquidado ?? 0, e.costeo!.costo_aterrizaje_usd),
      estado:     e.estado,
    })),
    [embarques]
  );

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground text-center py-20">
        Cargando dashboard…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard Importaciones</h1>
        <p className="text-sm text-muted-foreground">
          Seguimiento de embarques y comparativa estimado vs real
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard icon={Ship} label="Total embarques" value={kpis.total} iconClass="text-primary" />
        <KpiCard icon={Truck} label="En tránsito" value={kpis.transito} iconClass="text-blue-500" />
        <KpiCard icon={CheckCircle2} label="Recibidas" value={kpis.recibidas} iconClass="text-green-500" />
        <KpiCard icon={DollarSign} label="Total liquidado" value={fmt(kpis.totalLiq)} iconClass="text-purple-500" />
      </div>

      {/* Comparativa global vs costeos */}
      {kpis.conCosteo > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">Estimado ({kpis.conCosteo} embarques)</p>
            <p className="text-xl font-bold">{fmt(kpis.totalEst)}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">Real liquidado</p>
            <p className="text-xl font-bold">{fmt(kpis.totalReal)}</p>
          </div>
          <div className={`border rounded-lg p-4 ${kpis.delta > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              {kpis.delta > 0
                ? <TrendingUp className="size-3 text-red-500" />
                : <TrendingDown className="size-3 text-green-500" />}
              {kpis.delta > 0 ? "Sobrecosto" : "Ahorro"}
            </div>
            <p className={`text-xl font-bold ${kpis.delta > 0 ? "text-red-600" : "text-green-600"}`}>
              {kpis.delta > 0 ? "+" : ""}{fmt(kpis.delta)}
            </p>
            <p className="text-xs text-muted-foreground">
              {pct(kpis.totalReal, kpis.totalEst).toFixed(1)}% vs estimado
            </p>
          </div>
        </div>
      )}

      {/* Gráfico evolución mensual */}
      {chartData.length > 0 && (
        <div className="border rounded-lg p-4">
          <p className="text-sm font-semibold mb-4">Evolución mensual (USD)</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Bar dataKey="fob"       name="FOB total"      fill="#94a3b8" radius={[3,3,0,0]} />
              <Bar dataKey="liquidado" name="Total liquidado" fill="#6366f1" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla comparativa estimado vs real */}
      {comparativo.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/20">
            <p className="text-sm font-semibold">Comparativa Costeo vs DAI real</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Embarque</TableHead>
                <TableHead>Costeo</TableHead>
                <TableHead className="text-right">Estimado</TableHead>
                <TableHead className="text-right">Real (DAI)</TableHead>
                <TableHead className="text-right">Delta</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparativo.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs font-semibold">{row.embarque}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.costeo}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(row.estimado)}</TableCell>
                  <TableCell className="text-xs text-right">{fmt(row.real)}</TableCell>
                  <TableCell className={`text-xs text-right font-medium ${row.delta > 0 ? "text-red-600" : "text-green-600"}`}>
                    {row.delta > 0 ? "+" : ""}{fmt(row.delta)}
                  </TableCell>
                  <TableCell className={`text-xs text-right ${row.delta > 0 ? "text-red-600" : "text-green-600"}`}>
                    {row.pct.toFixed(1)}%
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {row.estado}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {embarques.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Ship className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin embarques registrados aún</p>
        </div>
      )}
    </div>
  );
}

// ── KPI Card helper ───────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  iconClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  iconClass?: string;
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className={`flex items-center gap-2 text-muted-foreground mb-1 ${iconClass}`}>
        <Icon className="size-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
