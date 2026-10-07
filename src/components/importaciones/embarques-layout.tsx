/**
 * embarques-layout.tsx
 * Lista de embarques con KPIs, tabla, prorrateo y vinculación a costeo.
 */
import { useState } from "react";
import {
  Plus, Ship, CheckCircle2, Truck, Package,
  Pencil, Trash2, Calculator, ChevronDown, ChevronRight, RefreshCw,
  FileSpreadsheet, FileText,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useEmbarques, useEliminarEmbarque, useProrratearCostos, useActualizarCostoCatalogo,
} from "@/hooks/entities/use-embarques";
import type { EmbarqueConLineas } from "@/services/importaciones-embarques";
import { exportLiquidacionExcel, exportLiquidacionPdf } from "@/services/importaciones-export";
import { EmbarqueForm } from "./embarque-form";

// ── Config estados ────────────────────────────────────────────────────────────

const ESTADO_CFG = {
  "En tránsito": { label: "En tránsito", className: "bg-blue-50 text-blue-700 border-blue-200",   icon: Truck },
  "Recibida":    { label: "Recibida",    className: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  "Parcial":     { label: "Parcial",     className: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: Package },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

// ── Fila expandible ───────────────────────────────────────────────────────────
function EmbarqueRow({
  emb,
  onEdit,
  onEliminar,
  onProrratear,
  onActualizarCatalogo,
  onExportExcel,
  onExportPdf,
}: {
  emb:                  EmbarqueConLineas;
  onEdit:               (e: EmbarqueConLineas) => void;
  onEliminar:           (e: EmbarqueConLineas) => void;
  onProrratear:         (id: string) => void;
  onActualizarCatalogo: (id: string) => void;
  onExportExcel:        (e: EmbarqueConLineas) => void;
  onExportPdf:          (e: EmbarqueConLineas) => void;
}) {
  const [open, setOpen] = useState(false);
  const cfg = ESTADO_CFG[emb.estado as keyof typeof ESTADO_CFG] ?? ESTADO_CFG["En tránsito"];
  const Icon = cfg.icon;

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/30">
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setOpen(!open)}
          >
            {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </Button>
        </TableCell>
        <TableCell className="font-mono text-xs font-semibold">
          {emb.numero_embarque ?? "—"}
        </TableCell>
        <TableCell className="text-xs">{emb.numero_liquidacion ?? "—"}</TableCell>
        <TableCell className="text-xs">{emb.proveedor?.nombre ?? "—"}</TableCell>
        <TableCell className="text-xs text-right">{fmt(emb.fob_total)}</TableCell>
        <TableCell className="text-xs text-right">{fmt(emb.total_liquidado)}</TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-xs ${cfg.className} gap-1`}>
            <Icon className="size-3" />
            {cfg.label}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {format(new Date(emb.fecha), "dd MMM yyyy", { locale: es })}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            {/* Prorratear */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Calcular prorrateo"
              onClick={() => onProrratear(emb.id)}
            >
              <Calculator className="size-3" />
            </Button>
            {/* Actualizar catálogo */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Actualizar precio costo en catálogo"
              onClick={() => onActualizarCatalogo(emb.id)}
            >
              <RefreshCw className="size-3" />
            </Button>
            {/* Exportar Excel */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Exportar liquidación a Excel"
              onClick={() => onExportExcel(emb)}
            >
              <FileSpreadsheet className="size-3" />
            </Button>
            {/* Exportar PDF */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Exportar liquidación a PDF"
              onClick={() => onExportPdf(emb)}
            >
              <FileText className="size-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(emb)}>
              <Pencil className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => onEliminar(emb)}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Fila expandida: líneas del DAI */}
      {open && (
        <TableRow className="bg-muted/10">
          <TableCell colSpan={9} className="py-0">
            <div className="px-6 py-3">
              {/* Comparación costeo si hay */}
              {emb.costeo && (
                <div className="mb-3 p-2 rounded-md bg-blue-50 border border-blue-100 text-xs text-blue-800 flex gap-6">
                  <span>Costeo vinculado: <strong>{emb.costeo.numero}</strong></span>
                  <span>
                    Estimado: <strong>{fmt(emb.costeo.costo_aterrizaje_usd)}</strong>
                    {" "}vs Real: <strong>{fmt(emb.total_liquidado)}</strong>
                    {" "}
                    <span className={emb.total_liquidado > emb.costeo.costo_aterrizaje_usd ? "text-red-600" : "text-green-600"}>
                      ({emb.total_liquidado > emb.costeo.costo_aterrizaje_usd ? "+" : ""}
                      {fmt(emb.total_liquidado - emb.costeo.costo_aterrizaje_usd)})
                    </span>
                  </span>
                </div>
              )}

              {/* Líneas */}
              {emb.lineas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin líneas registradas</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b">
                      <th className="text-left py-1 pr-3 font-medium">Descripción</th>
                      <th className="text-right py-1 pr-3 font-medium">FOB línea</th>
                      <th className="text-right py-1 pr-3 font-medium">Cantidad</th>
                      <th className="text-right py-1 pr-3 font-medium">Costo unit. calc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emb.lineas.map((l) => (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="py-1 pr-3">{l.descripcion_original}</td>
                        <td className="text-right py-1 pr-3">{fmt(l.fob_linea)}</td>
                        <td className="text-right py-1 pr-3">{l.cantidad} {l.unidad_medida ?? ""}</td>
                        <td className="text-right py-1 pr-3">
                          {l.costo_unitario_calculado != null
                            ? fmt(Number(l.costo_unitario_calculado))
                            : <span className="text-muted-foreground italic">Calcular</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function EmbarquesLayout() {
  const { data: embarques = [], isLoading } = useEmbarques();
  const eliminar          = useEliminarEmbarque();
  const prorratear        = useProrratearCostos();
  const actualizarCatalog = useActualizarCostoCatalogo();

  const [formOpen, setFormOpen]     = useState(false);
  const [editando, setEditando]     = useState<EmbarqueConLineas | null>(null);
  const [paraEliminar, setParaEliminar] = useState<EmbarqueConLineas | null>(null);

  function handleEdit(emb: EmbarqueConLineas) {
    setEditando(emb);
    setFormOpen(true);
  }
  function handleNuevo() {
    setEditando(null);
    setFormOpen(true);
  }
  function handleCloseForm() {
    setFormOpen(false);
    setEditando(null);
  }

  async function handleProrratear(id: string) {
    try {
      await prorratear.mutateAsync(id);
      toast.success("Prorrateo calculado");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleActualizarCatalogo(id: string) {
    try {
      const result = await actualizarCatalog.mutateAsync(id);
      toast.success(
        result.actualizados > 0
          ? `Catálogo actualizado: ${result.actualizados} producto(s)`
          : "Sin productos vinculados para actualizar"
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleExportExcel(emb: EmbarqueConLineas) {
    try {
      await exportLiquidacionExcel(emb);
    } catch (e) {
      toast.error("Error al exportar Excel: " + (e as Error).message);
    }
  }

  async function handleExportPdf(emb: EmbarqueConLineas) {
    try {
      await exportLiquidacionPdf(emb);
    } catch (e) {
      toast.error("Error al exportar PDF: " + (e as Error).message);
    }
  }

  async function confirmarEliminar() {
    if (!paraEliminar) return;
    try {
      await eliminar.mutateAsync(paraEliminar.id);
      toast.success("Embarque eliminado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setParaEliminar(null);
    }
  }

  // KPIs
  const total     = embarques.length;
  const transito  = embarques.filter((e) => e.estado === "En tránsito").length;
  const recibidas = embarques.filter((e) => e.estado === "Recibida").length;
  const totalUsd  = embarques.reduce((acc, e) => acc + e.total_liquidado, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Embarques</h1>
          <p className="text-sm text-muted-foreground">
            Liquidaciones DAI — costo aterrizaje real vs estimado
          </p>
        </div>
        <Button onClick={handleNuevo}>
          <Plus className="size-4 mr-2" /> Nuevo embarque
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Ship className="size-4" />
            <span className="text-xs">Total embarques</span>
          </div>
          <p className="text-2xl font-bold">{total}</p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Truck className="size-4 text-blue-500" />
            <span className="text-xs">En tránsito</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{transito}</p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle2 className="size-4 text-green-500" />
            <span className="text-xs">Recibidas</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{recibidas}</p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Calculator className="size-4 text-purple-500" />
            <span className="text-xs">Total liquidado</span>
          </div>
          <p className="text-xl font-bold">{fmt(totalUsd)}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Embarque</TableHead>
              <TableHead>N° DAI</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="text-right">FOB total</TableHead>
              <TableHead className="text-right">Total liquidado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="w-40">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : embarques.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <Ship className="size-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Sin embarques registrados
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={handleNuevo}>
                    <Plus className="size-4 mr-1" /> Registrar primer embarque
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              embarques.map((emb) => (
                <EmbarqueRow
                  key={emb.id}
                  emb={emb}
                  onEdit={handleEdit}
                  onEliminar={setParaEliminar}
                  onProrratear={handleProrratear}
                  onActualizarCatalogo={handleActualizarCatalogo}
                  onExportExcel={handleExportExcel}
                  onExportPdf={handleExportPdf}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Form */}
      {formOpen && (
        <EmbarqueForm
          open={formOpen}
          onClose={handleCloseForm}
          editando={editando}
        />
      )}

      {/* Confirmar eliminar */}
      <AlertDialog open={!!paraEliminar} onOpenChange={(o) => !o && setParaEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar embarque?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el embarque <strong>{paraEliminar?.numero_embarque}</strong> y todas
              sus líneas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEliminar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
