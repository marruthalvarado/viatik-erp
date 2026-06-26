/**
 * RendicionDetail — vista detalle de una rendición con tabs de Gastos,
 * Documentos y Viajes, más edición inline y eliminación.
 */
import { useState } from "react";
import { Pencil, Trash2, ArrowLeft, FileText, Receipt, Plane, Send, Clock } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { DataTable } from "@/components/common/data-table";
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

import { useGastos } from "@/hooks/entities/use-gastos";
import { useDocumentos } from "@/hooks/entities/use-documentos";
import { useProyectos } from "@/hooks/entities/use-proyectos";
import { useEstadosRendicion, useTiposRendicion } from "@/hooks/entities/use-catalogs";
import { useActualizarRendicion, useEliminarRendicion } from "@/hooks/entities/use-rendiciones";
import { useCompany } from "@/contexts/company-context";
import { useAuth } from "@/contexts/auth-context";
import { formatCurrency, formatDate } from "@/utils/formatters";

import type { DataTableColumn } from "@/components/common/data-table";
import type { Rendicion, RendicionUpdate, Gasto, Documento } from "@/types/entities";

import { RendicionForm } from "./rendicion-form";
import { rendicionToForm, emptyToNull, estadoTone } from "./rendicion-types";
import type { RendicionFormValues } from "./rendicion-types";
import { ViajesTab } from "./viajes-tab";

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

function GastosTab({ rendicionId }: { rendicionId: string }) {
  const { data, isLoading } = useGastos({
    pageSize: 50,
    filters: { rendicion_id: rendicionId },
  });

  const gastos = data?.rows ?? [];

  const columns: DataTableColumn<Gasto>[] = [
    {
      key: "fecha",
      header: "Fecha",
      className: "w-28",
      cell: (row) => <span className="text-sm tabular-nums">{formatDate(row.fecha)}</span>,
    },
    {
      key: "descripcion",
      header: "Descripción",
      cell: (row) => <span className="text-sm">{row.descripcion ?? "—"}</span>,
    },
    {
      key: "numero_documento",
      header: "Documento",
      className: "w-36",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{row.numero_documento ?? "—"}</span>
      ),
    },
    {
      key: "valor_factura",
      header: "Valor",
      align: "right",
      cell: (row) => (
        <span className="tabular-nums text-sm">{formatCurrency(row.valor_factura)}</span>
      ),
    },
    {
      key: "valor_reembolsable",
      header: "Reembolsable",
      align: "right",
      cell: (row) => (
        <span className="tabular-nums text-sm">{formatCurrency(row.valor_reembolsable)}</span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data?.total ?? 0} gasto{(data?.total ?? 0) !== 1 ? "s" : ""} registrado
          {(data?.total ?? 0) !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Para agregar gastos usa el módulo{" "}
          <span className="font-medium text-foreground">Gastos</span>
        </p>
      </div>
      <DataTable
        columns={columns}
        data={gastos}
        isLoading={isLoading}
        getRowId={(row) => row.id}
        emptyTitle="Sin gastos"
        emptyDescription="Esta rendición no tiene gastos registrados."
      />
    </div>
  );
}

// ─── DocumentosTab ────────────────────────────────────────────────────────────

function DocumentosTab({ rendicionId }: { rendicionId: string }) {
  const { data, isLoading } = useDocumentos({
    pageSize: 50,
    filters: { rendicion_id: rendicionId },
  });

  const documentos = data?.rows ?? [];

  const columns: DataTableColumn<Documento>[] = [
    {
      key: "nombre_archivo",
      header: "Archivo",
      cell: (row) => (
        <span className="text-sm font-medium">{row.nombre_archivo ?? "Sin nombre"}</span>
      ),
    },
    {
      key: "procesado",
      header: "OCR",
      className: "w-28",
      cell: (row) => (
        <StatusBadge tone={row.procesado ? "success" : "neutral"}>
          {row.procesado ? "Procesado" : "Pendiente"}
        </StatusBadge>
      ),
    },
    {
      key: "created_at",
      header: "Subido",
      className: "w-36",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.created_at)}</span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data?.total ?? 0} documento{(data?.total ?? 0) !== 1 ? "s" : ""} registrado
          {(data?.total ?? 0) !== 1 ? "s" : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Para adjuntar documentos usa el módulo{" "}
          <span className="font-medium text-foreground">Documentos</span>
        </p>
      </div>
      <DataTable
        columns={columns}
        data={documentos}
        isLoading={isLoading}
        getRowId={(row) => row.id}
        emptyTitle="Sin documentos"
        emptyDescription="Esta rendición no tiene documentos adjuntos."
      />
    </div>
  );
}

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

  const { data: proyectosData } = useProyectos({ pageSize: 200 });
  const { data: estadosData } = useEstadosRendicion({ pageSize: 100 });
  const { data: tiposData } = useTiposRendicion({ pageSize: 100 });

  const actualizar = useActualizarRendicion();
  const eliminar = useEliminarRendicion();

  const proyectos = proyectosData?.rows ?? [];
  const estados = estadosData?.rows ?? [];
  const tipos = tiposData?.rows ?? [];

  const estadoCodigo = estados.find((e) => e.id === rendicion.estado_rendicion_id)?.codigo ?? null;
  const estadoNombre =
    estados.find((e) => e.id === rendicion.estado_rendicion_id)?.nombre ?? "Sin estado";
  const tipoNombre = tipos.find((t) => t.id === rendicion.tipo_rendicion_id)?.nombre ?? "—";
  const proyectoNombre =
    proyectos.find((p) => p.id === rendicion.proyecto_id)?.nombre ?? rendicion.proyecto_id;

  const puedeEnviar =
    (estadoCodigo === "borrador" || estadoCodigo === null) && !rendicion.workflow_id;

  async function handleSubmitEdit(values: RendicionFormValues) {
    if (!empresaActivaId || !user?.id) return;
    try {
      const payload: RendicionUpdate = {
        numero: values.numero,
        proyecto_id: values.proyecto_id,
        descripcion: emptyToNull(values.descripcion),
        fecha_rendicion: emptyToNull(values.fecha_rendicion),
        estado_rendicion_id: values.estado_rendicion_id ?? null,
        tipo_rendicion_id: values.tipo_rendicion_id ?? null,
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
              disabled
              aria-label="Enviar para aprobación (requiere workflow configurado)"
              title={
                puedeEnviar
                  ? "Requiere configurar un workflow de aprobación"
                  : "Solo disponible en estado borrador"
              }
            >
              <Send className="size-4" />
              Enviar para aprobación
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
