/**
 * Configuración de cuentas contables por clave de rol.
 * Mapea rol-key ('banco', 'cxc', 'ventas', etc.) → cuenta del plan.
 */
import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfigContable } from "@/hooks/entities/use-contabilidad";
import type { PlanCuenta } from "@/hooks/entities/use-contabilidad";

interface ConfigCuentasProps {
  empresaId: string;
  cuentas: PlanCuenta[];
}

const CLAVES: { clave: string; label: string; descripcion: string }[] = [
  { clave: "banco", label: "Banco / Caja", descripcion: "Cuenta bancaria para cobros y pagos" },
  { clave: "cxc", label: "Cuentas por cobrar", descripcion: "Clientes — facturas emitidas" },
  { clave: "ventas", label: "Ingresos por ventas", descripcion: "Cuenta de ventas / ingresos" },
  { clave: "iva_ventas", label: "IVA en ventas", descripcion: "IVA cobrado a clientes" },
  { clave: "cxp", label: "Cuentas por pagar", descripcion: "Proveedores — gastos empresa" },
  { clave: "iva_compras", label: "IVA en compras", descripcion: "IVA pagado a proveedores" },
  { clave: "ret_ir", label: "Retención IR", descripcion: "Retenciones IR cobradas a clientes" },
  { clave: "ret_iva", label: "Retención IVA", descripcion: "Retenciones IVA cobradas a clientes" },
];

export function ConfigCuentas({ empresaId, cuentas }: ConfigCuentasProps) {
  const { config, loading, error, guardar } = useConfigContable(empresaId);

  const configMap = useMemo(
    () => Object.fromEntries(config.map((c) => [c.clave, c.cuenta_id])),
    [config],
  );

  const cuentasMovimiento = useMemo(() => cuentas.filter((c) => c.acepta_movimientos), [cuentas]);

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">Cargando configuración…</p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Configuración de cuentas contables</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Asocia cada rol contable a la cuenta del plan de cuentas de tu empresa. Estos mapeos se
          usan al generar asientos automáticos desde facturas, gastos y cobros.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {CLAVES.map(({ clave, label, descripcion }) => {
          const currentId = configMap[clave] ?? "";
          return (
            <div key={clave} className="rounded-md border p-4 space-y-2">
              <div>
                <Label className="text-sm font-medium">{label}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{descripcion}</p>
              </div>
              <Select
                value={currentId || "__none__"}
                onValueChange={(v) => guardar(clave, v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin asignar —</SelectItem>
                  {cuentasMovimiento.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo} — {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Los cambios se guardan automáticamente al seleccionar una cuenta.
      </p>
    </div>
  );
}
