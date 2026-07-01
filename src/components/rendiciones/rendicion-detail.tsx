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

import { useProyectos } from "@/hooks/entities/use-proyectos";
import { useEstadosRendicion, useTiposRendicion } from "@/hooks/entities/use-catalogs";
import { useActualizarRendicion, useEliminarRendicion } from "@/hooks/entities/use-rendiciones";
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
        <FinancialCard label="Total facturado" value={formatCurrency(rendicion.total_facturado)} />
        <FinancialCard label="Reembolsable" value={formatCurrency(rendicion.total_reembolsable)} />
        <FinancialCard label="Anticipos" value={formatCurrency(rendicion.total_anticipos)} />
        <FinancialCard
          label="Saldo"
          value={formatCurrency(rendicion.saldo)}
          highlight={(rendicion.saldo ?? 0) < 0 ? "danger" : "normal"}
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
