/**
 * step4-system-evaluation.tsx
 * Paso 4: System Evaluation — 10 producciones dual beam con datos del Beam Evaluator Tool
 */
import { useState } from "react";
import { ChevronLeft, CheckCircle2, Info, ChevronDown, ChevronUp, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { CicloEvaluacion, ProduccionDualBeam } from "@/types/entities";
import { useGuardarDatosEvaluacion, useCompletarEvaluacion } from "@/hooks/entities/use-evaluaciones";
import { calcularResultados } from "@/utils/eval-calcs";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  evaluacion: CicloEvaluacion;
  onNext:     (ev: CicloEvaluacion) => void;
  onBack:     () => void;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

function defaultProduccion(numero: number): ProduccionDualBeam {
  return {
    numero,
    site: undefined, batch: undefined, target: undefined,
    fecha: undefined, configuracion: undefined,
  };
}

// ── Campos del Beam Evaluator Tool ────────────────────────────────────────────

interface FieldDef { key: keyof ProduccionDualBeam; label: string; unit: string; group: string }

const FIELDS: FieldDef[] = [
  // General
  { key: "anodeCurrentHigh",        label: "Anode Current High",        unit: "A",   group: "Ion Source" },
  { key: "anodeCurrentLimitEvents", label: "Anode Current Limit Events", unit: "#",  group: "Ion Source" },
  { key: "anodeVoltageAvg",         label: "Anode Voltage Avg",         unit: "kV",  group: "Ion Source" },
  { key: "isAvg",                   label: "IS Current Avg",            unit: "mA",  group: "Ion Source" },
  { key: "isMax",                   label: "IS Current Max",            unit: "mA",  group: "Ion Source" },
  { key: "isVariation",             label: "IS Current Variation",      unit: "mA",  group: "Ion Source" },
  // RF / Dee
  { key: "dee1Avg",                 label: "Dee1 Voltage Avg",          unit: "kV",  group: "RF" },
  { key: "dee1Variation",           label: "Dee1 Voltage Variation",    unit: "kV",  group: "RF" },
  { key: "dee2Avg",                 label: "Dee2 Voltage Avg",          unit: "kV",  group: "RF" },
  { key: "dee2Variation",           label: "Dee2 Voltage Variation",    unit: "kV",  group: "RF" },
  { key: "flap1Avg",                label: "Flap1 Avg",                 unit: "°",   group: "RF" },
  { key: "flap1Min",                label: "Flap1 Min",                 unit: "°",   group: "RF" },
  { key: "flap1Max",                label: "Flap1 Max",                 unit: "°",   group: "RF" },
  { key: "flap1Variation",          label: "Flap1 Variation",           unit: "°",   group: "RF" },
  { key: "flap2Avg",                label: "Flap2 Avg",                 unit: "°",   group: "RF" },
  { key: "flap2Min",                label: "Flap2 Min",                 unit: "°",   group: "RF" },
  { key: "flap2Max",                label: "Flap2 Max",                 unit: "°",   group: "RF" },
  { key: "flap2Variation",          label: "Flap2 Variation",           unit: "°",   group: "RF" },
  { key: "reflectedPowerHigh",      label: "Reflected Power High",      unit: "kW",  group: "RF" },
  { key: "reflectedVoltLimitEvents",label: "Refl.Volt Limit Events",    unit: "#",   group: "RF" },
  { key: "rfApparentPowerAvg",      label: "RF Apparent Power Avg",     unit: "kW",  group: "RF" },
  { key: "dpaFwdVoltHigh",          label: "DPA FWD Voltage High",      unit: "V",   group: "RF" },
  { key: "phaseErrorVariation",     label: "Phase Error Variation",     unit: "°",   group: "RF" },
  { key: "phaseLoadMax",            label: "Phase Load Max",            unit: "°",   group: "RF" },
  { key: "phaseLoadMin",            label: "Phase Load Min",            unit: "°",   group: "RF" },
  // Beam / Extraction
  { key: "balanceAvg",              label: "Balance Avg",               unit: "%",   group: "Beam" },
  { key: "balanceMin",              label: "Balance Min",               unit: "%",   group: "Beam" },
  { key: "balanceMax",              label: "Balance Max",               unit: "%",   group: "Beam" },
  { key: "balanceVariation",        label: "Balance Variation",         unit: "%",   group: "Beam" },
  { key: "probeCurAvg",             label: "Probe Current Avg",         unit: "µA",  group: "Beam" },
  { key: "residualBeamHigh",        label: "Residual Beam High",        unit: "µA",  group: "Beam" },
  { key: "screenCurrentHigh",       label: "Screen Current High",       unit: "mA",  group: "Beam" },
  // Magnet
  { key: "magnetWorkingPointAvg",   label: "Magnet Working Point Avg",  unit: "A",   group: "Magnet" },
  { key: "magnetWorkingDiffAvg",    label: "Magnet Working Diff Avg",   unit: "A",   group: "Magnet" },
  // Vacuum / Gas
  { key: "gasFlowAvg",              label: "Gas Flow Avg",              unit: "sccm", group: "Vacuum" },
  { key: "gasFlowVariance",         label: "Gas Flow Variance",         unit: "sccm", group: "Vacuum" },
  { key: "vacuumAvg",               label: "Vacuum Avg",                unit: "mbar", group: "Vacuum" },
  { key: "vacuumVariation",         label: "Vacuum Variation",          unit: "mbar", group: "Vacuum" },
] satisfies FieldDef[];

const GROUPS = Array.from(new Set(FIELDS.map(f => f.group)));

// ── Componente principal ──────────────────────────────────────────────────────

export function Step4SystemEvaluation({ evaluacion, onNext, onBack }: Props) {
  const guardar   = useGuardarDatosEvaluacion();
  const completar = useCompletarEvaluacion();

  const initialProducciones: ProduccionDualBeam[] = evaluacion.datos_evaluacion?.producciones?.length
    ? evaluacion.datos_evaluacion.producciones
    : Array.from({ length: 10 }, (_, i) => defaultProduccion(i + 1));

  const [skipped, setSkipped]           = useState<boolean>(evaluacion.datos_evaluacion?.skipped ?? false);
  const [producciones, setProducciones] = useState<ProduccionDualBeam[]>(initialProducciones);
  const [activeProd, setActiveProd]     = useState<number>(1);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(GROUPS.map(g => [g, true]))
  );

  const prod = producciones.find(p => p.numero === activeProd) ?? defaultProduccion(activeProd);

  function updateProd(patch: Partial<ProduccionDualBeam>) {
    setProducciones(ps => ps.map(p => p.numero === activeProd ? { ...p, ...patch } : p));
  }

  function updateField(key: keyof ProduccionDualBeam, val: string) {
    const num = parseFloat(val);
    updateProd({ [key]: val === "" ? undefined : isNaN(num) ? val : num });
  }

  // Comprobar si una producción tiene al menos un dato
  function hasDatos(p: ProduccionDualBeam) {
    return FIELDS.some(f => p[f.key] != null);
  }

  const produccionesConDatos = producciones.filter(hasDatos).length;

  async function handleGuardar(andComplete = false) {
    const ev = await guardar.mutateAsync({
      evalId: evaluacion.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      producciones: producciones as any,
      skipped,
    });

    if (andComplete) {
      const resultado = calcResultadoCombinado(
        evaluacion.datos_performance ?? {},
        evaluacion.tiene_deuterio,
        producciones,
        skipped
      );
      const finalEv = await completar.mutateAsync({
        evalId: ev.id,
        resultado,
        observaciones: undefined,
      });
      onNext(finalEv);
    } else {
      onNext(ev);
    }
  }

  function calcResultadoCombinado(
    datosPerf: CicloEvaluacion["datos_performance"],
    tieneDeuterio: boolean,
    ps: ProduccionDualBeam[],
    step4Skipped: boolean
  ): "pass" | "fail" {
    // Step 3 — todos los sub-tests con datos deben ser true
    const r3 = calcularResultados(datosPerf ?? {}, tieneDeuterio);
    const step3Values = Object.values(r3).filter(v => v !== null) as boolean[];
    const step3Pass   = step3Values.length === 0 || step3Values.every(v => v === true);

    // Step 4 — solo si no está marcado como "No realizado"
    let step4Pass = true;
    if (!step4Skipped) {
      const withData = ps.filter(hasDatos);
      step4Pass = !withData.some(p =>
        (p.screenCurrentHigh != null && p.screenCurrentHigh > 40) ||
        (p.reflectedPowerHigh != null && p.reflectedPowerHigh > 2.0)
      );
    }

    return step3Pass && step4Pass ? "pass" : "fail";
  }

  return (
    <div className="space-y-4">
      {/* Toggle "No realizado" a nivel de todo el paso 4 */}
      <div className={cn(
        "flex items-center justify-between rounded-lg border p-4 transition-colors",
        skipped ? "border-amber-300 bg-amber-50" : "border-muted"
      )}>
        <div className="flex items-center gap-3">
          <SkipForward className={cn("h-5 w-5", skipped ? "text-amber-600" : "text-muted-foreground")} />
          <div>
            <p className="font-medium text-sm">System Evaluation — No realizado</p>
            <p className="text-xs text-muted-foreground">
              Activa si no se realizó la evaluación de producciones. Se excluirá del resultado final.
            </p>
          </div>
        </div>
        <Switch checked={skipped} onCheckedChange={setSkipped} />
      </div>

      {skipped ? (
        /* Placeholder cuando está marcado como "No realizado" */
        <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 p-8 text-center space-y-2">
          <SkipForward className="h-8 w-8 text-amber-400 mx-auto" />
          <p className="font-medium text-amber-800">System Evaluation no realizada</p>
          <p className="text-sm text-amber-700">
            Este paso está marcado como "No realizado" y no afectará el resultado final.
            El PASS/FAIL se determinará únicamente con los resultados del Performance Test (Paso 3).
          </p>
        </div>
      ) : (
        <>
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 flex gap-2 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 flex-none" />
        <span>
          Registrar datos del <strong>Beam Evaluator Tool</strong> para cada producción dual beam.
          El informe final consolidará todas las producciones.
        </span>
      </div>

      {/* Selector de producción */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Producción</p>
        <div className="flex flex-wrap gap-1.5">
          {producciones.map(p => (
            <button
              key={p.numero}
              onClick={() => setActiveProd(p.numero)}
              className={cn(
                "w-10 h-10 rounded-lg text-sm font-semibold border-2 transition-colors",
                activeProd === p.numero
                  ? "border-primary bg-primary text-primary-foreground"
                  : hasDatos(p)
                  ? "border-green-400 bg-green-50 text-green-800"
                  : "border-muted-foreground/20 hover:bg-muted"
              )}
            >
              {p.numero}
            </button>
          ))}
        </div>
      </div>

      {/* Info básica de la producción */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold">Producción #{prod.numero} — Información general</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: "fecha",         label: "Fecha",          type: "date" },
            { key: "site",          label: "Site",           type: "text" },
            { key: "batch",         label: "Batch #",        type: "text" },
            { key: "target",        label: "Target",         type: "text" },
            { key: "configuracion", label: "Configuración",  type: "text" },
          ].map(({ key, label, type }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                type={type}
                value={(prod as Record<string, unknown>)[key] as string ?? ""}
                onChange={e => updateProd({ [key]: e.target.value || undefined })}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Campos del Beam Evaluator Tool por grupo */}
      {GROUPS.map(group => {
        const groupFields = FIELDS.filter(f => f.group === group);
        const isExpanded  = expandedGroups[group] ?? true;
        return (
          <div key={group} className="border rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted transition-colors"
              onClick={() => setExpandedGroups(prev => ({ ...prev, [group]: !isExpanded }))}
            >
              <span className="text-sm font-semibold">{group}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {groupFields.filter(f => prod[f.key] != null).length}/{groupFields.length}
                </Badge>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>

            {isExpanded && (
              <div className="grid grid-cols-3 gap-3 p-4">
                {groupFields.map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label}</Label>
                    <div className="flex gap-1 items-center">
                      <Input
                        type="number" step="any"
                        value={(prod[f.key] as number | undefined) ?? ""}
                        onChange={e => updateField(f.key, e.target.value)}
                        className="h-8 text-xs"
                      />
                      <span className="text-xs text-muted-foreground w-10 flex-none">{f.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Resumen */}
      <div className="border rounded-lg p-3 bg-muted/30">
        <p className="text-xs font-semibold mb-2">Resumen — producciones con datos</p>
        <div className="flex flex-wrap gap-1.5">
          {producciones.map(p => (
            <div key={p.numero} className={cn(
              "px-2 py-1 rounded text-xs font-medium",
              hasDatos(p) ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"
            )}>
              #{p.numero} {hasDatos(p) ? "✓" : "—"}
            </div>
          ))}
        </div>
      </div>
        </>
      )}

      {/* Navegación */}
      <div className="flex justify-between pt-4 border-t">
        <Button type="button" variant="outline" onClick={onBack} className="gap-1">
          <ChevronLeft className="h-4 w-4" />
          Atrás
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleGuardar(false)}
            disabled={guardar.isPending || completar.isPending}
          >
            Guardar borrador
          </Button>
          <Button
            onClick={() => handleGuardar(true)}
            disabled={guardar.isPending || completar.isPending || (!skipped && produccionesConDatos === 0)}
            title={!skipped && produccionesConDatos === 0 ? "Ingresa datos en al menos una producción, o marca el paso como 'No realizado'" : undefined}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {guardar.isPending || completar.isPending ? "Guardando…" : "Completar Evaluación"}
          </Button>
        </div>
      </div>
    </div>
  );
}
