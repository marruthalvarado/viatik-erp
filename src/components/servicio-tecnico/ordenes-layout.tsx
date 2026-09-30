/**
 * Layout: Órdenes de Servicio
 */
import { useState } from "react";
import {
  Plus, ClipboardList, CheckCircle2, Clock, Wrench, XCircle,
  AlertCircle, RotateCw, FileDown, FileText, Loader2,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  useOrdenesServicio,
  useCrearOrdenServicio,
  useActualizarOrdenServicio,
  useEliminarOrdenServicio,
  useGenerarOrdenesPreventivasManual,
} from "@/hooks/entities/use-servicio-tecnico";
import type {
  OrdenConRelaciones,
  OrdenServicioPayload,
  OsRepuestoPayload,
} from "@/services/servicio-tecnico/ordenes-servicio";
import { getOsActividades } from "@/services/servicio-tecnico/ordenes-servicio";
import { OrdenForm } from "./orden-form";
import { OrdenDetalleSheet } from "./orden-detalle-sheet";
import {
  exportOrdenServicioPdf,
  exportOrdenServicioDocx,
} from "@/services/export/orden-servicio-export";
import { useCompany } from "@/contexts/company-context";

const ESTADO_CFG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  pendiente:   { label: "Pendiente",   className: "bg-gray-50 text-gray-600 border-gray-200",     icon: Clock },
  programada:  { label: "Programada",  className: "bg-blue-50 text-blue-700 border-blue-200",      icon: Clock },
  en_proceso:  { label: "En proceso",  className: "bg-yellow-50 text-yellow-700 border-yellow-200",icon: Wrench },
  completada:  { label: "Completada",  className: "bg-green-50 text-green-700 border-green-200",   icon: CheckCircle2 },
  cancelada:   { label: "Cancelada",   className: "bg-red-50 text-red-600 border-red-200",         icon: XCircle },
};

const TIPO_LABELS: Record<string, string> = {
  preventivo:    "Preventivo",
  correctivo:    "Correctivo",
  instalacion:   "Instalación",
  actualizacion: "Actualización",
  repuesto:      "Repuesto",
};

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CFG[estado] ?? ESTADO_CFG["pendiente"];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`text-xs ${cfg.className}`}>
      <Icon className="size-3 mr-1" />{cfg.label}
    </Badge>
  );
}

export function OrdenesLayout() {
  const { empresaActiva } = useCompany();
  const { data: ordenes = [], isLoading } = useOrdenesServicio();
  const crear     = useCrearOrdenServicio();
  const actualizar = useActualizarOrdenServicio();
  const eliminar  = useEliminarOrdenServicio();
  const generar   = useGenerarOrdenesPreventivasManual();

  const [busqueda,    setBusqueda]    = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroTipo,   setFiltroTipo]   = useState<string>("todos");
  const [formOpen,    setFormOpen]    = useState(false);
  const [editando,    setEditando]    = useState<OrdenConRelaciones | null>(null);
  const [detalleOrden, setDetalleOrden] = useState<OrdenConRelaciones | null>(null);
  const [exportingPdf,  setExportingPdf]  = useState<string | null>(null);
  const [exportingDocx, setExportingDocx] = useState<string | null>(null);

  const filtradas = ordenes.filter((o) => {
    const q = busqueda.toLowerCase();
    const matchQ =
      (o.numero ?? "").toLowerCase().includes(q) ||
      (o.equipo?.nombre ?? "").toLowerCase().includes(q) ||
      (o.cliente?.nombre ?? "").toLowerCase().includes(q) ||
      (o.tecnico?.nombres ?? "").toLowerCase().includes(q);
    const matchEstado = filtroEstado === "todos" || o.estado === filtroEstado;
    const matchTipo   = filtroTipo   === "todos" || o.tipo   === filtroTipo;
    return matchQ && matchEstado && matchTipo;
  });

  const handleSubmit = async (payload: OrdenServicioPayload, repuestos: OsRepuestoPayload[]) => {
    try {
      if (editando) {
        await actualizar.mutateAsync({ id: editando.id, payload, repuestos });
        toast.success("Orden actualizada");
      } else {
        const res = await crear.mutateAsync({ payload, repuestos });
        toast.success(`Orden ${res.numero} creada`);
      }
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  };

  const handleEliminar = async (o: OrdenConRelaciones) => {
    if (!confirm(`¿Eliminar la orden ${o.numero}?`)) return;
    try {
      await eliminar.mutateAsync(o.id);
      toast.success("Orden eliminada");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleGenerar = async () => {
    try {
      const n = await generar.mutateAsync(14);
      toast.success(
        n > 0
          ? `${n} orden(es) preventiva(s) generada(s)`
          : "No hay equipos con mantenimiento próximo",
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const fmtDate = (d: string | null | undefined) =>
    d ? format(new Date(d), "dd/MM/yy HH:mm", { locale: es }) : "—";

  const exportOpts = empresaActiva
    ? {
        empresa: {
          nombre:    empresaActiva.nombre,
          ruc:       empresaActiva.ruc,
          telefono:  empresaActiva.telefono,
          correo:    empresaActiva.correo,
          direccion: empresaActiva.direccion,
          logo_url:  empresaActiva.logo_url,
        },
      }
    : {};

  const handleExportPdf = async (o: OrdenConRelaciones) => {
    setExportingPdf(o.id);
    try {
      const actividades = await getOsActividades(o.id).catch(() => []);
      await exportOrdenServicioPdf(o, { ...exportOpts, actividades });
    } catch (err) {
      console.error(err);
      toast.error("Error al generar el PDF");
    } finally {
      setExportingPdf(null);
    }
  };

  const handleExportDocx = async (o: OrdenConRelaciones) => {
    setExportingDocx(o.id);
    try {
      const actividades = await getOsActividades(o.id).catch(() => []);
      await exportOrdenServicioDocx(o, { ...exportOpts, actividades });
    } catch (err) {
      console.error(err);
      toast.error("Error al generar el Word");
    } finally {
      setExportingDocx(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Título */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" />
            Órdenes de Servicio
          </h1>
          <p className="text-sm text-muted-foreground">
            Registro de intervenciones técnicas — preventivas, correctivas e instalaciones.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerar}
            disabled={generar.isPending}
          >
            <RotateCw className={`size-4 mr-1 ${generar.isPending ? "animate-spin" : ""}`} />
            Generar preventivas
          </Button>
          <Button onClick={() => { setEditando(null); setFormOpen(true); }}>
            <Plus className="size-4 mr-1" />Nueva orden
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por número, equipo, cliente o técnico…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {Object.entries(ESTADO_CFG).map(([v, cfg]) => (
              <SelectItem key={v} value={v}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {Object.entries(TIPO_LABELS).map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>
      ) : filtradas.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <AlertCircle className="size-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium">Sin órdenes de servicio</p>
          <p className="text-sm">Crea una nueva orden o genera las preventivas automáticas.</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead>Programada</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => setDetalleOrden(o)}
                >
                  <TableCell className="font-mono text-sm">{o.numero}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {TIPO_LABELS[o.tipo] ?? o.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>
                      <p className="font-medium">{o.equipo?.nombre ?? "—"}</p>
                      {o.equipo?.numero_serie && (
                        <p className="text-xs text-muted-foreground">S/N: {o.equipo.numero_serie}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {o.cliente?.nombre ?? o.equipo?.cliente?.nombre ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {o.tecnico ? `${o.tecnico.nombres} ${o.tecnico.apellidos}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmtDate(o.fecha_programada)}
                  </TableCell>
                  <TableCell><EstadoBadge estado={o.estado ?? "pendiente"} /></TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex justify-end gap-1"
                      onClick={(e) => e.stopPropagation()} // evita abrir el detalle al hacer click en acciones
                    >
                      {/* Abrir detalle */}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setDetalleOrden(o)}
                        title="Abrir OS"
                      >
                        <ExternalLink className="size-3 mr-1" />Abrir
                      </Button>

                      {/* Editar metadatos */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditando(o); setFormOpen(true); }}
                        title="Editar datos de la orden"
                      >
                        Editar
                      </Button>

                      {/* Export rápido */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Exportar PDF"
                        disabled={exportingPdf === o.id}
                        onClick={() => handleExportPdf(o)}
                      >
                        {exportingPdf === o.id
                          ? <Loader2 className="size-3.5 animate-spin" />
                          : <FileDown className="size-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Exportar Word"
                        disabled={exportingDocx === o.id}
                        onClick={() => handleExportDocx(o)}
                      >
                        {exportingDocx === o.id
                          ? <Loader2 className="size-3.5 animate-spin" />
                          : <FileText className="size-3.5" />}
                      </Button>

                      {/* Eliminar */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleEliminar(o)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Formulario de crear / editar metadatos */}
      <OrdenForm
        open={formOpen}
        orden={editando}
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
      />

      {/* Panel de detalle unificado */}
      <OrdenDetalleSheet
        orden={detalleOrden}
        open={detalleOrden !== null}
        onClose={() => setDetalleOrden(null)}
      />
    </div>
  );
}
