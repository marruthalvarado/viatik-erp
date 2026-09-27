/**
 * Balance General (Estado de Situación Financiera NIIF).
 * Activos, Pasivos y Patrimonio al cierre del período.
 */
import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SaldoCuenta } from "@/hooks/entities/use-contabilidad";

interface BalanceGeneralProps {
  saldos: SaldoCuenta[];
  hasta: string;
}

function Section({
  titulo,
  cuentas,
  total,
}: {
  titulo: string;
  cuentas: SaldoCuenta[];
  total: number;
}) {
  return (
    <>
      <TableRow className="bg-muted/40">
        <TableCell colSpan={3} className="font-semibold text-sm py-2 uppercase tracking-wide">
          {titulo}
        </TableCell>
      </TableRow>
      {cuentas.map((c) => (
        <TableRow key={c.id} className={cn(!c.acepta_movimientos && "font-medium bg-muted/20")}>
          <TableCell className={cn("text-sm", c.acepta_movimientos ? "pl-8" : "pl-4")}>
            <span className="font-mono text-xs text-muted-foreground mr-2">{c.codigo}</span>
            {c.nombre}
          </TableCell>
          <TableCell />
          <TableCell className="text-right font-mono text-sm">
            {c.acepta_movimientos && c.saldo !== 0 ? c.saldo.toFixed(2) : ""}
          </TableCell>
        </TableRow>
      ))}
      <TableRow className="border-t-2 font-semibold">
        <TableCell className="text-sm">Total {titulo}</TableCell>
        <TableCell />
        <TableCell className="text-right font-mono">{total.toFixed(2)}</TableCell>
      </TableRow>
    </>
  );
}

export function BalanceGeneral({ saldos, hasta }: BalanceGeneralProps) {
  const activos = useMemo(() => saldos.filter((s) => s.tipo === "activo"), [saldos]);
  const pasivos = useMemo(() => saldos.filter((s) => s.tipo === "pasivo"), [saldos]);
  const patrimonio = useMemo(() => saldos.filter((s) => s.tipo === "patrimonio"), [saldos]);

  const totalActivos = activos.filter((c) => c.acepta_movimientos).reduce((s, c) => s + c.saldo, 0);
  const totalPasivos = pasivos.filter((c) => c.acepta_movimientos).reduce((s, c) => s + c.saldo, 0);
  const totalPatrimonio = patrimonio
    .filter((c) => c.acepta_movimientos)
    .reduce((s, c) => s + c.saldo, 0);
  const totalPasivoPatrimonio = totalPasivos + totalPatrimonio;

  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold">Estado de Situación Financiera</h3>
      <p className="text-sm text-muted-foreground">Al {hasta}</p>

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60%]">Cuenta</TableHead>
              <TableHead />
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <Section titulo="Activos" cuentas={activos} total={totalActivos} />
            <Section titulo="Pasivos" cuentas={pasivos} total={totalPasivos} />
            <Section titulo="Patrimonio" cuentas={patrimonio} total={totalPatrimonio} />

            {/* Verificación */}
            <TableRow
              className={cn(
                "bg-muted/50 font-bold border-t-2",
                Math.abs(totalActivos - totalPasivoPatrimonio) > 0.01 && "bg-red-50",
              )}
            >
              <TableCell>Total Pasivo + Patrimonio</TableCell>
              <TableCell />
              <TableCell className="text-right font-mono">
                {totalPasivoPatrimonio.toFixed(2)}
              </TableCell>
            </TableRow>
            {Math.abs(totalActivos - totalPasivoPatrimonio) > 0.01 && (
              <TableRow className="bg-red-50">
                <TableCell colSpan={3} className="text-center text-sm text-red-600 py-2">
                  ⚠ El balance no cuadra: diferencia de{" "}
                  {Math.abs(totalActivos - totalPasivoPatrimonio).toFixed(2)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
