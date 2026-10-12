/**
 * costeo-proyecto-detalle.tsx
 * Hoja de detalle de un Costeo de Proyecto — vista read-only con resumen
 * financiero completo y tabla de ítems con costos prorrateados.
 */
import { Pencil, X, FolderKanban, Link2 } from "lucide-react";
import { format } from "date-fns";
import { es }    from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import type { CosteoProyectoConItems } from "@/services/costeos-proyecto";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

const pct = (n: number) => `${n.toFixed(2)}%`;

interface Props {
  open: boolean;
  costeo: CosteoProyectoConItems;
  onClose: () => void;
  onEdit: () => void;
}

export function CosteoProyectoDetalle({ open, costeo, onClose, onEdit }: Props) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto" side="right">
        <SheetHeader className="flex-row items-start justify-between pr-6">
          <div>
            <SheetTitle className="flex items-center gap-2">
              <FolderKanban className="size-4" />
              {costeo.numero}
            </SheetTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{costeo.descripcion}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5">
              <Pencil className="size-3.5" />
              Editar
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* ── Meta ── */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {costeo.proyecto && (
              <div>
                <p className="text-xs text-muted-foreground">Proyecto</p>
                <p className="font-medium">{costeo.proyecto.nombre}</p>
              </div>
            )}
            {costeo.cotizacion && (
              <div>
                <p className="text-xs text-muted-foreground">Cotización vinculada</p>
                <p className="font-medium font-mono">{costeo.cotizacion.numero} — {costeo.cotizacion.razon_social}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Estado</p>
              <Badge variant="outline" className={costeo.estado === "finalizado" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}>
                {costeo.estado === "finalizado" ? "Finalizado" : "Borrador"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fecha</p>
              <p>{format(new Date(costeo.created_at), "dd 'de' MMMM yyyy", { locale: es })}</p>
            </div>
          </div>

          {/* ── KPIs resumen ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Total FOB</p>
              <p className="text-lg font-bold">{fmt(costeo.total_fob_usd)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Gastos importación</p>
              <p className="text-lg font-bold">{fmt(costeo.total_gastos_imp)}</p>
            </div>
            <div className="rounded-lg border bg-orange-50 border-orange-200 p-3">
              <p className="text-[10px] text-orange-700 uppercase">Costo aterrizaje</p>
              <p className="text-lg font-bold text-orange-700">{fmt(costeo.total_costo_aterrizaje)}</p>
            </div>
            <div className="rounded-lg border bg-green-50 border-green-200 p-3">
              <p className="text-[10px] text-green-700 uppercase">Precio venta sugerido</p>
              <p className="text-lg font-bold text-green-700">{fmt(costeo.total_precio_venta)}</p>
            </div>
          </div>

          {/* ── Parámetros ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm rounded-lg border p-4 bg-muted/20">
            <div className="flex justify-between"><span className="text-muted-foreground">Flete total</span><span>{fmt(costeo.flete_total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Seguro</span><span>{fmt(costeo.seguro_total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Agente aduanas</span><span>{fmt(costeo.agente_aduanas)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Bodega</span><span>{fmt(costeo.bodega)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Otros logística</span><span>{fmt(costeo.otros_logistica)}</span></div>
            <div />
            <div className="flex justify-between"><span className="text-muted-foreground">FODINFA</span><span>{pct(costeo.fodinfa_pct)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Arancel</span><span>{pct(costeo.arancel_pct)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">ISD</span><span>{pct(costeo.isd_pct)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Margen empresa</span><span>{pct(costeo.margen_empresa_pct)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Comisión ventas</span><span>{pct(costeo.comision_venta_pct)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Gastos admin.</span><span>{pct(costeo.gastos_admin_pct)}</span></div>
          </div>

          {/* ── Tabla de ítems ── */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Productos ({costeo.items.length})</h3>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">FOB unit.</TableHead>
                    <TableHead className="text-right">FOB total</TableHead>
                    <TableHead className="text-right">Costo aterrizaje</TableHead>
                    <TableHead className="text-right">Aterrizaje unit.</TableHead>
                    <TableHead className="text-right">PVP unit.</TableHead>
                    <TableHead className="text-right">PVP total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costeo.items
                    .sort((a, b) => a.orden - b.orden)
                    .map((item, i) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{item.descripcion}</p>
                            {(item.fabricante || item.modelo) && (
                              <p className="text-[10px] text-muted-foreground">
                                {[item.fabricante, item.modelo].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">{item.cantidad}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(item.precio_fob_unitario_usd)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(item.total_fob_usd)}</TableCell>
                        <TableCell className="text-right text-sm font-medium text-orange-700">{fmt(item.costo_aterrizaje_total)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(item.costo_aterrizaje_unitario)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(item.precio_venta_unitario)}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-green-700">{fmt(item.precio_venta_total)}</TableCell>
                      </TableRow>
                    ))}
                  {/* Totales */}
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell colSpan={4} className="text-right text-sm">Totales</TableCell>
                    <TableCell className="text-right text-sm">{fmt(costeo.total_fob_usd)}</TableCell>
                    <TableCell className="text-right text-sm text-orange-700">{fmt(costeo.total_costo_aterrizaje)}</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right text-sm text-green-700">{fmt(costeo.total_precio_venta)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {costeo.notas && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Notas</p>
              <p className="text-sm whitespace-pre-wrap">{costeo.notas}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
