/**
 * Formulario para crear / editar una cuenta contable.
 */
import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PlanCuenta, TipoCuenta, NaturalezaCuenta } from "@/hooks/entities/use-contabilidad";

interface PlanCuentasFormProps {
  open: boolean;
  cuenta?: PlanCuenta | null;
  parentId?: string | null;
  empresaId: string;
  cuentas: PlanCuenta[];
  onGuardar: (payload: Omit<PlanCuenta, "id" | "created_at">) => Promise<void>;
  onClose: () => void;
}

const TIPOS: { value: TipoCuenta; label: string }[] = [
  { value: "activo", label: "Activo" },
  { value: "pasivo", label: "Pasivo" },
  { value: "patrimonio", label: "Patrimonio" },
  { value: "ingreso", label: "Ingreso" },
  { value: "costo", label: "Costo" },
  { value: "gasto", label: "Gasto" },
];

const NATURALEZAS: { value: NaturalezaCuenta; label: string }[] = [
  { value: "deudora", label: "Deudora (saldo D-H)" },
  { value: "acreedora", label: "Acreedora (saldo H-D)" },
];

const NATURALEZA_DEFAULT: Record<TipoCuenta, NaturalezaCuenta> = {
  activo: "deudora",
  costo: "deudora",
  gasto: "deudora",
  pasivo: "acreedora",
  patrimonio: "acreedora",
  ingreso: "acreedora",
};

export function PlanCuentasForm({
  open,
  cuenta,
  parentId,
  empresaId,
  cuentas,
  onGuardar,
  onClose,
}: PlanCuentasFormProps) {
  const isEdit = !!cuenta;

  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoCuenta>("activo");
  const [naturaleza, setNaturaleza] = useState<NaturalezaCuenta>("deudora");
  const [selectedParent, setSelectedParent] = useState<string>("");
  const [aceptaMovimientos, setAceptaMovimientos] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (cuenta) {
        setCodigo(cuenta.codigo);
        setNombre(cuenta.nombre);
        setTipo(cuenta.tipo);
        setNaturaleza(cuenta.naturaleza);
        setSelectedParent(cuenta.parent_id ?? "");
        setAceptaMovimientos(cuenta.acepta_movimientos);
      } else {
        setCodigo("");
        setNombre("");
        setTipo("activo");
        setNaturaleza("deudora");
        setSelectedParent(parentId ?? "");
        setAceptaMovimientos(true);
      }
      setError(null);
    }
  }, [open, cuenta, parentId]);

  const handleTipoChange = (t: TipoCuenta) => {
    setTipo(t);
    setNaturaleza(NATURALEZA_DEFAULT[t]);
  };

  const handleSubmit = async () => {
    if (!codigo.trim() || !nombre.trim()) {
      setError("Código y nombre son obligatorios.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Compute nivel from parent
      const parent = cuentas.find((c) => c.id === selectedParent);
      const nivel = parent ? parent.nivel + 1 : 1;

      await onGuardar({
        empresa_id: empresaId,
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        tipo,
        naturaleza,
        parent_id: selectedParent || null,
        nivel,
        acepta_movimientos: aceptaMovimientos,
        activa: true,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // Only show company accounts (empresa_id not null) + parent candidates
  const parentOptions = cuentas.filter((c) => !c.acepta_movimientos || c.id === cuenta?.parent_id);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cuenta" : "Nueva cuenta contable"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Código *</Label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="1.1.01"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => handleTipoChange(v as TipoCuenta)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Caja y bancos"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Naturaleza</Label>
            <Select value={naturaleza} onValueChange={(v) => setNaturaleza(v as NaturalezaCuenta)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NATURALEZAS.map((n) => (
                  <SelectItem key={n.value} value={n.value}>
                    {n.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Cuenta padre</Label>
            <Select
              value={selectedParent || "__none__"}
              onValueChange={(v) => setSelectedParent(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin padre (nivel 1)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin padre (nivel 1)</SelectItem>
                {parentOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.codigo} — {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="acepta-mov"
              checked={aceptaMovimientos}
              onCheckedChange={setAceptaMovimientos}
            />
            <Label htmlFor="acepta-mov" className="cursor-pointer">
              Acepta movimientos (cuenta de detalle)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear cuenta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
