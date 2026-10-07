/**
 * costeos-layout.tsx
 * Lista de costeos de importación con KPIs y acciones.
 */
import { useState } from "react";
import {
  Plus, Calculator, Package, CheckCircle2, Archive, Clock,
  TrendingUp, Eye, Pencil, Trash2, RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

import { Button }       from "@/components/ui/button";
import { Badge }        from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useCosteos, useEliminarCosteo, useActualizarEstadoCosteo } from "@/hooks/entities/use-costeos";
import type { CosteoConRelaciones, EstadoCosteo } from "@/services/costeos";
import { CosteoForm }   from "./costeo-form";
import { CosteoDetalle } from "./costeo-detalle";

// ── Configuración de estados ─────────────────────────────────────────────────
const ESTADO_CFG: Record<EstadoCosteo, { label: string; className: string; icon: React.ElementType }> = {
  borrador:  { label: "Borrador",  className: "bg-yellow-50 text-yellow-700 border-yellow-200",  icon: Clock },
  aprobado:  { label: "Aprobado",  className: "bg-blue-50 text-blue-700 border-blue-200",        icon: CheckCircle2 },
  vigente:   { label: "Vigente",   className: "bg-green-50 text-green-700 border-green-200",     icon: TrendingUp },
  archivado: { label: "Archivado", className: "bg-gray-50 text-gray-400 border-gray-200",        icon: Archive },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

// ── Componente ────────────────────────────────────────────────────────────────
export function CosteosLayout() {
  const { data: costeos = [], isLoading } = useCosteos();
  const eliminar      = useEliminarCosteo();
  const cambiarEstado = useActualizarEstadoCosteo();

  const [filtro, setFiltro]     = useState<EstadoCosteo | "todos">("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<CosteoConRelaciones | null>(null);
  const [detalle, setDetalle]   = useState<CosteoConRelaciones | null>(null);
  const [paraEliminar, setParaEliminar] = useState<CosteoConRelaciones | null>(null);

  const filtrados = costeos.filter(
    (c) => filtro === "todos" || c.estado === filtro,
  );

  // KPIs
  const vigentes  = costeos.filter((c) => c.estado === "vigente").length;
  const aprobados = costeos.filter((c) => c.estado === "aprobado").length;
  const totalPvp  = costeos
    .filter((c) => ["vigente", "aprobado"].includes(c.estado))
    .reduce((s, c) => s + c.pvp_privado, 0);

  const handleEliminar = async () => {
    if (!paraEliminar) return;
    try {
      await eliminar.mutateAsync(paraEliminar.id);
      toast.success(`Costeo ${paraEliminar.numero} eliminado`);
      setParaEliminar(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleEstado = async (c: CosteoConRelaciones, estado: EstadoCosteo) => {
    try {
      await cambiarEstado.mutateAsync({ id: c.id, estado });
      toast.success(`Costeo marcado como ${ESTADO_CFG[estado].label.toLowerCase()}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const openForm = (c?: CosteoConRelaciones) => {
    setEditando(c ?? null);
    setFormOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
        <RefreshCw className="size-4 animate-spin" />
        Cargando costeos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard icon={Calculator} label="Total costeos"   value={String(costeos.length)} />
        <KpiCard icon={CheckCircle2} label="Aprobados"     value={String(aprobados)}      color="blue" />
        <KpiCard icon={TrendingUp}  label="Vigentes"       value={String(vigentes)}       color="green" />
        <KpiCard icon={Package}     label="PVP portafolio" value={fmt(totalPvp)}          color="primary" />
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={filtro} onValueChange={(v) => setFiltro(v as EstadoCosteo | "todos")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {Object.entries(ESTADO_CFG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filtrados.length} costeo{filtrados.length !== 1 ? "s" : ""}
          </span>
        </div>
        <Button onClick={() => openForm()} className="gap-2">
          <Plus className="size-4" />
          Nuevo costeo
        </Button>
      </div>

      {/* Tabla */}
      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground border-2 border-dashed rounded-xl">
          <Calculator className="size-10 opacity-30" />
          <div className="text-center">
            <p className="font-medium">Sin costeos</p>
            <p className="text-sm">
              {filtro === "todos"
                ? "Crea tu primer costeo de importación"
                : `No hay costeos en estado "${ESTADO_CFG[filtro as EstadoCosteo].label}"`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => openForm()}>
            <Plus className="size-4 mr-2" />
            Crear costeo
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Número</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead className="text-right">Costo aterrizaje</TableHead>
                <TableHead className="text-right">PVP Privado</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="w-28">Estado</TableHead>
                <TableHead className="w-24">Fecha</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((c) => {
                const cfg  = ESTADO_CFG[c.estado as EstadoCosteo];
                const Icon = cfg.icon;
                const margen = c.pvp_privado > 0
                  ? ((c.pvp_privado - c.costo_total_usd) / c.pvp_privado * 100).toFixed(1)
                  : "–";
                return (
                  <TableRow key={c.id} className="group">
                    <TableCell className="font-mono text-xs font-medium">{c.numero}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm">{c.descripcion_producto}</TableCell>
                    <TableCell className="text-sm">{c.proveedor?.nombre ?? "–"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.proyecto ? `${c.proyecto.codigo}` : "–"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {fmt(c.costo_aterrizaje_usd)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">
                      {fmt(c.pvp_privado)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {margen !== "–" ? `${margen}%` : "–"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={c.estado}
                        onValueChange={(v) => handleEstado(c, v as EstadoCosteo)}
                      >
                        <SelectTrigger className="h-7 w-28 px-2" asChild>
                          <button>
                            <Badge
                              variant="outline"
                              className={`${cfg.className} gap-1 cursor-pointer text-xs`}
                            >
                              <Icon className="size-3" />
                              {cfg.label}
                            </Badge>
                          </button>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ESTADO_CFG).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(c.created_at), "dd MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => setDetalle(c)}
                          title="Ver detalle"
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => openForm(c)}
                          title="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive"
                          onClick={() => setParaEliminar(c)}
                          title="Eliminar"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form — se monta sólo cuando está abierto para evitar render en frío */}
      {formOpen && (
        <CosteoForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditando(null); }}
          editando={editando}
        />
      )}

      {/* Detalle */}
      {detalle && (
        <CosteoDetalle
          costeo={detalle}
          onClose={() => setDetalle(null)}
          onEditar={() => { openForm(detalle); setDetalle(null); }}
        />
      )}

      {/* Confirmar eliminar */}
      <AlertDialog open={!!paraEliminar} onOpenChange={(o) => !o && setParaEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar costeo {paraEliminar?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El costeo "{paraEliminar?.descripcion_producto}" será eliminado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminar}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon,
  label,
  value,
  color = "default",
}: {
  icon:    React.ElementType;
  label:   string;
  value:   string;
  color?:  "default" | "blue" | "green" | "primary";
}) {
  const colors = {
    default: "text-muted-foreground",
    blue:    "text-blue-600",
    green:   "text-green-600",
    primary: "text-primary",
  };
  return (
    <div className="border rounded-lg p-4 bg-card flex items-center gap-3">
      <div className={`${colors[color]} opacity-70`}>
        <Icon className="size-8" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold font-mono ${colors[color]}`}>{value}</p>
      </div>
    </div>
  );
}
