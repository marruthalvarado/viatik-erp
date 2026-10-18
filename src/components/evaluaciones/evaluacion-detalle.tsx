/**
 * evaluacion-detalle.tsx
 * Vista de detalle de una evaluación completada — con botón de exportar PDF
 */
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, CheckCircle2, XCircle, Clock, FileText, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { CicloEvaluacion } from "@/types/entities";
import { exportEvaluacionPDF } from "@/services/export/evaluacion-export";
import { useCompany } from "@/contexts/company-context";
import { calcVacuumTight, calcVacuumLeak, calcIonSource, calcIarcBeam } from "@/utils/eval-calcs";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  evaluacion: CicloEvaluacion;
  onBack:     () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function BadgeResultado({ resultado }: { resultado: CicloEvaluacion["resultado_general"] }) {
  if (resultado === "pass")
    return <Badge className="bg-green-100 text-green-800 gap-1 text-sm px-3 py-1">
      <CheckCircle2 className="h-4 w-4" />PASS
    </Badge>;
  if (resultado === "fail")
    return <Badge className="bg-red-100 text-red-800 gap-1 text-sm px-3 py-1">
      <XCircle className="h-4 w-4" />FAIL
    </Badge>;
  return <Badge variant="outline" className="gap-1 text-sm px-3 py-1">
    <Clock className="h-4 w-4" />Pendiente
  </Badge>;
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground w-44 flex-none">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <Separator />
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function EvaluacionDetalle({ evaluacion: ev, onBack }: Props) {
  const [exportando, setExportando] = useState(false);
  const { empresaActiva } = useCompany();
  const site = ev.datos_sitio ?? {};
  const perf = ev.datos_performance ?? {};
  const eval_ = ev.datos_evaluacion ?? {};

  async function handleExportPDF() {
    setExportando(true);
    try {
      await exportEvaluacionPDF(ev, empresaActiva ? {
        empresa: {
          nombre:    empresaActiva.nombre,
          ruc:       empresaActiva.ruc,
          telefono:  empresaActiva.telefono,
          correo:    empresaActiva.correo,
          direccion: empresaActiva.direccion,
          logo_url:  empresaActiva.logo_url,
        },
      } : undefined);
    } catch (err) {
      console.error("Error exportando PDF:", err);
    } finally {
      setExportando(false);
    }
  }

  const tipoMap: Record<string, string> = {
    assessment:      "Assessment",
    upgrade_eval:    "Upgrade Evaluation",
    eosss:           "End of SSS",
    "10yr_refurbish": "10-Year Refurbishment",
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Volver
          </Button>
          <FlaskConical className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">{ev.numero}</h2>
            <p className="text-sm text-muted-foreground">
              {format(new Date(ev.fecha), "d MMMM yyyy", { locale: es })}
              {ev.ingeniero_nombre && ` · Ing. ${ev.ingeniero_nombre}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BadgeResultado resultado={ev.resultado_general} />
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPDF} disabled={exportando}>
            <FileText className="h-4 w-4" />
            {exportando ? "Generando…" : "Exportar PDF"}
          </Button>
        </div>
      </div>

      {/* Info general */}
      <Section title="Información general">
        <Row label="Número de evaluación" value={ev.numero} />
        <Row label="Tipo" value={tipoMap[ev.tipo_evaluacion] ?? ev.tipo_evaluacion} />
        <Row label="Modelo PT" value={ev.modelo_pt} />
        <Row label="Versión software" value={ev.version_sw} />
        <Row label="Modo Deuterón" value={ev.tiene_deuterio ? "Sí (D-mode activo)" : "No"} />
        <Row label="Estado" value={ev.estado} />
      </Section>

      {/* Site Info */}
      {site.sitioNombre && (
        <Section title="Site Info">
          <Row label="Cliente" value={site.clienteNombre} />
          <Row label="Sitio" value={site.sitioNombre} />
          <Row label="Dirección" value={site.sitioAddress} />
          <Row label="System ID" value={site.ciclotrónSystemId} />
          <Row label="Serial #" value={site.ciclotrónSerial} />
          <Row label="PT Release" value={site.ptRelease} />
          <Row label="Licencia" value={site.licenciaUA ? `${site.licenciaUA} µA` : undefined} />
          <Row label="Estado sistema" value={site.estadoSistema} />
        </Section>
      )}

      {/* Performance test — resumen */}
      {(perf.isocronos?.length || perf.rfProton || perf.transmision?.length
        || perf.iarcVsBeam?.length || perf.ionSource || perf.vacuumTightness?.length || perf.vacuumLeak?.length) && (
        <Section title="Performance Test — Resultados">
          {/* Isochronous — formula: PASS si al menos 1 fila tiene ratio < 5% */}
          {perf.isocronos?.map((t, i) => {
            const allFilas = t.filas ?? [];
            const isSkipped = (perf.skippedTests ?? []).includes("isocronos");
            const checked = allFilas.filter(f => f.target && f.target > 0);
            const pass = checked.length > 0 && checked.some(f => {
              const ratio = (((f.collLow ?? 0) + (f.collUp ?? 0)) / 2 / (f.target ?? 1)) * 100;
              return ratio < 5;
            });
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground w-44">Isochronous (pos {i === 0 ? "1–3" : "4–6"})</span>
                {isSkipped
                  ? <Badge variant="outline" className="text-muted-foreground">No realizado</Badge>
                  : checked.length > 0
                  ? <Badge className={pass ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {pass ? "PASS" : "FAIL"}
                    </Badge>
                  : <Badge variant="outline">Sin datos</Badge>}
              </div>
            );
          })}
          {/* RF Performance H⁻ */}
          {perf.rfProton && !(perf.skippedTests ?? []).includes("rfProton") && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground w-44">RF Performance H⁻</span>
              <Badge className={perf.rfProton.phaseAnalysis?.pass
                ? "bg-green-100 text-green-800"
                : perf.rfProton.phaseAnalysis?.pass === false
                ? "bg-red-100 text-red-800"
                : "bg-muted text-muted-foreground"}>
                {perf.rfProton.phaseAnalysis?.pass === true ? "PASS"
                  : perf.rfProton.phaseAnalysis?.pass === false ? "FAIL"
                  : "Pendiente"}
              </Badge>
            </div>
          )}
          {/* RF Performance D⁻ */}
          {ev.tiene_deuterio && perf.rfDeuteron && !(perf.skippedTests ?? []).includes("rfDeuteron") && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground w-44">RF Performance D⁻</span>
              <Badge className={perf.rfDeuteron.phaseAnalysis?.pass
                ? "bg-green-100 text-green-800"
                : perf.rfDeuteron.phaseAnalysis?.pass === false
                ? "bg-red-100 text-red-800"
                : "bg-muted text-muted-foreground"}>
                {perf.rfDeuteron.phaseAnalysis?.pass === true ? "PASS"
                  : perf.rfDeuteron.phaseAnalysis?.pass === false ? "FAIL"
                  : "Pendiente"}
              </Badge>
            </div>
          )}
          {/* Main Voltage Variation */}
          {perf.mainVoltage?.anodeVoltStandby != null && !(perf.skippedTests ?? []).includes("mainVoltage") && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground w-44">Main Voltage Variation</span>
              {(() => {
                const v = perf.mainVoltage!.anodeVoltStandby!;
                const pass = v >= 7.4 && v <= 8.2;
                return <Badge className={pass ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                  {pass ? "PASS" : "FAIL"}
                </Badge>;
              })()}
            </div>
          )}
          {/* IARC vs Beam */}
          {perf.iarcVsBeam && perf.iarcVsBeam.length > 0 && !(perf.skippedTests ?? []).includes("iarcVsBeam") && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground w-44">IARC vs Beam Current</span>
              {(() => {
                const r = calcIarcBeam(perf.iarcVsBeam ?? []);
                return <Badge className={r === true ? "bg-green-100 text-green-800" : r === false ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground"}>
                  {r === true ? "PASS" : r === false ? "FAIL" : "Pendiente"}
                </Badge>;
              })()}
            </div>
          )}
          {/* Ion Source */}
          {perf.ionSource && !(perf.skippedTests ?? []).includes("ionSource") && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground w-44">Ion Source Performance</span>
              {(() => {
                const r = calcIonSource(perf.ionSource?.filas ?? []);
                return <Badge className={r === true ? "bg-green-100 text-green-800" : r === false ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground"}>
                  {r === true ? "PASS" : r === false ? "FAIL" : "Pendiente"}
                </Badge>;
              })()}
            </div>
          )}
          {/* Beam Transmission */}
          {!!perf.transmision?.length && !(perf.skippedTests ?? []).includes("transmision") && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground w-44">Beam Transmission</span>
              {(() => {
                const pass = (perf.transmision ?? []).every(f =>
                  (f.transmissionToTarget == null || f.transmissionToTarget >= 55) &&
                  (f.transmissionToFoil == null || f.transmissionToFoil >= 65)
                );
                return <Badge className={pass ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                  {pass ? "PASS" : "FAIL"}
                </Badge>;
              })()}
            </div>
          )}
          {/* Vacuum Tightness */}
          {perf.vacuumTightness && perf.vacuumTightness.length > 0 && !(perf.skippedTests ?? []).includes("vacuumTight") && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground w-44">Vacuum Tightness</span>
              {(() => {
                const r = calcVacuumTight(perf.vacuumTightness ?? []);
                return <Badge className={r === true ? "bg-green-100 text-green-800" : r === false ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground"}>
                  {r === true ? "PASS" : r === false ? "FAIL" : "Pendiente"}
                </Badge>;
              })()}
            </div>
          )}
          {/* Vacuum Leak Rate */}
          {perf.vacuumLeak && perf.vacuumLeak.length > 0 && !(perf.skippedTests ?? []).includes("vacuumLeak") && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground w-44">Vacuum Leak Rate</span>
              {(() => {
                const r = calcVacuumLeak(perf.vacuumLeak ?? []);
                return <Badge className={r === true ? "bg-green-100 text-green-800" : r === false ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground"}>
                  {r === true ? "PASS" : r === false ? "FAIL" : "Pendiente"}
                </Badge>;
              })()}
            </div>
          )}
        </Section>
      )}

      {/* System Evaluation — resumen producciones */}
      {eval_?.producciones?.length > 0 && (
        <Section title="System Evaluation — Producciones">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded">
              <thead className="bg-muted">
                <tr>
                  {["#", "Fecha", "Site", "Batch", "Target", "Config.", "Screen I High", "Refl.Pow High"].map(h => (
                    <th key={h} className="px-2 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eval_.producciones.map(p => {
                  const screenFail = p.screenCurrentHigh != null && p.screenCurrentHigh > 40;
                  const reflFail   = p.reflectedPowerHigh != null && p.reflectedPowerHigh > 2.0;
                  return (
                    <tr key={p.numero} className="border-t hover:bg-muted/30">
                      <td className="px-2 py-1.5 font-medium">#{p.numero}</td>
                      <td className="px-2 py-1.5">{p.fecha ?? "—"}</td>
                      <td className="px-2 py-1.5">{p.site ?? "—"}</td>
                      <td className="px-2 py-1.5">{p.batch ?? "—"}</td>
                      <td className="px-2 py-1.5">{p.target ?? "—"}</td>
                      <td className="px-2 py-1.5">{p.configuracion ?? "—"}</td>
                      <td className={`px-2 py-1.5 ${screenFail ? "text-red-600 font-medium" : ""}`}>
                        {p.screenCurrentHigh != null ? `${p.screenCurrentHigh} mA` : "—"}
                      </td>
                      <td className={`px-2 py-1.5 ${reflFail ? "text-red-600 font-medium" : ""}`}>
                        {p.reflectedPowerHigh != null ? `${p.reflectedPowerHigh} kW` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Observaciones */}
      {ev.observaciones && (
        <Section title="Observaciones finales">
          <p className="text-sm">{ev.observaciones}</p>
        </Section>
      )}

      {/* Resultado final */}
      <div className={`rounded-lg border-2 p-4 text-center ${
        ev.resultado_general === "pass"
          ? "border-green-300 bg-green-50"
          : ev.resultado_general === "fail"
          ? "border-red-300 bg-red-50"
          : "border-muted"
      }`}>
        <p className="text-sm font-medium mb-2">Resultado General del Assessment</p>
        <BadgeResultado resultado={ev.resultado_general} />
        {ev.resultado_general === "pass" && (
          <p className="text-xs text-green-700 mt-2">
            El ciclotrón cumple con todos los criterios de evaluación
          </p>
        )}
        {ev.resultado_general === "fail" && (
          <p className="text-xs text-red-700 mt-2">
            Uno o más sub-tests no cumplen los criterios. Ver detalles arriba.
          </p>
        )}
      </div>
    </div>
  );
}
