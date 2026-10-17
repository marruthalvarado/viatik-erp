/**
 * Vista de análisis de un batch de producción.
 * – Gráficas de series de tiempo para todos los parámetros del ciclotrón
 * – Panel de anomalías con agrupación por parámetro y filtros interactivos
 * – Botón para generar OS Correctiva vinculada al batch
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import {
  AlertTriangle, AlertCircle, CheckCircle2, Download, Loader2, ClipboardList,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import type { CicloProduccion, CicloAnomalia, Ciclotrón } from "@/types/entities";
import type { BatchRow, BatchMeta } from "@/services/servicio-tecnico/ciclo-batch-parser";
import { parseBatchFile, calcTargetISetpoint } from "@/services/servicio-tecnico/ciclo-batch-parser";
import { detectAnomalias } from "@/services/servicio-tecnico/ciclo-anomaly";
import { descargarArchivoBatch } from "@/services/servicio-tecnico/ciclo-producciones";
import type { CiclotrónParametros } from "@/services/servicio-tecnico/ciclotrones";
import { vincularOsABatch } from "@/services/servicio-tecnico/ordenes-servicio";
import { useCrearOrdenServicio } from "@/hooks/entities/use-servicio-tecnico";

interface Props {
  produccion: CicloProduccion;
  params: CiclotrónParametros;
  ciclotrón?: Ciclotrón | null;
}

/** Reduce el dataset a max N puntos para performance */
function downsample(rows: BatchRow[], maxPts = 600): BatchRow[] {
  if (rows.length <= maxPts) return rows;
  const step = Math.ceil(rows.length / maxPts);
  return rows.filter((_, i) => i % step === 0);
}

function fmtSci(n: number): string {
  if (n === 0) return "0";
  if (Math.abs(n) < 0.001 || Math.abs(n) > 9999) return n.toExponential(2);
  return n.toFixed(2);
}

/** Extrae número de target y nombre de tracer del campo "Tracer: (1) 18F-" */
function parseTracerInfo(tracer: string | null): { target: string | null; nombre: string } {
  if (!tracer) return { target: null, nombre: "—" };
  const m = tracer.match(/^\((\d+)\)\s*(.*)/);
  if (m) return { target: `Target ${m[1]}`, nombre: m[2].trim() || tracer };
  return { target: null, nombre: tracer };
}

function EstadoBadge({ estado }: { estado: CicloProduccion["estado"] }) {
  const cfg = {
    pendiente:   { label: "Pendiente",   className: "bg-gray-100 text-gray-600",     icon: null },
    normal:      { label: "Normal",      className: "bg-green-100 text-green-700",   icon: CheckCircle2 },
    con_alertas: { label: "Con alertas", className: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
    critico:     { label: "Crítico",     className: "bg-red-100 text-red-700",       icon: AlertCircle },
  }[estado] ?? { label: estado, className: "bg-gray-100 text-gray-600", icon: null };
  const Icon = cfg.icon;
  return (
    <Badge className={`${cfg.className} border-0 gap-1`}>
      {Icon && <Icon className="h-3 w-3" />}
      {cfg.label}
    </Badge>
  );
}

/** Tarjeta de resumen por parámetro en la vista de anomalías */
function ParametroResumenCard({
  parametro, anoms, expanded, onToggle,
}: {
  parametro: string;
  anoms: CicloAnomalia[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const criticos = anoms.filter((a) => a.severidad === "critical");
  const warnings = anoms.filter((a) => a.severidad === "warning");
  const primero = anoms[0];
  const ultimo = anoms[anoms.length - 1];

  return (
    <div className={`rounded-md border text-sm overflow-hidden ${
      criticos.length > 0 ? "border-red-200" : "border-yellow-200"
    }`}>
      {/* Encabezado clickable */}
      <button
        type="button"
        className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
          criticos.length > 0
            ? "bg-red-50 hover:bg-red-100"
            : "bg-yellow-50 hover:bg-yellow-100"
        }`}
        onClick={onToggle}
      >
        {criticos.length > 0
          ? <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          : <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />}
        <span className="font-semibold flex-1">{parametro}</span>
        <div className="flex items-center gap-2 ml-auto">
          {criticos.length > 0 && (
            <Badge className="bg-red-100 text-red-700 border-0 text-xs">
              {criticos.length} crítico{criticos.length !== 1 ? "s" : ""}
            </Badge>
          )}
          {warnings.length > 0 && (
            <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">
              {warnings.length} alerta{warnings.length !== 1 ? "s" : ""}
            </Badge>
          )}
          {expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Resumen siempre visible */}
      <div className="px-3 pb-2 pt-1.5 bg-white border-t border-dashed border-gray-200 text-xs text-muted-foreground">
        <span>Primera: {primero.tiempo} · Última: {ultimo.tiempo}</span>
        {primero.limite_max != null && (
          <span className="ml-3">
            Valor típico: {fmtSci(primero.valor)} · Límite: {
              primero.limite_max != null ? `≤${fmtSci(primero.limite_max)}` : ""
            }{primero.limite_min != null ? ` ≥${fmtSci(primero.limite_min)}` : ""}
          </span>
        )}
        <p className="mt-0.5 text-xs text-gray-600">{primero.hint}</p>
      </div>

      {/* Detalle expandible: lista de todas las ocurrencias */}
      {expanded && (
        <div className="divide-y divide-dashed divide-gray-100">
          {anoms.map((a, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-1.5 bg-white text-xs">
              <span className={a.severidad === "critical" ? "text-red-600" : "text-yellow-600"}>
                {a.severidad === "critical" ? "●" : "△"}
              </span>
              <span className="font-mono">{a.tiempo}</span>
              <Badge variant="outline" className="text-[10px] capitalize">{a.fase}</Badge>
              <span className="text-muted-foreground">
                {fmtSci(a.valor)}
                {a.limite_max != null && <> (máx {fmtSci(a.limite_max)})</>}
                {a.limite_min != null && a.limite_max == null && <> (mín {fmtSci(a.limite_min)})</>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type ChartDatum = Record<string, number | string>;

export function ProduccionAnalisis({ produccion, params, ciclotrón }: Props) {
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [anomalias, setAnomalias] = useState<CicloAnomalia[]>([]);
  const [meta, setMeta] = useState<BatchMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generandoOs, setGenerandoOs] = useState(false);
  const [osCreada, setOsCreada] = useState<{ id: string; numero: string } | null>(null);

  // Filtros anomalías
  const [filterSev, setFilterSev] = useState<"all" | "critical" | "warning">("all");
  const [filterParam, setFilterParam] = useState<string | null>(null);
  // Parámetros expandidos en vista resumen
  const [expandedParams, setExpandedParams] = useState<Set<string>>(new Set());

  const crearOs = useCrearOrdenServicio();

  const loadData = useCallback(async () => {
    if (!produccion.archivo_path) return;
    setLoading(true);
    setError(null);
    try {
      const blob = await descargarArchivoBatch(produccion.archivo_path);
      const file = new File([blob], produccion.archivo_nombre ?? "batch.log");
      const parsed = await parseBatchFile(file);
      const targetISp = calcTargetISetpoint(parsed.rows);
      const anoms = detectAnomalias(parsed.rows, params, targetISp);
      setRows(parsed.rows);
      setAnomalias(anoms);
      setMeta(parsed.meta);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [produccion.archivo_path, produccion.archivo_nombre, params]);

  useEffect(() => { void loadData(); }, [loadData]);

  // ── Datos de meta (del archivo o de la BD) ─────────────────────────────────
  const tracerFuente = meta?.tracer ?? produccion.tracer ?? null;
  const batchNo = meta?.numeroBatch ?? produccion.numero_batch ?? null;
  const fechaFuente = meta?.fecha ?? produccion.fecha ?? null;
  const { target, nombre: tracerNombre } = parseTracerInfo(tracerFuente);

  // ── OS correctiva ─────────────────────────────────────────────────────────
  async function handleGenerarOs() {
    if (!ciclotrón?.equipo_id) return;
    setGenerandoOs(true);
    try {
      const criticos = anomalias.filter((a) => a.severidad === "critical");
      const warnings = anomalias.filter((a) => a.severidad === "warning");
      const resumen = [
        `Batch #${batchNo ?? "?"} — ${tracerNombre} — ${fechaFuente ?? "?"}`,
        `Anomalías detectadas: ${criticos.length} críticas, ${warnings.length} alertas.`,
        ...criticos.slice(0, 5).map((a) => `• [CRÍTICO] ${a.parametro} @ ${a.tiempo}: valor ${a.valor} (límites ${a.limite_min ?? "?"} – ${a.limite_max ?? "?"}). ${a.hint}`),
        ...(criticos.length > 5 ? [`• … y ${criticos.length - 5} críticos más.`] : []),
        ...warnings.slice(0, 3).map((a) => `• [ALERTA] ${a.parametro} @ ${a.tiempo}: valor ${a.valor}.`),
      ].join("\n");
      const result = await crearOs.mutateAsync({
        payload: {
          tipo: "correctivo",
          equipo_id: ciclotrón.equipo_id,
          descripcion_problema: resumen,
        },
      });
      await vincularOsABatch(result.id, produccion.id);
      setOsCreada(result);
    } finally {
      setGenerandoOs(false);
    }
  }

  // ── Agrupación de anomalías ───────────────────────────────────────────────
  const anomaliasAgrupadas = useMemo(() => {
    const map = new Map<string, CicloAnomalia[]>();
    for (const a of anomalias) {
      if (!map.has(a.parametro)) map.set(a.parametro, []);
      map.get(a.parametro)!.push(a);
    }
    // Ordenar: críticos primero, luego warnings; dentro de cada grupo por nombre
    return new Map(
      [...map.entries()].sort(([, va], [, vb]) => {
        const scoreA = va.some((x) => x.severidad === "critical") ? 0 : 1;
        const scoreB = vb.some((x) => x.severidad === "critical") ? 0 : 1;
        return scoreA !== scoreB ? scoreA - scoreB : 0;
      }),
    );
  }, [anomalias]);

  // Filtrar anomalías según severity + param seleccionado
  const anomaliasFiltradas = useMemo(() => {
    let list = anomalias;
    if (filterSev !== "all") list = list.filter((a) => a.severidad === filterSev);
    if (filterParam) list = list.filter((a) => a.parametro === filterParam);
    return list;
  }, [anomalias, filterSev, filterParam]);

  // Parámetros con anomalías (según filtro de severidad activo)
  const parametrosFiltrados = useMemo(() => {
    const set = new Set<string>();
    anomalias.forEach((a) => {
      if (filterSev === "all" || a.severidad === filterSev) set.add(a.parametro);
    });
    return [...set];
  }, [anomalias, filterSev]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData: ChartDatum[] = useMemo(
    () => downsample(rows).map((r) => ({
      t:       r.time,
      targetI: r.targetI,
      collLI:  r.collLI,
      collRI:  r.collRI,
      magnetI: r.magnetI,
      probeI:  r.probeI,
      foilI:   r.foilI,
      dee1Kv:  r.dee1Kv,
      dee2Kv:  r.dee2Kv,
      gasFlow: r.gasFlow,
      rfFwdW:  r.rfFwdW,
      rfReflW: r.rfReflW,
      arcI:    r.arcI,
      arcV:    r.arcV,
      vacuumP: parseFloat(r.vacuumP.toExponential(2)),
      targetP: r.targetP,
      heCoolP: r.heCoolP,
      balance: r.balance,
    })),
    [rows],
  );

  const xTicks = useMemo(
    () => chartData
      .filter((_, i) => i % Math.max(1, Math.ceil(chartData.length / 8)) === 0)
      .map((d) => d["t"] as string),
    [chartData],
  );

  function ChartWrap({ height = 220, children }: { height?: number; children: React.ReactNode }) {
    return (
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="t" type="category" ticks={xTicks} tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 10 }} width={55} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {children}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Loading / error ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Cargando y analizando archivo…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={loadData}>Reintentar</Button>
      </div>
    );
  }

  const durMin = produccion.duracion_segundos != null
    ? Math.round(produccion.duracion_segundos / 60) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header / metadata ── */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 items-end px-1 pb-3 border-b">
        {batchNo != null && (
          <div>
            <p className="text-xs text-muted-foreground">Batch</p>
            <p className="font-semibold text-lg leading-tight">#{batchNo}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">Tracer</p>
          <p className="font-medium">{tracerNombre}</p>
        </div>
        {target && (
          <div>
            <p className="text-xs text-muted-foreground">Target</p>
            <p className="font-medium">{target}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">Fecha</p>
          <p className="font-medium">
            {fechaFuente
              ? format(new Date(fechaFuente + "T12:00:00"), "dd MMM yyyy", { locale: es })
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Duración</p>
          <p className="font-medium">{durMin != null ? `${durMin} min` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Target-I setpoint</p>
          <p className="font-medium">
            {produccion.target_i_setpoint != null
              ? `${produccion.target_i_setpoint.toFixed(1)} µA` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Estado</p>
          <EstadoBadge estado={produccion.estado} />
        </div>
        <div className="ml-auto">
          {produccion.archivo_path && (
            <Button
              variant="outline" size="sm"
              onClick={async () => {
                const { urlFirmadaBatch } = await import("@/services/servicio-tecnico/ciclo-producciones");
                const url = await urlFirmadaBatch(produccion.archivo_path!);
                window.open(url, "_blank");
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Descargar archivo
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No hay datos disponibles para este batch.
        </p>
      )}

      {rows.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="haz" className="flex flex-col h-full">
            <TabsList className="sticky top-0 z-10 bg-background border-b rounded-none justify-start px-1 h-auto py-1 flex-wrap">
              <TabsTrigger value="haz">Haz</TabsTrigger>
              <TabsTrigger value="colimadores">Colimadores</TabsTrigger>
              <TabsTrigger value="rf">RF / Dee</TabsTrigger>
              <TabsTrigger value="presion">Presión</TabsTrigger>
              <TabsTrigger value="arco">Arco</TabsTrigger>
              <TabsTrigger value="anomalias">
                Anomalías
                {anomalias.length > 0 && (
                  <Badge className="ml-1 h-4 px-1 text-[10px]" variant="destructive">
                    {anomalias.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Haz: Target-I + Magnet-I ── */}
            <TabsContent value="haz" className="p-3 space-y-3">
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-sm">Corriente de haz — Target-I (µA)</CardTitle></CardHeader>
                <CardContent>
                  <ChartWrap>
                    <Line type="monotone" dataKey="targetI" name="Target-I" stroke="#2563eb" dot={false} strokeWidth={1.5} />
                    {produccion.target_i_setpoint != null && (
                      <ReferenceLine y={produccion.target_i_setpoint} stroke="#93c5fd" strokeDasharray="4 2"
                        label={{ value: `SP ${produccion.target_i_setpoint.toFixed(0)}`, fontSize: 9 }} />
                    )}
                  </ChartWrap>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-sm">Magneto — Magnet-I (A)</CardTitle></CardHeader>
                <CardContent>
                  <ChartWrap>
                    <Line type="monotone" dataKey="magnetI" name="Magnet-I" stroke="#7c3aed" dot={false} strokeWidth={1.5} />
                    <ReferenceLine y={params.magnet_i.min} stroke="#f87171" strokeDasharray="3 2" />
                    <ReferenceLine y={params.magnet_i.max} stroke="#f87171" strokeDasharray="3 2" />
                  </ChartWrap>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-sm">Sonda y Hoja — Probe-I / Foil-I (µA)</CardTitle></CardHeader>
                <CardContent>
                  <ChartWrap>
                    <Line type="monotone" dataKey="probeI" name="Probe-I" stroke="#0891b2" dot={false} strokeWidth={1.5} />
                    <Line type="monotone" dataKey="foilI" name="Foil-I" stroke="#f59e0b" dot={false} strokeWidth={1.5} />
                  </ChartWrap>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Colimadores ── */}
            <TabsContent value="colimadores" className="p-3 space-y-3">
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-sm">Colimadores izquierdo y derecho — Coll-l-I / Coll-r-I (µA)</CardTitle></CardHeader>
                <CardContent>
                  <ChartWrap height={260}>
                    <Line type="monotone" dataKey="collLI" name="Coll-l-I" stroke="#dc2626" dot={false} strokeWidth={1.5} />
                    <Line type="monotone" dataKey="collRI" name="Coll-r-I" stroke="#16a34a" dot={false} strokeWidth={1.5} />
                    <Line type="monotone" dataKey="targetI" name="Target-I" stroke="#2563eb" dot={false} strokeWidth={1} strokeDasharray="4 2" />
                  </ChartWrap>
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground px-1">
                Los colimadores miden la fracción del haz interceptada. Valores altos respecto a Target-I indican desalineación o dispersión excesiva del haz.
              </p>
            </TabsContent>

            {/* ── RF y Dee ── */}
            <TabsContent value="rf" className="p-3 space-y-3">
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-sm">Dee voltages — kV</CardTitle></CardHeader>
                <CardContent>
                  <ChartWrap>
                    <Line type="monotone" dataKey="dee1Kv" name="Dee-1-kV" stroke="#059669" dot={false} strokeWidth={1.5} />
                    <Line type="monotone" dataKey="dee2Kv" name="Dee-2-kV" stroke="#d97706" dot={false} strokeWidth={1.5} />
                    <ReferenceLine y={params.dee1_kv.min} stroke="#6ee7b7" strokeDasharray="3 2" />
                    <ReferenceLine y={params.dee1_kv.max} stroke="#6ee7b7" strokeDasharray="3 2" />
                    <ReferenceLine y={params.dee2_kv.min} stroke="#fcd34d" strokeDasharray="3 2" />
                    <ReferenceLine y={params.dee2_kv.max} stroke="#fcd34d" strokeDasharray="3 2" />
                  </ChartWrap>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-sm">Gas flow — sccm</CardTitle></CardHeader>
                <CardContent>
                  <ChartWrap>
                    <Line type="monotone" dataKey="gasFlow" name="Gas flow" stroke="#0891b2" dot={false} strokeWidth={1.5} />
                    <ReferenceLine y={params.gas_flow.min} stroke="#67e8f9" strokeDasharray="3 2" />
                    <ReferenceLine y={params.gas_flow.max} stroke="#67e8f9" strokeDasharray="3 2" />
                  </ChartWrap>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-sm">Potencia RF — fwd / refl (W)</CardTitle></CardHeader>
                <CardContent>
                  <ChartWrap>
                    <Line type="monotone" dataKey="rfFwdW" name="RF fwd" stroke="#7c3aed" dot={false} strokeWidth={1.5} />
                    <Line type="monotone" dataKey="rfReflW" name="RF refl" stroke="#e11d48" dot={false} strokeWidth={1.5} />
                  </ChartWrap>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Presiones ── */}
            <TabsContent value="presion" className="p-3 space-y-3">
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-sm">Presión de blanco — Target-P (mbar)</CardTitle></CardHeader>
                <CardContent>
                  <ChartWrap>
                    <Line type="monotone" dataKey="targetP" name="Target-P" stroke="#dc2626" dot={false} strokeWidth={1.5} />
                    <ReferenceLine y={params.target_p_min} stroke="#fca5a5" strokeDasharray="3 2"
                      label={{ value: `mín ${params.target_p_min}`, fontSize: 8 }} />
                    <ReferenceLine y={params.target_p_max} stroke="#fca5a5" strokeDasharray="3 2"
                      label={{ value: `máx ${params.target_p_max}`, fontSize: 8 }} />
                  </ChartWrap>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-sm">Enfriamiento He — He cool-P (bar)</CardTitle></CardHeader>
                <CardContent>
                  <ChartWrap>
                    <Line type="monotone" dataKey="heCoolP" name="He cool-P" stroke="#0284c7" dot={false} strokeWidth={1.5} />
                    <ReferenceLine y={params.he_cool_p_min} stroke="#7dd3fc" strokeDasharray="3 2" />
                    <ReferenceLine y={params.he_cool_p_max} stroke="#7dd3fc" strokeDasharray="3 2" />
                  </ChartWrap>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-sm">Vacío — Vacuum-P (mbar, escala log)</CardTitle></CardHeader>
                <CardContent>
                  <ChartWrap>
                    <Line type="monotone" dataKey="vacuumP" name="Vacuum-P" stroke="#64748b" dot={false} strokeWidth={1} />
                  </ChartWrap>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Arco ── */}
            <TabsContent value="arco" className="p-3 space-y-3">
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-sm">Corriente de arco — Arc-I (mA)</CardTitle></CardHeader>
                <CardContent>
                  <ChartWrap>
                    <Line type="monotone" dataKey="arcI" name="Arc-I" stroke="#9333ea" dot={false} strokeWidth={1} />
                    <ReferenceLine y={params.arc_i_min} stroke="#d8b4fe" strokeDasharray="3 2" />
                    <ReferenceLine y={params.arc_i_max} stroke="#d8b4fe" strokeDasharray="3 2" />
                  </ChartWrap>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-sm">Tensión de arco — Arc-V (V)</CardTitle></CardHeader>
                <CardContent>
                  <ChartWrap>
                    <Line type="monotone" dataKey="arcV" name="Arc-V" stroke="#6366f1" dot={false} strokeWidth={1} />
                    <ReferenceLine y={params.arc_v_min} stroke="#a5b4fc" strokeDasharray="3 2" />
                    <ReferenceLine y={params.arc_v_max} stroke="#a5b4fc" strokeDasharray="3 2" />
                  </ChartWrap>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Anomalías ── */}
            <TabsContent value="anomalias" className="p-3">
              {anomalias.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <p className="text-sm font-medium">Sin anomalías detectadas</p>
                  <p className="text-xs">El batch se ejecutó dentro de los parámetros configurados.</p>
                </div>
              ) : (
                <>
                  {/* Filtros de severidad */}
                  <div className="flex flex-wrap gap-2 mb-3 items-center">
                    <button
                      type="button"
                      onClick={() => { setFilterSev("all"); setFilterParam(null); }}
                      className={`rounded-full px-3 py-0.5 text-xs font-medium border transition-colors ${
                        filterSev === "all" && !filterParam
                          ? "bg-gray-800 text-white border-gray-800"
                          : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
                      }`}
                    >
                      Todos ({anomalias.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFilterSev("critical"); setFilterParam(null); }}
                      className={`rounded-full px-3 py-0.5 text-xs font-medium border transition-colors ${
                        filterSev === "critical"
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-red-50 text-red-700 border-red-200 hover:border-red-400"
                      }`}
                    >
                      Críticos ({anomalias.filter((a) => a.severidad === "critical").length})
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFilterSev("warning"); setFilterParam(null); }}
                      className={`rounded-full px-3 py-0.5 text-xs font-medium border transition-colors ${
                        filterSev === "warning"
                          ? "bg-yellow-500 text-white border-yellow-500"
                          : "bg-yellow-50 text-yellow-700 border-yellow-200 hover:border-yellow-400"
                      }`}
                    >
                      Alertas ({anomalias.filter((a) => a.severidad === "warning").length})
                    </button>

                    {/* Separador + filtros por parámetro */}
                    <Separator orientation="vertical" className="h-5 mx-1" />
                    {parametrosFiltrados.map((p) => {
                      const cnt = anomalias.filter(
                        (a) => a.parametro === p && (filterSev === "all" || a.severidad === filterSev),
                      ).length;
                      const hasCrit = anomalias.some((a) => a.parametro === p && a.severidad === "critical");
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFilterParam(filterParam === p ? null : p)}
                          className={`rounded-full px-3 py-0.5 text-xs font-medium border transition-colors ${
                            filterParam === p
                              ? (hasCrit ? "bg-red-500 text-white border-red-500" : "bg-yellow-500 text-white border-yellow-500")
                              : (hasCrit ? "bg-red-50 text-red-700 border-red-200 hover:border-red-400" : "bg-yellow-50 text-yellow-700 border-yellow-200 hover:border-yellow-400")
                          }`}
                        >
                          {p} ({cnt})
                        </button>
                      );
                    })}

                    {/* Generar OS */}
                    {ciclotrón?.equipo_id && !osCreada && (
                      <Button
                        size="sm" variant="destructive" className="ml-auto"
                        onClick={handleGenerarOs} disabled={generandoOs}
                      >
                        {generandoOs
                          ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          : <ClipboardList className="h-4 w-4 mr-1" />}
                        Generar OS Correctiva
                      </Button>
                    )}
                    {osCreada && (
                      <div className="ml-auto flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>OS <strong>{osCreada.numero}</strong> creada</span>
                      </div>
                    )}
                  </div>

                  {/* Vista por parámetro (agrupada) cuando no hay filtro de parámetro concreto */}
                  {!filterParam ? (
                    <ScrollArea className="h-[calc(100vh-22rem)]">
                      <div className="space-y-2 pr-1">
                        {[...anomaliasAgrupadas.entries()]
                          .filter(([, anoms]) =>
                            filterSev === "all"
                              ? true
                              : anoms.some((a) => a.severidad === filterSev),
                          )
                          .map(([param, anoms]) => {
                            const anoFilt = filterSev === "all"
                              ? anoms
                              : anoms.filter((a) => a.severidad === filterSev);
                            return (
                              <ParametroResumenCard
                                key={param}
                                parametro={param}
                                anoms={anoFilt}
                                expanded={expandedParams.has(param)}
                                onToggle={() => setExpandedParams((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(param)) next.delete(param);
                                  else next.add(param);
                                  return next;
                                })}
                              />
                            );
                          })}
                      </div>
                    </ScrollArea>
                  ) : (
                    /* Vista detalle cuando un parámetro está seleccionado */
                    <ScrollArea className="h-[calc(100vh-22rem)]">
                      <div className="space-y-1.5 pr-1">
                        {anomaliasFiltradas.map((a, i) => (
                          <div
                            key={i}
                            className={`p-2.5 rounded-md border text-sm ${
                              a.severidad === "critical"
                                ? "border-red-200 bg-red-50"
                                : "border-yellow-200 bg-yellow-50"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-0.5 font-medium">
                              {a.severidad === "critical"
                                ? <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                                : <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />}
                              <span className="font-mono text-xs">{a.tiempo}</span>
                              <Badge variant="outline" className="ml-auto text-[10px] capitalize">{a.fase}</Badge>
                            </div>
                            <p className="text-muted-foreground text-xs">
                              Valor: <strong>{fmtSci(a.valor)}</strong>
                              {a.limite_min != null && <> · Mín: {fmtSci(a.limite_min)}</>}
                              {a.limite_max != null && <> · Máx: {fmtSci(a.limite_max)}</>}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
