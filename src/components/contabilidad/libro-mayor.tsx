/**
 * Libro Mayor — movimientos detallados de una cuenta con saldo acumulado.
 */
import { useState } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useLibroMayor } from "@/hooks/entities/use-contabilidad";
import type { PlanCuenta } from "@/hooks/entities/use-contabilidad";

interface LibroMayorProps {
  empresaId: string;
  cuentas: PlanCuenta[];
}

export function LibroMayor({ empresaId, cuentas }: LibroMayorProps) {
  const thisYear = new Date().getFullYear();
  const [cuentaId, setCuentaId] = useState<string>("");
  const [desde, setDesde] = useState(`${thisYear}-01-01`);
  const [hasta, setHasta] = useState(`${thisYear}-12-31`);

  const { movimientos, loading, error } = useLibroMayor(empresaId, cuentaId || null, desde, hasta);

  const cuentasMovimiento = cuentas.filter((c) => c.acepta_movimientos);
  const cuentaActual = cuentas.find((c) => c.id === cuentaId);

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Libro Mayor</h3>

      {/* Filtros */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 space-y-1.5">
          <Label className="text-xs">Cuenta</Label>
          <Select
            value={cuentaId || "__none__"}
            onValueChange={(v) => setCuentaId(v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Selecciona cuenta…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Selecciona —</SelectItem>
              {cuentasMovimiento.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.codigo} — {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Desde</Label>
          <Input
            type="date"
            className="h-8 text-sm"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            className="h-8 text-sm"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
      </div>

      {/* Resultado */}
      {!cuentaId && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Selecciona una cuenta para ver sus movimientos.
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando movimientos…</p>
      )}

      {cuentaId && !loading && !error && (
        <>
          {cuentaActual && (
            <div className="text-sm font-medium">
              <span className="font-mono text-muted-foreground mr-2">{cuentaActual.codigo}</span>
              {cuentaActual.nombre}
              <span className="ml-2 text-xs text-muted-foreground capitalize">
                ({cuentaActual.naturaleza})
              </span>
            </div>
          )}

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Debe</TableHead>
                  <TableHead className="text-right">Haber</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Sin movimientos en el período.
                    </TableCell>
                  </TableRow>
                ) : (
                  movimientos.map((m) => (
                    <TableRow key={`${m.asiento_id}`}>
                      <TableCell className="font-mono text-sm">{m.numero}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(m.fecha + "T12:00:00"), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{m.descripcion}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {m.debe > 0 ? m.debe.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {m.haber > 0 ? m.haber.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono text-sm font-medium",
                          m.saldo_acum < 0 && "text-destructive",
                        )}
                      >
                        {m.saldo_acum.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
