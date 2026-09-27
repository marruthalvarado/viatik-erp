/**
 * movimientos-table.tsx
 * Tabla de movimientos bancarios con match automático y conciliación manual.
 *
 * Auto-match:
 *   CREDITO → facturas_emitidas (valor_neto ≈ monto, ±$0.02)
 *   DEBITO  → gastos_empresa   (total ≈ monto, ±$0.02)
 */
import { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Link2,
  Link2Off,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { toast } from "@/components/common/toast";
import {
  useMovimientosBancarios,
  useMarcarConciliado,
  useIgnorarMovimiento,
  useDesconciliar,
} from "@/hooks/entities/use-conciliacion";
import type {
  MovimientoBancario,
  EstadoMovimiento,
  FiltrosMovimientos,
} from "@/services/conciliacion";
import { calcValorNeto } from "@/components/facturas/factura-types";
import type { FacturaEmitida } from "@/services/facturas-emitidas";
import type { GastoEmpresa } from "@/services/gastos-empresa";

// ─── Auto-match helpers ───────────────────────────────────────────────────────

const TOLERANCE = 0.02;

function matchFactura(monto: number, facturas: FacturaEmitida[]): FacturaEmitida | null {
  for (const f of facturas) {
    if (f.estado_sri === "ANULADA") continue;
    const vn = calcValorNeto(
      Number(f.total),
      Number(f.iva),
      Number(f.subtotal),
      Number(f.retencion_iva_pct ?? 0),
      Number(f.retencion_ir_pct ?? 0),
    );
    if (Math.abs(vn - monto) <= TOLERANCE) return f;
  }
  return null;
}

function matchGasto(monto: number, gastos: GastoEmpresa[]): GastoEmpresa | null {
  for (const g of gastos) {
    if (g.deleted_at) continue;
    if (Math.abs(Number(g.total) - monto) <= TOLERANCE) return g;
  }
  return null;
}

// ─── Filtro de estado ─────────────────────────────────────────────────────────

const ESTADOS: { value: EstadoMovimiento | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "sin_conciliar", label: "Sin conciliar" },
  { value: "conciliado", label: "Conciliados" },
  { value: "ignorado", label: "Ignorados" },
];

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  empresaId: string;
  cuentaId?: string;
  facturas: FacturaEmitida[];
  gastos: GastoEmpresa[];
}

export function MovimientosTable({ empresaId, cuentaId, facturas, gastos }: Props) {
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoMovimiento | "todos">("sin_conciliar");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Manual assignment: movimientoId → { tipo, id }
  const [manualMap, setManualMap] = useState<
    Record<string, { tipo: "factura" | "gasto"; id: string }>
  >({});

  const filtros: FiltrosMovimientos = {
    cuentaId,
    estado: estadoFiltro === "todos" ? undefined : estadoFiltro,
  };

  const { data: movimientos = [], isLoading } = useMovimientosBancarios(empresaId, filtros);
  const marcar = useMarcarConciliado();
  const ignorar = useIgnorarMovimiento();
  const desconc = useDesconciliar();

  // Facturas con saldo pendiente
  const facturasPendientes = useMemo(
    () =>
      facturas.filter((f) => {
        if (f.estado_sri === "ANULADA") return false;
        return true; // simplificado: mostrar todas no anuladas
      }),
    [facturas],
  );

  async function handleConciliarAuto(mov: MovimientoBancario) {
    const matchId = manualMap[mov.id]?.id;
    const matchTipo = manualMap[mov.id]?.tipo;

    if (matchId && matchTipo) {
      // Asignación manual
      try {
        await marcar.mutateAsync({
          movimientoId: mov.id,
          matchTipo,
          matchId,
          matchNota: "Conciliación manual",
          crearCobro: matchTipo === "factura",
        });
        toast.success("Movimiento conciliado");
      } catch (err) {
        toast.error((err as Error).message);
      }
      return;
    }

    // Auto-match
    if (mov.tipo === "CREDITO") {
      const f = matchFactura(Number(mov.monto), facturasPendientes);
      if (f) {
        try {
          await marcar.mutateAsync({
            movimientoId: mov.id,
            matchTipo: "factura",
            matchId: f.id,
            matchNota: `Factura ${f.numero} — ${f.razon_social}`,
            crearCobro: true,
          });
          toast.success(`Conciliado con factura ${f.numero}`);
        } catch (err) {
          toast.error((err as Error).message);
        }
      } else {
        toast.error("No se encontró factura con monto coincidente. Asigna manualmente.");
      }
    } else {
      const g = matchGasto(Number(mov.monto), gastos);
      if (g) {
        try {
          await marcar.mutateAsync({
            movimientoId: mov.id,
            matchTipo: "gasto",
            matchId: g.id,
            matchNota: `Gasto: ${g.descripcion ?? "sin descripción"}`,
          });
          toast.success("Conciliado con gasto empresa");
        } catch (err) {
          toast.error((err as Error).message);
        }
      } else {
        toast.error("No se encontró gasto con monto coincidente. Asigna manualmente.");
      }
    }
  }

  async function handleIgnorar(mov: MovimientoBancario) {
    try {
      await ignorar.mutateAsync({ movimientoId: mov.id, nota: "Ignorado manualmente" });
      toast.success("Movimiento ignorado");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDeshacer(mov: MovimientoBancario) {
    try {
      await desconc.mutateAsync(mov.id);
      toast.success("Conciliación deshecha");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">Cargando movimientos…</div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex gap-1.5 flex-wrap">
        {ESTADOS.map((e) => (
          <button
            key={e.value}
            type="button"
            onClick={() => setEstadoFiltro(e.value as EstadoMovimiento | "todos")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              estadoFiltro === e.value
                ? "bg-primary text-primary-foreground"
                : "border hover:bg-muted/30"
            }`}
          >
            {e.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground self-center">
          {movimientos.length} movimiento{movimientos.length !== 1 ? "s" : ""}
        </span>
      </div>

      {movimientos.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <AlertCircle className="size-4" />
          No hay movimientos{estadoFiltro !== "todos" ? ` "${estadoFiltro}"` : ""}. Importa un
          extracto bancario.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 border-b text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="w-6 px-2 py-2" />
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Descripción</th>
                <th className="px-3 py-2 text-center">Tipo</th>
                <th className="px-3 py-2 text-right">Monto</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Match</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {movimientos.map((mov) => {
                const expanded = expandedId === mov.id;
                const isBusy = marcar.isPending || ignorar.isPending || desconc.isPending;
                const manualSel = manualMap[mov.id];
                const autoMatch =
                  mov.tipo === "CREDITO"
                    ? matchFactura(Number(mov.monto), facturasPendientes)
                    : matchGasto(Number(mov.monto), gastos);

                return (
                  <>
                    <tr
                      key={mov.id}
                      className={`transition-colors ${
                        mov.estado === "conciliado"
                          ? "bg-emerald-50/30"
                          : mov.estado === "ignorado"
                            ? "opacity-50"
                            : "hover:bg-muted/10"
                      }`}
                    >
                      {/* Expand */}
                      <td className="px-2 py-2">
                        {mov.estado === "sin_conciliar" && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : mov.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {expanded ? (
                              <ChevronDown className="size-3.5" />
                            ) : (
                              <ChevronRight className="size-3.5" />
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                        {formatDate(mov.fecha)}
                      </td>
                      <td className="px-3 py-2 max-w-[220px] truncate text-muted-foreground">
                        {mov.descripcion || "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            mov.tipo === "CREDITO"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {mov.tipo}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums font-semibold ${
                          mov.tipo === "CREDITO" ? "text-emerald-700" : "text-destructive"
                        }`}
                      >
                        {formatCurrency(Number(mov.monto))}
                      </td>
                      <td className="px-3 py-2">
                        {mov.estado === "conciliado" && (
                          <span className="flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="size-3.5" /> Conciliado
                          </span>
                        )}
                        {mov.estado === "ignorado" && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <XCircle className="size-3.5" /> Ignorado
                          </span>
                        )}
                        {mov.estado === "sin_conciliar" && (
                          <span className="text-amber-600 font-medium">Pendiente</span>
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-[180px] truncate text-muted-foreground text-[10px]">
                        {mov.match_nota ??
                          (autoMatch && mov.estado === "sin_conciliar" ? (
                            <span className="text-blue-600 flex items-center gap-1">
                              <Link2 className="size-3" /> Sugerencia disponible
                            </span>
                          ) : null)}
                      </td>
                      {/* Acciones */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 justify-end">
                          {mov.estado === "sin_conciliar" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => handleConciliarAuto(mov)}
                                disabled={isBusy}
                                title="Conciliar (auto o manual)"
                              >
                                <CheckCircle2 className="size-3 mr-1 text-emerald-600" />
                                Conciliar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[10px] text-muted-foreground"
                                onClick={() => handleIgnorar(mov)}
                                disabled={isBusy}
                                title="Ignorar movimiento"
                              >
                                <XCircle className="size-3" />
                              </Button>
                            </>
                          )}
                          {(mov.estado === "conciliado" || mov.estado === "ignorado") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px] text-muted-foreground"
                              onClick={() => handleDeshacer(mov)}
                              disabled={isBusy}
                              title="Deshacer"
                            >
                              <RotateCcw className="size-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Fila expandida: asignación manual */}
                    {expanded && mov.estado === "sin_conciliar" && (
                      <tr key={`${mov.id}-exp`} className="bg-muted/5 border-b">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="flex items-start gap-4">
                            {/* Sugerencia auto */}
                            {autoMatch && (
                              <div className="rounded-md border border-blue-200 bg-blue-50/50 px-3 py-2 text-xs">
                                <p className="font-medium text-blue-800 mb-1 flex items-center gap-1">
                                  <Link2 className="size-3.5" />
                                  Sugerencia automática
                                </p>
                                <p className="text-blue-700">
                                  {mov.tipo === "CREDITO"
                                    ? `Factura ${(autoMatch as FacturaEmitida).numero} — ${(autoMatch as FacturaEmitida).razon_social}`
                                    : `Gasto: ${(autoMatch as GastoEmpresa).descripcion ?? "sin descripción"}`}
                                </p>
                                <p className="text-blue-600 mt-0.5">
                                  {formatCurrency(
                                    mov.tipo === "CREDITO"
                                      ? calcValorNeto(
                                          Number((autoMatch as FacturaEmitida).total),
                                          Number((autoMatch as FacturaEmitida).iva),
                                          Number((autoMatch as FacturaEmitida).subtotal),
                                          Number(
                                            (autoMatch as FacturaEmitida).retencion_iva_pct ?? 0,
                                          ),
                                          Number(
                                            (autoMatch as FacturaEmitida).retencion_ir_pct ?? 0,
                                          ),
                                        )
                                      : Number((autoMatch as GastoEmpresa).total),
                                  )}
                                </p>
                              </div>
                            )}

                            {/* Asignación manual */}
                            <div className="flex-1 space-y-1.5">
                              <p className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                                <Link2Off className="size-3.5" /> Asignar manualmente
                              </p>
                              {mov.tipo === "CREDITO" ? (
                                <select
                                  value={manualSel?.id ?? ""}
                                  onChange={(e) =>
                                    setManualMap((prev) => ({
                                      ...prev,
                                      [mov.id]: { tipo: "factura", id: e.target.value },
                                    }))
                                  }
                                  className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                  <option value="">— Factura (sin asignar) —</option>
                                  {facturasPendientes.map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.numero} · {f.razon_social.slice(0, 25)} ·{" "}
                                      {formatDate(f.fecha)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <select
                                  value={manualSel?.id ?? ""}
                                  onChange={(e) =>
                                    setManualMap((prev) => ({
                                      ...prev,
                                      [mov.id]: { tipo: "gasto", id: e.target.value },
                                    }))
                                  }
                                  className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                  <option value="">— Gasto empresa (sin asignar) —</option>
                                  {gastos
                                    .filter((g) => !g.deleted_at)
                                    .map((g) => (
                                      <option key={g.id} value={g.id}>
                                        {g.descripcion?.slice(0, 30) ?? "Sin descripción"} ·{" "}
                                        {formatCurrency(Number(g.total))} · {formatDate(g.fecha)}
                                      </option>
                                    ))}
                                </select>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
