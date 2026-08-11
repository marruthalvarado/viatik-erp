/**
 * unidad-drawer.tsx
 * Drawer de detalle de una unidad/lote de inventario + historial de movimientos.
 */
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/common/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  useMovimientos, useBodegas, useRegistrarMovimiento,
} from "@/hooks/entities/use-inventario";
import { toast } from "@/components/common/toast";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { movimientoSchema, type MovimientoFormValues } from "./inventario-types";
import type { UnidadConDetalle } from "@/services/inventario";

const ESTADO_COLORS: Record<string, string> = {
  "En bodega": "bg-emerald-100 text-emerald-800",
  "Asignado": "bg-blue-100 text-blue-800",
  "En tránsito": "bg-yellow-100 text-yellow-800",
  "Instalado": "bg-purple-100 text-purple-800",
  "Vendido": "bg-gray-100 text-gray-600",
  "Dañado": "bg-red-100 text-red-800",
  "Baja": "bg-red-200 text-red-900",
};

interface Props {
  unidad: UnidadConDetalle | null;
  open: boolean;
  onClose: () => void;
}

export function UnidadDrawer({ unidad, open, onClose }: Props) {
  const { data: movimientos = [] } = useMovimientos(unidad?.id);
  const { data: bodegas = [] } = useBodegas();
  const registrar = useRegistrarMovimiento();

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors },
  } = useForm<MovimientoFormValues>({
    resolver: zodResolver(movimientoSchema),
    defaultValues: {
      tipo: "Asignación",
      fecha: new Date().toISOString().slice(0, 10),
      cantidad: 1,
      bodega_destino_id: "",
      proyecto_id: "",
      observacion: "",
    },
  });

  if (!unidad) return null;

  async function onSubmitMovimiento(values: MovimientoFormValues) {
    await registrar.mutateAsync({
      empresa_id: unidad!.empresa_id,
      unidad_id: unidad!.id,
      tipo: values.tipo,
      fecha: values.fecha,
      cantidad: values.cantidad,
      bodega_destino_id: values.bodega_destino_id || null,
      proyecto_id: values.proyecto_id || null,
      observacion: values.observacion || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any, {
      onSuccess: () => {
        toast.success("Movimiento registrado");
        reset();
      },
      onError: (err) => toast.error(err.message),
    });
  }

  const producto = unidad.producto;
  const esLote = producto?.tipo_seguimiento === "lote";

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DrawerContent className="max-w-2xl">
        <DrawerHeader>
          <DrawerTitle>{unidad.codigo ?? "—"}</DrawerTitle>
          <DrawerDescription>
            {producto?.nombre ?? "—"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-4 space-y-5 overflow-y-auto">
          {/* Ficha */}
          <div className="rounded-lg border p-4 grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
            <div className="text-muted-foreground">Código</div>
            <div className="font-mono font-semibold">{unidad.codigo ?? "—"}</div>

            <div className="text-muted-foreground">Estado</div>
            <div>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLORS[unidad.estado] ?? "bg-gray-100"}`}
              >
                {unidad.estado}
              </span>
            </div>

            <div className="text-muted-foreground">Producto</div>
            <div>{producto?.nombre ?? "—"}</div>

            {esLote && (
              <>
                <div className="text-muted-foreground">Cantidad original</div>
                <div>{unidad.cantidad_original}</div>
                <div className="text-muted-foreground">Cantidad actual</div>
                <div className="font-semibold">{unidad.cantidad_actual}</div>
              </>
            )}

            <div className="text-muted-foreground">Bodega</div>
            <div>{unidad.bodega?.nombre ?? "—"}</div>

            <div className="text-muted-foreground">Costo unitario</div>
            <div>{formatCurrency(unidad.costo_unitario ?? null)}</div>

            <div className="text-muted-foreground">Fecha ingreso</div>
            <div>{formatDate(unidad.fecha_ingreso)}</div>

            {unidad.serial && (
              <>
                <div className="text-muted-foreground">N° serie</div>
                <div className="font-mono">{unidad.serial}</div>
              </>
            )}

            {unidad.proyecto && (
              <>
                <div className="text-muted-foreground">Proyecto</div>
                <div>{unidad.proyecto.nombre}</div>
              </>
            )}

            {unidad.cliente && (
              <>
                <div className="text-muted-foreground">Cliente</div>
                <div>{unidad.cliente.nombre}</div>
              </>
            )}
          </div>

          {/* Registrar movimiento */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Registrar movimiento
            </p>
            <form onSubmit={handleSubmit(onSubmitMovimiento)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo *</Label>
                  <Select
                    value={watch("tipo")}
                    onValueChange={(v) => setValue("tipo", v as MovimientoFormValues["tipo"])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Asignación", "Transferencia", "Venta", "Consumo", "Devolución", "Baja"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fecha *</Label>
                  <Input type="date" {...register("fecha")} />
                </div>
              </div>

              {esLote && (
                <div>
                  <Label>Cantidad *</Label>
                  <Input type="number" step="0.001" {...register("cantidad")} />
                  {errors.cantidad && (
                    <p className="text-xs text-destructive mt-1">{errors.cantidad.message}</p>
                  )}
                </div>
              )}

              <div>
                <Label>Bodega destino</Label>
                <Select
                  value={watch("bodega_destino_id") ?? ""}
                  onValueChange={(v) => setValue("bodega_destino_id", v === "_none" ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Sin bodega" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Sin bodega —</SelectItem>
                    {bodegas.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Observación</Label>
                <Input {...register("observacion")} placeholder="Opcional" />
              </div>

              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={registrar.isPending}>
                  {registrar.isPending ? "Guardando…" : "Registrar"}
                </Button>
              </div>
            </form>
          </div>

          {/* Historial */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Historial de movimientos
            </p>
            {movimientos.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Sin movimientos registrados.</p>
            ) : (
              <div className="divide-y rounded-lg border text-sm">
                {movimientos.map((m) => (
                  <div key={m.id} className="flex items-start gap-3 px-3 py-2">
                    <Badge variant="outline" className="shrink-0 text-xs">{m.tipo}</Badge>
                    <div className="flex-1 min-w-0">
                      <span className="text-muted-foreground">{formatDate(m.fecha)}</span>
                      {esLote && <span className="ml-2">Cant: {m.cantidad}</span>}
                      {m.observacion && (
                        <p className="text-muted-foreground truncate">{m.observacion}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
