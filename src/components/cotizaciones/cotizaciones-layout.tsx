/**
 * Layout principal del módulo Cotizaciones.
 * Lista de cotizaciones + acciones: nueva, ver detalle, cambiar estado, generar factura.
 */
import { useState } from "react";
import { Plus, FileText, CheckCircle2, XCircle, Send, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useCotizaciones,
  useActualizarEstadoCotizacion,
  useConvertirAFactura,
} from "@/hooks/entities/use-cotizaciones";
import type { EstadoCotizacion, CotizacionConItems } from "@/services/cotizaciones";
import { CotizacionForm } from "./cotizacion-form";
import { CotizacionDetalle } from "./cotizacion-detalle";

const ESTADO_CFG: Record<EstadoCotizacion, { label: string; className: string; icon: React.ElementType }> = {
  borrador:  { label: "Borrador",  className: "bg-yellow-50 text-yellow-700 border-yellow-200",  icon: FileText },
  enviada:   { label: "Enviada",   className: "bg-blue-50 text-blue-700 border-blue-200",         icon: Send },
  aprobada:  { label: "Aprobada",  className: "bg-green-50 text-green-700 border-green-200",      icon: CheckCircle2 },
  rechazada: { label: "Rechazada", className: "bg-red-50 text-red-700 border-red-200",            icon: XCircle },
  vencida:   { label: "Vencida",   className: "bg-gray-50 text-gray-500 border-gray-200",         icon: Clock },
};

export function CotizacionesLayout() {
  const { data: cotizaciones = [], isLoading } = useCotizaciones();
  const cambiarEstado = useActualizarEstadoCotizacion();
  const convertir = useConvertirAFactura();

  const [filtroEstado, setFiltroEstado] = useState<EstadoCotizacion | "todos">("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<CotizacionConItems | null>(null);
  const [detalle, setDetalle] = useState<CotizacionConItems | null>(null);

  const filtradas = cotizaciones.filter(
    (c) => filtroEstado === "todos" || c.estado === filtroEstado,
  );

  const handleEstado = async (cot: CotizacionConItems, estado: EstadoCotizacion) => {
    try {
      await cambiarEstado.mutateAsync({ id: cot.id, estado });
      toast.success(`Cotización ${ESTADO_CFG[estado].label.toLowerCase()}`);
      if (detalle?.id === cot.id) setDetalle({ ...detalle, estado });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleConvertir = async (cot: CotizacionConItems) => {
    if (!confirm(`¿Generar factura a partir de ${cot.numero}?`)) return;
    try {
      const res = await convertir.mutateAsync({ cotizacion_id: cot.id });
      toast.success(`Factura ${res.numero} generada`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const fmtMoney = (n: number) =>
    `$${n.toLocaleString("es-EC", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Cotizaciones</h1>
        <p className="text-sm text-muted-foreground">
          Propuestas técnico-comerciales a clientes.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <Select
          value={filtroEstado}
          onValueChange={(v) => setFiltroEstado(v as EstadoCotizacion | "todos")}
        >
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="borrador">Borrador</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
            <SelectItem value="aprobada">Aprobada</SelectItem>
            <SelectItem value="rechazada">Rechazada</SelectItem>
            <SelectItem value="vencida">Vencida</SelectItem>
          </SelectContent>
        </Select>

        <Button size="sm" onClick={() => { setEditando(null); setFormOpen(true); }}>
          <Plus className="size-4 mr-1" /> Nueva cotización
        </Button>
      </div>

      {/* Tabla */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Válida hasta</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-44" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Cargando cotizaciones…
                </TableCell>
              </TableRow>
            ) : filtradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No hay cotizaciones. Crea la primera.
                </TableCell>
              </TableRow>
            ) : (
              filtradas.map((c) => {
                const cfg = ESTADO_CFG[c.estado as EstadoCotizacion] ?? ESTADO_CFG.borrador;
                const Icon = cfg.icon;
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setDetalle(c)}
                  >
                    <TableCell className="font-mono text-sm">{c.numero}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{c.razon_social}</div>
                      {c.ruc_cliente && (
                        <div className="text-xs text-muted-foreground">{c.ruc_cliente}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(c.fecha + "T12:00:00"), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.valida_hasta
                        ? format(new Date(c.valida_hasta + "T12:00:00"), "dd/MM/yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs gap-1 ${cfg.className}`}>
                        <Icon className="size-3" />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {fmtMoney(c.total)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 flex-wrap">
                        {c.estado === "borrador" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => { setEditando(c); setFormOpen(true); }}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-blue-600"
                              onClick={() => handleEstado(c, "enviada")}
                            >
                              Enviar
                            </Button>
                          </>
                        )}
                        {c.estado === "enviada" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-green-600"
                              onClick={() => handleEstado(c, "aprobada")}
                            >
                              Aprobar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-red-600"
                              onClick={() => handleEstado(c, "rechazada")}
                            >
                              Rechazar
                            </Button>
                          </>
                        )}
                        {c.estado === "aprobada" && !c.factura_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-emerald-700"
                            onClick={() => handleConvertir(c)}
                          >
                            Generar factura
                          </Button>
                        )}
                        {c.estado === "aprobada" && c.factura_id && (
                          <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-200">
                            Factura generada
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modales */}
      <CotizacionForm
        open={formOpen}
        cotizacion={editando ?? undefined}
        onClose={() => { setFormOpen(false); setEditando(null); }}
      />

      {detalle && (
        <CotizacionDetalle
          cotizacion={detalle}
          onCambiarEstado={(estado) => handleEstado(detalle, estado)}
          onGenerar={() => handleConvertir(detalle)}
          onClose={() => setDetalle(null)}
        />
      )}
    </div>
  );
}
