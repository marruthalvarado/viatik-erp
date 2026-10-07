/**
 * costeo-detalle.tsx
 * Panel de detalle de un costeo — muestra el desglose completo tipo Excel.
 */
import { Pencil, X, Package } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Button }    from "@/components/ui/button";
import { Badge }     from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

import type { CosteoConRelaciones, EstadoCosteo } from "@/services/costeos";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

const fmtPct = (n: number) =>
  new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + "%";

const ESTADO_LABELS: Record<EstadoCosteo, string> = {
  borrador:  "Borrador",
  aprobado:  "Aprobado",
  vigente:   "Vigente",
  archivado: "Archivado",
};

interface Props {
  costeo:    CosteoConRelaciones;
  onClose:   () => void;
  onEditar:  () => void;
}

export function CosteoDetalle({ costeo, onClose, onEditar }: Props) {
  const margen = costeo.pvp_privado > 0
    ? ((costeo.pvp_privado - costeo.costo_total_usd) / costeo.pvp_privado * 100)
    : 0;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle className="font-mono">{costeo.numero}</SheetTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{costeo.descripcion_producto}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{ESTADO_LABELS[costeo.estado as EstadoCosteo]}</Badge>
                {costeo.proyecto && (
                  <Badge variant="secondary" className="text-xs">
                    <Package className="size-3 mr-1" />
                    {costeo.proyecto.codigo}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(costeo.created_at), "dd MMM yyyy", { locale: es })}
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={onEditar}>
                <Pencil className="size-4 mr-2" />
                Editar
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="py-4 space-y-6">
          {/* Info básica */}
          <Section title="Información general">
            <InfoRow label="Proveedor"  value={costeo.proveedor?.nombre ?? "–"} />
            <InfoRow label="Moneda"     value={costeo.moneda_proveedor} />
            <InfoRow label="Precio FOB" value={`${fmt(costeo.precio_fob)} ${costeo.moneda_proveedor}`} />
            {costeo.moneda_proveedor === "EUR" && (
              <InfoRow label="Tipo cambio EUR→USD" value={costeo.tipo_cambio_eur.toFixed(4)} />
            )}
            <InfoRow label="FOB en USD"  value={fmt(costeo.precio_fob_usd)} bold />
            {costeo.codigo_nandina && (
              <InfoRow label="Partida NANDINA" value={costeo.codigo_nandina} />
            )}
          </Section>

          {/* Componentes */}
          {(costeo.componentes ?? []).length > 0 && (
            <Section title="Componentes adicionales">
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium">Descripción</th>
                      <th className="text-right px-3 py-2 text-xs font-medium">Precio</th>
                      <th className="text-right px-3 py-2 text-xs font-medium">Cant.</th>
                      <th className="text-right px-3 py-2 text-xs font-medium">Total USD</th>
                      <th className="text-center px-3 py-2 text-xs font-medium">FOB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costeo.componentes.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="px-3 py-2">
                          <div>{c.descripcion}</div>
                          {(c.fabricante || c.modelo) && (
                            <div className="text-xs text-muted-foreground">
                              {[c.fabricante, c.modelo].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          {fmt(c.precio_unitario)} {c.moneda}
                        </td>
                        <td className="px-3 py-2 text-right">{c.cantidad}</td>
                        <td className="px-3 py-2 text-right font-mono font-medium">{fmt(c.subtotal_usd)}</td>
                        <td className="px-3 py-2 text-center">
                          {c.incluir_en_fob ? "✓" : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30">
                    <tr className="border-t">
                      <td colSpan={3} className="px-3 py-2 text-xs font-medium">Total componentes</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(costeo.total_componentes_usd)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Section>
          )}

          {/* Resumen de cálculo — el "Excel" */}
          <Section title="Cálculo de costo aterrizaje">
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <CalcRow label="FOB base (producto)" value={costeo.precio_fob_usd} />
                  {costeo.total_componentes_usd > 0 && (
                    <CalcRow label="+ Componentes adicionales" value={costeo.total_componentes_usd} />
                  )}
                  <CalcRow label="= FOB Total" value={costeo.fob_total_usd} bold />
                  <CalcRow label="+ Flete" value={costeo.flete_estimado} />
                  <CalcRow label="+ Seguro" value={costeo.seguro_estimado} />
                  <CalcRow label="= CIF" value={costeo.cif_usd} bold />
                  <CalcRow label={`+ FODINFA (${fmtPct(costeo.fodinfa_pct)})`} value={costeo.fodinfa_usd} />
                  <CalcRow label={`+ Arancel (${fmtPct(costeo.arancel_pct)})`} value={costeo.arancel_usd} />
                  <CalcRow label={`+ ISD (${fmtPct(costeo.isd_pct)} sobre FOB)`} value={costeo.isd_usd} />
                  <CalcRow label={`+ IVA Importación (${fmtPct(costeo.iva_importacion_pct)})`} value={costeo.iva_importacion_usd} />
                  <CalcRow label="+ Agente de aduanas" value={costeo.agente_aduanas_est} />
                  <CalcRow label="+ Bodega" value={costeo.bodega_est} />
                  <CalcRow label="+ Otros logística" value={costeo.otros_logistica} />
                  <CalcRow label="= COSTO DE ATERRIZAJE" value={costeo.costo_aterrizaje_usd} bold highlight />
                </tbody>
              </table>
            </div>
          </Section>

          {/* Servicios y reservas */}
          <Section title="Servicios propios y reservas de posventa">
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <CalcRow label="Costo aterrizaje"         value={costeo.costo_aterrizaje_usd} />
                  <CalcRow label="+ Instalación"            value={costeo.instalacion} />
                  <CalcRow label="+ Entrenamiento"          value={costeo.entrenamiento} />
                  <CalcRow label="+ Gastos admin. fábrica"  value={costeo.gastos_admin_fabrica} />
                  <CalcRow label="+ Fee agente comercial"   value={costeo.fee_agente_comercial} />
                  <CalcRow label="+ Reserva garantía"       value={costeo.garantia_reserva} />
                  <CalcRow label="+ Reserva mantenimiento"  value={costeo.mantenimiento_preventivo_res} />
                  <CalcRow label="= COSTO TOTAL"            value={costeo.costo_total_usd} bold highlight />
                </tbody>
              </table>
            </div>
          </Section>

          {/* PVP */}
          <Section title="Precio de venta">
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <CalcRow label="Costo total"                                      value={costeo.costo_total_usd} />
                  <CalcRow label={`+ Comisión de venta (${fmtPct(costeo.comision_venta_pct)})`} value={costeo.comision_venta_usd} />
                  <CalcRow label={`Margen empresa (${fmtPct(costeo.margen_empresa_pct)} sobre PVP)`} value={0} />
                  <CalcRow label="PVP Privado"   value={costeo.pvp_privado}  bold highlight />
                  <CalcRow label="PVP General"   value={costeo.pvp_general}  bold />
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-4 justify-end">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Margen real sobre PVP</p>
                <p className="text-xl font-bold font-mono text-green-600">{fmtPct(margen)}</p>
              </div>
            </div>
          </Section>

          {/* Notas */}
          {costeo.notas && (
            <Section title="Notas">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{costeo.notas}</p>
            </Section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      {children}
      <Separator className="mt-6" />
    </div>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold font-mono" : "font-mono"}>{value}</span>
    </div>
  );
}

function CalcRow({ label, value, bold, highlight }: {
  label:      string;
  value:      number;
  bold?:      boolean;
  highlight?: boolean;
}) {
  const base = bold ? "font-semibold" : "font-normal";
  const bg   = highlight ? "bg-primary/5" : "";
  const color = highlight ? "text-primary" : "";
  return (
    <tr className={`border-t first:border-t-0 ${bg}`}>
      <td className={`px-3 py-2 ${base}`}>{label}</td>
      <td className={`px-3 py-2 text-right font-mono ${base} ${color}`}>
        {value !== 0 || highlight || bold
          ? new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value)
          : <span className="text-muted-foreground text-xs">–</span>}
      </td>
    </tr>
  );
}
