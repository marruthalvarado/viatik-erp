/**
 * Orquestador de Reportes Operativos — FASE 8D
 *
 * Responsabilidades:
 *   - Estado de filtros globales con persistencia en localStorage
 *   - Llamadas a hooks FASE 8A (sin acceso directo a Supabase)
 *   - Layout con tabs: Viajes | Rendiciones | Clientes | Proyectos | Proveedores
 *
 * Arquitectura: Route -> ReportesOperativosLayout -> Hooks 8A -> Services 8A -> Supabase
 */
import { useState, useMemo } from "react";
import { Activity, BarChart3 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCompany } from "@/contexts/company-context";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { ExportMenu } from "@/components/export/export-menu";
import type { ExportConfig, ExportRow } from "@/services/export/export-utils";

import {
  loadFiltrosOperativos,
  saveFiltrosOperativos,
  type FiltrosOperativos,
} from "./operational-filter-types";
import { OperationalFilters } from "./operational-filters";
import { ReporteViajes } from "./reporte-viajes";
import { ReporteRendiciones } from "./reporte-rendiciones";
import { ReporteClientes } from "./reporte-clientes";
import { ReporteProyectosOp } from "./reporte-proyectos-op";
import { ReporteProveedores } from "./reporte-proveedores";

import {
  useRptViajesDetalle,
  useRptRendicionesEstado,
  useRptGastosDetalle,
} from "@/hooks/entities/use-reportes-operativos";
import { useRptEjecucionPresupuestaria } from "@/hooks/entities/use-reportes-financieros";
import { useRptTopProveedores } from "@/hooks/entities/use-reportes-gerenciales";

// ---------------------------------------------------------------------------

export function ReportesOperativosLayout() {
  const { empresaActivaId, empresaActiva, loading: loadingCompany } = useCompany();
  const [filtros, setFiltrosRaw] = useState<FiltrosOperativos>(loadFiltrosOperativos);
  const [tab, setTab] = useState("viajes");

  function setFiltros(f: FiltrosOperativos) {
    setFiltrosRaw(f);
    saveFiltrosOperativos(f);
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
      }
    : null;

  const paramsProveedores = empresaId
    ? {
        p_empresa_id: empresaId,
        p_fecha_desde: filtros.fecha_desde,
        p_fecha_hasta: filtros.fecha_hasta,
        p_limite: 20,
      }
    : null;

  // -------------------------------------------------------------------------
  // Hooks FASE 8A — sin acceso directo a Supabase
  // -------------------------------------------------------------------------

  const viajes = useRptViajesDetalle(filtroFechas ?? null);

  const rendiciones = useRptRendicionesEstado(
    filtroFechas ? { ...filtroFechas, estado_codigo: filtros.estado_codigo } : null,
  );

  const gastos = useRptGastosDetalle(filtroFechas ?? null);

  const ejecucion = useRptEjecucionPresupuestaria(filtroEjecucion);

  const proveedores = useRptTopProveedores(paramsProveedores);

  // -------------------------------------------------------------------------
  // Loading / empty guards
  // -------------------------------------------------------------------------

  if (loadingCompany) return <LoadingState label="Cargando empresa..." />;

  if (!empresaId) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sin empresa activa"
        description="Selecciona una empresa en la barra superior para ver los reportes operativos."
      />
    );
  }

  const empresaNombre = empresaActiva?.nombre ?? "";

  // -------------------------------------------------------------------------
  // Retry helpers
  // -------------------------------------------------------------------------

  function retryViajes() {
    void viajes.refetch();
  }
  function retryRendiciones() {
    void rendiciones.refetch();
  }
  function retryClientesBase() {
    void ejecucion.refetch();
    void viajes.refetch();
    void gastos.refetch();
  }
  function retryProyectos() {
    void ejecucion.refetch();
    void rendiciones.refetch();
    void viajes.refetch();
  }
  function retryProveedores() {
    void proveedores.refetch();
  }

  const clientesError = ejecucion.error ?? viajes.error ?? gastos.error;
  const clientesLoading = ejecucion.isLoading || viajes.isLoading || gastos.isLoading;
  const proyectosError = ejecucion.error ?? rendiciones.error ?? viajes.error;
  const proyectosLoading = ejecucion.isLoading || rendiciones.isLoading || viajes.isLoading;

  // ─── Config exportación (tab activo) ───────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const exportConfig = useMemo<ExportConfig>(() => {
    const periodo = `${filtros.fecha_desde} / ${filtros.fecha_hasta}`;
    if (tab === "viajes") {
      const rows: ExportRow[] = (viajes.data ?? []).map((r) => ({
        numero: r.numero,
        usuario: r.usuario_nombre,
        destino: r.destino,
        pais: r.pais_nombre,
        fecha_inicio: r.fecha_inicio,
        fecha_fin: r.fecha_fin,
        duracion: r.duracion_dias,
        proyecto: r.proyecto_nombre,
      }));
      return {
        filename: `viatiq-viajes-${filtros.anio}`,
        title: "Viajes",
        empresa: empresaNombre,
        filtros: { Periodo: periodo } as Record<string, string>,
        rows,
        columns: [
          { key: "numero", header: "N°", width: 10 },
          { key: "usuario", header: "Responsable", width: 22 },
          { key: "destino", header: "Destino", width: 18 },
          { key: "pais", header: "País", width: 14 },
          { key: "fecha_inicio", header: "Inicio", width: 12, format: "date" },
          { key: "fecha_fin", header: "Fin", width: 12, format: "date" },
          { key: "duracion", header: "Días", width: 8, format: "number", align: "right" },
          { key: "proyecto", header: "Proyecto", width: 20 },
        ],
      };
    }
    if (tab === "rendiciones") {
      const rows: ExportRow[] = (rendiciones.data ?? []).map((r) => ({
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
        filename: `viatiq-rendiciones-${filtros.anio}`,
        title: "Rendiciones",
        empresa: empresaNombre,
        filtros: { Periodo: periodo } as Record<string, string>,
        rows,
        columns: [
          { key: "numero", header: "N°", width: 10 },
          { key: "usuario", header: "Responsable", width: 22 },
          { key: "proyecto", header: "Proyecto", width: 20 },
          { key: "estado", header: "Estado", width: 16 },
          { key: "fecha", header: "Fecha", width: 12, format: "date" },
          { key: "total", header: "Total USD", width: 14, format: "currency", align: "right" },
          { key: "saldo", header: "Saldo USD", width: 14, format: "currency", align: "right" },
          { key: "dias", header: "Días", width: 8, format: "number", align: "right" },
        ],
      };
    }
    if (tab === "proveedores") {
      const rows: ExportRow[] = (proveedores.data ?? []).map((r) => ({
        nombre: r.nombre,
        pais: r.pais,
        ciudad: r.ciudad,
        n_gastos: r.n_gastos,
        total: r.total,
        pct: r.pct_total,
        categoria: r.categoria_principal,
      }));
      return {
        filename: `viatiq-proveedores-${filtros.anio}`,
        title: "Top Proveedores",
        empresa: empresaNombre,
        filtros: { Periodo: periodo } as Record<string, string>,
        rows,
        columns: [
          { key: "nombre", header: "Proveedor", width: 24 },
          { key: "pais", header: "País", width: 14 },
          { key: "ciudad", header: "Ciudad", width: 14 },
          { key: "categoria", header: "Categoria", width: 20 },
          { key: "n_gastos", header: "# Gastos", width: 10, format: "number", align: "right" },
          { key: "total", header: "Total USD", width: 14, format: "currency", align: "right" },
          { key: "pct", header: "% Total", width: 10, format: "percent", align: "right" },
        ],
      };
    }
    // clientes / proyectos → ejecucion
    const rows: ExportRow[] = (ejecucion.data ?? []).map((r) => ({
      nombre: r.presupuesto_nombre ?? r.categoria_nombre ?? r.proyecto_nombre,
      valor_presupuestado: r.valor_presupuestado,
      ejecutado: r.ejecutado,
      disponible: r.disponible,
      pct: r.pct_ejecucion,
    }));
    const label = tab === "clientes" ? "Clientes" : "Proyectos";
    return {
      filename: `viatiq-${tab}-${filtros.anio}`,
      title: label,
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
  }, [
    tab,
    viajes.data,
    rendiciones.data,
    ejecucion.data,
    proveedores.data,
    empresaNombre,
    filtros,
  ]);

  const exportLoading =
    viajes.isLoading || rendiciones.isLoading || ejecucion.isLoading || proveedores.isLoading;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <PageHeader
        title="Reportes Operativos"
        description={
          empresaNombre ? `Analisis operativo de ${empresaNombre}.` : "Analisis operativo."
        }
        breadcrumbs={[{ label: "Reportes", href: "/reportes" }, { label: "Operativos" }]}
        actions={
          <div className="flex items-center gap-2">
            <OperationalFilters filtros={filtros} onFiltrosChange={setFiltros} />
            <ExportMenu config={exportConfig} disabled={exportLoading} />
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="viajes" aria-label="Ver reporte de viajes">
            Viajes
          </TabsTrigger>
          <TabsTrigger value="rendiciones" aria-label="Ver reporte de rendiciones">
            Rendiciones
          </TabsTrigger>
          <TabsTrigger value="clientes" aria-label="Ver reporte de clientes">
            Clientes
          </TabsTrigger>
          <TabsTrigger value="proyectos" aria-label="Ver reporte de proyectos">
            Proyectos
          </TabsTrigger>
          <TabsTrigger value="proveedores" aria-label="Ver reporte de proveedores">
            Proveedores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="viajes">
          <ReporteViajes
            data={viajes.data ?? []}
            loading={viajes.isLoading}
            error={viajes.error}
            onRetry={retryViajes}
          />
        </TabsContent>

        <TabsContent value="rendiciones">
          <ReporteRendiciones
            data={rendiciones.data ?? []}
            loading={rendiciones.isLoading}
            error={rendiciones.error}
            onRetry={retryRendiciones}
          />
        </TabsContent>

        <TabsContent value="clientes">
          <ReporteClientes
            ejecucion={ejecucion.data ?? []}
            viajes={viajes.data ?? []}
            gastos={gastos.data ?? []}
            loading={clientesLoading}
            error={clientesError}
            onRetry={retryClientesBase}
          />
        </TabsContent>

        <TabsContent value="proyectos">
          <ReporteProyectosOp
            ejecucion={ejecucion.data ?? []}
            rendiciones={rendiciones.data ?? []}
            viajes={viajes.data ?? []}
            loading={proyectosLoading}
            error={proyectosError}
            onRetry={retryProyectos}
          />
        </TabsContent>

        <TabsContent value="proveedores">
          <ReporteProveedores
            data={proveedores.data ?? []}
            loading={proveedores.isLoading}
            error={proveedores.error}
            onRetry={retryProveedores}
          />
        </TabsContent>
      </Tabs>

      <div className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Activity className="size-3" aria-hidden="true" />
        <span>Datos actualizados cada 5 minutos. Filtros persistidos en esta sesion.</span>
      </div>
    </>
  );
}
