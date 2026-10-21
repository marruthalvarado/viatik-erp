/**
 * Dialog de importación masiva de facturas emitidas desde el TXT SRI.
 *
 * Permite:
 * - Previsualizar las filas del archivo antes de importar
 * - Seleccionar / deseleccionar filas con checkbox
 * - Asignar proyecto por lote o individualmente
 * - Detectar duplicados (clave de acceso ya existente)
 */
import { useState, useMemo, useEffect } from "react";
import { CheckSquare, Square, Loader2, AlertTriangle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { FilaTxtFacturaEmitida } from "@/services/factura-emitida-txt-parser";

interface ProyectoItem {
  id: string;
  nombre: string;
}

interface FilaConMeta {
  fila: FilaTxtFacturaEmitida;
  seleccionada: boolean;
  proyectoId: string | null;
}

interface ImportFacturasEmitidasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filas: FilaTxtFacturaEmitida[];
  proyectos: ProyectoItem[];
  /** Claves de acceso ya existentes en la BD — para detectar duplicados */
  clavesExistentes?: Set<string>;
  onImportar: (
    filas: { fila: FilaTxtFacturaEmitida; proyectoId: string | null }[],
  ) => Promise<void>;
}

function buildFilas(
  filas: FilaTxtFacturaEmitida[],
  clavesExistentes: Set<string>,
): FilaConMeta[] {
  return filas.map((f) => ({
    fila: f,
    seleccionada: !f.clave_acceso || !clavesExistentes.has(f.clave_acceso),
    proyectoId: null,
  }));
}

export function ImportFacturasEmitidasDialog({
  open,
  onOpenChange,
  filas: filasProp,
  proyectos,
  clavesExistentes = new Set(),
  onImportar,
}: ImportFacturasEmitidasDialogProps) {
  const [filas, setFilas] = useState<FilaConMeta[]>(() =>
    buildFilas(filasProp, clavesExistentes),
  );
  const [cargando, setCargando] = useState(false);
  const [batchProyectoId, setBatchProyectoId] = useState<string | null>(null);

  useEffect(() => {
    setFilas(buildFilas(filasProp, clavesExistentes));
    setBatchProyectoId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filasProp, clavesExistentes]);

  function aplicarProyectoATodas() {
    setFilas((prev) => prev.map((f) => ({ ...f, proyectoId: batchProyectoId })));
  }

  function updateFila(i: number, patch: Partial<Omit<FilaConMeta, "fila">>) {
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  const todasSeleccionadas = filas.every((f) => f.seleccionada);
  const algunaSeleccionada = filas.some((f) => f.seleccionada);

  function toggleTodas() {
    const nuevoValor = !todasSeleccionadas;
    setFilas((prev) => prev.map((f) => ({ ...f, seleccionada: nuevoValor })));
  }

  const seleccionadas = filas.filter((f) => f.seleccionada);

  const numDuplicados = useMemo(
    () => filas.filter((f) => f.fila.clave_acceso && clavesExistentes.has(f.fila.clave_acceso)).length,
    [filas, clavesExistentes],
  );

  const totales = useMemo(
    () =>
      seleccionadas.reduce(
        (acc, { fila }) => ({
          subtotal: acc.subtotal + fila.subtotal,
          iva: acc.iva + fila.iva,
          total: acc.total + fila.total,
        }),
        { subtotal: 0, iva: 0, total: 0 },
      ),
    [seleccionadas],
  );

  async function handleImportar() {
    if (!algunaSeleccionada) return;
    setCargando(true);
    try {
      await onImportar(
        seleccionadas.map(({ fila, proyectoId }) => ({ fila, proyectoId })),
      );
      onOpenChange(false);
    } finally {
      setCargando(false);
    }
  }

  const selectCls =
    "h-7 rounded border bg-background px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring max-w-[160px] truncate";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-[900px] flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
          <DialogTitle>Importar facturas emitidas (TXT SRI)</DialogTitle>
          <DialogDescription>
            {filasProp.length} comprobante{filasProp.length !== 1 ? "s" : ""} detectado
            {filasProp.length !== 1 ? "s" : ""} en el archivo. Revisa y confirma los que deseas
            importar.
          </DialogDescription>
        </DialogHeader>

        {/* Banner duplicados */}
        {numDuplicados > 0 && (
          <div className="shrink-0 flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-sm text-amber-800">
            <AlertTriangle className="size-4 shrink-0 text-amber-500" />
            <span>
              <strong>{numDuplicados} factura{numDuplicados !== 1 ? "s" : ""}</strong> ya existen en
              la base de datos y fueron deseleccionadas automáticamente.
            </span>
          </div>
        )}

        {/* Batch proyecto */}
        {proyectos.length > 0 && (
          <div className="shrink-0 border-b bg-muted/20 px-6 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Asignar proyecto
              </span>
              <select
                value={batchProyectoId ?? "__none__"}
                onChange={(e) =>
                  setBatchProyectoId(e.target.value === "__none__" ? null : e.target.value)
                }
                className={selectCls}
                style={{ maxWidth: 220 }}
              >
                <option value="__none__">Sin proyecto</option>
                {proyectos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={aplicarProyectoATodas}
              >
                Aplicar a todas las filas
              </Button>
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b bg-muted/80 backdrop-blur">
              <tr className="text-left text-[11px] uppercase text-muted-foreground">
                <th className="w-10 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={toggleTodas}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    title={todasSeleccionadas ? "Deseleccionar todas" : "Seleccionar todas"}
                  >
                    {todasSeleccionadas ? (
                      <CheckSquare className="size-4" />
                    ) : (
                      <Square className="size-4" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2.5">Fecha emisión</th>
                <th className="px-3 py-2.5">Número</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5 text-right">Subtotal</th>
                <th className="px-3 py-2.5 text-right">IVA</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                {proyectos.length > 0 && <th className="px-3 py-2.5">Proyecto</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filas.map((item, i) => (
                <tr
                  key={i}
                  className={`transition-colors ${
                    item.seleccionada ? "hover:bg-muted/20" : "opacity-40"
                  }`}
                >
                  {/* Checkbox */}
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => updateFila(i, { seleccionada: !item.seleccionada })}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {item.seleccionada ? (
                        <CheckSquare className="size-4 text-primary" />
                      ) : (
                        <Square className="size-4" />
                      )}
                    </button>
                  </td>

                  {/* Fecha */}
                  <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums">
                    {formatDate(item.fila.fecha)}
                  </td>

                  {/* Número */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-medium">{item.fila.numero}</span>
                      {item.fila.clave_acceso && clavesExistentes.has(item.fila.clave_acceso) && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          Ya existe
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Tipo */}
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {item.fila.tipo_comprobante}
                  </td>

                  {/* Subtotal */}
                  <td className="px-3 py-2 text-right tabular-nums text-xs">
                    {formatCurrency(item.fila.subtotal)}
                  </td>

                  {/* IVA */}
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {formatCurrency(item.fila.iva)}
                  </td>

                  {/* Total */}
                  <td className="px-3 py-2 text-right tabular-nums text-sm font-semibold">
                    {formatCurrency(item.fila.total)}
                  </td>

                  {/* Proyecto */}
                  {proyectos.length > 0 && (
                    <td className="px-3 py-2">
                      <select
                        value={item.proyectoId ?? "__none__"}
                        onChange={(e) =>
                          updateFila(i, {
                            proyectoId: e.target.value === "__none__" ? null : e.target.value,
                          })
                        }
                        className={selectCls}
                        disabled={!item.seleccionada}
                      >
                        <option value="__none__">Sin proyecto</option>
                        {proyectos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>

            {/* Footer totales */}
            {algunaSeleccionada && (
              <tfoot className="sticky bottom-0 border-t bg-muted/80 backdrop-blur">
                <tr className="text-xs font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-muted-foreground">
                    {seleccionadas.length} de {filas.length} seleccionado
                    {seleccionadas.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(totales.subtotal)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(totales.iva)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                    {formatCurrency(totales.total)}
                  </td>
                  {proyectos.length > 0 && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer del dialog */}
        <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            La razón social y el RUC del cliente se pueden completar manualmente después de importar.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cargando}>
              Cancelar
            </Button>
            <Button onClick={handleImportar} disabled={!algunaSeleccionada || cargando}>
              {cargando && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              {cargando
                ? "Importando..."
                : `Importar ${seleccionadas.length} factura${seleccionadas.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
