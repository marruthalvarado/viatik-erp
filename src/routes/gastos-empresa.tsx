/**
 * Módulo Gastos de Empresa.
 *
 * Registro de gastos operativos de la empresa (independientes de rendiciones de viaje).
 * - Lista con filtros por año, categoría, deducible
 * - Carga desde XML SRI Ecuador
 * - Ingreso manual
 * - KPIs: total año, deducible vs no deducible
 */
import { Component, useRef, useState, useMemo, useEffect } from "react";
import type { ReactNode, ErrorInfo } from "react";
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
  ChevronsUpDown,
  Check,
  Filter,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  SortableHeader,
  FilterCell,
  applySort,
  applyColFilters,
  nextSort,
} from "@/components/common/sortable-header";
import type { SortState } from "@/components/common/sortable-header";

import { useCompany } from "@/contexts/company-context";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { readFacturaXmlFile } from "@/services/factura-xml-parser";
import type { FacturaXmlData } from "@/services/factura-xml-parser";
import { readFacturaPdfFile } from "@/services/factura-pdf-parser";
import { readTxtSriFile } from "@/services/factura-txt-parser";
import type { FilaTxtSri } from "@/services/factura-txt-parser";
import { ImportSriDialog } from "@/components/gastos-empresa/import-sri-dialog";
import type { GastoEmpresa } from "@/services/gastos-empresa";
import { buscarReembolsoEnRendicion } from "@/services/gastos-empresa";
import {
  useGastosEmpresa,
  useKpiGastosEmpresa,
  useCrearGastoEmpresa,
  useCrearGastosEmpresaLote,
  useActualizarGastoEmpresa,
  useEliminarGastoEmpresa,
  useClaveAccesoExistentes,
  useSugerenciasPorRuc,
} from "@/hooks/entities/use-gastos-empresa";
import { useCategoriasGasto } from "@/hooks/entities/use-catalogs";
import { useProveedores } from "@/hooks/entities/use-proveedores";
import { useProyectos } from "@/hooks/entities/use-proyectos";

// ─── Error boundary local para el diálogo de importación ─────────────────────
// Evita que un fallo en ImportSriDialog derribe toda la página.

class ImportDialogBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("[ImportSriDialog error]", err, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="rounded-xl border bg-card p-6 text-center shadow-lg max-w-sm">
            <p className="font-semibold text-destructive">Error al abrir el importador</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Revisa la consola para más detalles y recarga la página.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 text-xs underline text-muted-foreground hover:text-foreground"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const Route = createFileRoute("/gastos-empresa")({
  head: () => ({ meta: [{ title: "Gastos Empresa · VIATIQ" }] }),
  component: GastosEmpresaPage,
});

// ─── Schema ───────────────────────────────────────────────────────────────────

const MONEDAS_EXTRANJERAS = [
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — Libra esterlina" },
  { code: "CHF", label: "CHF — Franco suizo" },
  { code: "JPY", label: "JPY — Yen japonés" },
  { code: "CNY", label: "CNY — Yuan chino" },
  { code: "CAD", label: "CAD — Dólar canadiense" },
  { code: "AUD", label: "AUD — Dólar australiano" },
  { code: "SEK", label: "SEK — Corona sueca" },
  { code: "DKK", label: "DKK — Corona danesa" },
  { code: "NOK", label: "NOK — Corona noruega" },
];

const schema = z.object({
  fecha: z.string().min(1, "Requerido"),
  descripcion: z.string().min(1, "Requerido"),
  categoria_id: z.string().nullable().optional(),
  proveedor_id: z.string().nullable().optional(),
  proyecto_id: z.string().nullable().optional(),
  responsable: z.string().nullable().optional(),
  subtotal: z.coerce.number().min(0),
  iva_pct: z.coerce.number().min(0).max(100).default(0),
  iva: z.coerce.number().min(0),
  total: z.coerce.number().min(0),
  es_deducible: z.boolean(),
  clave_acceso: z.string().nullable().optional(),
  numero_documento: z.string().nullable().optional(),
  ruc_emisor: z.string().nullable().optional(),
  observacion: z.string().nullable().optional(),
  moneda_origen: z.string().nullable().optional(),
  monto_origen: z.coerce.number().nullable().optional(),
  tipo_cambio: z.coerce.number().nullable().optional(),
});
type FormValues = z.infer<typeof schema>;

/** Detecta el % IVA a partir de subtotal e iva almacenados (0, 12, 15 o 0 si no coincide). */
function deriveIvaPct(subtotal: number, iva: number): number {
  if (!subtotal || !iva) return 0;
  const pct = Math.round((iva / subtotal) * 100);
  return [0, 12, 15].includes(pct) ? pct : 0;
}

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
  const [anio, setAnio] = useState<number | null>(() => new Date().getFullYear());
  const [mes, setMes] = useState<number | null>(null);
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
  const [proveedorOpen, setProveedorOpen] = useState(false);
  const [sort, setSort] = useState<SortState>({ col: null, dir: "asc" });
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  function handleSort(col: string) {
    setSort((prev) => nextSort(prev, col));
  }
  function setColFilter(col: string, val: string) {
    setColFilters((prev) => {
      const next = { ...prev };
      if (val) next[col] = val;
      else delete next[col];
      return next;
    });
  }
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const txtRef = useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();
  // Años desde el actual hasta 2020 (cubre datos históricos desde 2023)
  const anios: number[] = [];
  for (let y = currentYear; y >= 2020; y--) anios.push(y);

  const filtros = {
    anio: anio ?? undefined, // null = sin filtro de año (todos)
    soloDeducibles: filtroDeducible === "si" ? true : filtroDeducible === "no" ? false : undefined,
  };

  const proyectoNombre = (id: string | null) =>
    id ? ((proyectos.data?.rows ?? []).find((p) => p.id === id)?.nombre ?? "—") : "—";

  const gastos = useGastosEmpresa(empresaActivaId, filtros);
  // KPI hook siempre necesita un año concreto; cuando es "todos" usamos datos en memoria
  const kpi = useKpiGastosEmpresa(empresaActivaId, anio ?? currentYear);
  const categorias = useCategoriasGasto({ pageSize: 200 });
  const proveedores = useProveedores({ pageSize: 1000 });
  const proyectos = useProyectos({ empresaId: empresaActivaId ?? undefined, pageSize: 200 });
  const claveAccesoExistentes = useClaveAccesoExistentes(empresaActivaId);
  const sugerenciasRuc = useSugerenciasPorRuc(empresaActivaId);
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
      iva_pct: 0,
      iva: 0,
      total: 0,
      es_deducible: true,
      clave_acceso: null,
      numero_documento: null,
      ruc_emisor: null,
      observacion: null,
      moneda_origen: null,
      monto_origen: null,
      tipo_cambio: null,
    },
  });

  // ── Auto-cálculo: iva = subtotal * iva_pct/100, total = subtotal + iva ──────
  const watchedSubtotal = form.watch("subtotal");
  const watchedIvaPct = form.watch("iva_pct");
  useEffect(() => {
    const sub = Number(watchedSubtotal) || 0;
    const pct = Number(watchedIvaPct) || 0;
    const ivaAmt = Math.round(sub * pct) / 100;
    form.setValue("iva", ivaAmt, { shouldValidate: false });
    form.setValue("total", parseFloat((sub + ivaAmt).toFixed(2)), { shouldValidate: false });
  }, [watchedSubtotal, watchedIvaPct]); // eslint-disable-line react-hooks/exhaustive-deps

  function openNueva(prefill?: FacturaXmlData) {
    setEditando(null);
    // Buscar proveedor existente por RUC cuando viene prefill de XML/PDF
    const proveedorMatch = prefill?.ruc_emisor
      ? (proveedores.data?.rows ?? []).find(
          (p) => p.identificacion === prefill.ruc_emisor,
        )
      : null;
    form.reset(
      prefill
        ? {
            fecha: prefill.fecha,
            descripcion: prefill.observacion ?? prefill.razon_social ?? "",
            categoria_id: null,
            proveedor_id: proveedorMatch?.id ?? null,
            proyecto_id: null,
            responsable: null,
            subtotal: prefill.subtotal,
            iva_pct: deriveIvaPct(prefill.subtotal, prefill.iva),
            iva: prefill.iva,
            total: prefill.total,
            es_deducible: true,
            clave_acceso: prefill.clave_acceso ?? null,
            numero_documento: prefill.numero ?? null,
            ruc_emisor: prefill.ruc_emisor ?? null,
            // Para PDF RIDE: razon_social = nombre del CLIENTE (comprador), no del emisor.
            // Si encontramos el proveedor por RUC, usamos su nombre como observación.
            // Para XML: razon_social ya es el nombre del emisor (correcto).
            observacion: proveedorMatch?.nombre ?? prefill.razon_social ?? null,
            moneda_origen: null,
            monto_origen: null,
            tipo_cambio: null,
          }
        : {
            fecha: new Date().toISOString().split("T")[0],
            descripcion: "",
            categoria_id: null,
            proveedor_id: null,
            proyecto_id: null,
            responsable: null,
            subtotal: 0,
            iva_pct: 0,
            iva: 0,
            total: 0,
            es_deducible: true,
            clave_acceso: null,
            numero_documento: null,
            ruc_emisor: null,
            observacion: null,
            moneda_origen: null,
            monto_origen: null,
            tipo_cambio: null,
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
      iva_pct: deriveIvaPct(Number(g.subtotal), Number(g.iva)),
      iva: g.iva,
      total: g.total,
      es_deducible: g.es_deducible,
      clave_acceso: g.clave_acceso,
      numero_documento: g.numero_documento ?? null,
      ruc_emisor: g.ruc_emisor ?? null,
      observacion: g.observacion,
      moneda_origen: g.moneda_origen ?? null,
      monto_origen: g.monto_origen ? Number(g.monto_origen) : null,
      tipo_cambio: g.tipo_cambio ? Number(g.tipo_cambio) : null,
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
      ruc_emisor: f.ruc_emisor || null,
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
      // ── Capa 3: advertencia si la misma factura ya está en una rendición ──
      try {
        const dup = await buscarReembolsoEnRendicion(
          empresaActivaId,
          values.clave_acceso ?? null,
          values.numero_documento ?? null,
          values.ruc_emisor ?? null,
        );
        if (dup.encontrado) {
          const ref = dup.rendicionNumero ? ` (rendición ${dup.rendicionNumero})` : "";
          toast.warning(`⚠ Esta factura ya fue registrada en una rendición de empleado${ref}. Se guardará igualmente.`);
        }
      } catch {
        // No bloquear el guardado si la consulta falla
      }

      const { iva_pct: _ivaPct, ...dbValues } = values;
      if (editando) {
        await actualizar.mutateAsync({
          id: editando.id,
          payload: {
            ...dbValues,
            numero_documento: dbValues.numero_documento ?? null,
            ruc_emisor: dbValues.ruc_emisor ?? null,
            moneda_origen: dbValues.moneda_origen ?? null,
            monto_origen: dbValues.monto_origen ?? null,
            tipo_cambio: dbValues.tipo_cambio ?? null,
          },
        });
        toast.success("Gasto actualizado");
      } else {
        await crear.mutateAsync({
          empresa_id: empresaActivaId,
          ...dbValues,
          categoria_id: dbValues.categoria_id ?? null,
          proveedor_id: dbValues.proveedor_id ?? null,
          proyecto_id: dbValues.proyecto_id ?? null,
          responsable: dbValues.responsable ?? null,
          clave_acceso: dbValues.clave_acceso ?? null,
          numero_documento: dbValues.numero_documento ?? null,
          ruc_emisor: dbValues.ruc_emisor ?? null,
          observacion: dbValues.observacion ?? null,
          moneda_origen: dbValues.moneda_origen ?? null,
          monto_origen: dbValues.monto_origen ?? null,
          tipo_cambio: dbValues.tipo_cambio ?? null,
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
  const listaProyecto =
    filtroProyecto === "todos"
      ? listaBase
      : filtroProyecto === "__sin_proyecto__"
        ? listaBase.filter((g) => !g.proyecto_id)
        : listaBase.filter((g) => g.proyecto_id === filtroProyecto);
  // Filtro de mes (client-side, solo aplica cuando hay año seleccionado)
  const lista =
    mes !== null
      ? listaProyecto.filter((g) => {
          if (!g.fecha) return false;
          return new Date(g.fecha + "T00:00:00").getMonth() + 1 === mes;
        })
      : listaProyecto;

  // KPIs: cuando hay filtro de mes o proyecto activo, los computamos en memoria
  const usarKpiMemoria = anio === null || mes !== null || filtroProyecto !== "todos";
  const kpiEfectivo =
    usarKpiMemoria
      ? {
          total_anio: lista.reduce((s, g) => s + (Number(g.total) || 0), 0),
          total_deducible: lista
            .filter((g) => g.es_deducible)
            .reduce((s, g) => s + (Number(g.total) || 0), 0),
          total_no_deducible: lista
            .filter((g) => !g.es_deducible)
            .reduce((s, g) => s + (Number(g.total) || 0), 0),
          num_gastos: lista.length,
        }
      : kpi.data;

  const categoriaNombre = (id: string | null) =>
    id ? ((categorias.data?.rows ?? []).find((c) => c.id === id)?.nombre ?? "—") : "—";
  const proveedorNombre = (id: string | null) =>
    id ? ((proveedores.data?.rows ?? []).find((p) => p.id === id)?.nombre ?? "—") : "—";

  // Fallback: proveedor_id → ruc_emisor derivado de los gastos ya cargados.
  // Cubre proveedores cuyo campo ruc en la tabla proveedores está vacío.
  const rucPorProveedor = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of gastos.data ?? []) {
      if (g.proveedor_id && g.ruc_emisor && !map.has(g.proveedor_id)) {
        map.set(g.proveedor_id, g.ruc_emisor);
      }
    }
    return map;
  }, [gastos.data]);

  // ─── Sort + filter ───────────────────────────────────────────────────────────
  function getGastoVal(g: (typeof lista)[0], col: string): string | number {
    switch (col) {
      case "fecha": return g.fecha ?? "";
      case "descripcion": return g.descripcion;
      case "categoria": return categoriaNombre(g.categoria_id);
      case "proveedor": return proveedorNombre(g.proveedor_id);
      case "ruc": return g.ruc_emisor ?? "";
      case "proyecto": return proyectoNombre(g.proyecto_id);
      case "subtotal": return Number(g.subtotal);
      case "iva": return Number(g.iva);
      case "total": return Number(g.total);
      case "deducible": return g.es_deducible ? "sí" : "no";
      default: return "";
    }
  }
  const listaFiltrada = applySort(
    applyColFilters(lista, colFilters, getGastoVal),
    sort,
    getGastoVal,
  );
  const hasFilters = Object.values(colFilters).some((v) => v);

  return (
    <>
      <PageHeader
        title="Gastos Empresa"
        description="Gastos operativos de la empresa (servicios, suministros, arriendo, etc.)."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={anio ?? "todos"}
              onChange={(e) => {
                const v = e.target.value;
                setAnio(v === "todos" ? null : Number(v));
                setMes(null); // reset mes al cambiar año
              }}
              className="h-8 rounded-md border bg-background px-2 text-sm"
            >
              <option value="todos">Todos los años</option>
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            {anio !== null && (
              <select
                value={mes ?? "todos"}
                onChange={(e) => {
                  const v = e.target.value;
                  setMes(v === "todos" ? null : Number(v));
                }}
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
            )}
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
          label={
            anio !== null && mes !== null
              ? `Total gastos ${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][mes - 1]} ${anio}`
              : anio !== null
                ? `Total gastos ${anio}`
                : "Total gastos (todos)"
          }
          value={formatCurrency(kpiEfectivo?.total_anio ?? 0)}
          icon={<TrendingDown className="size-4 text-rose-500" />}
        />
        <KpiCard label="Nº registros" value={String(kpiEfectivo?.num_gastos ?? 0)} />
        <KpiCard
          label="Deducibles"
          value={formatCurrency(kpiEfectivo?.total_deducible ?? 0)}
          icon={<CheckCircle className="size-4 text-emerald-500" />}
        />
        <KpiCard
          label="No deducibles"
          value={formatCurrency(kpiEfectivo?.total_no_deducible ?? 0)}
          icon={<XCircle className="size-4 text-amber-500" />}
          highlight={(kpiEfectivo?.total_no_deducible ?? 0) > 0}
        />
      </div>

      {/* Barra sort/filter */}
      {!gastos.isLoading && lista.length > 0 && (
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {listaFiltrada.length !== lista.length
              ? `${listaFiltrada.length} de ${lista.length} registros`
              : `${lista.length} registro${lista.length !== 1 ? "s" : ""}`}
            {hasFilters && (
              <button
                className="ml-2 text-xs text-blue-600 hover:underline"
                onClick={() => setColFilters({})}
              >
                Limpiar filtros
              </button>
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
            className={cn(showFilters && "bg-muted")}
          >
            <Filter className="size-3.5 mr-1.5" />
            {showFilters ? "Ocultar filtros" : "Filtrar columnas"}
          </Button>
        </div>
      )}

      {/* Tabla */}
      {gastos.isLoading ? (
        <LoadingState label="Cargando gastos..." />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Sin gastos registrados"
          description={`No hay gastos de empresa${anio !== null ? ` para ${anio}` : ""}. Carga un comprobante XML/PDF o agrégalo manualmente.`}
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr className="text-xs uppercase text-muted-foreground">
                  <SortableHeader label="Fecha" col="fecha" sort={sort} onSort={handleSort} />
                  <SortableHeader label="Descripción" col="descripcion" sort={sort} onSort={handleSort} />
                  <SortableHeader label="Categoría" col="categoria" sort={sort} onSort={handleSort} />
                  <SortableHeader label="Proveedor" col="proveedor" sort={sort} onSort={handleSort} />
                  <SortableHeader label="RUC" col="ruc" sort={sort} onSort={handleSort} />
                  <SortableHeader label="Proyecto" col="proyecto" sort={sort} onSort={handleSort} />
                  <SortableHeader label="Subtotal" col="subtotal" sort={sort} onSort={handleSort} align="right" />
                  <SortableHeader label="IVA" col="iva" sort={sort} onSort={handleSort} align="right" />
                  <SortableHeader label="Total" col="total" sort={sort} onSort={handleSort} align="right" />
                  <SortableHeader label="Deducible" col="deducible" sort={sort} onSort={handleSort} />
                  <th className="px-4 py-3" />
                </tr>
                {showFilters && (
                  <tr className="border-t border-muted/50 bg-muted/5">
                    {(["fecha","descripcion","categoria","proveedor","ruc","proyecto"] as const).map((col) => (
                      <FilterCell key={col} col={col} filters={colFilters} onChange={setColFilter} />
                    ))}
                    <FilterCell col="subtotal" filters={colFilters} onChange={setColFilter} align="right" />
                    <FilterCell col="iva" filters={colFilters} onChange={setColFilter} align="right" />
                    <FilterCell col="total" filters={colFilters} onChange={setColFilter} align="right" />
                    <FilterCell col="deducible" filters={colFilters} onChange={setColFilter} placeholder="sí/no" />
                    <td />
                  </tr>
                )}
              </thead>
              <tbody className="divide-y">
                {listaFiltrada.map((g) => (
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
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                      {g.ruc_emisor ?? "—"}
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
                      {g.moneda_origen && (
                        <div className="text-[10px] font-normal text-blue-600 tabular-nums">
                          {Number(g.monto_origen).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                          {g.moneda_origen}
                        </div>
                      )}
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
                  <td colSpan={6} className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                    {listaFiltrada.length !== lista.length
                      ? `${listaFiltrada.length} de ${lista.length} gastos`
                      : `${lista.length} gasto${lista.length !== 1 ? "s" : ""}`}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs font-semibold">
                    {formatCurrency(listaFiltrada.reduce((s, g) => s + g.subtotal, 0))}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs font-semibold text-muted-foreground">
                    {formatCurrency(listaFiltrada.reduce((s, g) => s + g.iva, 0))}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-sm font-bold text-rose-700">
                    {formatCurrency(listaFiltrada.reduce((s, g) => s + g.total, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Import TXT SRI Dialog — envuelto en boundary para evitar crash de página */}
      <ImportDialogBoundary>
        <ImportSriDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          filas={filasTxt}
          categorias={(categorias.data?.rows ?? []).map((c) => ({ id: c.id, nombre: c.nombre }))}
          proyectos={(proyectos.data?.rows ?? []).map((p) => ({ id: p.id, nombre: p.nombre }))}
          clavesExistentes={claveAccesoExistentes.data}
          sugerenciasPorRuc={sugerenciasRuc.data}
          onImportar={handleImportarLote}
        />
      </ImportDialogBoundary>

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
                    name="numero_documento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>N° Factura <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="001-001-000000123" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ruc_emisor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RUC emisor <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="1790000000001" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                    render={({ field }) => {
                      const provList = proveedores.data?.rows ?? [];
                      const selected = provList.find((p) => p.id === field.value);
                      return (
                        <FormItem>
                          <FormLabel>Proveedor</FormLabel>
                          <Popover open={proveedorOpen} onOpenChange={setProveedorOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="w-full justify-between font-normal text-sm h-9 px-3"
                                >
                                  <span className={cn("truncate", !selected && "text-muted-foreground")}>
                                    {selected ? selected.nombre : "Sin proveedor"}
                                  </span>
                                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[280px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Buscar proveedor..." />
                                <CommandList>
                                  <CommandEmpty>Sin resultados.</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      value="__none__"
                                      onSelect={() => {
                                        field.onChange(null);
                                        setProveedorOpen(false);
                                      }}
                                    >
                                      <Check className={cn("mr-2 size-4", !field.value ? "opacity-100" : "opacity-0")} />
                                      Sin proveedor
                                    </CommandItem>
                                    {provList.map((p) => (
                                      <CommandItem
                                        key={p.id}
                                        value={`${p.nombre} ${p.ruc ?? rucPorProveedor.get(p.id) ?? ""}`}
                                        onSelect={() => {
                                          field.onChange(p.id);
                                          const ruc = p.ruc ?? rucPorProveedor.get(p.id) ?? null;
                                          if (ruc) form.setValue("ruc_emisor", ruc);
                                          setProveedorOpen(false);
                                        }}
                                      >
                                        <Check className={cn("mr-2 size-4", field.value === p.id ? "opacity-100" : "opacity-0")} />
                                        <div>
                                          <div>{p.nombre}</div>
                                          {(p.ruc ?? rucPorProveedor.get(p.id)) && (
                                            <div className="text-xs text-muted-foreground">
                                              {p.ruc ?? rucPorProveedor.get(p.id)}
                                            </div>
                                          )}
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
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

                {/* ── Moneda de origen (importaciones) ─────────────────── */}
                <div className="rounded-lg border border-dashed px-3 pt-3 pb-2 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Moneda de origen
                  </p>
                  <FormField
                    control={form.control}
                    name="moneda_origen"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Moneda</FormLabel>
                        <Select
                          value={field.value ?? "__usd__"}
                          onValueChange={(v) => {
                            field.onChange(v === "__usd__" ? null : v);
                            if (v === "__usd__") {
                              form.setValue("monto_origen", null);
                              form.setValue("tipo_cambio", null);
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="USD — Dólar (por defecto)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__usd__">USD — Dólar (por defecto)</SelectItem>
                            {MONEDAS_EXTRANJERAS.map((m) => (
                              <SelectItem key={m.code} value={m.code}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch("moneda_origen") && (
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="monto_origen"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Monto ({form.watch("moneda_origen")})
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={field.value ?? ""}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value) || null;
                                  field.onChange(v);
                                  const tc = form.getValues("tipo_cambio") ?? 0;
                                  if (v && tc) {
                                    form.setValue("subtotal", parseFloat((v * tc).toFixed(2)));
                                    form.setValue("total", parseFloat((v * tc).toFixed(2)));
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="tipo_cambio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de cambio (a USD)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.000001"
                                min="0"
                                placeholder="1.000000"
                                value={field.value ?? ""}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value) || null;
                                  field.onChange(v);
                                  const mo = form.getValues("monto_origen") ?? 0;
                                  if (mo && v) {
                                    form.setValue("subtotal", parseFloat((mo * v).toFixed(2)));
                                    form.setValue("total", parseFloat((mo * v).toFixed(2)));
                                  }
                                }}
                              />
                            </FormControl>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Tipo indicado por el banco
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* Subtotal + % IVA */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="subtotal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subtotal (base)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="iva_pct"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>% IVA</FormLabel>
                        <Select
                          value={String(field.value ?? 0)}
                          onValueChange={(v) => field.onChange(Number(v))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="0%" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="12">12%</SelectItem>
                            <SelectItem value="15">15%</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* IVA y Total (calculados automáticamente) */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="iva"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IVA</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            readOnly
                            className="bg-muted/40 cursor-default"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="total"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            readOnly
                            className="bg-muted/40 cursor-default font-medium"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
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
