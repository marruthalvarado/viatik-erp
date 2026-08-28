/**
 * EmitirSriDialog — Dialog para emitir una factura electrónica al SRI.
 */
import { useState } from "react";
import { Send, CheckCircle2, XCircle, Loader2, RefreshCw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/common/toast";
import {
  useEmitirFactura,
  useConsultarEstado,
  useComprobanteByReferencia,
} from "@/hooks/entities/use-facturacion-sri";
import { FORMAS_PAGO_SRI, ESTADO_BADGE } from "@/types/facturacion-sri";
import type { FacturaEmitida } from "@/services/facturas-emitidas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  factura: FacturaEmitida;
  empresaId: string;
}

export function EmitirSriDialog({ open, onOpenChange, factura, empresaId }: Props) {
  const [descripcion, setDescripcion] = useState(factura.observacion ?? "Servicios profesionales");
  const [formaPago, setFormaPago] = useState("01");

  const emitir = useEmitirFactura();
  const consultar = useConsultarEstado();

  const { data: comprobante, refetch: refetchComp } = useComprobanteByReferencia(factura.id, "factura");

  async function handleEmitir() {
    const result = await emitir.mutateAsync({
      empresa_id: empresaId,
      factura_id: factura.id,
      descripcion_servicio: descripcion || undefined,
      forma_pago: formaPago,
    });
    if (!result.ok) {
      toast.error(result.error ?? result.mensaje_sri ?? "Error al emitir la factura.");
    } else if (result.estado === "autorizado") {
      toast.success("¡Factura autorizada por el SRI!");
    } else {
      toast.success(`Factura ${result.estado ?? "enviada"} al SRI.`);
    }
    refetchComp();
  }

  async function handleConsultar() {
    if (!comprobante?.clave_acceso) return;
    const r = await consultar.mutateAsync({ empresaId, claveAcceso: comprobante.clave_acceso });
    if (r.ok && r.estado === "AUTORIZADO") {
      toast.success("¡Factura autorizada!");
    } else {
      toast.success(`Estado SRI: ${r.estado ?? "sin respuesta"}`);
    }
    refetchComp();
  }

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto);
    toast.success("Copiado al portapapeles");
  }

  const yaEmitida = !!comprobante;
  const autorizada = comprobante?.estado === "autorizado";
  const rechazada = comprobante?.estado === "rechazado";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-4 text-muted-foreground" />
            Emitir al SRI — {factura.numero}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Resumen de la factura */}
          <div className="rounded-lg border p-3 text-sm space-y-1 bg-muted/30">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium">{factura.razon_social ?? "—"}</span>
            </div>
            {factura.ruc_cliente && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">RUC/ID</span>
                <span>{factura.ruc_cliente}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">${Number(factura.total ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fecha</span>
              <span>{factura.fecha}</span>
            </div>
          </div>

          {/* Estado del comprobante */}
          {comprobante && (
            <div className={`rounded-lg border px-4 py-3 text-sm space-y-2 ${autorizada ? "border-emerald-200 bg-emerald-50" : rechazada ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium">
                  {autorizada
                    ? <CheckCircle2 className="size-4 text-emerald-600" />
                    : rechazada
                    ? <XCircle className="size-4 text-red-600" />
                    : <Loader2 className="size-4 text-blue-600 animate-spin" />}
                  <span className={`capitalize px-2 py-0.5 rounded text-xs ${ESTADO_BADGE[comprobante.estado]}`}>
                    {comprobante.estado}
                  </span>
                </div>
                {!autorizada && comprobante.clave_acceso && (
                  <Button size="sm" variant="outline" onClick={handleConsultar} disabled={consultar.isPending}>
                    <RefreshCw className={`size-3 mr-1 ${consultar.isPending ? "animate-spin" : ""}`} />
                    Consultar
                  </Button>
                )}
              </div>
              {comprobante.clave_acceso && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Clave de acceso</p>
                  <div className="flex items-center gap-1">
                    <code className="text-[10px] bg-white border rounded px-2 py-1 flex-1 break-all">
                      {comprobante.clave_acceso}
                    </code>
                    <Button size="icon" variant="ghost" className="size-7 shrink-0"
                      onClick={() => copiar(comprobante.clave_acceso!)}>
                      <Copy className="size-3" />
                    </Button>
                  </div>
                </div>
              )}
              {comprobante.numero_autorizacion && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Autorización</span>
                  <span className="font-mono">{comprobante.numero_autorizacion}</span>
                </div>
              )}
              {comprobante.fecha_autorizacion && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Fecha autorización</span>
                  <span>{new Date(comprobante.fecha_autorizacion).toLocaleString("es-EC")}</span>
                </div>
              )}
              {comprobante.mensaje_sri && (
                <p className="text-xs text-muted-foreground">{comprobante.mensaje_sri}</p>
              )}
            </div>
          )}

          {/* Formulario (solo si no está autorizada) */}
          {!autorizada && (
            <>
              <div>
                <Label>Descripción del servicio</Label>
                <Input
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej. Servicios profesionales de medicina nuclear"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Aparecerá en el detalle de la factura electrónica.
                </p>
              </div>
              <div>
                <Label>Forma de pago</Label>
                <Select value={formaPago} onValueChange={setFormaPago}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGO_SRI.map((fp) => (
                      <SelectItem key={fp.codigo} value={fp.codigo}>
                        {fp.codigo} — {fp.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {autorizada ? "Cerrar" : "Cancelar"}
          </Button>
          {!autorizada && (
            <Button onClick={handleEmitir} disabled={emitir.isPending}>
              {emitir.isPending ? (
                <><Loader2 className="size-4 mr-2 animate-spin" />Emitiendo…</>
              ) : yaEmitida ? (
                <><RefreshCw className="size-4 mr-2" />Reintentar</>
              ) : (
                <><Send className="size-4 mr-2" />Emitir al SRI</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
