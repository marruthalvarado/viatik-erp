/**
 * Orquestador de Reportes Financieros — FASE 8C
 *
 * Responsabilidades:
 *   - Estado de filtros globales con persistencia en localStorage
 *   - Llamadas a hooks FASE 8A (sin acceso directo a Supabase)
 *   - Layout con tabs: Gastos | Presupuesto | Anticipos | Categorias | Proyectos
 *
 * Arquitectura: Route -> ReportesFinancierosLayout -> Hooks 8A -> Services 8A -> Supabase
 */
import { useState, useMemo } from "react";
import { TrendingUp, BarChart3 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCompany } from "@/contexts/company-context";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { ExportMenu } from "@/components/export/export-menu";
import type { ExportConfig, ExportRow } from "@/services/export/export-utils";

import {
  defaultFiltrosFinancieros,
  loadFiltrosFinancieros,
  saveFiltrosFinancieros,
  type FiltrosFinancieros,
} from "./financial-filter-types";
import { FinancialFilters } from "./financial-filters";
import { ReporteGastos } from "./reporte-gastos";
import { ReportePresupuesto } from "./reporte-presupuesto";
import { ReporteAnticipos } from "./reporte-anticipos";
import { ReporteCategorias } from "./reporte-categorias";
import { ReporteProyectos } from "./reporte-proyectos";

import { useRptGastosDetalle, useRptAnticipos } from "@/hooks/entities/use-reportes-operativos";
import {
  useRptEjecucionPresupuestaria,
  useRptEvolucionMensual,
} from "@/hooks/entities/use-reportes-financieros";

// ---------------------------------------------------------------------------

export function ReportesFinancierosLayout() {
  const { empresaActivaId, empresaActiva, loading: loadingCompany } = useCompany();
  const [filtros, setFiltrosRaw] = useState<FiltrosFinancieros>(loadFiltrosFinancieros);
  const [tab, setTab] = useState("gastos");

  function setFiltros(f: FiltrosFinancieros) {
    setFiltrosRaw(f);
    saveFiltrosFinancieros(f);
  }

  const empresaId = empresaActivaId ?? null;

  // -------------------------------------------------------------------------
  // Params para hooks
  // -------------------------------------------------------------------------

  const filtroFechas = empresaId
    ? {
        empresa_id: empresaId,
        fecha_desde: filtros.fecha_desde,
        fecha_hasta: filtros.fecha_hasta,
      }
    : null;

  const filtroEjecucion = empresaId
    ? {
        empresa_id: empresaId,
        anio: filtros.anio,
        proyecto_id: filtros.proyecto_id,
      }
    : null;

  const paramsEvolucion = empresaId
    ? {
        p_empresa_id: empresaId,
        p_anio_desde: filtros.anio,
        p_anio_hasta: filtros.anio,
        p_categoria_id: filtros.categoria_id,
      }
    : null;

  // -------------------------------------------------------------------------
  // Hooks FASE 8A — sin acceso directo a Supabase desde aqui
  // -------------------------------------------------------------------------

  const gastos = useRptGastosDetalle(
    filtroFechas
      ? {
          ...filtroFechas,
          proyecto_id: filtros.proyecto_id,
          categoria_gasto_id: filtros.categoria_id,
        }
      : null,
  );

  const ejecucion = useRptEjecucionPresupuestaria(filtroEjecucion);

  const anticipos = useRptAnticipos(
    filtroFechas ? { ...filtroFechas, proyecto_id: filtros.proyecto_id } : null,
  );

  // evolucion disponible para uso futuro (Evolución mensual)
  const _evolucion = useRptEvolucionMensual(paramsEvolucion);
  void _evolucion; // consumido pero no renderizado en esta fase

  // -------------------------------------------------------------------------
  // Loading / empty guards
  // -------------------------------------------------------------------------

  if (loadingCompany) return <LoadingState label="Cargando empresa..." />;

  if (!empresaId) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sin empresa activa"
        description="Selecciona una empresa en la barra superior para ver los reportes financieros."
      />
    );
  }

  const empresaNombre = empresaActiva?.nombre ?? "";

  // -------------------------------------------------------------------------
  // Retry helpers
  // -------------------------------------------------------------------------

  function retryGastos() {
    void gastos.refetch();
  }
  function retryEjecucion() {
    void ejecucion.refetch();
  }
  function retryAnticipos() {
    void anticipos.refetch();
  }

  // ─── Config exportación (tab activo) ───────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const exportConfig = useMemo<ExportConfig>(() => {
    const periodo = `${filtros.fecha_desde} / ${filtros.fecha_hasta}`;
    if (tab === "gastos") {
      const rows: ExportRow[] = (gastos.data ?? []).map((r) => ({
        numero: r.numero_documento,
        proveedor: r.proveedor_nombre,
        categoria: r.categoria_nombre,
        fecha: r.fecha,
        moneda: r.moneda_codigo,
        importe: r.valor_factura,
        proyecto: r.proyecto_nombre,
      }));
      return {
        filename: `viatiq-gastos-${filtros.anio}`,
        title: "Gastos",
        empresa: empresaNombre,
        filtros: { Periodo: periodo } as Record<string, string>,
        rows,
        columns: [
          { key: "numero", header: "N° Doc.", width: 14 },
          { key: "fecha", header: "Fecha", width: 12, format: "date" },
          { key: "proveedor", header: "Proveedor", width: 22 },
          { key: "categoria", header: "Categoria", width: 18 },
          { key: "importe", header: "Importe", width: 14, format: "currency", align: "right" },
          { key: "moneda", header: "Moneda", width: 10 },
          { key: "proyecto", header: "Proyecto", width: 20 },
        ],
      };
    }
    if (tab === "anticipos") {
      const rows: ExportRow[] = (anticipos.data ?? []).map((r) => ({
        numero: r.numero,
        rendicion: r.rendicion_numero,
        proyecto: r.proyecto_nombre,
        fecha: r.fecha,
        valor: r.valor,
        moneda: r.moneda_codigo,
        liquidado: r.liquidado ? "Sí" : "No",
      }));
      return {
        filename: `viatiq-anticipos-${filtros.anio}`,
        title: "Anticipos",
        empresa: empresaNombre,
        filtros: { Periodo: periodo } as Record<string, string>,
        rows,
        columns: [
          { key: "numero", header: "N°", width: 10 },
          { key: "fecha", header: "Fecha", width: 12, format: "date" },
          { key: "rendicion", header: "Rendición", width: 16 },
          { key: "proyecto", header: "Proyecto", width: 20 },
          { key: "valor", header: "Valor", width: 14, format: "currency", align: "right" },
          { key: "moneda", header: "Moneda", width: 10 },
          { key: "liquidado", header: "Liquidado", width: 12 },
        ],
      };
    }
    // presupuesto / categorias / proyectos → todos usan ejecucion
    const rows: ExportRow[] = (ejecucion.data ?? []).map((r) => ({
      nombre: r.presupuesto_nombre ?? r.categoria_nombre ?? r.proyecto_nombre,
      valor_presupuestado: r.valor_presupuestado,
      ejecutado: r.ejecutado,
      disponible: r.disponible,
      pct: r.pct_ejecucion,
    }));
    const tabLabel =
      tab === "presupuesto" ? "Presupuesto" : tab === "categorias" ? "Categorias" : "Proyectos";
    return {
      filename: `viatiq-${tab}-${filtros.anio}`,
      title: tabLabel,
      empresa: empresaNombre,
      filtros: { Año: String(filtros.anio) } as Record<string, string>,
      rows,
      columns: [
        { key: "nombre", header: "Concepto", width: 28 },
        {
          key: "valor_presupuestado",
          header: "Presupuesto",
          width: 16,
          format: "currency",
          align: "right",
        },
        { key: "ejecutado", header: "Ejecutado", width: 16, format: "currency", align: "right" },
        { key: "disponible", header: "Disponible", width: 16, format: "currency", align: "right" },
        { key: "pct", header: "% Ejecucion", width: 14, format: "number", align: "right" },
      ],
    };
  }, [tab, gastos.data, anticipos.data, ejecucion.data, empresaNombre, filtros]);

  const exportLoading = gastos.isLoading || ejecucion.isLoading || anticipos.isLoading;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <PageHeader
        title="Reportes Financieros"
        description={
          empresaNombre ? `Analisis financiero de ${empresaNombre}.` : "Analisis financiero."
        }
        breadcrumbs={[{ label: "Reportes", href: "/reportes" }, { label: "Financieros" }]}
        actions={
          <div className="flex items-center gap-2">
            <FinancialFilters filtros={filtros} onFiltrosChange={setFiltros} />
            <ExportMenu config={exportConfig} disabled={exportLoading} />
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="gastos" aria-label="Ver reporte de gastos">
            Gastos
          </TabsTrigger>
          <TabsTrigger value="presupuesto" aria-label="Ver reporte de presupuesto vs ejecutado">
            Presupuesto
          </TabsTrigger>
          <TabsTrigger value="anticipos" aria-label="Ver reporte de anticipos">
            Anticipos
          </TabsTrigger>
          <TabsTrigger value="categorias" aria-label="Ver reporte de gasto por categoria">
            Categorias
          </TabsTrigger>
          <TabsTrigger value="proyectos" aria-label="Ver reporte de gasto por proyecto">
            Proyectos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gastos">
          <ReporteGastos
            data={gastos.data ?? []}
            loading={gastos.isLoading}
            error={gastos.error}
            onRetry={retryGastos}
          />
        </TabsContent>

        <TabsContent value="presupuesto">
          <ReportePresupuesto
            data={ejecucion.data ?? []}
            loading={ejecucion.isLoading}
            error={ejecucion.error}
            onRetry={retryEjecucion}
          />
        </TabsContent>

        <TabsContent value="anticipos">
          <ReporteAnticipos
            data={anticipos.data ?? []}
            loading={anticipos.isLoading}
            error={anticipos.error}
            onRetry={retryAnticipos}
          />
        </TabsContent>

        <TabsContent value="categorias">
          <ReporteCategorias
            data={ejecucion.data ?? []}
            loading={ejecucion.isLoading}
            error={ejecucion.error}
            onRetry={retryEjecucion}
          />
        </TabsContent>

        <TabsContent value="proyectos">
          <ReporteProyectos
            data={ejecucion.data ?? []}
            loading={ejecucion.isLoading}
            error={ejecucion.error}
            onRetry={retryEjecucion}
          />
        </TabsContent>
      </Tabs>

      <div className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <TrendingUp className="size-3" aria-hidden="true" />
        <span>Datos actualizados cada 30 minutos. Filtros persistidos en esta sesion.</span>
      </div>
    </>
  );
}
