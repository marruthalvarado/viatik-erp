/**
 * step3-performance-test.tsx
 * Paso 3: System Performance Test — Hoja 6 del DOC1604037 rev9
 * 9 sub-tests con instrucciones y PASS/FAIL automático
 */
import { useState, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  Clock, Info, TrendingUp, Zap, Gauge, Wind,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { CicloEvaluacion, DatosPerformance, FilaIsocrona } from "@/types/entities";
import { useGuardarDatosPerformance } from "@/hooks/entities/use-evaluaciones";
import { calcularResultados } from "@/utils/eval-calcs";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  evaluacion: CicloEvaluacion;
  onNext:     (ev: CicloEvaluacion) => void;
  onBack:     () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function PassBadge({ pass }: { pass: boolean | null | undefined }) {
  if (pass === true)  return <Badge className="bg-green-100 text-green-800 gap-1 text-xs"><CheckCircle2 className="h-3 w-3" />PASS</Badge>;
  if (pass === false) return <Badge className="bg-red-100 text-red-800 gap-1 text-xs"><XCircle className="h-3 w-3" />FAIL</Badge>;
  return <Badge variant="outline" className="gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />Pendiente</Badge>;
}

function InstruccionesCaja({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-1 mb-4">
      <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Instrucciones</p>
      {lines.map((l, i) => (
        <p key={i} className="text-xs text-blue-700">{i + 1}. {l}</p>
      ))}
    </div>
  );
}

// ── Sub-test IDs ──────────────────────────────────────────────────────────────

const SUBTESTS = [
  { id: "isocronos",      label: "Isochronous",         icon: TrendingUp },
  { id: "rfProton",       label: "RF Perf (H⁻)",        icon: Zap },
  { id: "rfDeuteron",     label: "RF Perf (D-mode)",    icon: Zap, dOnly: true },
  { id: "mainVoltage",    label: "Main Voltage Var.",   icon: Gauge },
  { id: "iarcVsBeam",     label: "I-arc vs Beam",       icon: TrendingUp },
  { id: "ionSource",      label: "Ion Source Perf.",    icon: Zap },
  { id: "transmision",    label: "Beam Transmission",   icon: TrendingUp },
  { id: "vacuumTight",    label: "Vacuum Tightness",    icon: Wind },
  { id: "vacuumLeak",     label: "Vacuum Leak Rate",    icon: Wind },
] as const;

type SubtestId = typeof SUBTESTS[number]["id"];

// ── Componente principal ──────────────────────────────────────────────────────

export function Step3PerformanceTest({ evaluacion, onNext, onBack }: Props) {
  const guardar = useGuardarDatosPerformance();
  const [activeTab, setActiveTab] = useState<SubtestId>("isocronos");
  const [datos, setDatos] = useState<DatosPerformance>(
    evaluacion.datos_performance ?? {
      isocronos: [],
      rfProton: undefined,
      rfDeuteron: undefined,
      mainVoltage: undefined,
      iarcVsBeam: [],
      ionSource: undefined,
      transmision: [],
      vacuumTightness: [],
      vacuumLeak: [],
    }
  );

  // Resultado por sub-test (calculado)
  const resultados = useMemo(() => calcularResultados(datos, evaluacion.tiene_deuterio), [datos, evaluacion.tiene_deuterio]);
  const resultadoGeneral = Object.values(resultados).every(r => r === true) ? "pass"
    : Object.values(resultados).some(r => r === false) ? "fail" : null;

  async function handleGuardar() {
    const ev = await guardar.mutateAsync({ evalId: evaluacion.id, datos });
    onNext(ev);
  }

  const visibleSubtests = SUBTESTS.filter(s => !s.dOnly || evaluacion.tiene_deuterio);

  return (
    <div className="flex gap-6">
      {/* ── Sidebar de sub-tests ─────────────────────────── */}
      <div className="w-52 flex-none space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sub-tests</p>
        {visibleSubtests.map(st => {
          const r = resultados[st.id as keyof typeof resultados];
          const isSkipped = (st.id === "rfProton" && datos.rfProton?.skipped)
            || (st.id === "rfDeuteron" && datos.rfDeuteron?.skipped);
          return (
            <button
              key={st.id}
              onClick={() => setActiveTab(st.id as SubtestId)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between gap-1",
                activeTab === st.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              <span className="truncate">{st.label}</span>
              <span className="flex-none">
                {isSkipped
                  ? <span className="text-[10px] text-muted-foreground font-medium opacity-70">—</span>
                  : r === true ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  : r === false ? <XCircle className="h-3.5 w-3.5 text-red-400" />
                  : <Clock className="h-3.5 w-3.5 opacity-40" />}
              </span>
            </button>
          );
        })}

        <Separator className="my-2" />
        <div className="text-xs text-center">
          <p className="font-medium text-muted-foreground">Resultado</p>
          {resultadoGeneral === "pass" && <Badge className="bg-green-100 text-green-800 mt-1">PASS</Badge>}
          {resultadoGeneral === "fail" && <Badge className="bg-red-100 text-red-800 mt-1">FAIL</Badge>}
          {!resultadoGeneral && <Badge variant="outline" className="mt-1 text-xs">Pendiente</Badge>}
        </div>
      </div>

      {/* ── Panel principal ──────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {activeTab === "isocronos"   && <TestIsocronosPanel datos={datos} onChange={setDatos} />}
        {activeTab === "rfProton"    && <TestRFPanel datos={datos} onChange={setDatos} modo="H" modeloPt={evaluacion.modelo_pt ?? ""} />}
        {activeTab === "rfDeuteron"  && <TestRFPanel datos={datos} onChange={setDatos} modo="D" modeloPt={evaluacion.modelo_pt ?? ""} />}
        {activeTab === "mainVoltage" && <TestMainVoltage datos={datos} onChange={setDatos} />}
        {activeTab === "iarcVsBeam"  && <TestIarcBeam datos={datos} onChange={setDatos} />}
        {activeTab === "ionSource"   && <TestIonSource datos={datos} onChange={setDatos} />}
        {activeTab === "transmision" && <TestTransmision datos={datos} onChange={setDatos} />}
        {activeTab === "vacuumTight" && <TestVacuumTight datos={datos} onChange={setDatos} />}
        {activeTab === "vacuumLeak"  && <TestVacuumLeak datos={datos} onChange={setDatos} />}

        {/* Navegación */}
        <div className="flex justify-between pt-6 mt-4 border-t">
          <Button type="button" variant="outline" onClick={onBack} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Atrás
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGuardar} disabled={guardar.isPending}>
              Guardar borrador
            </Button>
            <Button onClick={handleGuardar} disabled={guardar.isPending} className="gap-2">
              {guardar.isPending ? "Guardando…" : "Siguiente"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Sub-test panels
// ══════════════════════════════════════════════════════════════════════════════

// ── 1. Isochronous test ───────────────────────────────────────────────────────

function buildDefaultFilas(magnetStart = 100, n = 10): FilaIsocrona[] {
  return Array.from({ length: n }, (_, i) => ({
    magnet: Math.round((magnetStart + i * 0.2) * 100) / 100,
    foil: null, collLow: null, target: null, collUp: null,
  }));
}

function TestIsocronosPanel({ datos, onChange }: { datos: DatosPerformance; onChange: (d: DatosPerformance) => void }) {
  const [grupo, setGrupo] = useState(0); // 0=pos1-3, 1=pos4-6

  const defaultTest = (g: number) => ({
    posicion: g === 0 ? 1 : 4,
    magnetStart: 100, magnetStep: 0.2,
    deeVoltage: 38, deltaVoltage: 4.5,
    vacuumPressure: null, gasFlow: null, isCurrentMA: null,
    probeCurrentStart: null, probeCurrentEnd: null,
    filas: buildDefaultFilas(100, 10),
  });

  const test = datos.isocronos?.[grupo] ?? defaultTest(grupo);

  function updateTest(patch: Partial<typeof test>) {
    let updated = { ...test, ...patch };
    if ("magnetStart" in patch || "magnetStep" in patch) {
      const start = updated.magnetStart ?? 100;
      const step  = updated.magnetStep  ?? 0.2;
      updated.filas = (updated.filas ?? []).map((f, i) => ({
        ...f,
        magnet: Math.round((start + i * step) * 100) / 100,
      }));
    }
    const arr = [...(datos.isocronos ?? [defaultTest(0), defaultTest(1)])];
    arr[grupo] = updated;
    onChange({ ...datos, isocronos: arr as DatosPerformance["isocronos"] });
  }

  function updateFila(idx: number, key: keyof FilaIsocrona, val: string) {
    const filas = [...(test.filas ?? [])];
    filas[idx] = { ...filas[idx], [key]: val === "" ? null : Number(val) };
    updateTest({ filas });
  }

  function addFila() {
    const filas = [...(test.filas ?? [])];
    const lastMagnet = filas.length > 0 ? (filas[filas.length - 1].magnet ?? 0) : (test.magnetStart ?? 100);
    const step = test.magnetStep ?? 0.2;
    filas.push({ magnet: Math.round((lastMagnet + step) * 100) / 100, foil: null, collLow: null, target: null, collUp: null });
    updateTest({ filas });
  }

  function removeFila() {
    const filas = [...(test.filas ?? [])];
    if (filas.length > 1) {
      filas.pop();
      updateTest({ filas });
    }
  }

  // Gráfico
  const chartData = (test.filas ?? []).map(f => ({
    magnet: f.magnet,
    Foil:   f.foil,
    "Coll-Low": f.collLow,
    Target: f.target,
    "Coll-Up": f.collUp,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">1. Isochronous Test</h3>
        <div className="flex rounded-md overflow-hidden border">
          <button onClick={() => setGrupo(0)}
            className={cn("px-3 py-1 text-sm", grupo === 0 ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
            Pos 1–3
          </button>
          <button onClick={() => setGrupo(1)}
            className={cn("px-3 py-1 text-sm border-l", grupo === 1 ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
            Pos 4–6
          </button>
        </div>
      </div>

      <InstruccionesCaja lines={[
        "Con el haz activo en la posición seleccionada, variar la corriente del magneto en pasos de 0.2 A.",
        "Para cada paso registrar: corriente Foil, Coll-Low, Target y Coll-Up en µA.",
        "Calcular ratio = (Coll-Low + Coll-Up) / 2 / Target × 100%. Límite: < 5%.",
        "Graficar todas las corrientes vs corriente de magneto para identificar el punto isocrono.",
      ]} />

      {/* Condiciones iniciales */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { key: "posicion",        label: "Target position",   step: "1" },
          { key: "magnetStart",     label: "Magneto inicio (A)", step: "0.1" },
          { key: "deeVoltage",      label: "Dee Volt (kV)",     step: "0.1" },
          { key: "deltaVoltage",    label: "ΔVoltage (kV)",     step: "0.1" },
          { key: "vacuumPressure",  label: "Vacío (mbar)",      step: "0.0000001" },
          { key: "gasFlow",         label: "Gas flow (sccm)",   step: "0.1" },
          { key: "isCurrentMA",     label: "IS current (mA)",   step: "1" },
          { key: "probeCurrentStart", label: "Probe I start (µA)", step: "0.1" },
          { key: "probeCurrentEnd",   label: "Probe I end (µA)",   step: "0.1" },
        ].map(({ key, label, step }) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Input
              type="number" step={step}
              value={(test as Record<string, unknown>)[key] as string ?? ""}
              onChange={e => updateTest({ [key]: e.target.value === "" ? null : Number(e.target.value) } as Partial<typeof test>)}
            />
          </div>
        ))}
      </div>

      {/* Tabla de filas */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded">
          <thead className="bg-muted">
            <tr>
              {["Magneto (A)", "Foil (µA)", "Coll-Low (µA)", "Target (µA)", "Coll-Up (µA)", "∑Coll", "Ratio %", "Pass"].map(h => (
                <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(test.filas ?? buildDefaultFilas(test.magnetStart ?? 100, 10)).map((f, i) => {
              const sumColl = (f.collLow ?? 0) + (f.collUp ?? 0);
              // Ratio = promedio Coll / Target × 100  (igual que Excel)
              const ratio = f.target ? (sumColl / 2 / f.target) * 100 : null;
              const pass = ratio != null ? ratio < 5 : null;
              return (
                <tr key={i} className="border-t hover:bg-muted/30">
                  <td className="px-2 py-1">
                    <Input type="number" step="0.2" className="h-6 w-20 text-xs px-1"
                      value={f.magnet ?? ""} onChange={e => updateFila(i, "magnet", e.target.value)} />
                  </td>
                  {(["foil", "collLow", "target", "collUp"] as const).map(k => (
                    <td key={k} className="px-2 py-1">
                      <Input type="number" step="0.1" className="h-6 w-20 text-xs px-1"
                        value={f[k] ?? ""} onChange={e => updateFila(i, k, e.target.value)} />
                    </td>
                  ))}
                  <td className="px-2 py-1 text-muted-foreground">{sumColl > 0 ? sumColl.toFixed(2) : "—"}</td>
                  <td className="px-2 py-1 text-muted-foreground">{ratio != null ? ratio.toFixed(1) + "%" : "—"}</td>
                  <td className="px-2 py-1"><PassBadge pass={pass} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Botones filas */}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addFila} className="text-xs gap-1">
          + Añadir fila
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={removeFila} className="text-xs text-red-500 hover:text-red-700"
          disabled={(test.filas?.length ?? 0) <= 1}>
          − Quitar última
        </Button>
      </div>

      {/* Gráfico */}
      {chartData.some(d => d.Target) && (
        <div>
          <p className="text-xs font-medium mb-1 text-muted-foreground">Gráfico isocrono</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="magnet" label={{ value: "I-Magnet (A)", position: "insideBottom", offset: -2 }} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              {["Foil","Coll-Low","Target","Coll-Up"].map((name, idx) => (
                <Line key={name} type="monotone" dataKey={name} dot={false}
                  stroke={["#3b82f6","#f59e0b","#22c55e","#ef4444"][idx]} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── 2 & 3. RF Performance ─────────────────────────────────────────────────────

function getRFLimits(modeloPt: string) {
  // Límites según modelo (DOC1604037 rev9, hoja RF Performance)
  if (modeloPt.toUpperCase().includes("880")) {
    return { reflectedPowerP95: 1.0, anodeCurrentP95: 3.0, screenCurrentP95: 120, dpaFwdVoltageP95: 110 };
  }
  if (modeloPt.toUpperCase().includes("860")) {
    return { reflectedPowerP95: 1.0, anodeCurrentP95: 2.8, screenCurrentP95: 120, dpaFwdVoltageP95: 100 };
  }
  // Default conservador (PT860)
  return { reflectedPowerP95: 1.0, anodeCurrentP95: 2.8, screenCurrentP95: 120, dpaFwdVoltageP95: 100 };
}

function TestRFPanel({ datos, onChange, modo, modeloPt }: {
  datos: DatosPerformance;
  onChange: (d: DatosPerformance) => void;
  modo: "H" | "D";
  modeloPt: string;
}) {
  const key = modo === "H" ? "rfProton" : "rfDeuteron";
  const rf = datos[key] ?? { modo, phaseAnalysis: {} };
  const pa = rf.phaseAnalysis ?? {};

  function updatePA(patch: Partial<typeof pa>) {
    const updated = { ...rf, phaseAnalysis: { ...pa, ...patch } };
    onChange({ ...datos, [key]: updated });
  }

  // Criterios Pass según modelo (DOC1604037 rev9)
  const limits = getRFLimits(modeloPt);

  const passReflPow = pa.reflectedPowerP95 != null ? pa.reflectedPowerP95 <= limits.reflectedPowerP95 : null;
  const passAnode   = pa.anodeCurrentP95   != null ? pa.anodeCurrentP95   <= limits.anodeCurrentP95   : null;
  const passScreen  = pa.screenCurrentP95  != null ? pa.screenCurrentP95  <= limits.screenCurrentP95  : null;
  const passDPA     = pa.dpaFwdVoltageP95  != null ? pa.dpaFwdVoltageP95  <= limits.dpaFwdVoltageP95  : null;
  const passAll = [passReflPow, passAnode, passScreen, passDPA].every(v => v !== false)
    && [passReflPow, passAnode, passScreen, passDPA].some(v => v === true)
    ? true
    : [passReflPow, passAnode, passScreen, passDPA].some(v => v === false) ? false : null;

  // Sync back overall pass
  if (passAll !== pa.pass) {
    setTimeout(() => updatePA({ pass: passAll }), 0);
  }

  const fields = [
    { key: "reflectedPowerP95", label: "Reflected Power P95 (kW)", limit: `≤ ${limits.reflectedPowerP95}`, pass: passReflPow },
    { key: "anodeCurrentP95",   label: "Anode Current P95 (A)",    limit: `≤ ${limits.anodeCurrentP95}`,   pass: passAnode   },
    { key: "screenCurrentP95",  label: "Screen Current P95 (mA)",  limit: `≤ ${limits.screenCurrentP95}`,  pass: passScreen  },
    { key: "dpaFwdVoltageP95",  label: "DPA FWD Voltage P95 (V)",  limit: `≤ ${limits.dpaFwdVoltageP95}`,  pass: passDPA     },
  ] as const;

  const skipped = rf.skipped ?? false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">RF Performance — modo {modo === "H" ? "H⁻ (Protón)" : "D⁻ (Deuterón)"}</h3>
          {skipped
            ? <Badge variant="outline" className="text-xs">No realizado</Badge>
            : <PassBadge pass={passAll} />}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">No realizado</Label>
          <Switch
            checked={skipped}
            onCheckedChange={v => onChange({ ...datos, [key]: { ...rf, skipped: v } })}
          />
        </div>
      </div>

      {skipped ? (
        <div className="rounded-lg border border-muted bg-muted/30 p-4 text-sm text-muted-foreground text-center">
          Este test fue marcado como "No realizado" y no se incluirá en el reporte PDF.
        </div>
      ) : (
        <>
          <InstruccionesCaja lines={[
            modo === "H"
              ? "Iniciar producción en modo H⁻ a la corriente de licencia máxima."
              : "Cambiar a modo D⁻ y realizar producción a 40 µA.",
            "Ejecutar el Phase Analysis Tool (Beam Evaluator Tool) durante la producción.",
            "Exportar el reporte y registrar los valores P95 de cada parámetro.",
            "Los valores P95 deben estar por debajo de los límites indicados para PASS.",
          ]} />

          <div className="grid grid-cols-2 gap-4">
            {fields.map(f => (
              <div key={f.key} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">{f.label}</Label>
                  <PassBadge pass={f.pass} />
                </div>
                <p className="text-xs text-muted-foreground">Límite: {f.limit}</p>
                <Input
                  type="number" step="0.01"
                  value={(pa as Record<string, unknown>)[f.key] as string ?? ""}
                  onChange={e => updatePA({ [f.key]: e.target.value === "" ? null : Number(e.target.value) } as typeof pa)}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <span className="text-sm font-medium">Resultado RF {modo}:</span>
            <PassBadge pass={passAll} />
          </div>
        </>
      )}
    </div>
  );
}

// ── 4. Main Voltage Variation ─────────────────────────────────────────────────

function TestMainVoltage({ datos, onChange }: { datos: DatosPerformance; onChange: (d: DatosPerformance) => void }) {
  const mv = datos.mainVoltage ?? { anodeVoltStandby: null, pass: null };

  // Pass: Anode voltage en standby entre 7.4–8.2 kV (SCU GEN2, según Excel DOC1604037)
  const pass = mv.anodeVoltStandby != null
    ? mv.anodeVoltStandby >= 7.4 && mv.anodeVoltStandby <= 8.2
    : null;

  function update(v: number | null) {
    // Recalcular pass con el nuevo valor para que el sidebar refleje el estado
    const newPass = v != null ? v >= 7.4 && v <= 8.2 : null;
    onChange({ ...datos, mainVoltage: { anodeVoltStandby: v, pass: newPass } });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold">4. Main Voltage Variation</h3>
        <PassBadge pass={pass} />
      </div>

      <InstruccionesCaja lines={[
        "Con el ciclotrón en Standby (sin haz), leer el voltaje del ánodo (PSARC PS/GEMS-02A).",
        "El voltaje del ánodo en standby debe estar entre 7.4 – 8.2 kV para PASS.",
        "SM-Acc §5-2: voltaje de arco típico ~7.9 kV, rango aceptable 7.4 – 8.2 kV.",
        "Verificar también que la variación de tensión de la fuente principal sea < ±2%.",
      ]} />

      <div className="border rounded-lg p-4 max-w-xs space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Voltaje ánodo standby (kV)</Label>
          <PassBadge pass={pass} />
        </div>
        <p className="text-xs text-muted-foreground">Límite: 7.4 – 8.2 kV</p>
        <Input
          type="number" step="0.01"
          value={mv.anodeVoltStandby ?? ""}
          onChange={e => update(e.target.value === "" ? null : Number(e.target.value))}
        />
      </div>
    </div>
  );
}

// ── 5. I-arc vs Beam Current ──────────────────────────────────────────────────

const IARC_SETPOINTS = [50, 100, 130] as const;

function TestIarcBeam({ datos, onChange }: { datos: DatosPerformance; onChange: (d: DatosPerformance) => void }) {
  const defaultFilas = IARC_SETPOINTS.map(ua => ({
    targetCurrentUA: ua, foilCurrentUA: null, arcCurrentMA: null,
    maxArcCurrentMA: 1300, maxFoilCurrentUA: ua * 1.1, pass: undefined,
  }));
  const filas = datos.iarcVsBeam?.length ? datos.iarcVsBeam : defaultFilas;

  function updateFila(idx: number, patch: Record<string, unknown>) {
    const arr = [...filas];
    const updated = { ...arr[idx], ...patch };
    // Auto-pass
    updated.pass = (updated.arcCurrentMA != null && updated.foilCurrentUA != null)
      ? updated.arcCurrentMA <= updated.maxArcCurrentMA && updated.foilCurrentUA <= updated.maxFoilCurrentUA
      : undefined;
    arr[idx] = updated;
    onChange({ ...datos, iarcVsBeam: arr });
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">5. I-arc vs Beam Current</h3>

      <InstruccionesCaja lines={[
        "Con haz en H⁻, configurar corriente de target a 50 µA, 100 µA y 130 µA.",
        "Para cada set-point registrar: corriente Foil (µA) y corriente de arco (mA).",
        "La corriente de arco no debe superar 1300 mA y la corriente de foil no debe superar 1.1× la corriente de target.",
        "SM-Acc §6: cambiar al Foilholder 2 si la lámina actual supera su vida útil (~2 mAh).",
      ]} />

      <table className="w-full text-xs border rounded">
        <thead className="bg-muted">
          <tr>
            {["Set-point Target (µA)", "Foil actual (µA)", "Arc I (mA)", "Límite Arc", "Resultado"].map(h => (
              <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-t hover:bg-muted/30">
              <td className="px-3 py-2 font-medium">{f.targetCurrentUA}</td>
              <td className="px-3 py-2">
                <Input type="number" step="0.1" className="h-7 w-24 text-xs px-1"
                  value={f.foilCurrentUA ?? ""}
                  onChange={e => updateFila(i, { foilCurrentUA: e.target.value === "" ? null : Number(e.target.value) })} />
              </td>
              <td className="px-3 py-2">
                <Input type="number" step="1" className="h-7 w-24 text-xs px-1"
                  value={f.arcCurrentMA ?? ""}
                  onChange={e => updateFila(i, { arcCurrentMA: e.target.value === "" ? null : Number(e.target.value) })} />
              </td>
              <td className="px-3 py-2 text-muted-foreground">≤ {f.maxArcCurrentMA} mA</td>
              <td className="px-3 py-2"><PassBadge pass={f.pass} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 6. Ion Source Performance ─────────────────────────────────────────────────

// Corriente mínima de sonda por setpoint IS (DOC1604037 / Excel referencia)
// Regla: si probeCurrentH < mínimo → "Valor bajo, requiere optimización"
//        si probeCurrentH >= mínimo (o IS=0) → OK
const IS_MIN_PROBE_H: Record<number, number | null> = {
  0:    null, // IS=0 siempre OK
  50:   13,
  100:  37,
  200:  121,
  300:  189,
  400:  244,
  600:  312,
  800:  343,
  1000: 371,
};

const IS_MIN_SETPOINTS = [0, 50, 100, 200, 300, 400, 600, 800, 1000] as const;

function TestIonSource({ datos, onChange }: { datos: DatosPerformance; onChange: (d: DatosPerformance) => void }) {
  const defaultFilas = IS_MIN_SETPOINTS.map(ma => ({
    isCurrentMA: ma, probeCurrentH: null, probeCurrentD: null,
    maxProbeH: IS_MIN_PROBE_H[ma] ?? 9999,
  }));
  const filas = datos.ionSource?.filas?.length ? datos.ionSource.filas : defaultFilas;
  const header = datos.ionSource ?? { magnetCurrent: 0, deeVoltage: 38, deltaVoltage: 4.5, vacuum: 0, gasFlow: 0, filas };

  function updateFilas(arr: typeof filas) {
    onChange({ ...datos, ionSource: { ...header, filas: arr } });
  }

  function updateFila(idx: number, key: string, val: string) {
    const arr = [...filas];
    arr[idx] = { ...arr[idx], [key]: val === "" ? null : Number(val) };
    updateFilas(arr);
  }

  // Datos para el gráfico
  const chartData = IS_MIN_SETPOINTS.map(ma => ({
    is: ma,
    probe: filas.find(f => f.isCurrentMA === ma)?.probeCurrentH ?? null,
    min: IS_MIN_PROBE_H[ma] ?? null,
  }));

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">6. Ion Source Performance</h3>

      <InstruccionesCaja lines={[
        "En modo haz (Beam mode), variar la corriente del ion source (IS) desde 0 a 1000 mA.",
        "Para cada set-point registrar: corriente de la sonda (Probe Current H⁻) en µA.",
        "La PIG usa cátodo frío (SM-Acc §5-2) — no hay filamento; no aplicar procedimiento de activación.",
        "Criterio PASS: la curva de sonda (azul) debe quedar por encima de la curva mínima (roja).",
      ]} />

      <table className="w-full text-xs border rounded">
        <thead className="bg-muted">
          <tr>
            {["IS Current (mA)", "Probe H⁻ (µA)", "Máx. permitido (µA)", "Estado"].map(h => (
              <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => {
            const min = IS_MIN_PROBE_H[f.isCurrentMA];
            const tooLow = min != null && f.probeCurrentH != null && f.probeCurrentH < min;
            const ok     = min != null && f.probeCurrentH != null && f.probeCurrentH >= min;
            return (
              <tr key={i} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">{f.isCurrentMA}</td>
                <td className="px-3 py-2">
                  <Input type="number" step="0.1" className="h-7 w-24 text-xs px-1"
                    value={f.probeCurrentH ?? ""}
                    onChange={e => updateFila(i, "probeCurrentH", e.target.value)} />
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {min != null ? `≥ ${min}` : "—"}
                </td>
                <td className="px-3 py-2">
                  {tooLow
                    ? <span className="text-xs font-medium text-orange-600">⚠ Valor bajo, requiere optimización</span>
                    : ok
                    ? <span className="text-xs font-medium text-green-600">✓ OK</span>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Gráfico: curva medida vs curva máxima */}
      <div className="border rounded-lg p-4">
        <p className="text-xs font-medium mb-2">Probe Current H⁻ vs Ion Source Current</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 20, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="is" label={{ value: "IS Current (mA)", position: "insideBottom", offset: -12, fontSize: 11 }} tick={{ fontSize: 10 }} />
            <YAxis label={{ value: "Probe H⁻ (µA)", angle: -90, position: "insideLeft", offset: 8, fontSize: 11 }} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number, name: string) => [`${v} µA`, name === "probe" ? "Probe H⁻ medida" : "Mín. requerido"]} labelFormatter={v => `IS = ${v} mA`} />
            <Line type="monotone" dataKey="min"   stroke="#ef4444" strokeWidth={2} dot={false} name="min"   connectNulls />
            <Line type="monotone" dataKey="probe" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="probe" connectNulls />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-6 mt-1 justify-center">
          <span className="flex items-center gap-1 text-xs"><span className="inline-block w-6 h-0.5 bg-blue-500"></span>Probe H⁻ medida</span>
          <span className="flex items-center gap-1 text-xs"><span className="inline-block w-6 h-0.5 bg-red-500"></span>Mín. requerido</span>
        </div>
      </div>
    </div>
  );
}

// ── 7. Beam Transmission ──────────────────────────────────────────────────────

function TestTransmision({ datos, onChange }: { datos: DatosPerformance; onChange: (d: DatosPerformance) => void }) {
  const defaultFilas = [50, 100, 130].map(ua => ({
    targetCurrentUA: ua,
    foilCurrentUA: null,
    probeInCurrentUA: null,
    isCurrentMA: null,
    transmissionToTarget: undefined as number | undefined,
    transmissionToFoil: undefined as number | undefined,
    passTarget: undefined as boolean | undefined,
    passFoil: undefined as boolean | undefined,
  }));
  const filas = datos.transmision?.length ? datos.transmision : defaultFilas;

  function updateFila(idx: number, key: string, val: string) {
    const arr = [...filas];
    const updated = { ...arr[idx], [key]: val === "" ? null : Number(val) };
    // Calcular transmisiones
    if (updated.targetCurrentUA && updated.probeInCurrentUA) {
      updated.transmissionToTarget = (updated.targetCurrentUA / updated.probeInCurrentUA) * 100;
      updated.passTarget = updated.transmissionToTarget >= 55;
    }
    if (updated.foilCurrentUA && updated.probeInCurrentUA) {
      updated.transmissionToFoil = (updated.foilCurrentUA / updated.probeInCurrentUA) * 100;
      updated.passFoil = updated.transmissionToFoil >= 65;
    }
    arr[idx] = updated;
    onChange({ ...datos, transmision: arr });
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">7. Beam Transmission</h3>

      <InstruccionesCaja lines={[
        "Con Probe In activado, registrar la corriente de entrada de haz (Probe In Current).",
        "Registrar simultáneamente la corriente en Foil y en Target para cada set-point.",
        "Transmisión a Target = I-Target / I-Probe-In × 100%. Mínimo: 55%.",
        "Transmisión a Foil  = I-Foil  / I-Probe-In × 100%. Mínimo: 65%.",
      ]} />

      <table className="w-full text-xs border rounded">
        <thead className="bg-muted">
          <tr>
            {["Target set (µA)", "I-Foil (µA)", "I-Probe-In (µA)", "Trans.→Targ %", "Trans.→Foil %", "PASS"].map(h => (
              <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => {
            const passAll = f.passTarget !== false && f.passFoil !== false
              ? (f.passTarget === true || f.passFoil === true ? true : null)
              : false;
            return (
              <tr key={i} className="border-t hover:bg-muted/30">
                <td className="px-2 py-1.5 font-medium">{f.targetCurrentUA}</td>
                <td className="px-2 py-1.5">
                  <Input type="number" step="0.1" className="h-7 w-20 text-xs px-1"
                    value={f.foilCurrentUA ?? ""} onChange={e => updateFila(i, "foilCurrentUA", e.target.value)} />
                </td>
                <td className="px-2 py-1.5">
                  <Input type="number" step="0.1" className="h-7 w-20 text-xs px-1"
                    value={f.probeInCurrentUA ?? ""} onChange={e => updateFila(i, "probeInCurrentUA", e.target.value)} />
                </td>
                <td className="px-2 py-1.5">
                  <span className={cn("font-medium", f.passTarget === false && "text-red-600")}>
                    {f.transmissionToTarget != null ? `${f.transmissionToTarget.toFixed(1)}%` : "—"}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <span className={cn("font-medium", f.passFoil === false && "text-red-600")}>
                    {f.transmissionToFoil != null ? `${f.transmissionToFoil.toFixed(1)}%` : "—"}
                  </span>
                </td>
                <td className="px-2 py-1.5"><PassBadge pass={passAll} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">Criterio: Transmisión a Target ≥ 55% · Transmisión a Foil ≥ 65%</p>
    </div>
  );
}

// ── 8. Vacuum Tightness ───────────────────────────────────────────────────────

// Límites por gas flow (curva roja del Excel DOC1604037)
const VACUUM_LIMITS: Record<number, { maxChamber: number; maxBacking: number }> = {
  1:  { maxChamber: 3.6e-6,  maxBacking: 1.3e-2 },
  2:  { maxChamber: 6.1e-6,  maxBacking: 2.1e-2 },
  3:  { maxChamber: 8.9e-6,  maxBacking: 2.7e-2 },
  4:  { maxChamber: 1.1e-5,  maxBacking: 3.3e-2 },
  5:  { maxChamber: 1.3e-5,  maxBacking: 3.9e-2 },
  6:  { maxChamber: 1.5e-5,  maxBacking: 4.5e-2 },
  7:  { maxChamber: 1.6e-5,  maxBacking: 4.7e-2 },
  8:  { maxChamber: 1.8e-5,  maxBacking: 5.4e-2 },
  9:  { maxChamber: 2.0e-5,  maxBacking: 5.9e-2 },
  10: { maxChamber: 2.2e-5,  maxBacking: 6.5e-2 },
};

function fmtE(v: number | null | undefined): string {
  if (v == null || isNaN(v as number)) return "—";
  return v.toExponential(2);
}

function TestVacuumTight({ datos, onChange }: { datos: DatosPerformance; onChange: (d: DatosPerformance) => void }) {
  // rawInputs mantiene el texto crudo mientras el usuario escribe (evita perder "1." o "1.9E")
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});

  const defaultFilas = Array.from({ length: 10 }, (_, i) => {
    const flow = i + 1;
    return {
      gasFlowSccm: flow,
      chamberPressureMbar: null as number | null,
      backingPressureMbar: null as number | null,
      maxChamberMbar: VACUUM_LIMITS[flow].maxChamber,
      maxBackingMbar: VACUUM_LIMITS[flow].maxBacking,
    };
  });

  // Merge saved rows preserving per-flow limits
  const filas = datos.vacuumTightness?.length
    ? datos.vacuumTightness.map((f, i) => ({
        ...f,
        maxChamberMbar: VACUUM_LIMITS[i + 1]?.maxChamber ?? f.maxChamberMbar,
        maxBackingMbar: VACUUM_LIMITS[i + 1]?.maxBacking ?? f.maxBackingMbar,
      }))
    : defaultFilas;

  // Actualiza el padre solo con valores numéricos válidos
  function commitFila(idx: number, key: string, raw: string) {
    const parsed = raw === "" ? null : Number(raw);
    const value = parsed == null || isNaN(parsed) ? null : parsed;
    const arr = [...filas];
    arr[idx] = { ...arr[idx], [key]: value };
    onChange({ ...datos, vacuumTightness: arr });
  }

  function handleChange(idx: number, key: string, val: string) {
    const k = `${idx}-${key}`;
    setRawInputs(prev => ({ ...prev, [k]: val }));
    // Commit inmediato solo si ya es un número válido (no en medio de "1.9E-")
    const parsed = Number(val);
    if (val === "" || !isNaN(parsed)) {
      commitFila(idx, key, val);
    }
  }

  function handleBlur(idx: number, key: string) {
    const k = `${idx}-${key}`;
    const raw = rawInputs[k];
    if (raw !== undefined) {
      commitFila(idx, key, raw);
      setRawInputs(prev => { const n = { ...prev }; delete n[k]; return n; });
    }
  }

  // Valor a mostrar: texto crudo si el usuario está escribiendo, sino el número formateado
  function displayVal(idx: number, key: string, stored: number | null): string {
    const k = `${idx}-${key}`;
    if (k in rawInputs) return rawInputs[k];
    if (stored == null || isNaN(stored)) return "";
    return String(stored); // JavaScript convierte 1.9e-5 → "0.000019" que es legible
  }

  // Gráficos: siempre los 10 puntos; curva roja siempre visible
  const chartChamber = Array.from({ length: 10 }, (_, i) => {
    const flow = i + 1;
    const f = filas.find(r => r.gasFlowSccm === flow);
    return {
      flow,
      medido: f?.chamberPressureMbar ?? null,
      límite: VACUUM_LIMITS[flow].maxChamber,
    };
  });
  const chartBacking = Array.from({ length: 10 }, (_, i) => {
    const flow = i + 1;
    const f = filas.find(r => r.gasFlowSccm === flow);
    return {
      flow,
      medido: f?.backingPressureMbar ?? null,
      límite: VACUUM_LIMITS[flow].maxBacking,
    };
  });

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">8. Vacuum Tightness</h3>

      <InstruccionesCaja lines={[
        "Inyectar H₂ a caudales de 1 a 10 sccm (de 1 en 1) y registrar presión de cámara y respaldo.",
        "PASS: la curva medida (azul) debe quedar por debajo de la curva límite (roja) en ambos gráficos.",
        "Puedes ingresar en notación científica (ej. 1.9E-5) o decimal (ej. 0.000019).",
        "Si la presión de cámara supera el límite, verificar la bomba de difusión y el caudal de gas.",
      ]} />

      <table className="w-full text-xs border rounded">
        <thead className="bg-muted">
          <tr>
            {["Gas Flow (sccm)", "P-Cámara (mbar)", "Máx cámara", "P-Respaldo (mbar)", "Máx respaldo", "Pass"].map(h => (
              <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => {
            const passC = f.chamberPressureMbar != null && !isNaN(f.chamberPressureMbar)
              ? f.chamberPressureMbar <= f.maxChamberMbar : null;
            const passB = f.backingPressureMbar != null && !isNaN(f.backingPressureMbar)
              ? f.backingPressureMbar <= f.maxBackingMbar : null;
            const pass = passC === false || passB === false ? false
              : passC === true || passB === true ? true : null;
            return (
              <tr key={i} className="border-t hover:bg-muted/30">
                <td className="px-2 py-1.5 font-medium">{f.gasFlowSccm}</td>
                <td className="px-2 py-1.5">
                  <Input type="text" className="h-7 w-24 text-xs px-1" placeholder="ej. 1.9E-5"
                    value={displayVal(i, "chamberPressureMbar", f.chamberPressureMbar)}
                    onChange={e => handleChange(i, "chamberPressureMbar", e.target.value)}
                    onBlur={() => handleBlur(i, "chamberPressureMbar")} />
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">{fmtE(f.maxChamberMbar)}</td>
                <td className="px-2 py-1.5">
                  <Input type="text" className="h-7 w-24 text-xs px-1" placeholder="ej. 1.3E-2"
                    value={displayVal(i, "backingPressureMbar", f.backingPressureMbar)}
                    onChange={e => handleChange(i, "backingPressureMbar", e.target.value)}
                    onBlur={() => handleBlur(i, "backingPressureMbar")} />
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">{fmtE(f.maxBackingMbar)}</td>
                <td className="px-2 py-1.5"><PassBadge pass={pass} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Gráficos — siempre visibles con curva límite */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-3">
          <p className="text-xs font-medium mb-2">P-Cámara vs Gas Flow</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartChamber} margin={{ top: 4, right: 8, bottom: 16, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="flow" label={{ value: "Gas Flow (sccm)", position: "insideBottom", offset: -10, fontSize: 10 }} tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v.toExponential(1)} width={52} />
              <Tooltip formatter={(v: number) => v.toExponential(2)} />
              <Line type="monotone" dataKey="límite" stroke="#ef4444" strokeWidth={2} dot={false} name="Límite" connectNulls />
              <Line type="monotone" dataKey="medido" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Medido" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="border rounded-lg p-3">
          <p className="text-xs font-medium mb-2">P-Respaldo vs Gas Flow</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartBacking} margin={{ top: 4, right: 8, bottom: 16, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="flow" label={{ value: "Gas Flow (sccm)", position: "insideBottom", offset: -10, fontSize: 10 }} tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v.toExponential(1)} width={52} />
              <Tooltip formatter={(v: number) => v.toExponential(2)} />
              <Line type="monotone" dataKey="límite" stroke="#ef4444" strokeWidth={2} dot={false} name="Límite" connectNulls />
              <Line type="monotone" dataKey="medido" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Medido" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── 9. Vacuum Leak Rate ───────────────────────────────────────────────────────

// Límites por tiempo para Vacuum Leak Rate (curva roja del Excel, DOC1604037)
// Pass criteria: Blue line should be below red line at every time point
const LEAK_LIMITS: Record<number, number> = {
  0: 1.80e-7,
  10: 1.00e-6,
  20: 1.50e-6,
  30: 1.90e-6,
  40: 2.30e-6,
  50: 2.70e-6,
  60: 3.00e-6,
  70: 3.30e-6,
  80: 3.60e-6,
  90: 3.90e-6,
  100: 4.20e-6,
  110: 4.60e-6,
  120: 4.90e-6,
};

function TestVacuumLeak({ datos, onChange }: { datos: DatosPerformance; onChange: (d: DatosPerformance) => void }) {
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});

  const TIMES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];

  const defaultFilas = TIMES.map(t => ({
    timeSec: t,
    pressureMbar: null as number | null,
    maxLeakRate: LEAK_LIMITS[t],
  }));

  const filas = datos.vacuumLeak?.length
    ? datos.vacuumLeak.map((f) => ({
        ...f,
        maxLeakRate: LEAK_LIMITS[f.timeSec ?? 0] ?? f.maxLeakRate,
      }))
    : defaultFilas;

  function commitFila(idx: number, raw: string) {
    const parsed = raw === "" ? null : Number(raw);
    const value = parsed == null || isNaN(parsed) ? null : parsed;
    const arr = [...filas];
    arr[idx] = { ...arr[idx], pressureMbar: value };
    onChange({ ...datos, vacuumLeak: arr });
  }

  function handleChange(idx: number, val: string) {
    setRawInputs(prev => ({ ...prev, [idx]: val }));
    const parsed = Number(val);
    if (val === "" || !isNaN(parsed)) commitFila(idx, val);
  }

  function handleBlur(idx: number) {
    const raw = rawInputs[idx];
    if (raw !== undefined) {
      commitFila(idx, raw);
      setRawInputs(prev => { const n = { ...prev }; delete n[idx]; return n; });
    }
  }

  function displayVal(idx: number, stored: number | null): string {
    if (String(idx) in rawInputs) return rawInputs[idx];
    if (stored == null || isNaN(stored)) return "";
    return String(stored);
  }

  // PASS: cada fila con dato debe estar ≤ su límite
  const withData = filas.filter(f => f.pressureMbar != null && !isNaN(f.pressureMbar));
  const pass: boolean | null = withData.length === 0 ? null
    : withData.every(f => (f.pressureMbar as number) <= (LEAK_LIMITS[f.timeSec ?? 0] ?? Infinity));

  // Gráfico: siempre los 13 puntos, curva roja siempre visible
  const chartData = TIMES.map(t => {
    const f = filas.find(r => r.timeSec === t);
    return {
      time: t,
      "Medido": f?.pressureMbar ?? null,
      "Límite": LEAK_LIMITS[t],
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold">9. Vacuum Leak Rate</h3>
        <PassBadge pass={pass} />
      </div>

      <InstruccionesCaja lines={[
        "Sistema frío, sin corrida de beam reciente, con vacío totalmente recuperado.",
        "Poner VCU en modo Standby con todas las BEV cerradas y sin gas flow.",
        "Registrar la presión de cámara cada 10 segundos hasta 120 s.",
        "PASS: la curva medida (azul) debe quedar por debajo de la curva límite (roja).",
      ]} />

      <div className="grid grid-cols-2 gap-6">
        {/* Tabla */}
        <table className="text-xs border rounded">
          <thead className="bg-muted">
            <tr>
              {["Tiempo (s)", "P-Cámara (mbar)", "Límite (mbar)", "Pass"].map(h => (
                <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => {
              const lim = LEAK_LIMITS[f.timeSec ?? 0];
              const rowPass = f.pressureMbar != null && !isNaN(f.pressureMbar)
                ? f.pressureMbar <= lim : null;
              return (
                <tr key={i} className="border-t hover:bg-muted/30">
                  <td className="px-2 py-1.5 font-medium">{f.timeSec} s</td>
                  <td className="px-2 py-1.5">
                    <Input type="text" className="h-7 w-24 text-xs px-1" placeholder="ej. 1.3E-6"
                      value={displayVal(i, f.pressureMbar)}
                      onChange={e => handleChange(i, e.target.value)}
                      onBlur={() => handleBlur(i)} />
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{fmtE(lim)}</td>
                  <td className="px-2 py-1.5"><PassBadge pass={rowPass} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Gráfico */}
        <div className="border rounded-lg p-3 flex flex-col">
          <p className="text-xs font-medium mb-2">Vacuum pressure vs Time</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 16, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time"
                label={{ value: "Time (s)", position: "insideBottom", offset: -10, fontSize: 10 }}
                tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v.toExponential(1)} width={56} />
              <Tooltip formatter={(v: number) => v.toExponential(2)} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="Límite" stroke="#ef4444" strokeWidth={2} dot={false} name="Max leak rate" connectNulls />
              <Line type="monotone" dataKey="Medido" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Vacuum pressure" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
