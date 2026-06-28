import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, FileText as FileIcon, ScanLine } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { DataTable } from "@/components/common/data-table";
import { SearchBar } from "@/components/common/search-bar";
import { Pagination } from "@/components/common/pagination";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "@/components/common/toast";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/common/drawer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AiExpenseWizard } from "@/components/ai/ai-expense-wizard";

import {
  useDocumentos,
  useCrearDocumento,
  useActualizarDocumento,
  useEliminarDocumento,
} from "@/hooks/entities/use-documentos";
import { useRendiciones } from "@/hooks/entities/use-rendiciones";
import { useCategoriasDocumento, useTiposDocumento } from "@/hooks/entities/use-catalogs";
import { useCompany } from "@/contexts/company-context";
import { formatDateTime, emptyToNull } from "@/utils/formatters";

import type { DataTableColumn } from "@/components/common/data-table";
import type { Documento, DocumentoInsert, DocumentoUpdate } from "@/types/entities";
import type { ListParams } from "@/types/common";

import { DocumentoForm } from "@/components/documentos/documento-form";
import {
  EMPTY_DOCUMENTO,
  documentoToForm,
  formatFileSize,
} from "@/components/documentos/documento-types";
import type { DocumentoFormValues } from "@/components/documentos/documento-types";

export const Route = createFileRoute("/documentos")({
  head: () => ({ meta: [{ title: "Documentos · VIATIQ" }] }),
  component: DocumentosPage,
});

function DocumentosPage() {
  return (
    <AppShell>
      <DocumentosContent />
    </AppShell>
  );
}

function DocumentosContent() {
  const { empresaActivaId } = useCompany();
  const [params, setParams] = useState<ListParams>({ page: 1, pageSize: 25 });
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDocumento, setEditingDocumento] = useState<Documento | null>(null);
  const [deletingDocumento, setDeletingDocumento] = useState<Documento | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data, isLoading, error } = useDocumentos({ ...params, search });
  const { data: rendicionesData } = useRendiciones({ pageSize: 200 });
  const { data: categoriasData } = useCategoriasDocumento({ pageSize: 200 });
  const { data: tiposData } = useTiposDocumento({ pageSize: 200 });
  const crear = useCrearDocumento();
  const actualizar = useActualizarDocumento();
  const eliminar = useEliminarDocumento();

  const rendiciones = rendicionesData?.rows ?? [];
  const categorias = categoriasData?.rows ?? [];
  const tipos = tiposData?.rows ?? [];

  const rendicionLabel = (id: string) => rendiciones.find((r) => r.id === id)?.numero ?? id;
  const categoriaLabel = (id: string | null | undefined) =>
    id ? (categorias.find((c) => c.id === id)?.nombre ?? "—") : "—";
  const tipoLabel = (id: string | null | undefined) =>
    id ? (tipos.find((t) => t.id === id)?.nombre ?? "—") : "—";

  const columns: DataTableColumn<Documento>[] = [
    {
      key: "nombre_archivo",
      header: "Archivo",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <FileIcon className="size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{row.nombre_archivo ?? "Sin nombre"}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(row.tamano)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "rendicion",
      header: "Rendición",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{rendicionLabel(row.rendicion_id)}</span>
      ),
    },
    {
      key: "categoria",
      header: "Categoría",
      cell: (row) => categoriaLabel(row.categoria_documento_id),
    },
    { key: "tipo", header: "Tipo", cell: (row) => tipoLabel(row.tipo_documento_id) },
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
      className: "w-40",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</span>
      ),
    },
    {
      key: "acciones",
      header: "",
      className: "w-[88px]",
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Editar documento"
            onClick={(e) => {
              e.stopPropagation();
              setEditingDocumento(row);
              setDrawerOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label="Eliminar documento"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingDocumento(row);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  function handleOpenNew() {
    setEditingDocumento(null);
    setDrawerOpen(true);
  }
  function handleCloseDrawer() {
    setDrawerOpen(false);
    setEditingDocumento(null);
  }

  async function handleSubmit(values: DocumentoFormValues) {
    if (!empresaActivaId) {
      toast.error("Selecciona una empresa activa antes de continuar.");
      return;
    }
    try {
      if (editingDocumento) {
        const payload: DocumentoUpdate = {
          rendicion_id: values.rendicion_id,
          nombre_archivo: emptyToNull(values.nombre_archivo),
          categoria_documento_id: values.categoria_documento_id ?? null,
          tipo_documento_id: values.tipo_documento_id ?? null,
          procesado: values.procesado ?? false,
        };
        await actualizar.mutateAsync({ id: editingDocumento.id, payload });
        toast.success("Documento actualizado correctamente.");
      } else {
        const payload: DocumentoInsert = {
          empresa_id: empresaActivaId,
          rendicion_id: values.rendicion_id,
          nombre_archivo: emptyToNull(values.nombre_archivo),
          categoria_documento_id: values.categoria_documento_id ?? null,
          tipo_documento_id: values.tipo_documento_id ?? null,
          procesado: values.procesado ?? false,
        };
        await crear.mutateAsync(payload);
        toast.success("Documento registrado correctamente.");
      }
      handleCloseDrawer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el documento.");
    }
  }

  async function handleDelete() {
    if (!deletingDocumento) return;
    try {
      await eliminar.mutateAsync(deletingDocumento.id);
      toast.success("Documento eliminado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el documento.");
    } finally {
      setDeletingDocumento(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Documentos"
        description="Facturas, recibos y archivos contables."
        breadcrumbs={[{ label: "Documentos" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setWizardOpen(true)}
              size="sm"
              variant="secondary"
              className="gap-1.5"
            >
              <ScanLine className="size-4" />
              Subir factura IA
            </Button>
            <Button onClick={handleOpenNew} size="sm" className="gap-1.5">
              <Plus className="size-4" />
              Nuevo documento
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setParams((p) => ({ ...p, page: 1 }));
          }}
          placeholder="Buscar por nombre de archivo..."
        />
      </div>

      {error ? (
        <EmptyState
          title="Error al cargar documentos"
          description={error instanceof Error ? error.message : "Ocurrió un error inesperado."}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.rows ?? []}
            isLoading={isLoading}
            getRowId={(row) => row.id}
            emptyTitle="Sin documentos"
            emptyDescription="Registra el primer documento con el botón Nuevo documento."
            emptyAction={
              <Button size="sm" onClick={handleOpenNew} className="gap-1.5">
                <Plus className="size-4" />
                Nuevo documento
              </Button>
            }
          />
          {data && data.total > 0 && (
            <div className="mt-3">
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={(page) => setParams((p) => ({ ...p, page }))}
              />
            </div>
          )}
        </>
      )}

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseDrawer();
        }}
      >
        <DrawerContent className="sm:max-w-lg">
          <DrawerHeader>
            <DrawerTitle>{editingDocumento ? "Editar documento" : "Nuevo documento"}</DrawerTitle>
            <DrawerDescription>
              {editingDocumento
                ? "Modifica los metadatos del documento."
                : "Registra los metadatos. La carga de archivos estará disponible al integrar Supabase Storage."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-6 pb-6">
            <DocumentoForm
              defaultValues={editingDocumento ? documentoToForm(editingDocumento) : EMPTY_DOCUMENTO}
              onSubmit={handleSubmit}
              onCancel={handleCloseDrawer}
              loading={crear.isPending || actualizar.isPending}
              submitLabel={editingDocumento ? "Guardar cambios" : "Registrar documento"}
              rendiciones={rendiciones}
              categorias={categorias}
              tipos={tipos}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <DeleteDialog
        open={!!deletingDocumento}
        onOpenChange={(open) => {
          if (!open) setDeletingDocumento(null);
        }}
        entityLabel={`el documento "${deletingDocumento?.nombre_archivo ?? "sin nombre"}"`}
        onConfirm={handleDelete}
        loading={eliminar.isPending}
      />

      {/* Wizard IA: subida de factura → OCR → IA → gasto */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subir factura con IA</DialogTitle>
            <DialogDescription>
              Sube una imagen o PDF. La IA leerá el documento y pre-llenará el formulario de gasto.
            </DialogDescription>
          </DialogHeader>
          <AiExpenseWizard
            onSuccess={(_documentoId, _gastoId) => {
              setWizardOpen(false);
            }}
            onCancel={() => setWizardOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
