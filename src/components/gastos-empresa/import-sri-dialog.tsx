/**
 * Dialog de importación masiva de comprobantes SRI.
 *
 * Permite:
 * - Asignar valores por lote (categoría / proyecto / deducible) y aplicarlos a todas las filas
 * - Sobrescribir individualmente cada fila desde la tabla
 * - Seleccionar / deseleccionar filas con checkbox
 * - Auto-sugerir categoría y proyecto según el historial de cada RUC emisor
 */
import { useState, useMemo, useEffect } from "react";
import { CheckSquare, Square, Loader2, AlertTriangle, Sparkles } from "lucide-react";

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
import type { FilaTxtSri } from "@/services/factura-txt-parser";

interface CatalogoItem {
  id: string;
  nombre: string;
}

interface SugerenciaRuc {
  categoriaId: string | null;
  proyectoId: string | null;
}

interface FilaConMeta {
  fila: FilaTxtSri;
  seleccionada: boolean;
  categoriaId: string | null;
  proyectoId: string | null;
  esDeducible: boolean;
  /** true si categoriaId/proyectoId fueron pre-rellenados desde el historial de RUC */
  sugerida: boolean;
}

interface ImportSriDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filas: FilaTxtSri[];
  categorias: CatalogoItem[];
  proyectos: CatalogoItem[];
  /** Claves de acceso ya existentes en la BD — usadas para detectar duplicados */
  clavesExistentes?: Set<string>;
  /** Mapa RUC → {categoriaId, proyectoId} con el último uso registrado por emisor */
  sugerenciasPorRuc?: Map<string, SugerenciaRuc>;
  onImportar: (
    filas: {
      fila: FilaTxtSri;
      categoriaId: string | null;
      proyectoId: string | null;
      esDeducible: boolean;
    }[],
  ) => Promise<void>;
}

function buildFilas(
  filas: FilaTxtSri[],
  clavesExistentes: Set<string>,
  sugerencias: Map<string, SugerenciaRuc>,
): FilaConMeta[] {
  return filas.map((f) => {
    const s = sugerencias.get(f.ruc_emisor);
    const tieneSugerencia = !!s && (s.categoriaId !== null || s.proyectoId !== null);
    return {
      fila: f,
      // Auto-deseleccionar duplicados
      seleccionada: !f.clave_acceso || !clavesExistentes.has(f.clave_acceso),
      categoriaId: s?.categoriaId ?? null,
      proyectoId: s?.proyectoId ?? null,
      esDeducible: true,
      sugerida: tieneSugerencia,
    };
  });
}

export function ImportSriDialog({
  open,
  onOpenChange,
  filas: filasProp,
  categorias,
  proyectos,
  clavesExistentes = new Set(),
  sugerenciasPorRuc = new Map(),
  onImportar,
}: ImportSriDialogProps) {
  const [filas, setFilas] = useState<FilaConMeta[]>(() =>
    buildFilas(filasProp, clavesExistentes, sugerenciasPorRuc),
  );
  const [cargando, setCargando] = useState(false);

  // Batch defaults
  const [batchCategoriaId, setBatchCategoriaId] = useState<string | null>(null);
  const [batchProyectoId, setBatchProyectoId] = useState<string | null>(null);
  const [batchEsDeducible, setBatchEsDeducible] = useState(true);

  // Reinicializar cuando cambia la prop o llegan sugerencias
  useEffect(() => {
    setFilas(buildFilas(filasProp, clavesExistentes, sugerenciasPorRuc));
    setBatchCategoriaId(null);
    setBatchProyectoId(null);
    setBatchEsDeducible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filasProp, sugerenciasPorRuc]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function aplicarATodas() {
    setFilas((prev) =>
      prev.map((f) => ({
        ...f,
        categoriaId: batchCategoriaId,
        proyectoId: batchProyectoId,
        esDeducible: batchEsDeducible,
        sugerida: false, // Aplicación manual elimina la bandera de sugerencia
      })),
    );
  }

  function updateFila(i: number, patch: Partial<Omit<FilaConMeta, "fila">>) {
    // Si el usuario cambia categoría o proyecto, la sugerencia ya no aplica
    const clearSugerida =
      "categoriaId" in patch || "proyectoId" in patch ? { sugerida: false } : {};
    setFilas((prev) =>
      prev.map((f, idx) => (idx === i ? { ...f, ...patch, ...clearSugerida } : f)),
    );
  }

  const todasSeleccionadas = filas.every((f) => f.seleccionada);
  const algunaSeleccionada = filas.some((f) => f.seleccionada);

  function toggleTodas() {
    const nuevoValor = !todasSeleccionadas;
    setFilas((prev) => prev.map((f) => ({ ...f, seleccionada: nuevoValor })));
  }

  const seleccionadas = filas.filter((f) => f.seleccionada);
  const numSugeridas = useMemo(() => filas.filter((f) => f.sugerida).length, [filas]);
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
        seleccionadas.map(({ fila, categoriaId, proyectoId, esDeducible }) => ({
          fila,
          categoriaId,
          proyectoId,
          esDeducible,
        })),
      );
      onOpenChange(false);
    } finally {
      setCargando(false);
    }
  }

  // ── Select reutilizable compacto ───────────────────────────────────────────

  const selectCls =
    "h-7 rounded border bg-background px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring max-w-[140px] truncate";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-[1100px] flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
          <DialogTitle>Importar comprobantes SRI</DialogTitle>
          <DialogDescription>
            {filasProp.length} comprobante{filasProp.length !== 1 ? "s" : ""} detectado
            {filasProp.length !== 1 ? "s" : ""} en el archivo. Asigna valores por lote o ajusta
            cada fila individualmente.
          </DialogDescription>
        </DialogHeader>

        {/* Banner sugerencias por RUC */}
        {numSugeridas > 0 && (
          <div className="shrink-0 flex items-center gap-2 bg-blue-50 border-b border-blue-200 px-6 py-2.5 text-sm text-blue-800">
            <Sparkles className="size-4 shrink-0 text-blue-500" />
            <span>
              <strong>{numSugeridas} comprobante{numSugeridas !== 1 ? "s" : ""}</strong>{" "}
              recibieron categoría y/o proyecto sugeridos automáticamente según el historial del
              emisor. Puedes ajustarlos individualmente.
            </span>
          </div>
        )}

        {/* Banner duplicados */}
        {numDuplicados > 0 && (
          <div className="shrink-0 flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-sm text-amber-800">
            <AlertTriangle className="size-4 shrink-0 text-amber-500" />
            <span>
              <strong>{numDuplicados} factura{numDuplicados !== 1 ? "s" : ""}</strong> ya existen en
              la base de datos y fueron deseleccionadas automáticamente. Puedes reactivarlas si
              necesitas sobreescribirlas.
            </span>
          </div>
        )}

        {/* Batch defaults */}
        <div className="shrink-0 border-b bg-muted/20 px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Valores por lote
            </span>

            {/* Categoría batch */}
            <select
              value={batchCategoriaId ?? "__none__"}
              onChange={(e) =>
                setBatchCategoriaId(e.target.value === "__none__" ? null : e.target.value)
              }
              className={selectCls}
              style={{ maxWidth: 180 }}
            >
              <option value="__none__">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>

            {/* Proyecto batch */}
            <select
              value={batchProyectoId ?? "__none__"}
              onChange={(e) =>
                setBatchProyectoId(e.target.value === "__none__" ? null : e.target.value)
              }
              className={selectCls}
              style={{ maxWidth: 180 }}
            >
              <option value="__none__">Sin proyecto</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>

            {/* Deducible batch */}
            <select
              value={batchEsDeducible ? "si" : "no"}
              onChange={(e) => setBatchEsDeducible(e.target.value === "si")}
              className={selectCls}
              style={{ maxWidth: 120 }}
            >
              <option value="si">Deducible</option>
              <option value="no">No deducible</option>
            </select>

            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={aplicarATodas}>
              Aplicar a todas las filas
            </Button>
          </div>
        </div>

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
                <th className="px-3 py-2.5">Fecha</th>
                <th className="px-3 py-2.5">Emisor</th>
                <th className="px-3 py-2.5">Serie</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5">Categoría</th>
                <th className="px-3 py-2.5">Proyecto</th>
                <th className="px-3 py-2.5 text-center">Ded.</th>
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

                  {/* Emisor */}
                  <td className="max-w-[200px] px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-sm">{item.fila.razon_social}</span>
                      {item.fila.clave_acceso && clavesExistentes.has(item.fila.clave_acceso) && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          Ya existe
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">{item.fila.ruc_emisor}</span>
                      {item.sugerida && (
                        <span
                          className="shrink-0 flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
                          title="Categoría y/o proyecto sugeridos desde el historial de este emisor"
                        >
                          <Sparkles className="size-2.5" />
                          Auto
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Serie */}
                  <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted-foreground">
                    {item.fila.serie}
                  </td>

                  {/* Total */}
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-sm">
                    {formatCurrency(item.fila.total)}
                  </td>

                  {/* Categoría inline */}
                  <td className="px-3 py-2">
                    <select
                      value={item.categoriaId ?? "__none__"}
                      onChange={(e) =>
                        updateFila(i, {
                          categoriaId: e.target.value === "__none__" ? null : e.target.value,
                        })
                      }
                      className={selectCls}
                      disabled={!item.seleccionada}
                    >
                      <option value="__none__">Sin categoría</option>
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Proyecto inline */}
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

                  {/* Deducible inline */}
                  <td className="px-3 py-2 text-center">
                    <select
                      value={item.esDeducible ? "si" : "no"}
                      onChange={(e) => updateFila(i, { esDeducible: e.target.value === "si" })}
                      className="h-7 rounded border bg-background px-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      disabled={!item.seleccionada}
                    >
                      <option value="si">Sí</option>
                      <option value="no">No</option>
                    </select>
                  </td>
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
                  <td className="px-3 py-2 text-right tabular-nums text-rose-700">
                    {formatCurrency(totales.total)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Dialog footer */}
        <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Podrás editar el proveedor de cada registro después de importar.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cargando}>
              Cancelar
            </Button>
            <Button onClick={handleImportar} disabled={!algunaSeleccionada || cargando}>
              {cargando && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              {cargando
                ? "Importando..."
                : `Importar ${seleccionadas.length} comprobante${seleccionadas.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
