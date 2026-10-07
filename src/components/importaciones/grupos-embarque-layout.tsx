/**
 * grupos-embarque-layout.tsx
 * Lista de Grupos de Embarque con sus importaciones vinculadas.
 * Permite prorratear costos compartidos de transporte entre importaciones
 * y marcar cada importacion como "Recibida" (generando inventario).
 */
import { useState } from "react";
import {
  Plus,
  Ship,
  ChevronDown,
  ChevronRight,
  Calculator,
  PackageCheck,
  Pencil,
  Trash2,
  Link2,
  Link2Off,
  Boxes,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  useGruposEmbarque,
  useEliminarGrupoEmbarque,
  useProrratearGrupo,
  useRecibirEmbarque,
  useVincularImportacion,
  useDesvincularImportacion,
} from "@/hooks/entities/use-grupos-embarque";
import { useEmbarques } from "@/hooks/entities/use-embarques";
import type { GrupoConImportaciones } from "@/services/importaciones-grupo";
import type { EmbarqueConLineas } from "@/services/importaciones-embarques";
import { GrupoEmbarqueForm } from "./grupo-embarque-form";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);

const ESTADO_CFG: Record<string, { label: string; className: string }> = {
  Abierto: { label: "Abierto", className: "bg-blue-50 text-blue-700 border-blue-200" },
  Prorrateado: {
    label: "Prorrateado",
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
  Cerrado: { label: "Cerrado", className: "bg-green-50 text-green-700 border-green-200" },
};

// ── Subcomponente: fila de importacion dentro del grupo ───────────────────────
function ImportacionRow({
  imp,
  grupoId,
  onRecibir,
  onDesvincular,
}: {
  imp: EmbarqueConLineas;
  grupoId: string;
  onRecibir: (id: string) => void;
  onDesvincular: (id: string) => void;
}) {
  return (
    <tr className="text-xs border-b last:border-0 hover:bg-muted/20">
      <td className="py-1.5 pr-3 font-mono font-semibold">{imp.numero_embarque ?? "—"}</td>
      <td className="py-1.5 pr-3">{imp.proveedor?.nombre ?? "—"}</td>
      <td className="py-1.5 pr-3 text-right">{fmt(imp.fob_total)}</td>
      <td className="py-1.5 pr-3 text-right text-blue-700">{fmt(imp.flete_prorrateado ?? 0)}</td>
      <td className="py-1.5 pr-3 text-right text-purple-700">{fmt(imp.seguro_prorrateado ?? 0)}</td>
      <td className="py-1.5 pr-3 text-right font-semibold">{fmt(imp.total_liquidado)}</td>
      <td className="py-1.5 pr-3">
        <Badge
          variant="outline"
          className={`text-xs ${imp.estado === "Recibida" ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}
        >
          {imp.estado}
        </Badge>
      </td>
      <td className="py-1.5">
        <div className="flex gap-1">
          {imp.estado !== "Recibida" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Marcar como recibida y generar inventario"
              onClick={() => onRecibir(imp.id)}
            >
              <PackageCheck className="size-3 text-green-600" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Desvincular del grupo"
            onClick={() => onDesvincular(imp.id)}
          >
            <Link2Off className="size-3 text-muted-foreground" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ── Subcomponente: Vincular importación ───────────────────────────────────────
function VincularDialog({
  open,
  grupoId,
  embarquesLibres,
  onClose,
}: {
  open: boolean;
  grupoId: string;
  embarquesLibres: EmbarqueConLineas[];
  onClose: () => void;
}) {
  const vincular = useVincularImportacion();

  async function handleVincular(impId: string) {
    try {
      await vincular.mutateAsync({ importacionId: impId, grupoId });
      toast.success("Importación vinculada al grupo");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular importación al grupo</DialogTitle>
        </DialogHeader>
        {embarquesLibres.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Todas las importaciones ya están vinculadas a un grupo.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {embarquesLibres.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/30"
              >
                <div>
                  <p className="text-sm font-mono font-semibold">{e.numero_embarque ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.proveedor?.nombre ?? "Sin proveedor"} · FOB {fmt(e.fob_total)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleVincular(e.id)}
                  disabled={vincular.isPending}
                >
                  <Link2 className="size-3 mr-1" /> Vincular
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Subcomponente: fila expandible del grupo ──────────────────────────────────
function GrupoRow({
  grupo,
  embarquesLibres,
  onEdit,
  onEliminar,
}: {
  grupo: GrupoConImportaciones;
  embarquesLibres: EmbarqueConLineas[];
  onEdit: (g: GrupoConImportaciones) => void;
  onEliminar: (g: GrupoConImportaciones) => void;
}) {
  const [open, setOpen] = useState(false);
  const [vincularOpen, setVincularOpen] = useState(false);

  const prorratear = useProrratearGrupo();
  const recibir = useRecibirEmbarque();
  const desvincular = useDesvincularImportacion();

  const cfg = ESTADO_CFG[grupo.estado] ?? ESTADO_CFG["Abierto"];
  const costoTotal = grupo.flete_total + grupo.seguro_total + grupo.otros_logistica;

  async function handleProrratear() {
    try {
      const r = await prorratear.mutateAsync(grupo.id);
      toast.success(
        `Prorrateo OK — ${r.importaciones} importaciones | ${fmt(r.flete_distribuido + r.seguro_distribuido)} distribuidos`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleRecibir(id: string) {
    try {
      const r = await recibir.mutateAsync(id);
      toast.success(`Recibida · ${r.unidades} unidades generadas en inventario`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleDesvincular(id: string) {
    try {
      await desvincular.mutateAsync(id);
      toast.success("Importación desvinculada");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <TableRow className="hover:bg-muted/30">
        <TableCell>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </Button>
        </TableCell>
        <TableCell className="font-mono text-xs font-semibold">{grupo.numero}</TableCell>
        <TableCell className="text-xs">{grupo.descripcion ?? "—"}</TableCell>
        <TableCell className="text-xs">
          {format(new Date(grupo.fecha), "dd MMM yyyy", { locale: es })}
        </TableCell>
        <TableCell className="text-xs text-right">{fmt(grupo.flete_total)}</TableCell>
        <TableCell className="text-xs text-right">{fmt(grupo.seguro_total)}</TableCell>
        <TableCell className="text-xs text-right font-semibold">{fmt(costoTotal)}</TableCell>
        <TableCell className="text-xs text-right text-muted-foreground">
          {grupo.importaciones.length}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-xs ${cfg.className}`}>
            {cfg.label}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Prorratear costos entre importaciones"
              onClick={handleProrratear}
              disabled={prorratear.isPending || grupo.importaciones.length === 0}
            >
              <Calculator className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Vincular importación"
              onClick={() => setVincularOpen(true)}
            >
              <Link2 className="size-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(grupo)}>
              <Pencil className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => onEliminar(grupo)}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Fila expandida: importaciones del grupo */}
      {open && (
        <TableRow className="bg-muted/10">
          <TableCell colSpan={10} className="py-0">
            <div className="px-6 py-3">
              {grupo.importaciones.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Sin importaciones vinculadas. Usa el botón <Link2 className="inline size-3" />{" "}
                  para agregar.
                </p>
              ) : (
                <>
                  {/* Resumen prorrateo */}
                  {grupo.estado === "Prorrateado" && (
                    <div className="mb-2 p-2 rounded bg-purple-50 border border-purple-100 text-xs text-purple-800 flex gap-6">
                      <span>
                        FOB grupo: <strong>{fmt(grupo.fob_total_grupo)}</strong>
                      </span>
                      <span>
                        Flete dist.: <strong>{fmt(grupo.flete_total)}</strong>
                      </span>
                      <span>
                        Seguro dist.: <strong>{fmt(grupo.seguro_total)}</strong>
                      </span>
                    </div>
                  )}
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b">
                        <th className="text-left py-1 pr-3 font-medium">Embarque</th>
                        <th className="text-left py-1 pr-3 font-medium">Proveedor</th>
                        <th className="text-right py-1 pr-3 font-medium">FOB</th>
                        <th className="text-right py-1 pr-3 font-medium text-blue-700">
                          Flete prorr.
                        </th>
                        <th className="text-right py-1 pr-3 font-medium text-purple-700">
                          Seguro prorr.
                        </th>
                        <th className="text-right py-1 pr-3 font-medium">Total liq.</th>
                        <th className="text-left py-1 pr-3 font-medium">Estado</th>
                        <th className="py-1 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.importaciones.map((imp) => (
                        <ImportacionRow
                          key={imp.id}
                          imp={imp}
                          grupoId={grupo.id}
                          onRecibir={handleRecibir}
                          onDesvincular={handleDesvincular}
                        />
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}

      {/* Dialog vincular */}
      <VincularDialog
        open={vincularOpen}
        grupoId={grupo.id}
        embarquesLibres={embarquesLibres}
        onClose={() => setVincularOpen(false)}
      />
    </>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function GruposEmbarqueLayout() {
  const { data: grupos = [], isLoading } = useGruposEmbarque();
  const { data: todosEmbarques = [] } = useEmbarques();
  const eliminar = useEliminarGrupoEmbarque();

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<GrupoConImportaciones | null>(null);
  const [paraEliminar, setParaEliminar] = useState<GrupoConImportaciones | null>(null);

  // Embarques sin grupo asignado (para el selector de vinculación)
  const embarquesLibres = (todosEmbarques as EmbarqueConLineas[]).filter(
    (e) => !(e as unknown as { grupo_embarque_id: string | null }).grupo_embarque_id,
  );

  function handleNuevo() {
    setEditando(null);
    setFormOpen(true);
  }
  function handleEdit(g: GrupoConImportaciones) {
    setEditando(g);
    setFormOpen(true);
  }

  async function confirmarEliminar() {
    if (!paraEliminar) return;
    try {
      await eliminar.mutateAsync(paraEliminar.id);
      toast.success("Grupo eliminado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setParaEliminar(null);
    }
  }

  // KPIs
  const totalGrupos = grupos.length;
  const totalImps = grupos.reduce((s, g) => s + g.importaciones.length, 0);
  const totalFlete = grupos.reduce((s, g) => s + g.flete_total, 0);
  const totalSeguro = grupos.reduce((s, g) => s + g.seguro_total, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Grupos de Embarque</h1>
          <p className="text-sm text-muted-foreground">
            Agrupa importaciones de un mismo envío físico y prorratea los costos de transporte
          </p>
        </div>
        <Button onClick={handleNuevo}>
          <Plus className="size-4 mr-2" /> Nuevo grupo
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Boxes, label: "Grupos", value: totalGrupos, color: "" },
          { icon: Ship, label: "Importaciones", value: totalImps, color: "" },
          {
            icon: Calculator,
            label: "Total flete",
            value: fmt(totalFlete),
            color: "text-blue-700",
          },
          {
            icon: Calculator,
            label: "Total seguro",
            value: fmt(totalSeguro),
            color: "text-purple-700",
          },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Icon className="size-4" />
              <span className="text-xs">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Número</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Flete</TableHead>
              <TableHead className="text-right">Seguro</TableHead>
              <TableHead className="text-right">Total costos</TableHead>
              <TableHead className="text-right">Importaciones</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-36">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : grupos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12">
                  <Boxes className="size-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Sin grupos de embarque</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={handleNuevo}>
                    <Plus className="size-4 mr-1" /> Crear primer grupo
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              grupos.map((g) => (
                <GrupoRow
                  key={g.id}
                  grupo={g}
                  embarquesLibres={embarquesLibres}
                  onEdit={handleEdit}
                  onEliminar={setParaEliminar}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Form */}
      {formOpen && (
        <GrupoEmbarqueForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditando(null);
          }}
          editando={editando}
        />
      )}

      {/* Confirmar eliminar */}
      <AlertDialog open={!!paraEliminar} onOpenChange={(o) => !o && setParaEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el grupo <strong>{paraEliminar?.numero}</strong> y las importaciones
              vinculadas se desvinculan (no se eliminan). Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarEliminar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
