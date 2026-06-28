/**
 * Orquestador del Dashboard Ejecutivo BI — FASE 8B
 *
 * Responsabilidades:
 *   · Estado de filtros globales con persistencia en localStorage
 *   · Llamadas a todos los hooks FASE 8A (sin tocar Supabase directamente)
 *   · Layout y composición de sub-componentes
 *   · Drill-down: navegación a módulos relacionados
 *
 * Arquitectura: Route → BiLayout → Hooks 8A → Services 8A → Supabase
 */
import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BarChart3, ClipboardList, Truck, FolderKanban, Workflow, Receipt } from "lucide-react";
import { ExportMenu } from "@/components/export/export-menu";
import type { ExportConfig, ExportRow } from "@/services/export/export-utils";

import { useCompany } from "@/contexts/company-context";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";

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

import {
  useRptResumenEjecutivo,
  useRptTopProveedores,
} from "@/hooks/entities/use-reportes-gerenciales";
import {
  useRptEvolucionMensual,
  useRptEjecucionPresupuestaria,
} from "@/hooks/entities/use-reportes-financieros";
import {
  useRptRendicionesEstado,
  useRptViajesDetalle,
} from "@/hooks/entities/use-reportes-operativos";
import { useRptCumplimientoPoliticas } from "@/hooks/entities/use-reportes-auditoria";
import { useRptTiemposWorkflow } from "@/hooks/entities/use-reportes-workflow";

// ─── localStorage ──────────────────────────────────────────────────────────────

const LS_KEY = "viatik:filtros:globales";

function loadFiltros(): BiFiltros {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...defaultBiFiltros(), ...(JSON.parse(raw) as Partial<BiFiltros>) };
  } catch {
    // localStorage no disponible (SSR, modo privado, cuota llena)
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

// ─── Component ─────────────────────────────────────────────────────────────────

export function BiLayout() {
  const { empresaActivaId, empresaActiva, loading: loadingCompany } = useCompany();
  const navigate = useNavigate();
  const [filtros, setFiltrosRaw] = useState<BiFiltros>(loadFiltros);

  function setFiltros(f: BiFiltros) {
    setFiltrosRaw(f);
    saveFiltros(f);
  }

  const empresaId = empresaActivaId;

  // ─── Params para hooks ────────────────────────────────────────────────────────

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

  // ─── Hooks FASE 8A ────────────────────────────────────────────────────────────

  const resumen = useRptResumenEjecutivo(paramsResumen);
  const topProveedores = useRptTopProveedores(
    paramsResumen ? { ...paramsResumen, p_limite: 10 } : null,
  );
  const evolucion = useRptEvolucionMensual(
    empresaId
      ? { p_empresa_id: empresaId, p_anio_desde: filtros.anio, p_anio_hasta: filtros.anio }
      : null,
  );
  const ejecucion = useRptEjecucionPresupuestaria(filtroFechas);
  const rendicionesEstado = useRptRendicionesEstado(filtroFechas);
  const viajes = useRptViajesDetalle(filtroFechas);
  const cumplimiento = useRptCumplimientoPoliticas(filtroFechas);
  const tiemposWorkflow = useRptTiemposWorkflow(paramsResumen);

  // ─── Métricas derivadas ───────────────────────────────────────────────────────

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

  const kpiLoading =
    resumen.isLoading || ejecucion.isLoading || tiemposWorkflow.isLoading || viajes.isLoading;

  // ─── Drill-down ───────────────────────────────────────────────────────────────

  function nav(path: string) {
    void navigate({ to: path as "/" });
  }

  // ─── Loading / empty guards ───────────────────────────────────────────────────

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

  // ─── Config de exportación ────────────────────────────────────────────────────
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
      title: "Dashboard BI — Rendiciones",
      empresa: empresaNombre,
      filtros: { Año: String(filtros.anio) },
      columns: [
        { key: "numero", header: "N° Rendición", width: 14 },
        { key: "usuario", header: "Responsable", width: 22 },
        { key: "proyecto", header: "Proyecto", width: 20 },
        { key: "estado", header: "Estado", width: 16 },
        { key: "fecha", header: "Fecha", width: 12, format: "date" },
        { key: "total", header: "Total USD", width: 14, format: "currency", align: "right" },
        { key: "saldo", header: "Saldo USD", width: 14, format: "currency", align: "right" },
        { key: "dias", header: "Días en estado", width: 16, format: "number", align: "right" },
      ],
      rows,
    };
  }, [rendicionesEstado.data, empresaNombre, filtros.anio]);

  return (
    <>
      <PageHeader
        title="Dashboard BI"
        description={
          empresaNombre ? `Análisis ejecutivo de ${empresaNombre}.` : "Análisis ejecutivo."
        }
        breadcrumbs={[{ label: "Reportes" }, { label: "Dashboard BI" }]}
        actions={
          <div className="flex items-center gap-2">
            <BiFilters filtros={filtros} onFiltrosChange={setFiltros} />
            <ExportMenu config={exportConfig} disabled={rendicionesEstado.isLoading} />
          </div>
        }
      />

      {/* KPIs */}
      <BiKpis
        resumen={resumen.data}
        presupuestoEjecutado={presupuestoEjecutado}
        presupuestoDisponible={presupuestoDisponible}
        avgHorasAprobacion={avgHorasAprobacion}
        gastoPorViaje={gastoPorViaje}
        loading={kpiLoading}
      />

      {/* Charts — fila 1 */}
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

      {/* Charts — fila 2 */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <BiPresupuestoProyectoChart
          data={ejecucion.data ?? []}
          loading={ejecucion.isLoading}
          onNavigate={() => nav("/proyectos")}
        />
        <BiTopProveedoresChart
          data={topProveedores.data ?? []}
          loading={topProveedores.isLoading}
          onNavigate={() => nav("/proveedores")}
        />
      </div>

      {/* Chart — fila 3 */}
      <div className="mt-6">
        <BiGastoCategoriaChart
          data={ejecucion.data ?? []}
          loading={ejecucion.isLoading}
          onNavigate={() => nav("/gastos")}
        />
      </div>
    </>
  );
}
