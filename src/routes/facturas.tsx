/**
 * Módulo Facturas Emitidas.
 *
 * - Lista todas las facturas emitidas de la empresa
 * - Carga desde XML SRI Ecuador (parseo automático)
 * - Ingreso manual
 * - Asociación a proyecto
 */
import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Upload, Plus, Pencil, Trash2, TrendingUp } from "lucide-react";
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
  const fileRef = useRef<HTMLInputElement>(null);

  const facturas = useFacturasEmitidas(empresaActivaId, anio);
  const proyectos = useProyectos({ empresaId: empresaActivaId ?? undefined, pageSize: 200 });
  const crear = useCrearFactura();
  const actualizar = useActualizarFactura();
  const eliminar = useEliminarFactura();

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

  // KPIs rápidos
  const lista = facturas.data ?? [];
  const totalAnio = lista.reduce((s, f) => s + (Number(f.total) || 0), 0);
  const numFacturas = lista.length;

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
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
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
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {lista.map((f) => (
                  <tr key={f.id} className="hover:bg-muted/20 transition-colors">
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
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        {f.estado_sri ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
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
                ))}
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
                  <td colSpan={2} />
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

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
