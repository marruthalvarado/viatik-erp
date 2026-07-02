/**
 * rendicion-tabs.tsx
 * Componentes de pestaña para Gastos y Documentos de una rendicion.
 * Consumidos por RendicionDetail (rendicion-detail.tsx).
 */
import { DataTable } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { useGastos } from "@/hooks/entities/use-gastos";
import { useDocumentos } from "@/hooks/entities/use-documentos";
import { useViajes } from "@/hooks/entities/use-viajes";
import { usePoliticas } from "@/hooks/entities/use-politicas";
import { useCompany } from "@/contexts/company-context";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { DataTableColumn } from "@/components/common/data-table";
import type { Gasto, Documento, Viaje } from "@/types/entities";

// --- KmVehiculoPropioTable ---------------------------------------------------

interface KmRow {
  id: string;
  trayecto: string;
  fecha: string | null;
  km: number;
  valorKm: number;
  total: number;
}

function KmVehiculoPropioTable({ viajes, valorKm }: { viajes: Viaje[]; valorKm: number }) {
  const rows: KmRow[] = viajes
    .filter((v) => v.vehiculo_propio && (v.distancia_km ?? 0) > 0)
    .flatMap((v) => {
      const km = v.distancia_km ?? 0;
      const idaTrayecto = v.origen ? `${v.origen} → ${v.destino}` : v.destino;
      const retornoTrayecto = v.origen
        ? `${v.destino} → ${v.origen} (retorno)`
        : `${v.destino} (retorno)`;
      return [
        {
          id: `${v.id}_ida`,
          trayecto: idaTrayecto,
          fecha: v.fecha_inicio,
          km,
          valorKm,
          total: km * valorKm,
        },
        {
          id: `${v.id}_retorno`,
          trayecto: retornoTrayecto,
          fecha: v.fecha_inicio,
          km,
          valorKm,
          total: km * valorKm,
        },
      ];
    });

  if (rows.length === 0) return null;

  const totalKm = rows.reduce((s, r) => s + r.km, 0);
  const totalValor = rows.reduce((s, r) => s + r.total, 0);

  const columns: DataTableColumn<KmRow>[] = [
    {
      key: "trayecto",
      header: "Trayecto",
      cell: (row) => <span className="text-sm">{row.trayecto}</span>,
    },
    {
      key: "fecha",
      header: "Fecha",
      className: "w-28",
      cell: (row) => (
        <span className="text-sm tabular-nums">{row.fecha ? formatDate(row.fecha) : "—"}</span>
      ),
    },
    {
      key: "km",
      header: "Km",
      align: "right",
      className: "w-20",
      cell: (row) => <span className="tabular-nums text-sm">{row.km} km</span>,
    },
    {
      key: "valorKm",
      header: "$/km",
      align: "right",
      className: "w-24",
      cell: (row) => <span className="tabular-nums text-sm">{formatCurrency(row.valorKm)}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      className: "w-28",
      cell: (row) => (
        <span className="tabular-nums text-sm font-medium">{formatCurrency(row.total)}</span>
      ),
    },
  ];

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">Vehiculo propio</h3>
        <span className="text-xs text-muted-foreground">
          {totalKm} km · {formatCurrency(totalValor)}
        </span>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={false}
        getRowId={(row) => row.id}
        emptyTitle=""
        emptyDescription=""
      />
    </div>
  );
}

// --- GastosTab ---------------------------------------------------------------

export function GastosTab({ rendicionId }: { rendicionId: string }) {
  const { empresaActivaId } = useCompany();
  void empresaActivaId; // usePoliticas reads empresa from context internally

  const { data, isLoading } = useGastos({
    pageSize: 50,
    filters: { rendicion_id: rendicionId },
  });

  const { data: viajesData } = useViajes({
    pageSize: 50,
    filters: { rendicion_id: rendicionId },
  });

  const { data: politicasData } = usePoliticas({ pageSize: 1 });

  const gastos = data?.rows ?? [];
  const viajes = viajesData?.rows ?? [];
  const valorKm = politicasData?.rows?.[0]?.valor_km ?? 0;

  const viajesConVehiculoPropio = viajes.filter(
    (v) => v.vehiculo_propio && (v.distancia_km ?? 0) > 0,
  );

  const columns: DataTableColumn<Gasto>[] = [
    {
      key: "fecha",
      header: "Fecha",
      className: "w-28",
      cell: (row) => <span className="text-sm tabular-nums">{formatDate(row.fecha)}</span>,
    },
    {
      key: "descripcion",
      header: "Descripcion",
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
          Para agregar gastos usa el modulo{" "}
          <span className="font-medium text-foreground">Gastos</span>
        </p>
      </div>
      <DataTable
        columns={columns}
        data={gastos}
        isLoading={isLoading}
        getRowId={(row) => row.id}
        emptyTitle="Sin gastos"
        emptyDescription="Esta rendicion no tiene gastos registrados."
      />
      {viajesConVehiculoPropio.length > 0 && (
        <KmVehiculoPropioTable viajes={viajesConVehiculoPropio} valorKm={valorKm} />
      )}
      {viajesConVehiculoPropio.length > 0 && valorKm === 0 && (
        <p className="mt-2 text-xs text-amber-600">
          Configura el valor por km en{" "}
          <span className="font-medium">Administracion → Politicas</span> para ver el costo total.
        </p>
      )}
    </div>
  );
}

// --- DocumentosTab -----------------------------------------------------------

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
          Para adjuntar documentos usa el modulo{" "}
          <span className="font-medium text-foreground">Documentos</span>
        </p>
      </div>
      <DataTable
        columns={columns}
        data={documentos}
        isLoading={isLoading}
        getRowId={(row) => row.id}
        emptyTitle="Sin documentos"
        emptyDescription="Esta rendicion no tiene documentos adjuntos."
      />
    </div>
  );
}
