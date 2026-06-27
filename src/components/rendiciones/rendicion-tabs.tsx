/**
 * rendicion-tabs.tsx
 * Componentes de pestaña para Gastos y Documentos de una rendición.
 * Consumidos por RendicionDetail (rendicion-detail.tsx).
 */
import { DataTable } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { useGastos } from "@/hooks/entities/use-gastos";
import { useDocumentos } from "@/hooks/entities/use-documentos";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { DataTableColumn } from "@/components/common/data-table";
import type { Gasto, Documento } from "@/types/entities";

export function GastosTab({ rendicionId }: { rendicionId: string }) {
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

// ─── DocumentosTab ────────────────────────────────────────────────────────────

export function DocumentosTab({ rendicionId }: { rendicionId: string }) {
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
