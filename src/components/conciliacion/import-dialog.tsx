/**
 * import-dialog.tsx
 * Dialog para importar un extracto bancario (multi-banco).
 * Parsea el archivo, muestra preview y guarda en movimientos_bancarios.
 */
import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { toast } from "@/components/common/toast";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { BANCOS_SOPORTADOS, getBancoParser } from "@/services/bank-parsers";
import type { MovimientoBancarioParsed } from "@/services/bank-parsers";
import { useImportarMovimientos } from "@/hooks/entities/use-conciliacion";
import type { CuentaBancaria } from "@/services/conciliacion";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cuenta: CuentaBancaria;
  empresaId: string;
}

export function ImportDialog({ open, onOpenChange, cuenta, empresaId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<MovimientoBancarioParsed[]>([]);
  const [parsed, setParsed] = useState(false);
  const importar = useImportarMovimientos();

  // Determinar qué parser usar para este banco
  const bancoEntry = BANCOS_SOPORTADOS.find(
    (b) =>
      b.nombre.toLowerCase().includes(cuenta.banco.toLowerCase()) ||
      cuenta.banco.toLowerCase().includes(b.id),
  );
  const aceptados = bancoEntry?.formatos.join(",") ?? ".csv,.xls,.xlsx";

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setRows([]);
    setParsed(false);
    try {
      const parser = getBancoParser(bancoEntry?.id ?? "csv_generico");
      const result = await parser(file);
      setRows(result);
      setParsed(true);
      toast.success(`${result.length} movimientos detectados en el extracto`);
    } catch (err) {
      toast.error("Error al leer el archivo: " + (err as Error).message);
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleImportar() {
    if (!rows.length) return;
    try {
      const res = await importar.mutateAsync({
        cuentaId: cuenta.id,
        empresaId,
        movimientos: rows,
      });
      toast.success(
        `${res.insertados} movimientos importados. ${res.duplicados > 0 ? `${res.duplicados} ya existían (omitidos).` : ""}`,
      );
      handleClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => {
      setRows([]);
      setParsed(false);
    }, 300);
  }

  const creditos = rows.filter((r) => r.tipo === "CREDITO");
  const debitos = rows.filter((r) => r.tipo === "DEBITO");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar extracto — {cuenta.nombre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/20 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept={aceptados}
              className="hidden"
              onChange={handleFile}
            />
            <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">
              {parsing ? "Procesando archivo…" : `Cargar extracto ${cuenta.banco} (${aceptados})`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Los movimientos ya importados se omiten automáticamente.
            </p>
          </div>

          {/* Resumen + preview */}
          {parsed && rows.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{rows.length}</p>
                  <p className="text-xs text-muted-foreground">Movimientos</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{creditos.length}</p>
                  <p className="text-xs text-muted-foreground">Créditos</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-destructive">{debitos.length}</p>
                  <p className="text-xs text-muted-foreground">Débitos</p>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="px-3 py-2 bg-muted/30 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <FileText className="size-3.5" />
                  Preview (primeros 20)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/20 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left">Fecha</th>
                        <th className="px-3 py-2 text-left">Descripción</th>
                        <th className="px-3 py-2 text-left">Referencia</th>
                        <th className="px-3 py-2 text-center">Tipo</th>
                        <th className="px-3 py-2 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.slice(0, 20).map((r, i) => (
                        <tr key={i} className="hover:bg-muted/10">
                          <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">
                            {formatDate(r.fecha)}
                          </td>
                          <td className="px-3 py-1.5 max-w-[200px] truncate text-muted-foreground">
                            {r.descripcion || "—"}
                          </td>
                          <td className="px-3 py-1.5 max-w-[120px] truncate text-muted-foreground">
                            {r.referencia || "—"}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                r.tipo === "CREDITO"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {r.tipo}
                            </span>
                          </td>
                          <td
                            className={`px-3 py-1.5 text-right tabular-nums font-medium ${
                              r.tipo === "CREDITO" ? "text-emerald-700" : "text-destructive"
                            }`}
                          >
                            {formatCurrency(r.monto)}
                          </td>
                        </tr>
                      ))}
                      {rows.length > 20 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-2 text-center text-xs text-muted-foreground"
                          >
                            … y {rows.length - 20} más
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {parsed && rows.length > 0 && (
            <Button onClick={handleImportar} disabled={importar.isPending}>
              {importar.isPending ? "Importando…" : `Importar ${rows.length} movimientos`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
