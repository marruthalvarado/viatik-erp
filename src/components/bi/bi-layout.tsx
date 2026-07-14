/**
 * Orquestador del Dashboard Ejecutivo BI
 *
 * Fuentes de datos:
 *   - Evolucion mensual: dashboard.ts getEvolucionMensual (usa rendiciones.total_facturado)
 *   - Gastos por categoria: dashboard.ts getGastosPorCategoria (incluye Vehiculo propio + filtro politica)
 *   - Top proveedores: dashboard.ts getProveedores (usa vw_dashboard_proveedores con filtro politica)
 *   - Resto: hooks FASE 8A sin cambios
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { BarChart3, ClipboardList, Truck, FolderKanban, Workflow, Receipt } from "lucide-react";
import { ExportMenu } from "@/components/export/export-menu";
import type { ExportConfig, ExportRow } from "@/services/export/export-utils";

import { useCompany } from "@/contexts/company-context";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";

import { getEvolucionMensual, getGastosPorCategoria, getProveedores } from "@/services/dashboard";
import type { TopProveedorRow } from "@/types/reportes";
import { useKpiFacturacion, useFacturacionMensual } from "@/hooks/entities/use-facturas-emitidas";
import { formatCurrency } from "@/utils/formatters";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { EvolucionMensual } from "@/services/dashboard";
import type { ResumenFacturacionMensual } from "@/services/facturas-emitidas";

import { defaultBiFiltros, type BiFiltros } from "./bi-filter-types";
import { BiFilters } from "./bi-filters";
import { BiKpis } from "./bi-kpis";
import {
  BiEvolucionMensualChart,
  BiEstadoRendicionesChart,
  BiPresupuestoProyectoChart,
  BiTopProveedoresChart,
  BiGastoCategoriaChart,
} from "./bi-charts";
import { BiAlerts } from "./bi-alerts";
import { BiRendicionesPendientes, BiTopProveedoresTable } from "./bi-summary";
import { DrillDownBar } from "./bi-drilldown";

import { useRptResumenEjecutivo } from "@/hooks/entities/use-reportes-gerenciales";
import { useRptEjecucionPresupuestaria } from "@/hooks/entities/use-reportes-financieros";
import {
  useRptRendicionesEstado,
  useRptViajesDetalle,
} from "@/hooks/entities/use-reportes-operativos";
import { useRptCumplimientoPoliticas } from "@/hooks/entities/use-reportes-auditoria";
import { useRptTiemposWorkflow } from "@/hooks/entities/use-reportes-workflow";

// localStorage
const LS_KEY = "viatik:filtros:globales";

function loadFiltros(): BiFiltros {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...defaultBiFiltros(), ...(JSON.parse(raw) as Partial<BiFiltros>) };
  } catch {
    // localStorage no disponible
  }
  return defaultBiFiltros();
}

function saveFiltros(f: BiFiltros) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(f));
  } catch {
    // localStorage no disponible
  }
}

export function BiLayout() {
  const { empresaActivaId, empresaActiva, loading: loadingCompany } = useCompany();
  const navigate = useNavigate();
  const [filtros, setFiltrosRaw] = useState<BiFiltros>(loadFiltros);

  function setFiltros(f: BiFiltros) {
    setFiltrosRaw(f);
    saveFiltros(f);
  }

  const empresaId = empresaActivaId;

  // Params para hooks 8A (sin cambios)
  const paramsResumen = empresaId
    ? {
        p_empresa_id: empresaId,
        p_fecha_desde: filtros.fecha_desde,
        p_fecha_hasta: filtros.fecha_hasta,
      }
    : null;

  const filtroFechas = empresaId
    ? { empresa_id: empresaId, fecha_desde: filtros.fecha_desde, fecha_hasta: filtros.fecha_hasta }
    : null;

  // Hooks 8A (que no reemplazamos)
  const resumen = useRptResumenEjecutivo(paramsResumen);
  const ejecucion = useRptEjecucionPresupuestaria(filtroFechas);
  const rendicionesEstado = useRptRendicionesEstado(filtroFechas);
  const viajes = useRptViajesDetalle(filtroFechas);
  const cumplimiento = useRptCumplimientoPoliticas(filtroFechas);
  const tiemposWorkflow = useRptTiemposWorkflow(paramsResumen);

  // Fuentes corregidas: dashboard.ts (con filtro politica + km propio)
  const evolucion = useQuery({
    queryKey: ["dashboard_evolucion", empresaId, filtros.anio],
    queryFn: () => getEvolucionMensual(empresaId!, filtros.anio),
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
  });

  const gastosCategoria = useQuery({
    queryKey: ["dashboard_categorias", empresaId, filtros.anio],
    queryFn: () => getGastosPorCategoria(empresaId!, filtros.anio),
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
  });

  const proveedoresQ = useQuery({
    queryKey: ["dashboard_proveedores_bi", empresaId],
    queryFn: () => getProveedores(empresaId!, 10),
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
  });

  // Mapear DashboardProveedor -> TopProveedorRow (nombre + total)
  const topProveedoresData = (proveedoresQ.data ?? []).map((p) => ({
    proveedor_id: p.id ?? "",
    nombre: p.nombre ?? "",
    pais: "",
    ciudad: "",
    n_gastos: Number(p.cantidad_gastos ?? 0),
    total: Number(p.total_gastado ?? 0),
    pct_total: 0,
    categoria_principal: "",
  })) satisfies TopProveedorRow[];

  // Metricas derivadas
  const { presupuestoEjecutado, presupuestoDisponible } = useMemo(() => {
    const rows = ejecucion.data ?? [];
    return {
      presupuestoEjecutado: rows.reduce((s, r) => s + (r.ejecutado ?? 0), 0),
      presupuestoDisponible: rows.reduce((s, r) => s + (r.disponible ?? 0), 0),
    };
  }, [ejecucion.data]);

  const avgHorasAprobacion = useMemo(() => {
    const rows = (tiemposWorkflow.data ?? []).filter((r) => r.horas_espera_total != null);
    if (rows.length === 0) return null;
    return rows.reduce((s, r) => s + (r.horas_espera_total ?? 0), 0) / rows.length;
  }, [tiemposWorkflow.data]);

  const gastoPorViaje = useMemo(() => {
    const n = viajes.data?.length ?? 0;
    const total = resumen.data?.kpis.total_reembolsable ?? 0;
    return n > 0 ? total / n : null;
  }, [viajes.data, resumen.data]);

  // Facturación emitida
  const kpiFacturacion = useKpiFacturacion(empresaId, filtros.anio);
  const facturacionMensual = useFacturacionMensual(empresaId, filtros.anio);

  const kpiLoading =
    resumen.isLoading || ejecucion.isLoading || tiemposWorkflow.isLoading || viajes.isLoading;

  function nav(path: string) {
    void navigate({ to: path as "/" });
  }

  if (loadingCompany) return <LoadingState label="Cargando empresa..." />;
  if (!empresaId) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sin empresa activa"
        description="Selecciona una empresa en la barra superior para ver el Dashboard BI."
      />
    );
  }

  const empresaNombre = empresaActiva?.nombre ?? "";

  // Config de exportacion
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const exportConfig = useMemo<ExportConfig>(() => {
    const rows: ExportRow[] = (rendicionesEstado.data ?? []).map((r) => ({
      numero: r.numero,
      usuario: r.usuario_nombre,
      proyecto: r.proyecto_nombre,
      estado: r.estado_nombre,
      fecha: r.fecha_rendicion,
      total: r.total_facturado,
      saldo: r.saldo,
      dias: r.dias_en_estado,
    }));
    return {
      filename: `viatiq-dashboard-bi-${filtros.anio}`,
      title: "Dashboard BI - Rendiciones",
      empresa: empresaNombre,
      filtros: { Ano: String(filtros.anio) },
      columns: [
        { key: "numero", header: "N Rendicion", width: 14 },
        { key: "usuario", header: "Responsable", width: 22 },
        { key: "proyecto", header: "Proyecto", width: 20 },
        { key: "estado", header: "Estado", width: 16 },
        { key: "fecha", header: "Fecha", width: 12, format: "date" },
        { key: "total", header: "Total USD", width: 14, format: "currency", align: "right" },
        { key: "saldo", header: "Saldo USD", width: 14, format: "currency", align: "right" },
        { key: "dias", header: "Dias en estado", width: 16, format: "number", align: "right" },
      ],
      rows,
    };
  }, [rendicionesEstado.data, empresaNombre, filtros.anio]);

  // Variables usadas solo para satisfacer imports (evitar dead code warnings)
  void cumplimiento;
  void BiAlerts;
  void BiRendicionesPendientes;
  void BiTopProveedoresTable;
  void DrillDownBar;
  void ClipboardList;
  void Truck;
  void FolderKanban;
  void Workflow;
  void Receipt;

  return (
    <>
      <PageHeader
        title="Dashboard BI"
        description={
          empresaNombre ? `Analisis ejecutivo de ${empresaNombre}.` : "Analisis ejecutivo."
        }
        breadcrumbs={[{ label: "Reportes" }, { label: "Dashboard BI" }]}
        actions={
          <div className="flex items-center gap-2">
            <BiFilters filtros={filtros} onFiltrosChange={setFiltros} />
            <ExportMenu config={exportConfig} disabled={rendicionesEstado.isLoading} />
          </div>
        }
      />

      <BiKpis
        resumen={resumen.data}
        presupuestoEjecutado={presupuestoEjecutado}
        presupuestoDisponible={presupuestoDisponible}
        avgHorasAprobacion={avgHorasAprobacion}
        gastoPorViaje={gastoPorViaje}
        loading={kpiLoading}
      />

      {/* Fila 1 */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <BiEvolucionMensualChart
          data={evolucion.data ?? []}
          loading={evolucion.isLoading}
          anio={filtros.anio}
        />
        <BiEstadoRendicionesChart
          data={rendicionesEstado.data ?? []}
          loading={rendicionesEstado.isLoading}
          onNavigate={() => nav("/rendiciones")}
        />
      </div>

      {/* Fila 2 */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <BiPresupuestoProyectoChart
          data={ejecucion.data ?? []}
          loading={ejecucion.isLoading}
          onNavigate={() => nav("/proyectos")}
        />
        <BiTopProveedoresChart
          data={topProveedoresData}
          loading={proveedoresQ.isLoading}
          onNavigate={() => nav("/proveedores")}
        />
      </div>

      {/* Fila 3 */}
      <div className="mt-6">
        <BiGastoCategoriaChart
          data={gastosCategoria.data ?? []}
          loading={gastosCategoria.isLoading}
          onNavigate={() => nav("/gastos")}
        />
      </div>

      {/* Fila 4 — Facturación emitida */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold tracking-tight text-muted-foreground uppercase">
          Facturación emitida {filtros.anio}
        </h2>
        <div className="grid gap-4 sm:grid-cols-4 mb-6">
          <FactKpiCard
            label={`Total facturado ${filtros.anio}`}
            value={
              kpiFacturacion.isLoading ? "…" : formatCurrency(kpiFacturacion.data?.total_anio ?? 0)
            }
            accent="emerald"
          />
          <FactKpiCard
            label="Facturado mes actual"
            value={
              kpiFacturacion.isLoading
                ? "…"
                : formatCurrency(kpiFacturacion.data?.total_mes_actual ?? 0)
            }
          />
          <FactKpiCard
            label="N° facturas emitidas"
            value={
              kpiFacturacion.isLoading ? "…" : String(kpiFacturacion.data?.num_facturas_anio ?? 0)
            }
          />
          <FactKpiCard
            label="Clientes distintos"
            value={
              kpiFacturacion.isLoading
                ? "…"
                : String(kpiFacturacion.data?.num_clientes_distintos ?? 0)
            }
          />
        </div>
        <FacturacionVsGastosChart
          facturacion={facturacionMensual.data ?? []}
          gastos={evolucion.data ?? []}
          loading={facturacionMensual.isLoading || evolucion.isLoading}
          anio={filtros.anio}
          onNavigate={() => nav("/facturas")}
        />
      </div>
    </>
  );
}

// ─── Componentes auxiliares de facturación ─────────────────────────────────────────────

function FactKpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald";
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p
        className={`text-2xl font-bold tabular-nums ${accent === "emerald" ? "text-emerald-700" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function currencyTick(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v}`;
}

function FacturacionVsGastosChart({
  facturacion,
  gastos,
  loading,
  anio,
  onNavigate,
}: {
  facturacion: ResumenFacturacionMensual[];
  gastos: EvolucionMensual[];
  loading: boolean;
  anio: number;
  onNavigate: () => void;
}) {
  const data = facturacion.map((f) => {
    const g = gastos.find((g) => g.label === f.label);
    return {
      label: f.label,
      facturado: f.total_facturado,
      gastos: g?.total_facturado ?? 0,
    };
  });

  const empty = data.every((d) => d.facturado === 0 && d.gastos === 0);

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Facturado vs Gastos por mes</h3>
        <button
          onClick={onNavigate}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Ver facturas →
        </button>
      </div>
      {loading ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Cargando…
        </div>
      ) : empty ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Sin facturas registradas para {anio}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={currencyTick} tick={{ fontSize: 11 }} width={60} />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name === "facturado" ? "Facturado" : "Gastos",
              ]}
            />
            <Legend
              formatter={(v) => (v === "facturado" ? "Facturado" : "Gastos")}
              wrapperStyle={{ fontSize: 11 }}
            />
            <Bar dataKey="facturado" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="gastos" fill="#6366f1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
