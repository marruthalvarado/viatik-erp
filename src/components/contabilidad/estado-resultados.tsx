/**
 * Estado de Resultados (NIIF) — Ingresos, Costos y Gastos.
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

interface EstadoResultadosProps {
  saldos: SaldoCuenta[];
  desde: string;
  hasta: string;
}

function Section({
  titulo,
  cuentas,
  total,
  negativeTotals,
}: {
  titulo: string;
  cuentas: SaldoCuenta[];
  total: number;
  negativeTotals?: boolean;
}) {
  return (
    <>
      <TableRow className="bg-muted/40">
        <TableCell colSpan={2} className="font-semibold text-sm py-2 uppercase tracking-wide">
          {titulo}
        </TableCell>
      </TableRow>
      {cuentas.map((c) => (
        <TableRow key={c.id} className={cn(!c.acepta_movimientos && "font-medium bg-muted/20")}>
          <TableCell className={cn("text-sm", c.acepta_movimientos ? "pl-8" : "pl-4")}>
            <span className="font-mono text-xs text-muted-foreground mr-2">{c.codigo}</span>
            {c.nombre}
          </TableCell>
          <TableCell className="text-right font-mono text-sm">
            {c.acepta_movimientos && c.saldo !== 0 ? c.saldo.toFixed(2) : ""}
          </TableCell>
        </TableRow>
      ))}
      <TableRow className="border-t font-semibold">
        <TableCell className="text-sm">Total {titulo}</TableCell>
        <TableCell className={cn("text-right font-mono", negativeTotals && "text-destructive")}>
          {negativeTotals ? `(${total.toFixed(2)})` : total.toFixed(2)}
        </TableCell>
      </TableRow>
    </>
  );
}

export function EstadoResultados({ saldos, desde, hasta }: EstadoResultadosProps) {
  const ingresos = useMemo(() => saldos.filter((s) => s.tipo === "ingreso"), [saldos]);
  const costos = useMemo(() => saldos.filter((s) => s.tipo === "costo"), [saldos]);
  const gastos = useMemo(() => saldos.filter((s) => s.tipo === "gasto"), [saldos]);

  const totalIngresos = ingresos
    .filter((c) => c.acepta_movimientos)
    .reduce((s, c) => s + c.saldo, 0);
  const totalCostos = costos.filter((c) => c.acepta_movimientos).reduce((s, c) => s + c.saldo, 0);
  const totalGastos = gastos.filter((c) => c.acepta_movimientos).reduce((s, c) => s + c.saldo, 0);
  const utilidadBruta = totalIngresos - totalCostos;
  const utilidadNeta = utilidadBruta - totalGastos;

  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold">Estado de Resultados</h3>
      <p className="text-sm text-muted-foreground">
        Del {desde} al {hasta}
      </p>

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70%]">Cuenta</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <Section titulo="Ingresos" cuentas={ingresos} total={totalIngresos} />
            <Section titulo="Costos" cuentas={costos} total={totalCostos} negativeTotals />

            {/* Utilidad bruta */}
            <TableRow className="bg-blue-50 font-semibold border-t-2">
              <TableCell>Utilidad Bruta</TableCell>
              <TableCell
                className={cn("text-right font-mono", utilidadBruta < 0 && "text-destructive")}
              >
                {utilidadBruta < 0
                  ? `(${Math.abs(utilidadBruta).toFixed(2)})`
                  : utilidadBruta.toFixed(2)}
              </TableCell>
            </TableRow>

            <Section
              titulo="Gastos Operativos"
              cuentas={gastos}
              total={totalGastos}
              negativeTotals
            />

            {/* Utilidad neta */}
            <TableRow
              className={cn(
                "font-bold border-t-2",
                utilidadNeta >= 0 ? "bg-green-50" : "bg-red-50",
              )}
            >
              <TableCell>Utilidad / (Pérdida) Neta del Período</TableCell>
              <TableCell
                className={cn("text-right font-mono", utilidadNeta < 0 && "text-destructive")}
              >
                {utilidadNeta < 0
                  ? `(${Math.abs(utilidadNeta).toFixed(2)})`
                  : utilidadNeta.toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
