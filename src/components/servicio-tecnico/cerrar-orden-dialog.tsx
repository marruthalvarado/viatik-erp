/**
 * Dialog: Cerrar Orden de Servicio
 * Incluye: trabajos realizados, checklist de actividades, firma cliente y técnico.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import type { OrdenConRelaciones } from "@/services/servicio-tecnico/ordenes-servicio";
import { ActividadesChecklist } from "./actividades-checklist";
import { FirmaPad, type FirmaData } from "./firma-pad";
import { useGuardarFirmaOrden } from "@/hooks/entities/use-servicio-tecnico";

interface Props {
  open: boolean;
  orden: OrdenConRelaciones | null;
  onClose: () => void;
  onCerrar: (id: string, trabajos: string, obs?: string, costo?: number) => Promise<void>;
}

const emptyFirma = (): FirmaData => ({ nombre: "", cargo: "", dataUrl: null });

export function CerrarOrdenDialog({ open, orden, onClose, onCerrar }: Props) {
  const [trabajos, setTrabajos] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [costo, setCosto] = useState("");
  const [firmaCliente, setFirmaCliente] = useState<FirmaData>(emptyFirma());
  const [firmaTecnico, setFirmaTecnico] = useState<FirmaData>(emptyFirma());
  const [loading, setLoading] = useState(false);

  const firmaOrdenMut = useGuardarFirmaOrden();

  const reset = () => {
    setTrabajos("");
    setObservaciones("");
    setCosto("");
    setFirmaCliente(emptyFirma());
    setFirmaTecnico(emptyFirma());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orden) return;
    setLoading(true);
    try {
      // 1. Cerrar la orden (marcas como completada + guarda trabajos)
      await onCerrar(
        orden.id,
        trabajos,
        observaciones || undefined,
        costo ? parseFloat(costo) : undefined,
      );

      // 2. Guardar firma si se capturó al menos una
      const tieneFirmaCliente = firmaCliente.nombre || firmaCliente.dataUrl;
      const tieneFirmaTecnico = firmaTecnico.dataUrl;
      if (tieneFirmaCliente || tieneFirmaTecnico) {
        await firmaOrdenMut.mutateAsync({
          orden_id: orden.id,
          firma: {
            firma_cliente_nombre: firmaCliente.nombre || null,
            firma_cliente_cargo: firmaCliente.cargo || null,
            firma_cliente_data: firmaCliente.dataUrl,
            firma_tecnico_data: firmaTecnico.dataUrl,
          },
        });
      }

      reset();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cerrar orden {orden?.numero}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Trabajos realizados */}
          <div>
            <Label>Trabajos realizados *</Label>
            <Textarea
              value={trabajos}
              onChange={(e) => setTrabajos(e.target.value)}
              placeholder="Describe detalladamente los trabajos realizados…"
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Observaciones</Label>
              <Textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Observaciones, recomendaciones…"
                rows={2}
              />
            </div>
            <div>
              <Label>Costo mano de obra ($)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <Separator />

          {/* Checklist de actividades */}
          {orden && (
            <div>
              <h4 className="text-sm font-medium mb-3">Actividades de mantenimiento</h4>
              <ActividadesChecklist ordenId={orden.id} />
            </div>
          )}

          <Separator />

          {/* Firma del cliente */}
          <FirmaPad
            title="Firma del cliente"
            value={firmaCliente}
            onChange={setFirmaCliente}
          />

          <Separator />

          {/* Firma del técnico */}
          <FirmaPad
            title="Firma del técnico"
            value={firmaTecnico}
            onChange={setFirmaTecnico}
          />

          <p className="text-xs text-muted-foreground">
            Al cerrar, el inventario se descontará automáticamente según los repuestos registrados.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !trabajos.trim()}>
              {loading ? "Cerrando…" : "Cerrar y firmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
