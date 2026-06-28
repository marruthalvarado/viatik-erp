/**
 * Orquestador de Workflow Analytics — FASE 8E
 *
 * Responsabilidades:
 *   - Estado de filtros con persistencia en localStorage
 *   - Llamadas a hooks FASE 8A (sin acceso directo a Supabase)
 *   - Layout con tabs: Flujo | Cuellos de botella | Aprobadores | Estados | SLA
 *
 * Arquitectura: Route -> WorkflowReportLayout -> Hooks 8A -> Services 8A -> Supabase
 */
import { useState, useMemo } from "react";
import { Network, RotateCcw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompany } from "@/contexts/company-context";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { ExportMenu } from "@/components/export/export-menu";
import type { ExportConfig, ExportRow } from "@/services/export/export-utils";
import {
  useRptAprobacionesEficiencia,
  useRptTiemposWorkflow,
} from "@/hooks/entities/use-reportes-workflow";
import { useRptRendicionesEstado } from "@/hooks/entities/use-reportes-operativos";
import { WorkflowSummary } from "./workflow-summary";
import { WorkflowBottlenecks } from "./workflow-bottlenecks";
import { WorkflowApprovers } from "./workflow-approvers";
import { WorkflowStatus } from "./workflow-status";
import { WorkflowSla } from "./workflow-sla";

// ---------------------------------------------------------------------------
// Tipos y helpers de filtro
// ---------------------------------------------------------------------------

const LS_KEY = "viatik:filtros:workflow";

interface FiltrosWorkflow {
  anio: number;
  mes_desde: number;
  mes_hasta: number;
}

const CURRENT_YEAR = new Date().getFullYear();

function defaultFiltros(): FiltrosWorkflow {
  return { anio: CURRENT_YEAR, mes_desde: 1, mes_hasta: 12 };
}

function loadFiltros(): FiltrosWorkflow {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...defaultFiltros(), ...(JSON.parse(raw) as Partial<FiltrosWorkflow>) };
  } catch {
    // ignorar error de localStorage
  }
  return defaultFiltros();
}

function saveFiltros(f: FiltrosWorkflow) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(f));
  } catch {
    // ignorar error de localStorage
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function buildFechaDesde(f: FiltrosWorkflow) {
  return `${f.anio}-${pad2(f.mes_desde)}-01`;
}

function buildFechaHasta(f: FiltrosWorkflow) {
  const ultimo = new Date(f.anio, f.mes_hasta, 0).getDate();
  return `${f.anio}-${pad2(f.mes_hasta)}-${String(ultimo).padStart(2, "0")}`;
}

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const ANIOS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

// ---------------------------------------------------------------------------

export function WorkflowReportLayout() {
  const { empresaActivaId, empresaActiva, loading: loadingCompany } = useCompany();
  const [filtros, setFiltrosRaw] = useState<FiltrosWorkflow>(loadFiltros);
  const [tab, setTab] = useState("flujo");

  function setFiltros(f: FiltrosWorkflow) {
    setFiltrosRaw(f);
    saveFiltros(f);
  }

  const empresaId = empresaActivaId ?? null;

  // -------------------------------------------------------------------------
  // Params para hooks
  // -------------------------------------------------------------------------

  const fechaDesde = buildFechaDesde(filtros);
  const fechaHasta = buildFechaHasta(filtros);

  const filtroAprobaciones = empresaId
    ? { empresa_id: empresaId, fecha_desde: fechaDesde, fecha_hasta: fechaHasta }
    : null;

  const filtroRendiciones = empresaId
    ? { empresa_id: empresaId, fecha_desde: fechaDesde, fecha_hasta: fechaHasta }
    : null;

  const paramsTiempos = empresaId
    ? { p_empresa_id: empresaId, p_fecha_desde: fechaDesde, p_fecha_hasta: fechaHasta }
    : null;

  // -------------------------------------------------------------------------
  // Hooks FASE 8A — sin acceso directo a Supabase
  // -------------------------------------------------------------------------

  const aprobaciones = useRptAprobacionesEficiencia(filtroAprobaciones);
  const tiempos = useRptTiemposWorkflow(paramsTiempos);
  const rendiciones = useRptRendicionesEstado(filtroRendiciones);

  // -------------------------------------------------------------------------
  // Guards
  // -------------------------------------------------------------------------

  if (loadingCompany) return <LoadingState label="Cargando empresa..." />;

  if (!empresaId) {
    return (
      <EmptyState
        icon={Network}
        title="Sin empresa activa"
        description="Selecciona una empresa en la barra superior para ver el Workflow Analytics."
      />
    );
  }

  const empresaNombre = empresaActiva?.nombre ?? "";

  // -------------------------------------------------------------------------
  // Retry helpers
  // -------------------------------------------------------------------------

  function retryAprobaciones() {
    void aprobaciones.refetch();
  }
  function retryTiempos() {
    void tiempos.refetch();
  }
  function retryRendiciones() {
    void rendiciones.refetch();
  }

  // ─── Config exportación (tab activo) ───────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const exportConfig = useMemo<ExportConfig>(() => {
    const periodo = `${fechaDesde} / ${fechaHasta}`;
    if (tab === "flujo") {
      const rows: ExportRow[] = (tiempos.data ?? []).map((r) => ({
        rendicion: r.rendicion_numero,
        responsable: r.usuario_nombre,
        envio: r.fecha_envio,
        primera_accion: r.fecha_primera_accion,
        aprobacion: r.fecha_aprobacion_final,
        horas: r.horas_espera_total,
        acciones: r.n_acciones,
        rechazos: r.n_rechazos,
      }));
      return {
        filename: `viatiq-workflow-flujo-${filtros.anio}`,
        title: "Flujo de Aprobaciones",
        empresa: empresaNombre,
        filtros: { Periodo: periodo },
        rows,
        columns: [
          { key: "rendicion", header: "Rendición", width: 14 },
          { key: "responsable", header: "Responsable", width: 22 },
          { key: "envio", header: "Fecha Envío", width: 14, format: "date" },
          { key: "horas", header: "Horas Espera", width: 14, format: "number", align: "right" },
          { key: "acciones", header: "Acciones", width: 10, format: "number", align: "right" },
          { key: "rechazos", header: "Rechazos", width: 10, format: "number", align: "right" },
        ],
      };
    }
    if (tab === "aprobadores" || tab === "cuellos") {
      const rows: ExportRow[] = (aprobaciones.data ?? []).map((r) => ({
        aprobador: r.aprobador_nombre,
        paso: r.paso_nombre,
        workflow: r.workflow_nombre,
        rendicion: r.rendicion_numero,
        accion: r.accion_nombre,
        fecha: r.fecha_accion,
      }));
      return {
        filename: `viatiq-workflow-${tab}-${filtros.anio}`,
        title: tab === "aprobadores" ? "Aprobadores" : "Cuellos de Botella",
        empresa: empresaNombre,
        filtros: { Periodo: periodo },
        rows,
        columns: [
          { key: "aprobador", header: "Aprobador", width: 22 },
          { key: "paso", header: "Paso", width: 18 },
          { key: "workflow", header: "Workflow", width: 18 },
          { key: "rendicion", header: "Rendición", width: 14 },
          { key: "accion", header: "Acción", width: 14 },
          { key: "fecha", header: "Fecha", width: 14, format: "date" },
        ],
      };
    }
    // estados / sla → rendiciones
    const rows: ExportRow[] = (rendiciones.data ?? []).map((r) => ({
      numero: r.numero,
      usuario: r.usuario_nombre,
      estado: r.estado_nombre,
      fecha: r.fecha_rendicion,
      total: r.total_facturado,
      dias: r.dias_en_estado,
    }));
    return {
      filename: `viatiq-workflow-${tab}-${filtros.anio}`,
      title: tab === "estados" ? "Estados de Rendiciones" : "SLA Workflow",
      empresa: empresaNombre,
      filtros: { Periodo: periodo },
      rows,
      columns: [
        { key: "numero", header: "Rendición", width: 14 },
        { key: "usuario", header: "Responsable", width: 22 },
        { key: "estado", header: "Estado", width: 16 },
        { key: "fecha", header: "Fecha", width: 12, format: "date" },
        { key: "total", header: "Total USD", width: 14, format: "currency", align: "right" },
        { key: "dias", header: "Días en estado", width: 14, format: "number", align: "right" },
      ],
    };
  }, [
    tab,
    tiempos.data,
    aprobaciones.data,
    rendiciones.data,
    empresaNombre,
    filtros.anio,
    fechaDesde,
    fechaHasta,
  ]);

  const exportLoading = tiempos.isLoading || aprobaciones.isLoading || rendiciones.isLoading;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Cabecera */}
      <PageHeader
        title={`Workflow Analytics${empresaNombre ? ` · ${empresaNombre}` : ""}`}
        description="Analisis de flujos de aprobacion, tiempos y eficiencia del workflow"
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
        {/* Año */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Año</span>
          <Select
            value={String(filtros.anio)}
            onValueChange={(v) => setFiltros({ ...filtros, anio: Number(v) })}
          >
            <SelectTrigger className="h-8 w-[90px] text-xs" aria-label="Seleccionar año">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANIOS.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mes desde */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Desde</span>
          <Select
            value={String(filtros.mes_desde)}
            onValueChange={(v) =>
              setFiltros({ ...filtros, mes_desde: Math.min(Number(v), filtros.mes_hasta) })
            }
          >
            <SelectTrigger className="h-8 w-[120px] text-xs" aria-label="Mes inicio del periodo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mes hasta */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Hasta</span>
          <Select
            value={String(filtros.mes_hasta)}
            onValueChange={(v) =>
              setFiltros({ ...filtros, mes_hasta: Math.max(Number(v), filtros.mes_desde) })
            }
          >
            <SelectTrigger className="h-8 w-[120px] text-xs" aria-label="Mes fin del periodo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reset */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFiltros(defaultFiltros())}
          className="h-8 gap-1.5 text-xs"
          aria-label="Restablecer filtros de workflow analytics"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Restablecer
        </Button>

        <div className="ml-auto">
          <ExportMenu config={exportConfig} disabled={exportLoading} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="flujo" className="text-xs">
            Flujo
          </TabsTrigger>
          <TabsTrigger value="cuellos" className="text-xs">
            Cuellos de botella
          </TabsTrigger>
          <TabsTrigger value="aprobadores" className="text-xs">
            Aprobadores
          </TabsTrigger>
          <TabsTrigger value="estados" className="text-xs">
            Estados
          </TabsTrigger>
          <TabsTrigger value="sla" className="text-xs">
            SLA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flujo" className="mt-4">
          <WorkflowSummary
            data={tiempos.data ?? []}
            loading={tiempos.isLoading}
            error={tiempos.error}
            onRetry={retryTiempos}
          />
        </TabsContent>

        <TabsContent value="cuellos" className="mt-4">
          <WorkflowBottlenecks
            data={aprobaciones.data ?? []}
            loading={aprobaciones.isLoading}
            error={aprobaciones.error}
            onRetry={retryAprobaciones}
          />
        </TabsContent>

        <TabsContent value="aprobadores" className="mt-4">
          <WorkflowApprovers
            data={aprobaciones.data ?? []}
            loading={aprobaciones.isLoading}
            error={aprobaciones.error}
            onRetry={retryAprobaciones}
          />
        </TabsContent>

        <TabsContent value="estados" className="mt-4">
          <WorkflowStatus
            data={rendiciones.data ?? []}
            loading={rendiciones.isLoading}
            error={rendiciones.error}
            onRetry={retryRendiciones}
          />
        </TabsContent>

        <TabsContent value="sla" className="mt-4">
          <WorkflowSla
            data={tiempos.data ?? []}
            loading={tiempos.isLoading}
            error={tiempos.error}
            onRetry={retryTiempos}
          />
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <footer className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Network className="size-3" aria-hidden="true" />
        Datos actualizados cada 1 minuto · Workflow Analytics · FASE 8E
      </footer>
    </div>
  );
}
