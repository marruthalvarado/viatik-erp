/**
 * Módulo Inventario — Bodega.
 *
 * Gestiona el inventario de equipos, repuestos y consumibles importados.
 * - Catálogo de productos (PROD-XXX)
 * - Importaciones / liquidaciones aduaneras (DAI)
 * - Unidades individuales (UNIT-XXXX) y lotes (LOT-XXXX)
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Package, Import, Archive, Plus, Pencil, Trash2, Eye, RefreshCw,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "@/components/common/toast";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/common/metric-card";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/common/drawer";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useCompany } from "@/contexts/company-context";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { emptyToNull } from "@/utils/formatters";

import {
  useProductosCatalogo, useCreateProducto, useUpdateProducto, useDeleteProducto,
  useImportaciones, useCreateImportacion,
  useGenerarUnidades, useRecalcularProrrateo,
  useUnidades, useResumenInventario,
} from "@/hooks/entities/use-inventario";

import { ProductoForm } from "@/components/inventario/producto-form";
import { ImportacionForm } from "@/components/inventario/importacion-form";
import { UnidadDrawer } from "@/components/inventario/unidad-drawer";
import type { ProductoFormValues, ImportacionFormValues, LineaFormValues } from "@/components/inventario/inventario-types";
import type { ProductoCatalogo, ImportacionConLineas, UnidadConDetalle } from "@/services/inventario";

export const Route = createFileRoute("/inventario")({
  head: () => ({ meta: [{ title: "Inventario · VIATIQ" }] }),
  component: InventarioPage,
});

function InventarioPage() {
  return (
    <AppShell>
      <InventarioContent />
    </AppShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTENIDO PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
function InventarioContent() {
  const { empresaActivaId } = useCompany();
  const { data: resumen, isLoading: resumenLoading } = useResumenInventario();

  if (!empresaActivaId) {
    return (
      <div className="p-6">
        <EmptyState title="Sin empresa activa" description="Selecciona una empresa para ver el inventario." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Inventario"
        description="Bodega, equipos, repuestos y consumibles"
      />

      {/* KPIs */}
      {!resumenLoading && resumen && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Total en bodega" value={resumen.en_bodega} icon={Archive} />
          <MetricCard label="Asignados" value={resumen.asignadas} icon={Package} />
          <MetricCard label="En tránsito" value={resumen.en_transito} icon={Import} />
          <MetricCard label="Valor inventario" value={formatCurrency(resumen.valor_total)} icon={Archive} />
        </div>
      )}

      <Tabs defaultValue="catalogo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalogo" className="gap-1.5">
            <Package className="size-3.5" /> Catálogo
          </TabsTrigger>
          <TabsTrigger value="importaciones" className="gap-1.5">
            <Import className="size-3.5" /> Importaciones
          </TabsTrigger>
          <TabsTrigger value="bodega" className="gap-1.5">
            <Archive className="size-3.5" /> Bodega
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo"><CatalogoTab /></TabsContent>
        <TabsContent value="importaciones"><ImportacionesTab /></TabsContent>
        <TabsContent value="bodega"><BodegaTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1: CATÁLOGO DE PRODUCTOS
// ══════════════════════════════════════════════════════════════════════════════
function CatalogoTab() {
  const { data: productos = [], isLoading } = useProductosCatalogo();
  const crear = useCreateProducto();
  const actualizar = useUpdateProducto();
  const eliminar = useDeleteProducto();
  const { empresaActivaId } = useCompany();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ProductoCatalogo | null>(null);
  const [deleting, setDeleting] = useState<ProductoCatalogo | null>(null);

  async function handleSubmit(values: ProductoFormValues) {
    const payload = {
      empresa_id: empresaActivaId!,
      nombre: values.nombre,
      descripcion: emptyToNull(values.descripcion),
      tipo_seguimiento: values.tipo_seguimiento,
      unidad_medida: values.unidad_medida,
      categoria_id: emptyToNull(values.categoria_id),
      estado: values.estado,
    };

    if (editing) {
      await actualizar.mutateAsync({ id: editing.id, payload }, {
        onSuccess: () => { toast.success("Producto actualizado"); setDrawerOpen(false); setEditing(null); },
        onError: (e) => toast.error(e.message),
      });
    } else {
      await crear.mutateAsync(payload as never, {
        onSuccess: () => { toast.success("Producto creado"); setDrawerOpen(false); },
        onError: (e) => toast.error(e.message),
      });
    }
  }

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setDrawerOpen(true); }}>
          <Plus className="size-4 mr-1" /> Nuevo producto
        </Button>
      </div>

      {productos.length === 0 ? (
        <EmptyState title="Sin productos" description="Agrega el primer producto al catálogo." />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Código</th>
                <th className="px-3 py-2 text-left font-medium">Nombre</th>
                <th className="px-3 py-2 text-left font-medium">Seguimiento</th>
                <th className="px-3 py-2 text-left font-medium">Unidad</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {productos.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs">{p.codigo ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{p.nombre}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-xs">
                      {p.tipo_seguimiento === "lote" ? "Lote" : "Unidad"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{p.unidad_medida}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                      p.estado === "activo" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                    }`}>
                      {p.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost" size="icon" className="size-7"
                        onClick={() => { setEditing(p); setDrawerOpen(true); }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="size-7 text-destructive"
                        onClick={() => setDeleting(p)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={drawerOpen} onOpenChange={(o) => { if (!o) { setDrawerOpen(false); setEditing(null); } }}>
        <DrawerContent className="max-w-lg">
          <DrawerHeader>
            <DrawerTitle>{editing ? "Editar producto" : "Nuevo producto"}</DrawerTitle>
            <DrawerDescription>
              {editing
                ? "Actualiza los datos del producto del catálogo."
                : "Agrega un nuevo producto o modelo al catálogo de inventario."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4">
            <ProductoForm
              initial={editing}
              onSubmit={handleSubmit}
              submitting={crear.isPending || actualizar.isPending}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <DeleteDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        entityLabel={deleting?.nombre ?? "este producto"}
        onConfirm={async () => {
          await eliminar.mutateAsync(deleting!.id, {
            onSuccess: () => { toast.success("Producto eliminado"); setDeleting(null); },
            onError: (e) => toast.error(e.message),
          });
        }}
        loading={eliminar.isPending}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2: IMPORTACIONES
// ══════════════════════════════════════════════════════════════════════════════
function ImportacionesTab() {
  const { data: importaciones = [], isLoading } = useImportaciones();
  const crear = useCreateImportacion();
  const recalcular = useRecalcularProrrateo();
  const generarUnidades = useGenerarUnidades();

  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleSubmit(values: ImportacionFormValues, lineas: LineaFormValues[]) {
    const payload = {
      ...values,
      proveedor_id: emptyToNull(values.proveedor_id),
      bodega_destino_id: emptyToNull(values.bodega_destino_id),
      gasto_empresa_id: null,
      valor_aduanas:
        Number(values.fob_total) + Number(values.seguro) + Number(values.flete) + Number(values.ajustes),
    };

    const lineasPayload = lineas
      .filter((l) => l.descripcion_original.trim())
      .map((l) => ({
        descripcion_original: l.descripcion_original,
        fob_linea: l.fob_linea,
        cantidad: l.cantidad,
        unidad_medida: emptyToNull(l.unidad_medida ?? ""),
        producto_id: emptyToNull(l.producto_id ?? ""),
      }));

    await crear.mutateAsync({ payload: payload as never, lineas: lineasPayload as never }, {
      onSuccess: () => { toast.success("Importación creada"); setDrawerOpen(false); },
      onError: (e) => toast.error(e.message),
    });
  }

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDrawerOpen(true)}>
          <Plus className="size-4 mr-1" /> Nueva importación
        </Button>
      </div>

      {importaciones.length === 0 ? (
        <EmptyState title="Sin importaciones" description="Registra la primera liquidación aduanera." />
      ) : (
        <div className="space-y-3">
          {importaciones.map((imp) => (
            <ImportacionCard
              key={imp.id}
              imp={imp}
              onRecalcular={async () => {
                await recalcular.mutateAsync(imp.id, {
                  onSuccess: () => toast.success("Prorrateo recalculado"),
                  onError: (e) => toast.error(e.message),
                });
              }}
              onGenerarUnidades={async () => {
                await generarUnidades.mutateAsync(imp.id, {
                  onSuccess: (n) => toast.success(`${n as number} unidades generadas`),
                  onError: (e) => toast.error(e.message),
                });
              }}
            />
          ))}
        </div>
      )}

      <Drawer open={drawerOpen} onOpenChange={(o) => { if (!o) setDrawerOpen(false); }}>
        <DrawerContent className="max-w-4xl">
          <DrawerHeader>
            <DrawerTitle>Nueva importación</DrawerTitle>
            <DrawerDescription>Registro de liquidación aduanera (DAI) con líneas de productos.</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 overflow-y-auto max-h-[80vh]">
            <ImportacionForm onSubmit={handleSubmit} submitting={crear.isPending} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function ImportacionCard({
  imp, onRecalcular, onGenerarUnidades,
}: {
  imp: ImportacionConLineas;
  onRecalcular: () => Promise<void>;
  onGenerarUnidades: () => Promise<void>;
}) {
  const ESTADO_COLORS: Record<string, string> = {
    "En tránsito": "bg-yellow-100 text-yellow-800",
    "Recibida": "bg-emerald-100 text-emerald-800",
    "Parcial": "bg-blue-100 text-blue-800",
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{imp.numero_liquidacion ?? "S/N"}</span>
            {imp.referencia_dai && (
              <span className="text-xs text-muted-foreground">· {imp.referencia_dai}</span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {formatDate(imp.fecha)} · {imp.proveedor?.nombre ?? "Sin proveedor"} · {imp.bodega?.nombre ?? "Sin bodega"}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${ESTADO_COLORS[imp.estado] ?? ""}`}>
            {imp.estado}
          </span>
        </div>
      </div>

      {/* Resumen financiero */}
      <div className="grid grid-cols-4 gap-2 text-sm">
        <div className="text-center">
          <div className="text-xs text-muted-foreground">FOB Total</div>
          <div className="font-medium">{formatCurrency(imp.fob_total)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Total Liquidado</div>
          <div className="font-semibold text-primary">{formatCurrency(imp.total_liquidado)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Líneas</div>
          <div className="font-medium">{imp.lineas.length}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">País origen</div>
          <div>{imp.pais_origen ?? "—"}</div>
        </div>
      </div>

      {/* Líneas */}
      {imp.lineas.length > 0 && (
        <div className="rounded border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-2 py-1 text-left">Descripción</th>
                <th className="px-2 py-1 text-left">Producto</th>
                <th className="px-2 py-1 text-right">Cant.</th>
                <th className="px-2 py-1 text-right">FOB línea</th>
                <th className="px-2 py-1 text-right">Costo unit.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {imp.lineas.map((l) => (
                <tr key={l.id} className="hover:bg-muted/10">
                  <td className="px-2 py-1.5">{l.descripcion_original}</td>
                  <td className="px-2 py-1.5">
                    {l.producto
                      ? <span className="font-mono">[{l.producto.codigo}] {l.producto.nombre}</span>
                      : <span className="text-muted-foreground italic">Sin vincular</span>
                    }
                  </td>
                  <td className="px-2 py-1.5 text-right">{l.cantidad}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(l.fob_linea)}</td>
                  <td className="px-2 py-1.5 text-right font-medium">
                    {l.costo_unitario_calculado
                      ? formatCurrency(l.costo_unitario_calculado)
                      : <span className="text-muted-foreground">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onRecalcular}>
          <RefreshCw className="size-3 mr-1" /> Recalcular prorrateo
        </Button>
        {imp.estado !== "Recibida" && (
          <Button size="sm" onClick={onGenerarUnidades}>
            <Archive className="size-3 mr-1" /> Generar unidades
          </Button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3: BODEGA (unidades e inventario)
// ══════════════════════════════════════════════════════════════════════════════
function BodegaTab() {
  const [estadoFiltro, setEstadoFiltro] = useState<string>("");
  const { data: unidades = [], isLoading } = useUnidades(
    estadoFiltro ? { estado: estadoFiltro } : undefined,
  );
  const [selectedUnidad, setSelectedUnidad] = useState<UnidadConDetalle | null>(null);

  const ESTADO_COLORS: Record<string, string> = {
    "En bodega": "bg-emerald-100 text-emerald-800",
    "Asignado": "bg-blue-100 text-blue-800",
    "En tránsito": "bg-yellow-100 text-yellow-800",
    "Instalado": "bg-purple-100 text-purple-800",
    "Vendido": "bg-gray-100 text-gray-600",
    "Dañado": "bg-red-100 text-red-800",
    "Baja": "bg-red-200 text-red-900",
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select
          value={estadoFiltro || "_all"}
          onValueChange={(v) => setEstadoFiltro(v === "_all" ? "" : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos los estados</SelectItem>
            <SelectItem value="En bodega">En bodega</SelectItem>
            <SelectItem value="Asignado">Asignado</SelectItem>
            <SelectItem value="En tránsito">En tránsito</SelectItem>
            <SelectItem value="Instalado">Instalado</SelectItem>
            <SelectItem value="Vendido">Vendido</SelectItem>
            <SelectItem value="Dañado">Dañado</SelectItem>
            <SelectItem value="Baja">Baja</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{unidades.length} registros</span>
      </div>

      {unidades.length === 0 ? (
        <EmptyState
          title="Sin unidades"
          description="Crea una importación y usa 'Generar unidades' para poblar el inventario."
        />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Código</th>
                <th className="px-3 py-2 text-left font-medium">Producto</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-left font-medium">Bodega</th>
                <th className="px-3 py-2 text-right font-medium">Cant.</th>
                <th className="px-3 py-2 text-right font-medium">Costo unit.</th>
                <th className="px-3 py-2 text-left font-medium">Ingreso</th>
                <th className="px-3 py-2 text-right font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {unidades.map((u) => (
                <tr key={u.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs font-semibold">{u.codigo ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div>{u.producto?.nombre ?? "—"}</div>
                    {u.serial && (
                      <div className="text-xs text-muted-foreground font-mono">{u.serial}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${ESTADO_COLORS[u.estado] ?? "bg-gray-100"}`}>
                      {u.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{u.bodega?.nombre ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {u.producto?.tipo_seguimiento === "lote"
                      ? <span>{u.cantidad_actual}<span className="text-muted-foreground">/{u.cantidad_original}</span></span>
                      : "1"
                    }
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrency(u.costo_unitario ?? null)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(u.fecha_ingreso)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost" size="icon" className="size-7"
                      onClick={() => setSelectedUnidad(u)}
                    >
                      <Eye className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UnidadDrawer
        unidad={selectedUnidad}
        open={!!selectedUnidad}
        onClose={() => setSelectedUnidad(null)}
      />
    </div>
  );
}
