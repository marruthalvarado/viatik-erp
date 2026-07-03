/**
 * RendicionDetail — vista detalle de una rendición con tabs de Gastos,
 * Documentos y Viajes, más edición inline y eliminación.
 */
import { useState } from "react";
import {
  Pencil,
  Trash2,
  ArrowLeft,
  FileText,
  Receipt,
  Plane,
  GitBranch,
  Clock,
  Download,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { toast } from "@/components/common/toast";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/common/drawer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProyectos } from "@/hooks/entities/use-proyectos";
import { useEstadosRendicion, useTiposRendicion } from "@/hooks/entities/use-catalogs";
import { useActualizarRendicion, useEliminarRendicion } from "@/hooks/entities/use-rendiciones";
import { useViajes } from "@/hooks/entities/use-viajes";
import { usePoliticas } from "@/hooks/entities/use-politicas";
import { useCompany } from "@/contexts/company-context";
import { useAuth } from "@/contexts/auth-context";
import { formatCurrency, formatDate } from "@/utils/formatters";

import type { Rendicion, RendicionUpdate } from "@/types/entities";

import { RendicionForm } from "./rendicion-form";
import { rendicionToForm, emptyToNull, estadoTone } from "./rendicion-types";
import type { RendicionFormValues } from "./rendicion-types";
import { ViajesTab } from "./viajes-tab";
import { exportarLiquidacion } from "@/services/liquidacion-export";
import { WorkflowTab } from "./workflow-tab";
import { useWorkflows } from "@/hooks/entities/use-workflow";

// ─── FinancialCard ────────────────────────────────────────────────────────────

interface FinancialCardProps {
  label: string;
  value: string;
  highlight?: "danger" | "normal";
}

function FinancialCard({ label, value, highlight = "normal" }: FinancialCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${highlight === "danger" ? "text-destructive" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

// ─── GastosTab ────────────────────────────────────────────────────────────────

import { GastosTab, DocumentosTab } from "./rendicion-tabs";

// ─── RendicionDetail (exportado) ──────────────────────────────────────────────

export interface RendicionDetailProps {
  rendicion: Rendicion;
  onBack: () => void;
  onUpdated: (r: Rendicion) => void;
}

export function RendicionDetail({ rendicion, onBack, onUpdated }: RendicionDetailProps) {
  const { empresaActivaId } = useCompany();
  const { user } = useAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deletingRendicion, setDeletingRendicion] = useState(false);
  const [exportando, setExportando] = useState(false);

  const { data: proyectosData } = useProyectos({ pageSize: 200 });
  const { data: estadosData } = useEstadosRendicion({ pageSize: 100 });
  const { data: tiposData } = useTiposRendicion({ pageSize: 100 });
  const { data: workflowsData } = useWorkflows();

  const actualizar = useActualizarRendicion();
  const eliminar = useEliminarRendicion();

  // --- Computo de total efectivo (gastos filtrados + vehiculo propio + km ciudad) ---
  const { data: viajesData } = useViajes({
    pageSize: 50,
    filters: { rendicion_id: rendicion.id },
  });
  const { data: politicasData } = usePoliticas({ pageSize: 1 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gastosRaw = [], isSuccess: gastosLoaded } = useQuery<any[]>({
    queryKey: ["gastos-enriquecidos", rendicion.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("gastos")
        .select("*, categorias_gasto(nombre)")
        .eq("rendicion_id", rendicion.id)
        .is("deleted_at", null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any[];
    },
  });
  const viajesLoaded = viajesData !== undefined;

  const politica = politicasData?.rows?.[0] ?? null;
  const valorKm = Number(politica?.valor_km ?? 0);
  const kmCiudadDia = Number(politica?.km_ciudad_por_dia ?? 0);
  const viajes = viajesData?.rows ?? [];

  const viajePropio = viajes.find((v) => v.vehiculo_propio) ?? viajes[0] ?? null;
  const diasViaje =
    viajePropio?.fecha_inicio && viajePropio?.fecha_fin
      ? Math.ceil(
          (new Date(viajePropio.fecha_fin).getTime() -
            new Date(viajePropio.fecha_inicio).getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1
      : 0;
  const kmPropio = viajes
    .filter((v) => v.vehiculo_propio && (v.distancia_km ?? 0) > 0)
    .reduce((s, v) => s + Number(v.distancia_km ?? 0) * 2 * valorKm, 0);
  const kmCiudad = diasViaje > 0 && kmCiudadDia > 0 ? diasViaje * kmCiudadDia * valorKm : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gastosSum = (gastosRaw as any[]).reduce((s: number, g: any) => {
    const catNombre: string = g.categorias_gasto?.nombre ?? "";

    let val: number = Number(g.valor_factura ?? 0);
    if (politica?.paga_combustible === false && catNombre === "Combustible") val = 0;
    if (politica?.paga_peajes === false && catNombre === "Peaje") val = 0;
    return s + val;
  }, 0);

  const totalEfectivo = gastosSum + kmPropio + kmCiudad;
  const dataReady = gastosLoaded && viajesLoaded;
  const displayTotal = dataReady ? totalEfectivo : Number(rendicion.total_facturado ?? 0);
  const displaySaldo = displayTotal - Number(rendicion.total_anticipos ?? 0);
  // -------------------------------------------------------------------------------

  const proyectos = proyectosData?.rows ?? [];
  const estados = estadosData?.rows ?? [];
  const tipos = tiposData?.rows ?? [];
  const tieneWorkflowActivo = (workflowsData?.length ?? 0) > 0;

  const estadoCodigo = estados.find((e) => e.id === rendicion.estado_rendicion_id)?.codigo ?? null;
  const estadoNombre =
    estados.find((e) => e.id === rendicion.estado_rendicion_id)?.nombre ?? "Sin estado";
  const tipoNombre = tipos.find((t) => t.id === rendicion.tipo_rendicion_id)?.nombre ?? "—";
  const proyectoNombre =
    proyectos.find((p) => p.id === rendicion.proyecto_id)?.nombre ?? rendicion.proyecto_id;

  async function handleSubmitEdit(values: RendicionFormValues) {
    if (!empresaActivaId || !user?.id) return;
    try {
      const payload: RendicionUpdate = {
        numero: values.numero,
        proyecto_id: values.proyecto_id,
        descripcion: emptyToNull(values.descripcion),
        motivo: emptyToNull(values.motivo),
        fecha_rendicion: emptyToNull(values.fecha_rendicion),
        estado_rendicion_id: values.estado_rendicion_id ?? null,
        tipo_rendicion_id: values.tipo_rendicion_id ?? null,
        anticipo_efectivo: values.anticipo_efectivo ?? null,
        anticipo_credito: values.anticipo_credito ?? null,
      };
      const updated = await actualizar.mutateAsync({ id: rendicion.id, payload });
      onUpdated(updated);
      toast.success("Rendición actualizada.");
      setDrawerOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar.");
    }
  }

  async function handleDelete() {
    try {
      await eliminar.mutateAsync(rendicion.id);
      toast.success(`Rendición "${rendicion.numero}" eliminada.`);
      onBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar.");
    } finally {
      setDeletingRendicion(false);
    }
  }

  async function handleExportarLiquidacion() {
    setExportando(true);
    try {
      await exportarLiquidacion(rendicion);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar la liquidación.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <>
      <div className="mb-1 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          aria-label="Volver al listado de rendiciones"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
          Rendiciones
        </Button>
      </div>

      <PageHeader
        title={rendicion.numero}
        description={`${proyectoNombre}${rendicion.descripcion ? ` · ${rendicion.descripcion}` : ""}`}
        breadcrumbs={[{ label: "Rendiciones" }, { label: rendicion.numero }]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge tone={estadoTone(estadoCodigo)}>{estadoNombre}</StatusBadge>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-label="Exportar liquidación de viáticos"
              disabled={exportando}
              onClick={() => void handleExportarLiquidacion()}
            >
              <Download className="size-4" />
              {exportando ? "Generando…" : "Liquidación"}
            </Button>

            {/* El botón de envío ahora vive en el tab Workflow — acceso directo aquí */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-label="Ir al tab Workflow"
              onClick={() => {
                const tab = document.querySelector<HTMLButtonElement>('[data-tab="workflow"]');
                tab?.click();
              }}
            >
              <GitBranch className="size-4" />
              Workflow
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Editar rendición"
              onClick={() => setDrawerOpen(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              aria-label="Eliminar rendición"
              onClick={() => setDeletingRendicion(true)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        }
      />

      {/* Resumen financiero */}
      <div className="mb-6 mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FinancialCard label="Total facturado" value={formatCurrency(displayTotal)} />
        <FinancialCard label="Reembolsable" value={formatCurrency(rendicion.total_reembolsable)} />
        <FinancialCard label="Anticipos" value={formatCurrency(rendicion.total_anticipos)} />
        <FinancialCard
          label="Saldo"
          value={formatCurrency(displaySaldo)}
          highlight={displaySaldo < 0 ? "danger" : "normal"}
        />
      </div>

      {/* Metadatos */}
      <div className="mb-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">Fecha:</span>{" "}
          {formatDate(rendicion.fecha_rendicion)}
        </span>
        <span>
          <span className="font-medium text-foreground">Tipo:</span> {tipoNombre}
        </span>
        {rendicion.fecha_envio && (
          <span>
            <Clock className="mr-1 inline size-3.5" />
            Enviada: {formatDate(rendicion.fecha_envio)}
          </span>
        )}
        {rendicion.fecha_aprobacion && (
          <span>
            <Clock className="mr-1 inline size-3.5" />
            Aprobada: {formatDate(rendicion.fecha_aprobacion)}
          </span>
        )}
        {rendicion.workflow_id && <span className="text-info">Workflow configurado</span>}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="gastos">
        <TabsList className="mb-4">
          <TabsTrigger value="gastos" className="gap-1.5">
            <Receipt className="size-4" />
            Gastos
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1.5">
            <FileText className="size-4" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="viajes" className="gap-1.5">
            <Plane className="size-4" />
            Viajes
          </TabsTrigger>
          <TabsTrigger value="workflow" data-tab="workflow" className="gap-1.5">
            <GitBranch className="size-4" />
            Workflow
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gastos">
          <GastosTab rendicionId={rendicion.id} />
        </TabsContent>

        <TabsContent value="documentos">
          <DocumentosTab rendicionId={rendicion.id} />
        </TabsContent>

        <TabsContent value="viajes">
          <ViajesTab rendicionId={rendicion.id} />
        </TabsContent>

        <TabsContent value="workflow">
          <WorkflowTab
            rendicion={rendicion}
            estadoCodigo={estadoCodigo}
            estadoNombre={estadoNombre}
            tieneWorkflowActivo={tieneWorkflowActivo}
          />
        </TabsContent>
      </Tabs>

      {/* Edit drawer */}
      <Drawer open={drawerOpen} onOpenChange={(open) => !open && setDrawerOpen(false)}>
        <DrawerContent className="sm:max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Editar rendición</DrawerTitle>
            <DrawerDescription>Modifica los datos de la rendición.</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-6 pb-6">
            <RendicionForm
              defaultValues={rendicionToForm(rendicion)}
              onSubmit={handleSubmitEdit}
              onCancel={() => setDrawerOpen(false)}
              loading={actualizar.isPending}
              submitLabel="Guardar cambios"
              proyectos={proyectos}
              estados={estados}
              tipos={tipos}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <DeleteDialog
        open={deletingRendicion}
        onOpenChange={(open) => !open && setDeletingRendicion(false)}
        entityLabel={`la rendición "${rendicion.numero}"`}
        onConfirm={handleDelete}
        loading={eliminar.isPending}
      />
    </>
  );
}
