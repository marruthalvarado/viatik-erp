/**
 * Dialog de importación masiva de comprobantes SRI.
 *
 * Muestra una tabla de previsualización de todas las filas del TXT,
 * permite seleccionar/deseleccionar individualmente, asignar valores por
 * defecto (categoría, proyecto, deducible) para el lote, y confirmar la
 * importación en un solo click.
 */
import { useState, useMemo } from "react";
import { CheckSquare, Square, Loader2, AlertCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { formatCurrency, formatDate } from "@/utils/formatters";
import type { FilaTxtSri } from "@/services/factura-txt-parser";

interface CatalogoItem {
  id: string;
  nombre: string;
}

interface ImportSriDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filas: FilaTxtSri[];
  categorias: CatalogoItem[];
  proyectos: CatalogoItem[];
  /** IDs de claves_acceso ya existentes en la BD (para advertencia de duplicados) */
  clavesExistentes?: Set<string>;
  onImportar: (params: {
    filas: FilaTxtSri[];
    categoriaId: string | null;
    proyectoId: string | null;
    esDeducible: boolean;
  }) => Promise<void>;
}

export function ImportSriDialog({
  open,
  onOpenChange,
  filas,
  categorias,
  proyectos,
  clavesExistentes = new Set(),
  onImportar,
}: ImportSriDialogProps) {
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(
    () => new Set(filas.map((_, i) => i)),
  );
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [proyectoId, setProyectoId] = useState<string | null>(null);
  const [esDeducible, setEsDeducible] = useState(true);
  const [cargando, setCargando] = useState(false);

  // Resetear selección cuando cambian las filas
  const filasKey = filas.length;
  useMemo(() => {
    setSeleccionadas(new Set(filas.map((_, i) => i)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filasKey]);

  const todasSeleccionadas = seleccionadas.size === filas.length;
  const algunaSeleccionada = seleccionadas.size > 0;

  function toggleTodas() {
    if (todasSeleccionadas) {
      setSeleccionadas(new Set());
    } else {
      setSeleccionadas(new Set(filas.map((_, i) => i)));
    }
  }

  function toggleFila(i: number) {
    const next = new Set(seleccionadas);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSeleccionadas(next);
  }

  const totales = useMemo(() => {
    let subtotal = 0;
    let iva = 0;
    let total = 0;
    seleccionadas.forEach((i) => {
      subtotal += filas[i].subtotal;
      iva += filas[i].iva;
      total += filas[i].total;
    });
    return { subtotal, iva, total };
  }, [filas, seleccionadas]);

  async function handleImportar() {
    if (!algunaSeleccionada) return;
    setCargando(true);
    try {
      const filasSeleccionadas = [...seleccionadas]
        .sort((a, b) => a - b)
        .map((i) => filas[i]);
      await onImportar({ filas: filasSeleccionadas, categoriaId, proyectoId, esDeducible });
      onOpenChange(false);
    } finally {
      setCargando(false);
    }
  }

  const duplicados = useMemo(
    () => new Set(filas.map((f, i) => (clavesExistentes.has(f.clave_acceso) ? i : -1)).filter((i) => i >= 0)),
    [filas, clavesExistentes],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-full max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Importar comprobantes SRI</DialogTitle>
          <DialogDescription>
            {filas.length} comprobante{filas.length !== 1 ? "s" : ""} detectado
            {filas.length !== 1 ? "s" : ""} en el archivo. Revisa y ajusta los valores antes de
            importar.
          </DialogDescription>
        </DialogHeader>

        {/* Valores por defecto */}
        <div className="px-6 py-4 border-b bg-muted/20 shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Valores por defecto para todo el lote
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {/* Categoría */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Categoría</span>
              <Select
                value={categoriaId ?? "__none__"}
                onValueChange={(v) => setCategoriaId(v === "__none__" ? null : v)}
              >
                <SelectTrigger className="h-8 w-48 text-sm">
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin categoría</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Proyecto */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Proyecto</span>
              <Select
                value={proyectoId ?? "__none__"}
                onValueChange={(v) => setProyectoId(v === "__none__" ? null : v)}
              >
                <SelectTrigger className="h-8 w-48 text-sm">
                  <SelectValue placeholder="Sin proyecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin proyecto</SelectItem>
                  {proyectos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deducible */}
            <div className="flex items-center gap-2">
              <Switch checked={esDeducible} onCheckedChange={setEsDeducible} id="sri-deducible" />
              <label htmlFor="sri-deducible" className="text-sm cursor-pointer select-none">
                Deducible
              </label>
            </div>
          </div>
        </div>

        {/* Tabla de previsualización */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur border-b z-10">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2.5 w-10">
                  <button
                    type="button"
                    onClick={toggleTodas}
                    className="text-muted-foreground hover:text-foreground transition-colors"
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
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5 text-right">Subtotal</th>
                <th className="px-3 py-2.5 text-right">IVA</th>
                <th className="px-3 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filas.map((f, i) => {
                const checked = seleccionadas.has(i);
                const esDuplicado = duplicados.has(i);
                return (
                  <tr
                    key={i}
                    onClick={() => toggleFila(i)}
                    className={`cursor-pointer transition-colors ${
                      checked ? "hover:bg-muted/30" : "opacity-40 hover:opacity-60"
                    } ${esDuplicado ? "bg-amber-50/60" : ""}`}
                  >
                    <td className="px-3 py-2.5">
                      {checked ? (
                        <CheckSquare className="size-4 text-primary" />
                      ) : (
                        <Square className="size-4 text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-xs whitespace-nowrap">
                      {formatDate(f.fecha)}
                    </td>
                    <td className="px-3 py-2.5 max-w-[220px]">
                      <div className="truncate font-medium">{f.razon_social}</div>
                      <div className="text-[10px] text-muted-foreground">{f.ruc_emisor}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {f.serie}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                        {f.tipo_comprobante}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatCurrency(f.subtotal)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(f.iva)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                      <div className="flex items-center justify-end gap-1">
                        {esDuplicado && (
                          <span title="Ya existe en la base de datos">
                            <AlertCircle className="size-3 text-amber-500 shrink-0" />
                          </span>
                        )}
                        {formatCurrency(f.total)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {seleccionadas.size > 0 && (
              <tfoot className="sticky bottom-0 border-t bg-muted/80 backdrop-blur">
                <tr className="text-xs font-semibold">
                  <td colSpan={5} className="px-3 py-2 text-muted-foreground">
                    {seleccionadas.size} de {filas.length} seleccionado
                    {seleccionadas.size !== 1 ? "s" : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(totales.subtotal)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(totales.iva)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-700">
                    {formatCurrency(totales.total)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t shrink-0 flex items-center justify-between sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Podrás editar categoría, proyecto y proveedor en cada registro después de importar.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cargando}>
              Cancelar
            </Button>
            <Button onClick={handleImportar} disabled={!algunaSeleccionada || cargando}>
              {cargando && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              {cargando
                ? "Importando..."
                : `Importar ${seleccionadas.size} comprobante${seleccionadas.size !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
