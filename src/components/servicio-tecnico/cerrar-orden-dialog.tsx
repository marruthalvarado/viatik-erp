/**
 * Dialog: Cerrar Orden de Servicio
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import type { OrdenConRelaciones } from "@/services/servicio-tecnico/ordenes-servicio";

interface Props {
  open: boolean;
  orden: OrdenConRelaciones | null;
  onClose: () => void;
  onCerrar: (id: string, trabajos: string, obs?: string, costo?: number) => Promise<void>;
}

export function CerrarOrdenDialog({ open, orden, onClose, onCerrar }: Props) {
  const [trabajos, setTrabajos] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [costo, setCosto] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orden) return;
    setLoading(true);
    try {
      await onCerrar(
        orden.id,
        trabajos,
        observaciones || undefined,
        costo ? parseFloat(costo) : undefined,
      );
      setTrabajos("");
      setObservaciones("");
      setCosto("");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar orden {orden?.numero}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Trabajos realizados *</Label>
            <Textarea
              value={trabajos}
              onChange={(e) => setTrabajos(e.target.value)}
              placeholder="Describe detalladamente los trabajos realizados…"
              rows={4}
              required
            />
          </div>
          <div>
            <Label>Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Observaciones adicionales, recomendaciones…"
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
          <p className="text-xs text-muted-foreground">
            Al cerrar, el inventario se descontará automáticamente según los repuestos registrados.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !trabajos.trim()}>
              {loading ? "Cerrando…" : "Cerrar orden"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
