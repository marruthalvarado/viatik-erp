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
import { useState } from "react";
import { TrendingUp, BarChart3 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCompany } from "@/contexts/company-context";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";

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
        actions={<FinancialFilters filtros={filtros} onFiltrosChange={setFiltros} />}
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
