/**
 * Módulo Facturas Emitidas.
 *
 * - Lista todas las facturas emitidas de la empresa
 * - Carga desde XML SRI Ecuador (parseo automático)
 * - Ingreso manual
 * - Asociación a proyecto
 * - Panel de cobros (pagos recibidos) por factura
 */
import { useRef, useState, Fragment } from "react";
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
  Loader2,
  X,
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
import type { FacturaEmitida } from "@/services/facturas-emitidas";
import {
  useFacturasEmitidas,
  useCrearFactura,
  useActualizarFactura,
  useEliminarFactura,
} from "@/hooks/entities/use-facturas-emitidas";
import { useProyectos } from "@/hooks/entities/use-proyectos";
import {
  useCobros,
  useCrearCobro,
  useEliminarCobro,
  useCobrosAgregados,
} from "@/hooks/entities/use-cobros";
import type { CobroInsert } from "@/types/entities";

export const Route = createFileRoute("/facturas")({
  head: () => ({ meta: [{ title: "Facturas Emitidas · VIATIQ" }] }),
  component: FacturasPage,
});

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  numero: z.string().min(1, "Requerido"),
  fecha: z.string().min(1, "Requerido"),
  tipo: z.enum(["factura", "nota_credito"]),
  ruc_cliente: z.string().nullable().optional(),
  razon_social: z.string().min(1, "Requerido"),
  subtotal: z.coerce.number().min(0),
  descuento: z.coerce.number().min(0),
  iva: z.coerce.number().min(0),
  total: z.coerce.number().min(0),
  proyecto_id: z.string().nullable().optional(),
  observacion: z.string().nullable().optional(),
  clave_acceso: z.string().nullable().optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── Helpers cobros ───────────────────────────────────────────────────────────

type EstadoCobro = "pendiente" | "parcial" | "cobrado";

function calcEstadoCobro(total: number, cobrado: number): EstadoCobro {
  if (cobrado <= 0) return "pendiente";
  if (cobrado >= total) return "cobrado";
  return "parcial";
}

const BADGE_COBRO: Record<EstadoCobro, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  parcial: "bg-blue-100 text-blue-700",
  cobrado: "bg-emerald-100 text-emerald-700",
};

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editando, setEditando] = useState<FacturaEmitida | null>(null);
  const [xmlParsed, setXmlParsed] = useState<FacturaXmlData | null>(null);
  const [loadingXml, setLoadingXml] = useState(false);
  const [expandedFactura, setExpandedFactura] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const facturas = useFacturasEmitidas(empresaActivaId, anio);
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
    resolver: zodResolver(schema),
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

  function toggleExpand(facturaId: string) {
    setExpandedFactura((prev) => (prev === facturaId ? null : facturaId));
  }

  // KPIs rápidos
  const lista = facturas.data ?? [];
  const cobrosMap = cobrosAgregados.data;
  const totalAnio = lista.reduce((s, f) => s + (Number(f.total) || 0), 0);
  const numFacturas = lista.length;
  const totalPendiente = lista.reduce((s, f) => {
    const cobrado = cobrosMap?.get(f.id) ?? 0;
    return s + Math.max(0, Number(f.total) - cobrado);
  }, 0);

  const proyectoNombre = (id: string | null) => {
    if (!id) return "—";
    return (proyectos.data?.rows ?? []).find((p) => p.id === id)?.nombre ?? "—";
  };

  return (
    <>
      <PageHeader
        title="Facturas Emitidas"
        description="Facturación emitida por la empresa a clientes."
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
            <input
              ref={fileRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={handleXmlUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={loadingXml}
            >
              <Upload className="size-4 mr-1.5" />
              Cargar XML
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
          label={`Total facturado ${anio}`}
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

      {/* Tabla */}
      {facturas.isLoading ? (
        <LoadingState label="Cargando facturas..." />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin facturas"
          description={`No hay facturas registradas para ${anio}. Carga un XML o agrega manualmente.`}
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Número</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Proyecto</th>
                  <th className="px-4 py-3 font-medium text-right">Subtotal</th>
                  <th className="px-4 py-3 font-medium text-right">IVA</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-right">Saldo</th>
                  <th className="px-4 py-3 font-medium">Estado SRI</th>
                  <th className="px-4 py-3 font-medium">Cobros</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {lista.map((f) => {
                  const montoCobrado = cobrosMap?.get(f.id) ?? 0;
                  const saldo = Math.max(0, Number(f.total) - montoCobrado);
                  const estado = calcEstadoCobro(Number(f.total), montoCobrado);
                  const isExpanded = expandedFactura === f.id;
                  return (
                    <Fragment key={f.id}>
                      <tr className={`hover:bg-muted/20 transition-colors${isExpanded ? " bg-muted/10" : ""}`}>
                        <td className="px-4 py-3 font-mono text-xs font-medium">{f.numero}</td>
                        <td className="px-4 py-3 tabular-nums text-xs">{formatDate(f.fecha)}</td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <div className="truncate font-medium">{f.razon_social}</div>
                          {f.ruc_cliente && (
                            <div className="text-[10px] text-muted-foreground">{f.ruc_cliente}</div>
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
                            <span className="text-emerald-600">—</span>
                          ) : (
                            <span className="text-amber-700">{formatCurrency(saldo)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            {f.estado_sri ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${BADGE_COBRO[estado]}`}
                          >
                            {estado}
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => openEditar(f)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              onClick={() => handleEliminar(f.id)}
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
                              empresaId={empresaActivaId}
                              numero={f.numero}
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
                    {formatCurrency(lista.reduce((s, f) => s + f.subtotal, 0))}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs font-semibold text-muted-foreground">
                    {formatCurrency(lista.reduce((s, f) => s + f.iva, 0))}
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
      )}

      {/* Drawer form */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{editando ? "Editar factura" : "Nueva factura"}</DrawerTitle>
            <DrawerDescription>
              {xmlParsed && !editando
                ? `Datos cargados desde XML · ${xmlParsed.numero}`
                : "Completa los datos de la factura emitida."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto p-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="numero"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input placeholder="001-001-000000001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tipo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="factura">Factura</SelectItem>
                            <SelectItem value="nota_credito">Nota de Crédito</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="proyecto_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proyecto</FormLabel>
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ruc_cliente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RUC / ID Cliente</FormLabel>
                        <FormControl>
                          <Input placeholder="1791365372001" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="razon_social"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razón Social</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre del cliente" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {(["subtotal", "descuento", "iva", "total"] as const).map((f) => (
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
                  name="observacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observación</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Descripción del producto / servicio"
                          {...field}
                          value={field.value ?? ""}
                        />
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
                    {editando ? "Guardar cambios" : "Registrar factura"}
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

// ─── CobroPanel ───────────────────────────────────────────────────────────────

interface CobroPanelProps {
  facturaId: string;
  total: number;
  empresaId: string;
  numero: string;
}

function CobroPanel({ facturaId, total, empresaId, numero }: CobroPanelProps) {
  const cobros = useCobros(facturaId);
  const crear = useCrearCobro(facturaId);
  const eliminar = useEliminarCobro(facturaId);

  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  const [monto, setMonto] = useState("");
  const [observacion, setObservacion] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const listaCobros = cobros.data ?? [];
  const montoCobrado = listaCobros.reduce((s, c) => s + Number(c.monto), 0);
  const saldo = Math.max(0, total - montoCobrado);
  const estado = calcEstadoCobro(total, montoCobrado);

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const montoNum = parseFloat(monto);
    if (!fecha) {
      setFormError("La fecha es requerida.");
      return;
    }
    if (isNaN(montoNum) || montoNum <= 0) {
      setFormError("El monto debe ser mayor a 0.");
      return;
    }
    if (montoNum > saldo + 0.001) {
      setFormError(`El monto no puede superar el saldo (${formatCurrency(saldo)}).`);
      return;
    }
    try {
      const payload: CobroInsert = {
        empresa_id: empresaId,
        factura_id: facturaId,
        fecha_cobro: fecha,
        monto: montoNum,
        observacion: observacion.trim() || null,
      };
      await crear.mutateAsync(payload);
      setMonto("");
      setObservacion("");
      toast.success("Cobro registrado");
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function handleEliminar(id: string) {
    if (!confirm("¿Eliminar este cobro?")) return;
    try {
      await eliminar.mutateAsync(id);
      toast.success("Cobro eliminado");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {/* Saldo header */}
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs uppercase text-muted-foreground tracking-wide">Factura</p>
          <p className="font-mono text-sm font-medium">{numero}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground tracking-wide">Total</p>
          <p className="tabular-nums font-semibold">{formatCurrency(total)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground tracking-wide">Cobrado</p>
          <p className="tabular-nums font-semibold text-emerald-700">{formatCurrency(montoCobrado)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground tracking-wide">Saldo pendiente</p>
          <p
            className={`tabular-nums text-xl font-bold ${
              estado === "cobrado" ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {formatCurrency(saldo)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${BADGE_COBRO[estado]}`}
        >
          {estado}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lista de cobros */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Pagos recibidos
          </p>
          {cobros.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Cargando…
            </div>
          ) : listaCobros.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sin cobros registrados.</p>
          ) : (
            <div className="space-y-1">
              {listaCobros.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border bg-background px-3 py-2"
                >
                  <div className="flex items-center gap-4">
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {formatDate(c.fecha_cobro)}
                    </span>
                    <span className="tabular-nums font-semibold text-emerald-700">
                      {formatCurrency(Number(c.monto))}
                    </span>
                    {c.observacion && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {c.observacion}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-destructive hover:text-destructive"
                    onClick={() => handleEliminar(c.id)}
                    disabled={eliminar.isPending}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formulario nuevo cobro */}
        {estado !== "cobrado" && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Registrar cobro
            </p>
            <form onSubmit={handleCrear} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Fecha</label>
                  <Input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Monto</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  Observación{" "}
                  <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <Input
                  placeholder="Transferencia, cheque, cuota #1…"
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              {formError && <p className="text-xs text-destructive">{formError}</p>}
              <Button type="submit" size="sm" disabled={crear.isPending}>
                {crear.isPending && <Loader2 className="size-3 mr-1.5 animate-spin" />}
                Registrar cobro
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
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
