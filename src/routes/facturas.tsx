/**
 * Módulo Facturas Emitidas.
 *
 * - Lista todas las facturas emitidas de la empresa
 * - Carga desde XML SRI Ecuador (parseo automático)
 * - Ingreso manual
 * - Asociación a proyecto
 * - Panel de cobros (pagos recibidos) por factura
 * - Campos de retención fiscal (agente de retención Ecuador)
 */
import { useRef, useState, Fragment, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  Upload,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Ban,
  Filter,
  Percent,
  Send,
  Landmark,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "@/components/common/toast";
import { Button } from "@/components/ui/button";

import { useCompany } from "@/contexts/company-context";
import { formatCurrency, formatDate } from "@/utils/formatters";
import {
  SortableHeader,
  FilterCell,
  applySort,
  applyColFilters,
  nextSort,
} from "@/components/common/sortable-header";
import type { SortState } from "@/components/common/sortable-header";
import { readFacturaXmlFile } from "@/services/factura-xml-parser";
import type { FacturaXmlData } from "@/services/factura-xml-parser";
import { readFacturaPdfFile } from "@/services/factura-pdf-parser";
import type { FacturaEmitida } from "@/services/facturas-emitidas";
import {
  useFacturasEmitidas,
  useCrearFactura,
  useActualizarFactura,
  useEliminarFactura,
  useFlujoCajaProyectado,
} from "@/hooks/entities/use-facturas-emitidas";
import { useProyectos } from "@/hooks/entities/use-proyectos";
import { useCobrosAgregados } from "@/hooks/entities/use-cobros";

import {
  facturaSchema,
  type FormValues,
  calcValorNeto,
  calcDiasAtraso,
  calcEstadoCobro,
  BADGE_COBRO,
} from "@/components/facturas/factura-types";
import { KpiCard } from "@/components/facturas/kpi-card";
import { FlujoCajaChart } from "@/components/facturas/flujo-caja-chart";
import { CobroPanel } from "@/components/facturas/cobro-panel";
import { FacturaDrawer } from "@/components/facturas/factura-drawer";
import { EmitirSriDialog } from "@/components/facturas/emitir-sri-dialog";
import { ReconciliarBancoDialog } from "@/components/facturas/reconciliar-banco-dialog";

export const Route = createFileRoute("/facturas")({
  head: () => ({ meta: [{ title: "Facturas Emitidas · VIATIQ" }] }),
  component: FacturasPage,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

function FacturasPage() {
  return (
    <AppShell>
      <FacturasContent />
    </AppShell>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────

function FacturasContent() {
  const { empresaActivaId } = useCompany();
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [mes, setMes] = useState<number | null>(null);
  const [sort, setSort] = useState<SortState>({ col: null, dir: "asc" });
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editando, setEditando] = useState<FacturaEmitida | null>(null);
  const [xmlParsed, setXmlParsed] = useState<FacturaXmlData | null>(null);
  const [loadingXml, setLoadingXml] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [expandedFactura, setExpandedFactura] = useState<string | null>(null);
  const [emitirSriFactura, setEmitirSriFactura] = useState<FacturaEmitida | null>(null);
  const [reconciliarOpen, setReconciliarOpen] = useState(false);

  function handleSort(col: string) { setSort((p) => nextSort(p, col)); }
  function setColFilter(col: string, val: string) {
    setColFilters((prev) => {
      const next = { ...prev };
      if (val) next[col] = val; else delete next[col];
      return next;
    });
  }
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const facturas = useFacturasEmitidas(empresaActivaId, anio);
  const flujoCaja = useFlujoCajaProyectado(empresaActivaId, anio);
  const proyectos = useProyectos({ empresaId: empresaActivaId ?? undefined, pageSize: 200 });
  const crear = useCrearFactura();
  const actualizar = useActualizarFactura();
  const eliminar = useEliminarFactura();
  const cobrosAgregados = useCobrosAgregados(empresaActivaId);

  const anios = [
    new Date().getFullYear(),
    new Date().getFullYear() - 1,
    new Date().getFullYear() - 2,
  ];

  const form = useForm<FormValues>({
    resolver: zodResolver(facturaSchema),
    defaultValues: {
      numero: "",
      fecha: "",
      tipo: "factura",
      ruc_cliente: null,
      razon_social: "",
      subtotal: 0,
      descuento: 0,
      iva: 0,
      total: 0,
      proyecto_id: null,
      observacion: null,
      clave_acceso: null,
      retencion_iva_pct: 0,
      retencion_ir_pct: 0,
      fecha_vencimiento: null,
    },
  });

  function openNueva(prefill?: FacturaXmlData) {
    setEditando(null);
    form.reset(
      prefill
        ? {
            numero: prefill.numero,
            fecha: prefill.fecha,
            tipo: prefill.tipo,
            ruc_cliente: prefill.ruc_cliente ?? null,
            razon_social: prefill.razon_social,
            subtotal: prefill.subtotal,
            descuento: prefill.descuento,
            iva: prefill.iva,
            total: prefill.total,
            proyecto_id: null,
            observacion: prefill.observacion ?? null,
            clave_acceso: prefill.clave_acceso ?? null,
            retencion_iva_pct: 0,
            retencion_ir_pct: 0,
            fecha_vencimiento: null,
          }
        : {
            numero: "",
            fecha: new Date().toISOString().split("T")[0],
            tipo: "factura",
            ruc_cliente: null,
            razon_social: "",
            subtotal: 0,
            descuento: 0,
            iva: 0,
            total: 0,
            proyecto_id: null,
            observacion: null,
            clave_acceso: null,
            retencion_iva_pct: 0,
            retencion_ir_pct: 0,
            fecha_vencimiento: null,
          },
    );
    setDrawerOpen(true);
  }

  function openEditar(f: FacturaEmitida) {
    setEditando(f);
    form.reset({
      numero: f.numero,
      fecha: f.fecha,
      tipo: f.tipo as "factura" | "nota_credito",
      ruc_cliente: f.ruc_cliente,
      razon_social: f.razon_social,
      subtotal: f.subtotal,
      descuento: f.descuento,
      iva: f.iva,
      total: f.total,
      proyecto_id: f.proyecto_id,
      observacion: f.observacion,
      clave_acceso: f.clave_acceso,
      retencion_iva_pct: f.retencion_iva_pct ?? 0,
      retencion_ir_pct: f.retencion_ir_pct ?? 0,
      fecha_vencimiento: f.fecha_vencimiento ?? null,
    });
    setDrawerOpen(true);
  }

  function checkDuplicado(numero: string): boolean {
    const lista = facturas.data ?? [];
    const existente = lista.find((f) => f.numero === numero);
    if (existente) {
      toast.error(`La factura ${numero} ya está registrada (${existente.razon_social})`);
      return true;
    }
    return false;
  }

  async function handleXmlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingXml(true);
    try {
      const parsed = await readFacturaXmlFile(file);
      if (checkDuplicado(parsed.numero)) return;
      setXmlParsed(parsed);
      openNueva(parsed);
      toast.success(`XML cargado: ${parsed.numero}`);
    } catch (err) {
      toast.error("Error al leer XML: " + (err as Error).message);
    } finally {
      setLoadingXml(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingPdf(true);
    try {
      const parsed = await readFacturaPdfFile(file);
      if (checkDuplicado(parsed.numero)) return;
      setXmlParsed(parsed);
      openNueva(parsed);
      if (!parsed.razon_social) {
        const nombreDesdeHistorial = parsed.ruc_cliente
          ? (facturas.data ?? []).find(
              (f) => f.ruc_cliente === parsed.ruc_cliente && f.razon_social,
            )?.razon_social
          : null;
        if (nombreDesdeHistorial) {
          form.setValue("razon_social", nombreDesdeHistorial, { shouldValidate: false });
          toast.success(`PDF cargado: ${parsed.numero} · Razón social tomada del historial`);
        } else {
          toast.error("PDF cargado pero no se pudo leer la razón social — complétala manualmente.");
        }
      } else {
        toast.success(`PDF cargado: ${parsed.numero}`);
      }
    } catch (err) {
      toast.error("Error al leer PDF: " + (err as Error).message);
    } finally {
      setLoadingPdf(false);
      if (pdfRef.current) pdfRef.current.value = "";
    }
  }

  async function onSubmit(values: FormValues) {
    if (!empresaActivaId) return;
    try {
      if (editando) {
        await actualizar.mutateAsync({
          id: editando.id,
          payload: {
            ...values,
            proyecto_id: values.proyecto_id || null,
            xml_content: editando.xml_content,
          },
        });
        toast.success("Factura actualizada");
      } else {
        await crear.mutateAsync({
          empresa_id: empresaActivaId!,
          ...values,
          ruc_cliente: values.ruc_cliente ?? null,
          proyecto_id: values.proyecto_id ?? null,
          observacion: values.observacion ?? null,
          clave_acceso: values.clave_acceso ?? null,
          xml_content: xmlParsed?.xml_content ?? null,
          created_by: null,
          estado_sri: "AUTORIZADO",
        } as Parameters<typeof crear.mutateAsync>[0]);
        toast.success("Factura registrada");
      }
      setDrawerOpen(false);
      setXmlParsed(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleEliminar(id: string) {
    if (!confirm("¿Eliminar esta factura?")) return;
    try {
      await eliminar.mutateAsync(id);
      toast.success("Factura eliminada");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleAnular(f: FacturaEmitida) {
    if (f.estado_sri === "ANULADA") return;
    if (!confirm(`¿Anular la factura ${f.numero}? Esta acción pone el total en $0 y marca la factura como ANULADA.`)) return;
    try {
      await actualizar.mutateAsync({
        id: f.id,
        payload: { estado_sri: "ANULADA", total: 0, subtotal: 0, iva: 0, descuento: 0 },
      });
      toast.success(`Factura ${f.numero} anulada`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function toggleExpand(facturaId: string) {
    setExpandedFactura((prev) => (prev === facturaId ? null : facturaId));
  }

  const proyectoNombre = (id: string | null) => {
    if (!id) return "—";
    return (proyectos.data?.rows ?? []).find((p) => p.id === id)?.nombre ?? "—";
  };

  // ─── Filtro mes + sort + colFilters ──────────────────────────────────────────
  const cobrosMap = cobrosAgregados.data;

  const listaBase = facturas.data ?? [];
  const lista = useMemo(
    () =>
      mes !== null
        ? listaBase.filter((f) => {
            if (!f.fecha) return false;
            return new Date(f.fecha + "T00:00:00").getMonth() + 1 === mes;
          })
        : listaBase,
    [listaBase, mes],
  );

  function getFacturaVal(f: FacturaEmitida, col: string): string | number {
    const vn = calcValorNeto(
      Number(f.total), Number(f.iva), Number(f.subtotal),
      Number(f.retencion_iva_pct ?? 0), Number(f.retencion_ir_pct ?? 0),
    );
    const cobrado = cobrosMap?.get(f.id) ?? 0;
    switch (col) {
      case "numero":   return f.numero ?? "";
      case "fecha":    return f.fecha ?? "";
      case "cliente":  return f.razon_social ?? "";
      case "proyecto": return proyectoNombre(f.proyecto_id);
      case "subtotal": return Number(f.subtotal);
      case "iva":      return Number(f.iva);
      case "total":    return Number(f.total);
      case "saldo":    return Math.max(0, vn - cobrado);
      case "estado":   return f.estado_sri ?? "";
      default:         return "";
    }
  }

  const listaFiltrada = applySort(
    applyColFilters(lista, colFilters, getFacturaVal),
    sort,
    getFacturaVal,
  );
  const hasFilters = Object.values(colFilters).some((v) => v);

  const listaActiva = listaFiltrada.filter((f) => f.estado_sri !== "ANULADA");
  const totalAnio = listaActiva.reduce((s, f) => s + (Number(f.total) || 0), 0);
  const numFacturas = listaActiva.length;
  const totalPendiente = listaFiltrada.reduce((s, f) => {
    const vn = calcValorNeto(
      Number(f.total), Number(f.iva), Number(f.subtotal),
      Number(f.retencion_iva_pct ?? 0), Number(f.retencion_ir_pct ?? 0),
    );
    const cobrado = cobrosMap?.get(f.id) ?? 0;
    return s + Math.max(0, vn - cobrado);
  }, 0);

  return (
    <>
      <PageHeader
        title="Facturas Emitidas"
        description="Facturación emitida por la empresa a clientes."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={anio}
              onChange={(e) => { setAnio(Number(e.target.value)); setMes(null); }}
              className="h-8 rounded-md border bg-background px-2 text-sm"
            >
              {anios.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select
              value={mes ?? "todos"}
              onChange={(e) => setMes(e.target.value === "todos" ? null : Number(e.target.value))}
              className="h-8 rounded-md border bg-background px-2 text-sm"
            >
              <option value="todos">Todos los meses</option>
              <option value="1">Enero</option>
              <option value="2">Febrero</option>
              <option value="3">Marzo</option>
              <option value="4">Abril</option>
              <option value="5">Mayo</option>
              <option value="6">Junio</option>
              <option value="7">Julio</option>
              <option value="8">Agosto</option>
              <option value="9">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre</option>
            </select>
            <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={handleXmlUpload} />
            <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={loadingXml || loadingPdf}
            >
              <Upload className="size-4 mr-1.5" />
              {loadingXml ? "Leyendo..." : "Cargar XML"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pdfRef.current?.click()}
              disabled={loadingXml || loadingPdf}
            >
              <Upload className="size-4 mr-1.5" />
              {loadingPdf ? "Leyendo..." : "Cargar PDF"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReconciliarOpen(true)}
            >
              <Landmark className="size-4 mr-1.5" />
              Conciliar banco
            </Button>
            <Button size="sm" onClick={() => openNueva()}>
              <Plus className="size-4 mr-1.5" />
              Nueva factura
            </Button>
          </div>
        }
      />

      {/* KPIs rápidos */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <KpiCard
          label={
            mes !== null
              ? `Total facturado ${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][mes - 1]} ${anio}`
              : `Total facturado ${anio}`
          }
          value={formatCurrency(totalAnio)}
          icon={<TrendingUp className="size-4 text-emerald-600" />}
        />
        <KpiCard label="Número de facturas" value={String(numFacturas)} />
        <KpiCard
          label="Promedio por factura"
          value={numFacturas > 0 ? formatCurrency(totalAnio / numFacturas) : "—"}
        />
        <KpiCard
          label="Saldo por cobrar"
          value={formatCurrency(totalPendiente)}
          icon={<DollarSign className="size-4 text-amber-600" />}
          highlight={totalPendiente > 0}
        />
      </div>

      {/* Flujo de caja proyectado */}
      {(flujoCaja.data?.length ?? 0) > 0 && (
        <FlujoCajaChart data={flujoCaja.data!} anio={anio} />
      )}

      {/* Tabla */}
      {facturas.isLoading ? (
        <LoadingState label="Cargando facturas..." />
      ) : listaBase.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin facturas"
          description={`No hay facturas registradas para ${anio}. Carga un XML o agrega manualmente.`}
        />
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {listaFiltrada.length !== lista.length
                ? `${listaFiltrada.length} de ${lista.length} facturas`
                : `${lista.length} facturas`}
            </p>
            <div className="flex items-center gap-2">
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setColFilters({})}
                >
                  Limpiar filtros
                </Button>
              )}
              <Button
                variant={showFilters ? "secondary" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowFilters((v) => !v)}
              >
                <Filter className="size-3 mr-1" />
                {showFilters ? "Ocultar filtros" : "Filtrar columnas"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <SortableHeader label="Número" col="numero" sort={sort} onSort={handleSort} />
                    <SortableHeader label="Fecha" col="fecha" sort={sort} onSort={handleSort} />
                    <SortableHeader label="Cliente" col="cliente" sort={sort} onSort={handleSort} />
                    <SortableHeader label="Proyecto" col="proyecto" sort={sort} onSort={handleSort} />
                    <SortableHeader label="Subtotal" col="subtotal" sort={sort} onSort={handleSort} align="right" />
                    <SortableHeader label="IVA" col="iva" sort={sort} onSort={handleSort} align="right" />
                    <SortableHeader label="Total" col="total" sort={sort} onSort={handleSort} align="right" />
                    <SortableHeader label="Saldo" col="saldo" sort={sort} onSort={handleSort} align="right" />
                    <SortableHeader label="Estado SRI" col="estado" sort={sort} onSort={handleSort} />
                    <th className="px-4 py-3 font-medium text-xs uppercase text-muted-foreground">Cobros</th>
                    <th className="px-4 py-3" />
                  </tr>
                  {showFilters && (
                    <tr className="border-t bg-muted/10">
                      <FilterCell col="numero" filters={colFilters} onChange={setColFilter} />
                      <FilterCell col="fecha" filters={colFilters} onChange={setColFilter} />
                      <FilterCell col="cliente" filters={colFilters} onChange={setColFilter} />
                      <FilterCell col="proyecto" filters={colFilters} onChange={setColFilter} />
                      <FilterCell col="subtotal" filters={colFilters} onChange={setColFilter} />
                      <FilterCell col="iva" filters={colFilters} onChange={setColFilter} />
                      <FilterCell col="total" filters={colFilters} onChange={setColFilter} />
                      <FilterCell col="saldo" filters={colFilters} onChange={setColFilter} />
                      <FilterCell col="estado" filters={colFilters} onChange={setColFilter} />
                      <th />
                      <th />
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y">
                  {listaFiltrada.map((f) => {
                    const valorNeto = calcValorNeto(
                      Number(f.total), Number(f.iva), Number(f.subtotal),
                      Number(f.retencion_iva_pct ?? 0), Number(f.retencion_ir_pct ?? 0),
                    );
                    const montoCobrado = cobrosMap?.get(f.id) ?? 0;
                    const saldo = Math.max(0, valorNeto - montoCobrado);
                    const estado = calcEstadoCobro(valorNeto, montoCobrado, f.fecha_vencimiento);
                    const diasAtraso = estado === "vencido" ? calcDiasAtraso(f.fecha_vencimiento) : 0;
                    const isExpanded = expandedFactura === f.id;
                    const tieneRetencion =
                      Number(f.retencion_iva_pct ?? 0) > 0 || Number(f.retencion_ir_pct ?? 0) > 0;
                    const isAnulada = f.estado_sri === "ANULADA";
                    return (
                      <Fragment key={f.id}>
                        <tr
                          className={`hover:bg-muted/20 transition-colors${isExpanded ? " bg-muted/10" : ""}${isAnulada ? " opacity-50" : ""}`}
                        >
                          <td className="px-4 py-3 font-mono text-xs font-medium">
                            <span className={isAnulada ? "line-through text-muted-foreground" : ""}>{f.numero}</span>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-xs">{formatDate(f.fecha)}</td>
                          <td className="px-4 py-3 max-w-[200px]">
                            <div className="truncate font-medium">{f.razon_social}</div>
                            {f.ruc_cliente && (
                              <div className="text-[10px] text-muted-foreground">{f.ruc_cliente}</div>
                            )}
                            {tieneRetencion && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Percent className="size-2.5 text-blue-500" />
                                <span className="text-[9px] text-blue-600 font-medium">
                                  Agente ret.
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-[160px] truncate text-muted-foreground text-xs">
                            {proyectoNombre(f.proyecto_id)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatCurrency(f.subtotal)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(f.iva)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold">
                            {formatCurrency(f.total)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">
                            {estado === "cobrado" ? (
                              <span className="text-emerald-600">{"—"}</span>
                            ) : (
                              <span className="text-amber-700">{formatCurrency(saldo)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isAnulada ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {f.estado_sri ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${BADGE_COBRO[estado]}`}
                            >
                              {estado === "vencido"
                                ? `Vencido · ${diasAtraso}d`
                                : estado === "cobrado"
                                  ? "Cobrado"
                                  : estado === "parcial"
                                    ? "Parcial"
                                    : "Pendiente"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                title={isExpanded ? "Cerrar cobros" : "Ver cobros"}
                                onClick={() => toggleExpand(f.id)}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="size-3.5" />
                                ) : (
                                  <ChevronDown className="size-3.5" />
                                )}
                              </Button>
                              {!isAnulada && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-blue-600 hover:text-blue-700"
                                  onClick={() => setEmitirSriFactura(f)}
                                  title="Emitir al SRI"
                                >
                                  <Send className="size-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => openEditar(f)}
                                disabled={isAnulada}
                                title="Editar"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              {!isAnulada && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-amber-600 hover:text-amber-700"
                                  onClick={() => handleAnular(f)}
                                  title="Anular factura"
                                >
                                  <Ban className="size-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-destructive hover:text-destructive"
                                onClick={() => handleEliminar(f.id)}
                                title="Eliminar"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && empresaActivaId && (
                          <tr>
                            <td colSpan={11} className="bg-muted/10 px-6 py-4 border-t">
                              <CobroPanel
                                facturaId={f.id}
                                total={Number(f.total)}
                                subtotal={Number(f.subtotal)}
                                iva={Number(f.iva)}
                                retencionIvaPct={Number(f.retencion_iva_pct ?? 0)}
                                retencionIrPct={Number(f.retencion_ir_pct ?? 0)}
                                empresaId={empresaActivaId}
                                numero={f.numero}
                                onRetencionesSave={async (ivaPct, irPct) => {
                                  await actualizar.mutateAsync({
                                    id: f.id,
                                    payload: {
                                      retencion_iva_pct: ivaPct,
                                      retencion_ir_pct: irPct,
                                    },
                                  });
                                }}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="border-t bg-muted/20">
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                      {numFacturas} factura{numFacturas !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs font-semibold">
                      {formatCurrency(listaFiltrada.reduce((s, f) => s + f.subtotal, 0))}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs font-semibold text-muted-foreground">
                      {formatCurrency(listaFiltrada.reduce((s, f) => s + f.iva, 0))}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-sm font-bold text-emerald-700">
                      {formatCurrency(totalAnio)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-sm font-bold text-amber-700">
                      {formatCurrency(totalPendiente)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {emitirSriFactura && empresaActivaId && (
        <EmitirSriDialog
          open={!!emitirSriFactura}
          onOpenChange={(v) => { if (!v) setEmitirSriFactura(null); }}
          factura={emitirSriFactura}
          empresaId={empresaActivaId}
        />
      )}

      {empresaActivaId && (
        <ReconciliarBancoDialog
          open={reconciliarOpen}
          onOpenChange={setReconciliarOpen}
          facturas={facturas.data ?? []}
          cobrosMap={cobrosMap ?? new Map()}
          empresaId={empresaActivaId}
        />
      )}

      <FacturaDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        form={form}
        editando={editando}
        xmlParsed={xmlParsed}
        onSubmit={onSubmit}
        proyectos={proyectos.data?.rows ?? []}
        crearIsPending={crear.isPending}
        actualizarIsPending={actualizar.isPending}
      />
    </>
  );
}
