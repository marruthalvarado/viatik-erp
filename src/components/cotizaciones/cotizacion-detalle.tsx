/**
 * Panel lateral con el detalle completo de una cotización.
 */
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { X, CheckCircle2, XCircle, Send, FileText, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import type { CotizacionConItems, EstadoCotizacion } from "@/services/cotizaciones";
import {
  exportCotizacionPdf,
  exportCotizacionDocx,
  type ExportOptions,
} from "@/services/export/cotizacion-export";
import { useCompany } from "@/contexts/company-context";

interface Props {
  cotizacion: CotizacionConItems;
  onCambiarEstado: (estado: EstadoCotizacion) => void;
  onGenerar: () => void;
  onClose: () => void;
}

const ESTADO_CFG: Record<string, { label: string; className: string }> = {
  borrador:  { label: "Borrador",  className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  enviada:   { label: "Enviada",   className: "bg-blue-50 text-blue-700 border-blue-200" },
  aprobada:  { label: "Aprobada",  className: "bg-green-50 text-green-700 border-green-200" },
  rechazada: { label: "Rechazada", className: "bg-red-50 text-red-700 border-red-200" },
  vencida:   { label: "Vencida",   className: "bg-gray-50 text-gray-500 border-gray-200" },
};

export function CotizacionDetalle({ cotizacion: c, onCambiarEstado, onGenerar, onClose }: Props) {
  const { empresaActivaId, empresaActiva } = useCompany();
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingDocx, setLoadingDocx] = useState(false);

  const exportOpts: ExportOptions = {
    empresa_id: empresaActivaId ?? "",
    empresa: empresaActiva
      ? {
          nombre: empresaActiva.nombre,
          ruc: empresaActiva.ruc,
          telefono: empresaActiva.telefono,
          correo: empresaActiva.correo,
          direccion: empresaActiva.direccion,
        }
      : undefined,
  };

  const handlePdf = async () => {
    setLoadingPdf(true);
    try {
      await exportCotizacionPdf(c, exportOpts);
    } catch (err) {
      console.error(err);
      toast.error("Error al generar el PDF");
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleDocx = async () => {
    setLoadingDocx(true);
    try {
      await exportCotizacionDocx(c, exportOpts);
    } catch (err) {
      console.error(err);
      toast.error("Error al generar el Word");
    } finally {
      setLoadingDocx(false);
    }
  };

  const fmtMoney = (n: number) =>
    `$${n.toLocaleString("es-EC", { minimumFractionDigits: 2 })}`;
  const fmtFecha = (d: string) =>
    format(new Date(d + "T12:00:00"), "d 'de' MMMM yyyy", { locale: es });

  const cfg = ESTADO_CFG[c.estado] ?? ESTADO_CFG.borrador;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div>
            <SheetTitle className="font-mono text-base">{c.numero}</SheetTitle>
            <Badge variant="outline" className={`mt-1 text-xs ${cfg.className}`}>
              {cfg.label}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </SheetHeader>

        {/* Acciones */}
        <div className="flex flex-wrap gap-2 mb-4">
          {c.estado === "borrador" && (
            <Button size="sm" variant="outline" onClick={() => onCambiarEstado("enviada")}>
              <Send className="size-3.5 mr-1" /> Marcar como enviada
            </Button>
          )}
          {c.estado === "enviada" && (
            <>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onCambiarEstado("aprobada")}>
                <CheckCircle2 className="size-3.5 mr-1" /> Aprobar
              </Button>
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => onCambiarEstado("rechazada")}>
                <XCircle className="size-3.5 mr-1" /> Rechazar
              </Button>
            </>
          )}
          {c.estado === "aprobada" && !c.factura_id && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={onGenerar}>
              <FileText className="size-3.5 mr-1" /> Generar factura
            </Button>
          )}

          {/* Descargas */}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={handlePdf} disabled={loadingPdf}>
              {loadingPdf ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <FileDown className="size-3.5 mr-1" />}
              PDF
            </Button>
            <Button size="sm" variant="outline" onClick={handleDocx} disabled={loadingDocx}>
              {loadingDocx ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <FileText className="size-3.5 mr-1" />}
              Word
            </Button>
          </div>
        </div>

        <Separator className="mb-4" />

        {/* Info cliente */}
        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Cliente</p>
            <p className="font-medium">{c.razon_social}</p>
            {c.ruc_cliente && <p className="text-xs text-muted-foreground">RUC: {c.ruc_cliente}</p>}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fechas</p>
            <p>{fmtFecha(c.fecha)}</p>
            {c.valida_hasta && (
              <p className="text-xs text-muted-foreground">Válida hasta: {fmtFecha(c.valida_hasta)}</p>
            )}
          </div>
          {c.lugar_entrega && (
            <div>
              <p className="text-xs text-muted-foreground">Lugar de entrega</p>
              <p>{c.lugar_entrega}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Condiciones</p>
            {c.dias_entrega && <p>{c.dias_entrega} días laborables de entrega</p>}
            {c.meses_garantia && <p>{c.meses_garantia} meses de garantía</p>}
          </div>
        </div>

        <Separator className="mb-4" />

        {/* Ítems */}
        <div className="space-y-3 mb-4">
          <h3 className="text-sm font-semibold">Ítems ({c.items.length})</h3>
          {c.items.map((it, idx) => (
            <div key={it.id} className="rounded-lg border p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    #{idx + 1}
                    {it.fabricante && <> · {it.fabricante}</>}
                    {it.modelo && <> {it.modelo}</>}
                  </p>
                  <p className="text-sm mt-0.5 leading-relaxed">{it.descripcion}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-semibold">{fmtMoney(it.precio_neto)}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.cantidad} × {fmtMoney(it.precio_unitario)}
                    {it.descuento_pct > 0 && ` − ${it.descuento_pct}%`}
                  </p>
                </div>
              </div>
              {(it.dias_entrega || it.meses_garantia) && (
                <p className="text-xs text-muted-foreground">
                  {it.dias_entrega ? `${it.dias_entrega}d entrega` : ""}
                  {it.dias_entrega && it.meses_garantia ? " · " : ""}
                  {it.meses_garantia ? `${it.meses_garantia}m garantía` : ""}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Términos de pago */}
        {c.terminos_pago?.length > 0 && (
          <>
            <Separator className="mb-4" />
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2">Términos de pago</h3>
              <div className="space-y-1">
                {c.terminos_pago.map((t, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{t.concepto}</span>
                    <span className="font-medium">{t.porcentaje}%</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Totales */}
        <Separator className="mb-4" />
        <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono">{fmtMoney(c.subtotal)}</span>
          </div>
          {c.descuento_total > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Descuento</span>
              <span className="font-mono">− {fmtMoney(c.descuento_total)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">IVA {c.iva_pct}%</span>
            <span className="font-mono">{fmtMoney(c.iva)}</span>
          </div>
          <Separator className="my-1" />
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span className="font-mono">{fmtMoney(c.total)}</span>
          </div>
        </div>

        {/* Notas */}
        {c.notas && (
          <div className="mt-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notas</p>
            <p className="text-sm whitespace-pre-wrap">{c.notas}</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
