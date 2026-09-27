import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/common/toast";
import { useCreateCuenta, useUpdateCuenta } from "@/hooks/entities/use-conciliacion";
import type { CuentaBancaria } from "@/services/conciliacion";
import { BANCOS_SOPORTADOS } from "@/services/bank-parsers";

interface Props {
  empresaId: string;
  cuenta?: CuentaBancaria;
  onDone: () => void;
  onCancel: () => void;
}

export function CuentaForm({ empresaId, cuenta, onDone, onCancel }: Props) {
  const isEditing = !!cuenta;
  const create = useCreateCuenta();
  const update = useUpdateCuenta();

  const [banco, setBanco] = useState(cuenta?.banco ?? "ProCredit");
  const [nombre, setNombre] = useState(cuenta?.nombre ?? "");
  const [numCta, setNumCta] = useState(cuenta?.numero_cuenta ?? "");
  const [moneda, setMoneda] = useState(cuenta?.moneda ?? "USD");

  const bancoOpts = Array.from(new Set(BANCOS_SOPORTADOS.map((b) => b.nombre)));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error("El nombre de la cuenta es requerido");
      return;
    }
    try {
      if (isEditing) {
        await update.mutateAsync({
          id: cuenta.id,
          payload: { banco, nombre, numero_cuenta: numCta || null, moneda },
        });
        toast.success("Cuenta actualizada");
      } else {
        await create.mutateAsync({
          empresa_id: empresaId,
          banco,
          nombre,
          numero_cuenta: numCta || null,
          moneda,
          activa: true,
        });
        toast.success("Cuenta bancaria creada");
      }
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const busy = create.isPending || update.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Banco *</Label>
          <select
            value={banco}
            onChange={(e) => setBanco(e.target.value)}
            className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {bancoOpts.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Moneda</Label>
          <select
            value={moneda}
            onChange={(e) => setMoneda(e.target.value)}
            className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>
      <div>
        <Label>Nombre / alias *</Label>
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Cta. Cte. ProCredit USD"
          className="mt-1"
        />
      </div>
      <div>
        <Label>Número de cuenta (opcional)</Label>
        <Input
          value={numCta}
          onChange={(e) => setNumCta(e.target.value)}
          placeholder="XXXXXXXXXX"
          className="mt-1"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Guardando…" : isEditing ? "Actualizar" : "Crear cuenta"}
        </Button>
      </div>
    </form>
  );
}
