/**
 * Formulario de creación de asientos contables.
 * Valida que Σ debe == Σ haber antes de guardar.
 */
import { useState, useMemo } from "react";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { PlanCuenta, LineaAsiento } from "@/hooks/entities/use-contabilidad";

interface AsientoFormProps {
  open: boolean;
  cuentas: PlanCuenta[];
  empresaId: string;
  onGuardar: (
    fecha: string,
    descripcion: string,
    lineas: LineaAsiento[],
    confirmar: boolean,
  ) => Promise<void>;
  onClose: () => void;
}

interface LineaLocal {
  id: number;
  cuenta_id: string;
  descripcion: string;
  debe: string;
  haber: string;
}

let nextId = 1;

function emptyLinea(): LineaLocal {
  return { id: nextId++, cuenta_id: "", descripcion: "", debe: "", haber: "" };
}

export function AsientoForm({ open, cuentas, onGuardar, onClose }: AsientoFormProps) {
  const today = new Date().toISOString().split("T")[0];
  const [fecha, setFecha] = useState(today);
  const [descripcion, setDescripcion] = useState("");
  const [lineas, setLineas] = useState<LineaLocal[]>([emptyLinea(), emptyLinea()]);
  const [confirmar, setConfirmar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cuentasMovimiento = useMemo(() => cuentas.filter((c) => c.acepta_movimientos), [cuentas]);

  const totalDebe = lineas.reduce((s, l) => s + (parseFloat(l.debe) || 0), 0);
  const totalHaber = lineas.reduce((s, l) => s + (parseFloat(l.haber) || 0), 0);
  const balanceado = Math.abs(totalDebe - totalHaber) < 0.001;

  const setLinea = (id: number, patch: Partial<LineaLocal>) => {
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const addLinea = () => setLineas((prev) => [...prev, emptyLinea()]);
  const removeLinea = (id: number) => {
    if (lineas.length <= 2) return;
    setLineas((prev) => prev.filter((l) => l.id !== id));
  };

  const reset = () => {
    setFecha(today);
    setDescripcion("");
    setLineas([emptyLinea(), emptyLinea()]);
    setConfirmar(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!fecha) {
      setError("La fecha es obligatoria.");
      return;
    }
    if (!descripcion.trim()) {
      setError("La descripción es obligatoria.");
      return;
    }
    if (lineas.some((l) => !l.cuenta_id)) {
      setError("Todas las líneas deben tener cuenta.");
      return;
    }
    if (lineas.some((l) => !l.debe && !l.haber)) {
      setError("Cada línea debe tener debe o haber.");
      return;
    }
    if (!balanceado) {
      setError(
        `El asiento no balancea: Debe ${totalDebe.toFixed(2)} ≠ Haber ${totalHaber.toFixed(2)}`,
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: LineaAsiento[] = lineas.map((l) => ({
        cuenta_id: l.cuenta_id,
        descripcion: l.descripcion || undefined,
        debe: parseFloat(l.debe) || 0,
        haber: parseFloat(l.haber) || 0,
      }));
      await onGuardar(fecha, descripcion.trim(), payload, confirmar);
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar asiento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nuevo asiento contable</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Cabecera */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha *</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Descripción *</Label>
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Concepto del asiento"
              />
            </div>
          </div>

          {/* Líneas */}
          <div className="rounded-md border overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_90px_90px_32px] gap-x-2 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Cuenta</span>
              <span>Descripción</span>
              <span className="text-right">Debe</span>
              <span className="text-right">Haber</span>
              <span />
            </div>

            {lineas.map((linea) => (
              <div
                key={linea.id}
                className="grid grid-cols-[1fr_1fr_90px_90px_32px] gap-x-2 items-center border-t px-3 py-1.5"
              >
                {/* Cuenta */}
                <Select
                  value={linea.cuenta_id || "__none__"}
                  onValueChange={(v) =>
                    setLinea(linea.id, { cuenta_id: v === "__none__" ? "" : v })
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecciona cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {cuentasMovimiento.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} — {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Descripción */}
                <Input
                  className="h-8 text-sm"
                  value={linea.descripcion}
                  onChange={(e) => setLinea(linea.id, { descripcion: e.target.value })}
                  placeholder="Opcional"
                />

                {/* Debe */}
                <Input
                  className="h-8 text-right font-mono text-sm"
                  type="number"
                  min={0}
                  step={0.01}
                  value={linea.debe}
                  onChange={(e) =>
                    setLinea(linea.id, {
                      debe: e.target.value,
                      haber: e.target.value ? "" : linea.haber,
                    })
                  }
                  placeholder="0.00"
                />

                {/* Haber */}
                <Input
                  className="h-8 text-right font-mono text-sm"
                  type="number"
                  min={0}
                  step={0.01}
                  value={linea.haber}
                  onChange={(e) =>
                    setLinea(linea.id, {
                      haber: e.target.value,
                      debe: e.target.value ? "" : linea.debe,
                    })
                  }
                  placeholder="0.00"
                />

                {/* Eliminar */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeLinea(linea.id)}
                  disabled={lineas.length <= 2}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}

            {/* Totales */}
            <div className="grid grid-cols-[1fr_1fr_90px_90px_32px] gap-x-2 border-t bg-muted/30 px-3 py-2">
              <div className="col-span-2 flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addLinea}>
                  <Plus className="size-3 mr-1" />
                  Añadir línea
                </Button>
              </div>
              <div
                className={cn(
                  "text-right font-mono text-sm font-semibold",
                  !balanceado && "text-destructive",
                )}
              >
                {totalDebe.toFixed(2)}
              </div>
              <div
                className={cn(
                  "text-right font-mono text-sm font-semibold",
                  !balanceado && "text-destructive",
                )}
              >
                {totalHaber.toFixed(2)}
              </div>
              <div />
            </div>

            {!balanceado && totalDebe > 0 && (
              <div className="px-3 pb-2 text-xs text-destructive">
                Diferencia: {Math.abs(totalDebe - totalHaber).toFixed(2)} — el asiento debe
                balancear.
              </div>
            )}
          </div>

          {/* Confirmar directo */}
          <div className="flex items-center gap-3">
            <Switch id="confirmar" checked={confirmar} onCheckedChange={setConfirmar} />
            <Label htmlFor="confirmar" className="cursor-pointer">
              Confirmar asiento directamente (estado definitivo)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !balanceado}>
            {saving ? "Guardando…" : confirmar ? "Crear y confirmar" : "Crear borrador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
