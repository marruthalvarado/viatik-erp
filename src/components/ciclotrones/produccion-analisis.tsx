/**
 * Vista de análisis de un batch de producción.
 * Muestra:
 *  - Metadata del batch (tracer, fecha, duración)
 *  - Gráficas de series de tiempo para los parámetros principales
 *  - Panel de anomalías detectadas con hints del manual
 *
 * Nota: el archivo original se parsea de nuevo en el browser al abrir esta vista
 * para poder dibujar las gráficas (los datos crudos no se guardan en BD).
 */
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { AlertTriangle, AlertCircle, CheckCircle2, Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import type { CicloProduccion, CicloAnomalia } from "@/types/entities";
import type { BatchRow } from "@/services/servicio-tecnico/ciclo-batch-parser";
import { parseBatchFile, calcTargetISetpoint } from "@/services/servicio-tecnico/ciclo-batch-parser";
import { detectAnomalias } from "@/services/servicio-tecnico/ciclo-anomaly";
import { descargarArchivoBatch } from "@/services/servicio-tecnico/ciclo-producciones";
import type { CiclotrónParametros } from "@/services/servicio-tecnico/ciclotrones";

interface Props {
  produccion: CicloProduccion;
  params: CiclotrónParametros;
}

/** Reduce el dataset a max N puntos para performance en recharts */
function downsample(rows: BatchRow[], maxPts = 500): BatchRow[] {
  if (rows.length <= maxPts) return rows;
  const step = Math.ceil(rows.length / maxPts);
  return rows.filter((_, i) => i % step === 0);
}

function fmtSci(n: number): string {
  if (n === 0) return "0";
  if (Math.abs(n) < 0.001 || Math.abs(n) > 9999) return n.toExponential(2);
  return n.toFixed(2);
}

function EstadoBadge({ estado }: { estado: CicloProduccion["estado"] }) {
  const cfg = {
    pendiente:    { label: "Pendiente",     className: "bg-gray-100 text-gray-600",    icon: null },
    normal:       { label: "Normal",        className: "bg-green-100 text-green-700",  icon: CheckCircle2 },
    con_alertas:  { label: "Con alertas",   className: "bg-yellow-100 text-yellow-700",icon: AlertTriangle },
    critico:      { label: "Crítico",       className: "bg-red-100 text-red-700",      icon: AlertCircle },
  }[estado] ?? { label: estado, className: "bg-gray-100 text-gray-600", icon: null };
  const Icon = cfg.icon;
  return (
    <Badge className={`${cfg.className} border-0 gap-1`}>
      {Icon && <Icon className="h-3 w-3" />}
      {cfg.label}
    </Badge>
  );
}

function AnomaliaItem({ a }: { a: CicloAnomalia }) {
  return (
    <div className={`p-3 rounded-md border text-sm ${
      a.severidad === "critical" ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50"
    }`}>
      <div className="flex items-center gap-2 mb-1 font-medium">
        {a.severidad === "critical"
          ? <AlertCircle className="h-4 w-4 text-red-600" />
          : <AlertTriangle className="h-4 w-4 text-yellow-600" />}
        <span>{a.parametro}</span>
        <span className="text-muted-foreground font-normal">@ {a.tiempo}</span>
        <Badge variant="outline" className="ml-auto text-xs capitalize">{a.fase}</Badge>
      </div>
      <p className="text-muted-foreground text-xs mb-1">
        Valor: <strong>{fmtSci(a.valor)}</strong>
        {a.limite_min != null && <> · Mín: {fmtSci(a.limite_min)}</>}
        {a.limite_max != null && <> · Máx: {fmtSci(a.limite_max)}</>}
      </p>
      <p className="text-xs">{a.hint}</p>
    </div>
  );
}

type ChartDatum = Record<string, number | string>;

export function ProduccionAnalisis({ produccion, params }: Props) {
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [anomalias, setAnomalias] = useState<CicloAnomalia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [produccion.archivo_path, produccion.archivo_nombre, params]);

  useEffect(() => { void loadData(); }, [loadData]);

  const chartData: ChartDatum[] = downsample(rows).map((r) => ({
    t:        r.time,
    targetI:  r.targetI,
    magnetI:  r.magnetI,
    dee1Kv:   r.dee1Kv,
    dee2Kv:   r.dee2Kv,
    gasFlow:  r.gasFlow,
    vacuumP:  Number(r.vacuumP.toExponential(2)),
    targetP:  r.targetP,
    heCoolP:  r.heCoolP,
    arcI:     r.arcI,
  }));

  // Ticks reducidos en X
  const xTicks = chartData.filter((_, i) => i % Math.ceil(chartData.length / 8) === 0).map((d) => d["t"]);

  function commonChart(children: React.ReactNode) {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="t" ticks={xTicks as string[]} tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={55} />
          <Tooltip contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {children}
        </LineChart>
      </ResponsiveContainer>
    );
  }

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
    <div className="space-y-4">
      {/* ── Header / metadata ── */}
      <div className="flex flex-wrap gap-4 items-start">
        <div>
          <p className="text-xs text-muted-foreground">Tracer</p>
          <p className="font-medium">{produccion.tracer ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Fecha</p>
          <p className="font-medium">
            {produccion.fecha
              ? format(new Date(produccion.fecha), "dd MMM yyyy", { locale: es })
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

      <Separator />

      {rows.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No hay datos disponibles para este batch.
        </p>
      )}

      {rows.length > 0 && (
        <Tabs defaultValue="haz">
          <TabsList>
            <TabsTrigger value="haz">Haz</TabsTrigger>
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

          {/* ── Haz (Target-I, colimadores, magneto) ── */}
          <TabsContent value="haz">
            <Card>
              <CardHeader><CardTitle className="text-sm">Corriente de haz — µA</CardTitle></CardHeader>
              <CardContent>
                {commonChart(<>
                  <Line type="monotone" dataKey="targetI" name="Target-I" stroke="#2563eb" dot={false} strokeWidth={1.5} />
                  <ReferenceLine y={params.target_i_spike_ua > 0 ? (produccion.target_i_setpoint ?? 65) : undefined}
                    stroke="#93c5fd" strokeDasharray="4 2" label={{ value: "Setpoint", fontSize: 9 }} />
                </>)}
              </CardContent>
            </Card>
            <Card className="mt-3">
              <CardHeader><CardTitle className="text-sm">Magnet-I — A</CardTitle></CardHeader>
              <CardContent>
                {commonChart(<>
                  <Line type="monotone" dataKey="magnetI" name="Magnet-I" stroke="#7c3aed" dot={false} strokeWidth={1.5} />
                  <ReferenceLine y={params.magnet_i.min} stroke="#f87171" strokeDasharray="3 2" />
                  <ReferenceLine y={params.magnet_i.max} stroke="#f87171" strokeDasharray="3 2" />
                </>)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── RF y Dee voltages ── */}
          <TabsContent value="rf">
            <Card>
              <CardHeader><CardTitle className="text-sm">Dee voltages — kV</CardTitle></CardHeader>
              <CardContent>
                {commonChart(<>
                  <Line type="monotone" dataKey="dee1Kv" name="Dee-1-kV" stroke="#059669" dot={false} strokeWidth={1.5} />
                  <Line type="monotone" dataKey="dee2Kv" name="Dee-2-kV" stroke="#d97706" dot={false} strokeWidth={1.5} />
                  <ReferenceLine y={params.dee1_kv.min} stroke="#6ee7b7" strokeDasharray="3 2" />
                  <ReferenceLine y={params.dee1_kv.max} stroke="#6ee7b7" strokeDasharray="3 2" />
                  <ReferenceLine y={params.dee2_kv.min} stroke="#fcd34d" strokeDasharray="3 2" />
                  <ReferenceLine y={params.dee2_kv.max} stroke="#fcd34d" strokeDasharray="3 2" />
                </>)}
              </CardContent>
            </Card>
            <Card className="mt-3">
              <CardHeader><CardTitle className="text-sm">Gas flow — sccm</CardTitle></CardHeader>
              <CardContent>
                {commonChart(<>
                  <Line type="monotone" dataKey="gasFlow" name="Gas flow" stroke="#0891b2" dot={false} strokeWidth={1.5} />
                  <ReferenceLine y={params.gas_flow.min} stroke="#67e8f9" strokeDasharray="3 2" />
                  <ReferenceLine y={params.gas_flow.max} stroke="#67e8f9" strokeDasharray="3 2" />
                </>)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Presiones ── */}
          <TabsContent value="presion">
            <Card>
              <CardHeader><CardTitle className="text-sm">Target-P — mbar</CardTitle></CardHeader>
              <CardContent>
                {commonChart(<>
                  <Line type="monotone" dataKey="targetP" name="Target-P" stroke="#dc2626" dot={false} strokeWidth={1.5} />
                  <ReferenceLine y={params.target_p_min} stroke="#fca5a5" strokeDasharray="3 2" />
                  <ReferenceLine y={params.target_p_max} stroke="#fca5a5" strokeDasharray="3 2" />
                </>)}
              </CardContent>
            </Card>
            <Card className="mt-3">
              <CardHeader><CardTitle className="text-sm">He cool-P — bar</CardTitle></CardHeader>
              <CardContent>
                {commonChart(<>
                  <Line type="monotone" dataKey="heCoolP" name="He cool-P" stroke="#0284c7" dot={false} strokeWidth={1.5} />
                  <ReferenceLine y={params.he_cool_p_min} stroke="#7dd3fc" strokeDasharray="3 2" />
                  <ReferenceLine y={params.he_cool_p_max} stroke="#7dd3fc" strokeDasharray="3 2" />
                </>)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Arco ── */}
          <TabsContent value="arco">
            <Card>
              <CardHeader><CardTitle className="text-sm">Arc-I — mA</CardTitle></CardHeader>
              <CardContent>
                {commonChart(<>
                  <Line type="monotone" dataKey="arcI" name="Arc-I" stroke="#9333ea" dot={false} strokeWidth={1} />
                  <ReferenceLine y={params.arc_i_min} stroke="#d8b4fe" strokeDasharray="3 2" />
                  <ReferenceLine y={params.arc_i_max} stroke="#d8b4fe" strokeDasharray="3 2" />
                </>)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Anomalías ── */}
          <TabsContent value="anomalias">
            {anomalias.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="text-sm font-medium">Sin anomalías detectadas</p>
                <p className="text-xs">El batch se ejecutó dentro de los parámetros configurados.</p>
              </div>
            ) : (
              <>
                <div className="flex gap-3 mb-4 flex-wrap">
                  <Badge className="bg-red-100 text-red-700 border-0">
                    {anomalias.filter((a) => a.severidad === "critical").length} Críticos
                  </Badge>
                  <Badge className="bg-yellow-100 text-yellow-700 border-0">
                    {anomalias.filter((a) => a.severidad === "warning").length} Alertas
                  </Badge>
                </div>
                <ScrollArea className="h-[420px] pr-2">
                  <div className="space-y-2">
                    {anomalias.map((a, i) => (
                      <AnomaliaItem key={i} a={a} />
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
