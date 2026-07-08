/**
 * rendicion-tabs.tsx
 * Componentes de pestaña para Gastos y Documentos de una rendicion.
 * Consumidos por RendicionDetail (rendicion-detail.tsx).
 */
import { useState } from "react";
import { Plus, ScanLine, Send } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentos } from "@/hooks/entities/use-documentos";
import { useViajes } from "@/hooks/entities/use-viajes";
import { usePoliticas } from "@/hooks/entities/use-politicas";
import { useCompany } from "@/contexts/company-context";
import { formatCurrency, formatDate, emptyToNull } from "@/utils/formatters";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/common/drawer";
import { GastoForm } from "@/components/gastos/gasto-form";
import { EMPTY_FORM } from "@/components/gastos/gasto-types";
import type { GastoFormValues } from "@/components/gastos/gasto-types";
import { useCrearGasto } from "@/hooks/entities/use-gastos";
import { useProveedores } from "@/hooks/entities/use-proveedores";
import { useCategoriasGasto, useEstadosGasto, useMonedas } from "@/hooks/entities/use-catalogs";
import { toast } from "@/components/common/toast";
import { AiExpenseWizard } from "@/components/ai/ai-expense-wizard";
import { useEnviarAprobacion } from "@/hooks/entities/use-workflow";
import type { DataTableColumn } from "@/components/common/data-table";
import type { Gasto, Documento, Viaje, GastoInsert, Politica } from "@/types/entities";

// --- Helpers para violaciones de política ------------------------------------

function getTope(catNombre: string, pol: Politica): number | null {
  const n = catNombre.toLowerCase();
  if (n.includes("desayuno")) return pol.tope_desayuno;
  if (n.includes("almuerzo")) return pol.tope_almuerzo;
  if (n.includes("cena")) return pol.tope_cena;
  if (n.includes("hospedaje") || n.includes("hotel") || n.includes("alojamiento"))
    return pol.tope_hospedaje;
  if (n.includes("miscel")) return pol.tope_miscelaneo;
  return null;
}

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

export function GastosTab({
  rendicionId,
  rendicionNumero,
  rendicionEstadoCodigo,
  rendicionProyectoId,
}: {
  rendicionId: string;
  rendicionNumero: string;
  rendicionEstadoCodigo: string | null;
  rendicionProyectoId: string | null;
}) {
  const { empresaActivaId } = useCompany();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [confirmarEnvio, setConfirmarEnvio] = useState(false);
  const enviarAprobacion = useEnviarAprobacion();

  // Catalog data for the gasto form
  const { data: proveedoresData } = useProveedores({ pageSize: 200 });
  const { data: categoriasData } = useCategoriasGasto({ pageSize: 200 });
  const { data: estadosData } = useEstadosGasto({ pageSize: 200 });
  const { data: monedasData } = useMonedas({ pageSize: 200 });
  const crear = useCrearGasto();

  const proveedores = proveedoresData?.rows ?? [];
  const categorias = categoriasData?.rows ?? [];
  const estados = estadosData?.rows ?? [];
  const monedas = monedasData?.rows ?? [];

  async function handleSaveGasto(values: GastoFormValues) {
    if (!empresaActivaId) {
      toast.error("Selecciona una empresa activa antes de continuar.");
      return;
    }
    const payload: GastoInsert = {
      empresa_id: empresaActivaId,
      rendicion_id: rendicionId,
      descripcion: emptyToNull(values.descripcion),
      numero_documento: emptyToNull(values.numero_documento),
      fecha: emptyToNull(values.fecha),
      categoria_gasto_id: values.categoria_gasto_id ?? null,
      estado_gasto_id: values.estado_gasto_id ?? null,
      proveedor_id: values.proveedor_id ?? null,
      moneda_codigo: values.moneda_codigo ?? null,
      valor_factura: values.valor_factura ?? null,
      valor_moneda_origen: values.valor_moneda_origen ?? null,
      tipo_cambio: values.tipo_cambio ?? null,
      valor_reembolsable: values.valor_reembolsable ?? null,
      observaciones: emptyToNull(values.observaciones),
    };
    await crear.mutateAsync(payload);
    await queryClient.invalidateQueries({ queryKey: ["gastos-enriquecidos", rendicionId] });
    toast.success("Gasto registrado correctamente.");
    setDrawerOpen(false);
  }

  async function handleEnviar() {
    if (gastosRaw.length === 0) {
      setAlertMsg("Debes registrar al menos un gasto antes de enviar la rendición.");
      return;
    }
    if (!rendicionProyectoId) {
      setAlertMsg("La rendición debe tener un proyecto asignado antes de enviarse.");
      return;
    }
    if (rendicionEstadoCodigo !== "registrada") {
      setAlertMsg(
        `Esta rendición está en estado "${rendicionEstadoCodigo ?? "desconocido"}" y no puede enviarse nuevamente.`,
      );
      return;
    }
    setConfirmarEnvio(true);
  }

  async function handleConfirmarEnvio() {
    try {
      await enviarAprobacion.mutateAsync(rendicionId);
      toast.success("Rendición enviada a aprobación correctamente.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar la rendición.");
    } finally {
      setConfirmarEnvio(false);
    }
  }

  // Fetch gastos enriched with category name for policy filtering
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gastosRaw = [], isLoading } = useQuery<any[]>({
    queryKey: ["gastos-enriquecidos", rendicionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("gastos")
        .select("*, categorias_gasto(nombre)")
        .eq("rendicion_id", rendicionId)
        .is("deleted_at", null)
        .order("fecha");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any[];
    },
  });

  const { data: viajesData } = useViajes({
    pageSize: 50,
    filters: { rendicion_id: rendicionId },
  });

  const { data: politicasData } = usePoliticas({ pageSize: 1 });

  const politica = politicasData?.rows?.[0] ?? null;
  const valorKm = Number(politica?.valor_km ?? 0);
  const kmCiudadDia = Number(politica?.km_ciudad_por_dia ?? 0);

  // Apply policy filter: zero out excluded categories
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gastos: Gasto[] = (gastosRaw as any[]).map((g) => {
    const catNombre: string = g.categorias_gasto?.nombre ?? "";

    let valorFactura: number = Number(g.valor_factura ?? 0);
    if (politica?.paga_combustible === false && catNombre === "Combustible") valorFactura = 0;
    if (politica?.paga_peajes === false && catNombre === "Peaje") valorFactura = 0;

    return { ...g, valor_factura: valorFactura } as Gasto;
  });

  const viajes = viajesData?.rows ?? [];

  const viajesConVehiculoPropio = viajes.filter(
    (v) => v.vehiculo_propio && (v.distancia_km ?? 0) > 0,
  );

  // Movilización en ciudad
  const viajeMain = viajes[0] ?? null;
  const diasViaje =
    viajeMain?.fecha_inicio && viajeMain?.fecha_fin
      ? Math.ceil(
          (new Date(viajeMain.fecha_fin).getTime() - new Date(viajeMain.fecha_inicio).getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1
      : 0;
  const kmCiudadTotal =
    viajeMain?.vehiculo_propio && diasViaje > 0 && kmCiudadDia > 0
      ? diasViaje * kmCiudadDia * valorKm
      : 0;

  // Mapa id → nombre de categoría (para badges de violación)
  const gastoCategoriaMap = new Map<string, string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (gastosRaw as any[]).map((g) => [g.id as string, (g.categorias_gasto?.nombre ?? "") as string]),
  );

  // Rango de fechas del viaje para badge fuera de rango
  const viajeInicio = viajeMain?.fecha_inicio ?? null;
  const viajeFin = viajeMain?.fecha_fin ?? null;
  const rechazaFueraRango = politica?.acepta_facturas_fuera_rango === false;

  const columns: DataTableColumn<Gasto>[] = [
    {
      key: "fecha",
      header: "Fecha",
      className: "w-32",
      cell: (row) => {
        const fueraRango =
          rechazaFueraRango &&
          row.fecha &&
          viajeInicio &&
          viajeFin &&
          (row.fecha < viajeInicio || row.fecha > viajeFin);
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm tabular-nums">{formatDate(row.fecha)}</span>
            {fueraRango && (
              <span className="rounded border border-orange-300 bg-orange-50 px-1.5 py-0.5 text-xs font-medium text-orange-700">
                Fuera de rango
              </span>
            )}
          </div>
        );
      },
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
      cell: (row) => {
        const catNombre = gastoCategoriaMap.get(row.id) ?? "";
        const tope = politica ? getTope(catNombre, politica) : null;
        const excede = tope != null && tope > 0 && Number(row.valor_factura) > tope;
        return (
          <div className="flex items-center justify-end gap-2">
            <span className="tabular-nums text-sm">{formatCurrency(row.valor_factura)}</span>
            {excede && (
              <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                ⚠ Excede tope
              </span>
            )}
          </div>
        );
      },
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
    <>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {gastosRaw.length} gasto{gastosRaw.length !== 1 ? "s" : ""} registrado
            {gastosRaw.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setWizardOpen(true)}>
              <ScanLine className="mr-1 size-3.5" />
              Cargar Factura
            </Button>
            <Button size="sm" onClick={() => setDrawerOpen(true)}>
              <Plus className="mr-1 size-3.5" />
              +Nuevo Gasto Manual
            </Button>
          </div>
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
        {kmCiudadTotal > 0 && (
          <div className="mt-4 rounded-md border border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Movilización en ciudad</p>
                <p className="text-xs text-muted-foreground">
                  {diasViaje} día{diasViaje !== 1 ? "s" : ""} · {kmCiudadDia} km/día ·{" "}
                  {formatCurrency(valorKm)}/km
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(kmCiudadTotal)}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end border-t pt-4">
        <Button
          variant="default"
          onClick={() => void handleEnviar()}
          disabled={enviarAprobacion.isPending}
        >
          <Send className="mr-1.5 size-4" />
          {enviarAprobacion.isPending ? "Enviando..." : "Enviar rendición"}
        </Button>
      </div>

      {/* Alert: validación fallida */}
      <AlertDialog open={!!alertMsg} onOpenChange={() => setAlertMsg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No se puede enviar</AlertDialogTitle>
            <AlertDialogDescription>{alertMsg}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlertMsg(null)}>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación de envío */}
      <AlertDialog open={confirmarEnvio} onOpenChange={setConfirmarEnvio}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar rendición a aprobación?</AlertDialogTitle>
            <AlertDialogDescription>
              La rendición <strong>{rendicionNumero}</strong> será enviada al aprobador. Una vez
              enviada no podrás modificar los gastos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmarEnvio()}
              disabled={enviarAprobacion.isPending}
            >
              {enviarAprobacion.isPending ? "Enviando..." : "Confirmar envío"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Wizard IA: Cargar Factura */}
      <Drawer open={wizardOpen} onOpenChange={setWizardOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Cargar Factura con IA</DrawerTitle>
            <DrawerDescription>Rendición: {rendicionNumero}</DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
            <AiExpenseWizard
              rendicionIdInicial={rendicionId}
              onSuccess={async () => {
                await queryClient.invalidateQueries({
                  queryKey: ["gastos-enriquecidos", rendicionId],
                });
                setWizardOpen(false);
              }}
              onCancel={() => setWizardOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Nuevo gasto</DrawerTitle>
            <DrawerDescription>Rendición: {rendicionNumero}</DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
            <GastoForm
              defaultValues={{ ...EMPTY_FORM, rendicion_id: rendicionId }}
              onSubmit={handleSaveGasto}
              onCancel={() => setDrawerOpen(false)}
              loading={crear.isPending}
              submitLabel="Registrar gasto"
              rendiciones={[{ id: rendicionId, numero: rendicionNumero }]}
              proveedores={proveedores}
              categorias={categorias}
              estados={estados}
              monedas={monedas}
              politica={politica}
              viajeNoches={diasViaje}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

// --- DocumentosTab -----------------------------------------------------------

async function abrirDocumento(storagePath: string | null, nombre: string | null) {
  if (!storagePath) return;
  const { data, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) return;
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  void nombre;
}

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
      cell: (row) =>
        row.storage_path ? (
          <button
            type="button"
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => void abrirDocumento(row.storage_path, row.nombre_archivo)}
          >
            {row.nombre_archivo ?? "Sin nombre"}
          </button>
        ) : (
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
