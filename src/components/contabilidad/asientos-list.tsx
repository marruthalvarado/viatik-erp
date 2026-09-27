/**
 * Lista de asientos contables con filtros y acciones.
 */
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BookOpen, ChevronDown, ChevronRight, Eye, RotateCcw, CheckCircle2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useAsientoDetalle } from "@/hooks/entities/use-contabilidad";
import type { AsientoContable } from "@/hooks/entities/use-contabilidad";
import type { EstadoAsiento } from "@/services/contabilidad";

interface AsientosListProps {
  asientos: AsientoContable[];
  loading?: boolean;
  onConfirmar?: (id: string) => Promise<void>;
  onReversar?: (id: string) => void;
  onNuevo?: () => void;
  filtroEstado?: EstadoAsiento | "todos";
  onFiltroEstado?: (v: EstadoAsiento | "todos") => void;
}

const ESTADO_BADGE: Record<EstadoAsiento, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  definitivo: { label: "Definitivo", className: "bg-green-100 text-green-700 border-green-200" },
  reversado: { label: "Reversado", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

const REF_LABEL: Record<string, string> = {
  manual: "Manual",
  factura: "Factura",
  gasto: "Gasto",
  cobro: "Cobro",
  conciliacion: "Conciliación",
};

function AsientoDetalleModal({
  asientoId,
  open,
  onClose,
}: {
  asientoId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { asiento, loading, error } = useAsientoDetalle(open ? asientoId : null);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Asiento {asiento?.numero ?? "…"} —{" "}
            {asiento
              ? format(new Date(asiento.fecha + "T12:00:00"), "d MMM yyyy", { locale: es })
              : ""}
          </DialogTitle>
        </DialogHeader>

        {loading && <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {asiento && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{asiento.descripcion}</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Debe</TableHead>
                  <TableHead className="text-right">Haber</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asiento.lineas.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">
                      {l.cuenta?.codigo} <span className="font-sans">{l.cuenta?.nombre}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.descripcion ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {l.debe > 0 ? l.debe.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {l.haber > 0 ? l.haber.toFixed(2) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell
                    colSpan={2}
                    className="text-right text-xs uppercase text-muted-foreground"
                  >
                    Total
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {asiento.lineas.reduce((s, l) => s + l.debe, 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {asiento.lineas.reduce((s, l) => s + l.haber, 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AsientosList({
  asientos,
  loading,
  onConfirmar,
  onReversar,
  onNuevo,
  filtroEstado = "todos",
  onFiltroEstado,
}: AsientosListProps) {
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleConfirmar = async (id: string) => {
    setConfirmingId(id);
    try {
      await onConfirmar?.(id);
    } finally {
      setConfirmingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <BookOpen className="size-6 animate-pulse mr-2" />
        Cargando asientos…
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <Select
          value={filtroEstado}
          onValueChange={(v) => onFiltroEstado?.(v as EstadoAsiento | "todos")}
        >
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="borrador">Borrador</SelectItem>
            <SelectItem value="definitivo">Definitivo</SelectItem>
            <SelectItem value="reversado">Reversado</SelectItem>
          </SelectContent>
        </Select>

        {onNuevo && (
          <Button size="sm" onClick={onNuevo}>
            Nuevo asiento
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {asientos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground text-sm">
                  No hay asientos contables para mostrar.
                </TableCell>
              </TableRow>
            ) : (
              asientos.map((a) => {
                const estadoInfo = ESTADO_BADGE[a.estado];
                return (
                  <TableRow key={a.id} className={cn(a.estado === "reversado" && "opacity-50")}>
                    <TableCell className="font-mono text-sm">{a.numero}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(a.fecha + "T12:00:00"), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{a.descripcion}</TableCell>
                    <TableCell>
                      {a.referencia_tipo ? (
                        <Badge variant="outline" className="text-xs">
                          {REF_LABEL[a.referencia_tipo] ?? a.referencia_tipo}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", estadoInfo.className)}>
                        {estadoInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">—</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="Ver detalle"
                          onClick={() => setDetalleId(a.id)}
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        {a.estado === "borrador" && onConfirmar && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-green-600 hover:text-green-700"
                            title="Confirmar asiento"
                            disabled={confirmingId === a.id}
                            onClick={() => handleConfirmar(a.id)}
                          >
                            <CheckCircle2 className="size-3.5" />
                          </Button>
                        )}
                        {a.estado === "definitivo" && onReversar && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-orange-600 hover:text-orange-700"
                            title="Reversar asiento"
                            onClick={() => onReversar(a.id)}
                          >
                            <RotateCcw className="size-3.5" />
                          </Button>
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

      {/* Detalle modal */}
      {detalleId && (
        <AsientoDetalleModal
          asientoId={detalleId}
          open={!!detalleId}
          onClose={() => setDetalleId(null)}
        />
      )}
    </>
  );
}
