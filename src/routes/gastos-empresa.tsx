/**
 * Módulo Gastos de Empresa.
 *
 * Registro de gastos operativos de la empresa (independientes de rendiciones de viaje).
 * - Lista con filtros por año, categoría, deducible
 * - Carga desde XML SRI Ecuador
 * - Ingreso manual
 * - KPIs: total año, deducible vs no deducible
 */
import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Upload,
  TrendingDown,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "@/components/common/toast";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/common/drawer";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useCompany } from "@/contexts/company-context";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { readFacturaXmlFile } from "@/services/factura-xml-parser";
import type { FacturaXmlData } from "@/services/factura-xml-parser";
import { readFacturaPdfFile } from "@/services/factura-pdf-parser";
import { readTxtSriFile } from "@/services/factura-txt-parser";
import type { FilaTxtSri } from "@/services/factura-txt-parser";
import { ImportSriDialog } from "@/components/gastos-empresa/import-sri-dialog";
import type { GastoEmpresa } from "@/services/gastos-empresa";
import {
  useGastosEmpresa,
  useKpiGastosEmpresa,
  useCrearGastoEmpresa,
  useCrearGastosEmpresaLote,
  useActualizarGastoEmpresa,
  useEliminarGastoEmpresa,
} from "@/hooks/entities/use-gastos-empresa";
import { useCategoriasGasto } from "@/hooks/entities/use-catalogs";
import { useProveedores } from "@/hooks/entities/use-proveedores";
import { useProyectos } from "@/hooks/entities/use-proyectos";

export const Route = createFileRoute("/gastos-empresa")({
  head: () => ({ meta: [{ title: "Gastos Empresa · VIATIQ" }] }),
  component: GastosEmpresaPage,
});

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  fecha: z.string().min(1, "Requerido"),
  descripcion: z.string().min(1, "Requerido"),
  categoria_id: z.string().nullable().optional(),
  proveedor_id: z.string().nullable().optional(),
  proyecto_id: z.string().nullable().optional(),
  responsable: z.string().nullable().optional(),
  subtotal: z.coerce.number().min(0),
  iva: z.coerce.number().min(0),
  total: z.coerce.number().min(0),
  es_deducible: z.boolean(),
  clave_acceso: z.string().nullable().optional(),
  observacion: z.string().nullable().optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── Page ─────────────────────────────────────────────────────────────────────

function GastosEmpresaPage() {
  return (
    <AppShell>
      <GastosEmpresaContent />
    </AppShell>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────

function GastosEmpresaContent() {
  const { empresaActivaId } = useCompany();
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [filtroDeducible, setFiltroDeducible] = useState<"todos" | "si" | "no">("todos");
  const [filtroProyecto, setFiltroProyecto] = useState<string>("todos");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editando, setEditando] = useState<GastoEmpresa | null>(null);
  const [xmlParsed, setXmlParsed] = useState<FacturaXmlData | null>(null);
  const [loadingXml, setLoadingXml] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingTxt, setLoadingTxt] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [filasTxt, setFilasTxt] = useState<FilaTxtSri[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const txtRef = useRef<HTMLInputElement>(null);

  const anios = [
    new Date().getFullYear(),
    new Date().getFullYear() - 1,
    new Date().getFullYear() - 2,
  ];

  const filtros = {
    anio,
    soloDeducibles: filtroDeducible === "si" ? true : filtroDeducible === "no" ? false : undefined,
  };

  const proyectoNombre = (id: string | null) =>
    id ? ((proyectos.data?.rows ?? []).find((p) => p.id === id)?.nombre ?? "—") : "—";

  const gastos = useGastosEmpresa(empresaActivaId, filtros);
  const kpi = useKpiGastosEmpresa(empresaActivaId, anio);
  const categorias = useCategoriasGasto({ pageSize: 200 });
  const proveedores = useProveedores({ pageSize: 200 });
  const proyectos = useProyectos({ empresaId: empresaActivaId ?? undefined, pageSize: 200 });
  const crear = useCrearGastoEmpresa();
  const crearLote = useCrearGastosEmpresaLote();
  const actualizar = useActualizarGastoEmpresa();
  const eliminar = useEliminarGastoEmpresa();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fecha: new Date().toISOString().split("T")[0],
      descripcion: "",
      categoria_id: null,
      proveedor_id: null,
      proyecto_id: null,
      responsable: null,
      subtotal: 0,
      iva: 0,
      total: 0,
      es_deducible: true,
      clave_acceso: null,
      observacion: null,
    },
  });

  function openNueva(prefill?: FacturaXmlData) {
    setEditando(null);
    form.reset(
      prefill
        ? {
            fecha: prefill.fecha,
            descripcion: prefill.observacion ?? prefill.razon_social ?? "",
            categoria_id: null,
            proveedor_id: null,
            proyecto_id: null,
            responsable: null,
            subtotal: prefill.subtotal,
            iva: prefill.iva,
            total: prefill.total,
            es_deducible: true,
            clave_acceso: prefill.clave_acceso ?? null,
            observacion: prefill.razon_social ?? null,
          }
        : {
            fecha: new Date().toISOString().split("T")[0],
            descripcion: "",
            categoria_id: null,
            proveedor_id: null,
            proyecto_id: null,
            responsable: null,
            subtotal: 0,
            iva: 0,
            total: 0,
            es_deducible: true,
            clave_acceso: null,
            observacion: null,
          },
    );
    setDrawerOpen(true);
  }

  function openEditar(g: GastoEmpresa) {
    setEditando(g);
    form.reset({
      fecha: g.fecha,
      descripcion: g.descripcion,
      categoria_id: g.categoria_id,
      proveedor_id: g.proveedor_id,
      proyecto_id: g.proyecto_id,
      responsable: g.responsable,
      subtotal: g.subtotal,
      iva: g.iva,
      total: g.total,
      es_deducible: g.es_deducible,
      clave_acceso: g.clave_acceso,
      observacion: g.observacion,
    });
    setDrawerOpen(true);
  }

  async function handleXmlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingXml(true);
    try {
      const parsed = await readFacturaXmlFile(file);
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
      setXmlParsed(parsed);
      openNueva(parsed);
      toast.success(`PDF cargado: ${parsed.numero}`);
    } catch (err) {
      toast.error("Error al leer PDF: " + (err as Error).message);
    } finally {
      setLoadingPdf(false);
      if (pdfRef.current) pdfRef.current.value = "";
    }
  }

  async function handleTxtUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingTxt(true);
    try {
      const filas = await readTxtSriFile(file);
      setFilasTxt(filas);
      setImportDialogOpen(true);
      toast.success(`${filas.length} comprobantes detectados`);
    } catch (err) {
      toast.error("Error al leer TXT: " + (err as Error).message);
    } finally {
      setLoadingTxt(false);
      if (txtRef.current) txtRef.current.value = "";
    }
  }

  async function handleImportarLote(
    items: {
      fila: FilaTxtSri;
      categoriaId: string | null;
      proyectoId: string | null;
      esDeducible: boolean;
    }[],
  ) {
    if (!empresaActivaId) return;
    const rows = items.map(({ fila: f, categoriaId, proyectoId, esDeducible }) => ({
      empresa_id: empresaActivaId,
      fecha: f.fecha,
      descripcion: f.razon_social,
      categoria_id: categoriaId,
      proveedor_id: null,
      proyecto_id: proyectoId,
      responsable: null,
      subtotal: f.subtotal,
      iva: f.iva,
      total: f.total,
      es_deducible: esDeducible,
      clave_acceso: f.clave_acceso || null,
      observacion: `RUC: ${f.ruc_emisor} · Serie: ${f.serie}`,
      xml_content: null,
      comprobante_url: null,
      created_by: null,
    }));
    const n = await crearLote.mutateAsync(rows as Parameters<typeof crearLote.mutateAsync>[0]);
    toast.success(`${n} comprobante${n !== 1 ? "s" : ""} importado${n !== 1 ? "s" : ""} correctamente`);
  }

  async function onSubmit(values: FormValues) {
    if (!empresaActivaId) return;
    try {
      if (editando) {
        await actualizar.mutateAsync({
          id: editando.id,
          payload: { ...values },
        });
        toast.success("Gasto actualizado");
      } else {
        await crear.mutateAsync({
          empresa_id: empresaActivaId,
          ...values,
          categoria_id: values.categoria_id ?? null,
          proveedor_id: values.proveedor_id ?? null,
          proyecto_id: values.proyecto_id ?? null,
          responsable: values.responsable ?? null,
          clave_acceso: values.clave_acceso ?? null,
          observacion: values.observacion ?? null,
          xml_content: xmlParsed?.xml_content ?? null,
          comprobante_url: null,
          created_by: null,
        } as Parameters<typeof crear.mutateAsync>[0]);
        toast.success("Gasto registrado");
      }
      setDrawerOpen(false);
      setXmlParsed(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleEliminar(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return;
    try {
      await eliminar.mutateAsync(id);
      toast.success("Gasto eliminado");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const listaBase = gastos.data ?? [];
  const lista =
    filtroProyecto === "todos"
      ? listaBase
      : filtroProyecto === "__sin_proyecto__"
        ? listaBase.filter((g) => !g.proyecto_id)
        : listaBase.filter((g) => g.proyecto_id === filtroProyecto);

  const categoriaNombre = (id: string | null) =>
    id ? ((categorias.data?.rows ?? []).find((c) => c.id === id)?.nombre ?? "—") : "—";
  const proveedorNombre = (id: string | null) =>
    id ? ((proveedores.data?.rows ?? []).find((p) => p.id === id)?.nombre ?? "—") : "—";

  return (
    <>
      <PageHeader
        title="Gastos Empresa"
        description="Gastos operativos de la empresa (servicios, suministros, arriendo, etc.)."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="h-8 rounded-md border bg-background px-2 text-sm"
            >
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              value={filtroProyecto}
              onChange={(e) => setFiltroProyecto(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-sm"
            >
              <option value="todos">Todos los proyectos</option>
              <option value="__sin_proyecto__">Sin proyecto</option>
              {(proyectos.data?.rows ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
            <select
              value={filtroDeducible}
              onChange={(e) => setFiltroDeducible(e.target.value as "todos" | "si" | "no")}
              className="h-8 rounded-md border bg-background px-2 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="si">Deducibles</option>
              <option value="no">No deducibles</option>
            </select>
            <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={handleXmlUpload} />
            <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
            <input ref={txtRef} type="file" accept=".txt,.tsv" className="hidden" onChange={handleTxtUpload} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => txtRef.current?.click()}
              disabled={loadingXml || loadingPdf || loadingTxt}
              title="Importar archivo TXT de comprobantes recibidos del SRI"
            >
              <Upload className="size-4 mr-1.5" />
              {loadingTxt ? "Leyendo..." : "TXT SRI"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={loadingXml || loadingPdf || loadingTxt}
            >
              <Upload className="size-4 mr-1.5" />
              {loadingXml ? "Leyendo..." : "XML"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pdfRef.current?.click()}
              disabled={loadingXml || loadingPdf || loadingTxt}
            >
              <Upload className="size-4 mr-1.5" />
              {loadingPdf ? "Leyendo..." : "PDF"}
            </Button>
            <Button size="sm" onClick={() => openNueva()}>
              <Plus className="size-4 mr-1.5" />
              Nuevo gasto
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <KpiCard
          label={`Total gastos ${anio}`}
          value={formatCurrency(kpi.data?.total_anio ?? 0)}
          icon={<TrendingDown className="size-4 text-rose-500" />}
        />
        <KpiCard label="Nº registros" value={String(kpi.data?.num_gastos ?? 0)} />
        <KpiCard
          label="Deducibles"
          value={formatCurrency(kpi.data?.total_deducible ?? 0)}
          icon={<CheckCircle className="size-4 text-emerald-500" />}
        />
        <KpiCard
          label="No deducibles"
          value={formatCurrency(kpi.data?.total_no_deducible ?? 0)}
          icon={<XCircle className="size-4 text-amber-500" />}
          highlight={(kpi.data?.total_no_deducible ?? 0) > 0}
        />
      </div>

      {/* Tabla */}
      {gastos.isLoading ? (
        <LoadingState label="Cargando gastos..." />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Sin gastos registrados"
          description={`No hay gastos de empresa para ${anio}. Carga un comprobante XML/PDF o agrégalo manualmente.`}
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium">Proveedor</th>
                  <th className="px-4 py-3 font-medium">Proyecto</th>
                  <th className="px-4 py-3 font-medium text-right">Subtotal</th>
                  <th className="px-4 py-3 font-medium text-right">IVA</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium">Deducible</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {lista.map((g) => (
                  <tr key={g.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 tabular-nums text-xs">{formatDate(g.fecha)}</td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="truncate font-medium">{g.descripcion}</div>
                      {g.responsable && (
                        <div className="text-[10px] text-muted-foreground">{g.responsable}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {categoriaNombre(g.categoria_id)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">
                      {proveedorNombre(g.proveedor_id)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">
                      {proyectoNombre(g.proyecto_id)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(g.subtotal)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(g.iva)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {formatCurrency(g.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          g.es_deducible
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {g.es_deducible ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => openEditar(g)}
                          title="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => handleEliminar(g.id)}
                          title="Eliminar"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/20">
                <tr>
                  <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                    {lista.length} gasto{lista.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs font-semibold">
                    {formatCurrency(lista.reduce((s, g) => s + g.subtotal, 0))}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs font-semibold text-muted-foreground">
                    {formatCurrency(lista.reduce((s, g) => s + g.iva, 0))}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-sm font-bold text-rose-700">
                    {formatCurrency(lista.reduce((s, g) => s + g.total, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Import TXT SRI Dialog */}
      <ImportSriDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        filas={filasTxt}
        categorias={(categorias.data?.rows ?? []).map((c) => ({ id: c.id, nombre: c.nombre }))}
        proyectos={(proyectos.data?.rows ?? []).map((p) => ({ id: p.id, nombre: p.nombre }))}
        onImportar={handleImportarLote}
      />

      {/* Drawer form */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{editando ? "Editar gasto" : "Nuevo gasto empresa"}</DrawerTitle>
            <DrawerDescription>
              {xmlParsed && !editando
                ? `Datos del comprobante · ${xmlParsed.numero}`
                : "Completa los datos del gasto operativo."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto p-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fecha"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="responsable"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsable <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre del responsable" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Input placeholder="Servicio de internet, arriendo, suministros…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="categoria_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoría</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                          value={field.value ?? "__none__"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sin categoría" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">Sin categoría</SelectItem>
                            {(categorias.data?.rows ?? []).map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="proveedor_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proveedor</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                          value={field.value ?? "__none__"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sin proveedor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">Sin proveedor</SelectItem>
                            {(proveedores.data?.rows ?? []).map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="proyecto_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proyecto <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                        value={field.value ?? "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sin proyecto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Sin proyecto</SelectItem>
                          {(proyectos.data?.rows ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-3">
                  {(["subtotal", "iva", "total"] as const).map((f) => (
                    <FormField
                      key={f}
                      control={form.control}
                      name={f}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="capitalize">
                            {f === "iva" ? "IVA" : f.charAt(0).toUpperCase() + f.slice(1)}
                          </FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>

                <FormField
                  control={form.control}
                  name="es_deducible"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div>
                        <FormLabel className="cursor-pointer">Gasto deducible</FormLabel>
                        <p className="text-[11px] text-muted-foreground">
                          Desmarca si este gasto no aplica para deducción de IR.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="observacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observación <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Proveedor, número de comprobante, detalle…" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={crear.isPending || actualizar.isPending}>
                    {(crear.isPending || actualizar.isPending) && (
                      <Loader2 className="size-3 mr-1.5 animate-spin" />
                    )}
                    {editando ? "Guardar cambios" : "Registrar gasto"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-4 ${highlight ? "border-amber-300 bg-amber-50/30" : ""}`}
    >
      <div className="flex items-center justify-between mb-1">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${highlight ? "text-amber-700" : ""}`}>
        {value}
      </p>
    </div>
  );
}
