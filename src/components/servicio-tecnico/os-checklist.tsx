/**
 * Componente: Checklist de Actividades de Protocolo (OS Actividades)
 * Muestra el checklist de mantenimiento por sección con controles por tipo_campo.
 */
import { useState } from "react";
import { CheckCircle2, XCircle, MinusCircle, AlertTriangle, ClipboardCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import {
  useOsActividades,
  useActualizarOsActividad,
  useResumenOsActividades,
  useEquipoInstalado,
  useProtocolos,
  useCargarActividadesProtocolo,
  type OsActividad,
} from "@/hooks/entities/use-servicio-tecnico";

// ─── Botones resultado check3 ─────────────────────────────────
function Check3Buttons({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1">
      <Button
        type="button"
        size="sm"
        variant={value === "ok" ? "default" : "outline"}
        className={value === "ok" ? "bg-green-600 hover:bg-green-700 text-white border-0" : ""}
        onClick={() => onChange("ok")}
      >
        <CheckCircle2 className="size-3 mr-1" />OK
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "no_ok" ? "default" : "outline"}
        className={value === "no_ok" ? "bg-red-600 hover:bg-red-700 text-white border-0" : ""}
        onClick={() => onChange("no_ok")}
      >
        <XCircle className="size-3 mr-1" />No OK
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "na" ? "default" : "outline"}
        className={value === "na" ? "bg-gray-500 hover:bg-gray-600 text-white border-0" : ""}
        onClick={() => onChange("na")}
      >
        <MinusCircle className="size-3 mr-1" />N/A
      </Button>
    </div>
  );
}

// ─── Fila de actividad individual ───────────────────────────
function ActividadRow({
  act,
  ordenId,
}: {
  act: OsActividad;
  ordenId: string;
}) {
  const actualizar = useActualizarOsActividad(ordenId);
  const [valorMedido, setValorMedido] = useState<string>(act.valor_medido?.toString() ?? "");
  // Medición múltiple: array paralelo a etiquetas_medicion
  const [valoresMedidos, setValoresMedidos] = useState<string[]>(
    () => (act.valores_medidos ?? []).map((v) => v?.toString() ?? ""),
  );
  const [textoRespuesta, setTextoRespuesta] = useState(act.texto_respuesta ?? "");
  const [notas, setNotas] = useState(act.notas_resultado ?? "");
  const [guardandoMed, setGuardandoMed] = useState(false);

  const esMultiple = act.tipo_campo === "medicion"
    && act.etiquetas_medicion !== null
    && act.etiquetas_medicion.length > 1;

  const handleResultado = async (resultado: string) => {
    try {
      await actualizar.mutateAsync({ id: act.id, resultado });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleMedicionBlur = async () => {
    const v = parseFloat(valorMedido);
    if (isNaN(v)) return;
    setGuardandoMed(true);
    try {
      await actualizar.mutateAsync({
        id: act.id,
        valor_medido: v,
        resultado: act.valor_min !== null && act.valor_max !== null
          ? (v >= act.valor_min && v <= act.valor_max ? "ok" : "no_ok")
          : act.resultado,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGuardandoMed(false);
    }
  };

  // Guarda el array completo al perder foco en cualquier campo múltiple
  const handleMultiMedicionBlur = async (idx: number, raw: string) => {
    const updated = [...valoresMedidos];
    updated[idx] = raw;
    setValoresMedidos(updated);
    const parsed = updated.map((s) => parseFloat(s));
    if (parsed.some(isNaN)) return;       // esperar a que completen todos
    setGuardandoMed(true);
    try {
      await actualizar.mutateAsync({
        id: act.id,
        valores_medidos: parsed,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGuardandoMed(false);
    }
  };

  const handleTextoBlur = async () => {
    try {
      await actualizar.mutateAsync({ id: act.id, texto_respuesta: textoRespuesta || null });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleNotasBlur = async () => {
    try {
      await actualizar.mutateAsync({ id: act.id, notas_resultado: notas || null });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const fuera = act.tipo_campo === "medicion" && !esMultiple && act.valor_medido !== null
    && act.valor_min !== null && act.valor_max !== null
    && (act.valor_medido < act.valor_min || act.valor_medido > act.valor_max);

  return (
    <div className={`flex flex-col gap-2 py-2 px-3 rounded border ${
      act.resultado === "no_ok" ? "border-red-200 bg-red-50/40"
      : act.resultado === "ok"   ? "border-green-100 bg-green-50/20"
      : "border-transparent"
    }`}>
      <div className="flex items-start gap-2">
        <span className="text-xs text-muted-foreground font-mono mt-0.5 w-10 shrink-0">
          {act.numero_paso ?? "—"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug">
            {act.descripcion}
            {act.es_critico && (
              <Badge variant="destructive" className="ml-2 text-[10px] py-0 px-1">CRÍTICO</Badge>
            )}
          </p>

          {/* ── Medición múltiple: grid de inputs con etiqueta ── */}
          {esMultiple && (
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {act.etiquetas_medicion!.map((etiqueta, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap min-w-0 truncate" title={etiqueta}>
                    {etiqueta}
                  </span>
                  <Input
                    type="number"
                    step="any"
                    value={valoresMedidos[idx] ?? ""}
                    onChange={(e) => {
                      const updated = [...valoresMedidos];
                      updated[idx] = e.target.value;
                      setValoresMedidos(updated);
                    }}
                    onBlur={(e) => handleMultiMedicionBlur(idx, e.target.value)}
                    className="w-20 h-7 text-right text-sm shrink-0"
                    placeholder="—"
                    disabled={guardandoMed}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0">
          {act.tipo_campo === "check3" && (
            <Check3Buttons value={act.resultado} onChange={handleResultado} />
          )}
          {act.tipo_campo === "medicion" && !esMultiple && (
            <div className="flex items-center gap-1.5">
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="any"
                    value={valorMedido}
                    onChange={(e) => setValorMedido(e.target.value)}
                    onBlur={handleMedicionBlur}
                    className={`w-24 h-7 text-right text-sm ${fuera ? "border-red-400" : ""}`}
                    placeholder="Valor"
                    disabled={guardandoMed}
                  />
                  {act.unidad && <span className="text-xs text-muted-foreground">{act.unidad}</span>}
                </div>
                {act.valor_min !== null && act.valor_max !== null && (
                  <span className={`text-[10px] ${fuera ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                    {fuera && <AlertTriangle className="inline size-3 mr-0.5" />}
                    Rango: {act.valor_min}–{act.valor_max}
                  </span>
                )}
              </div>
            </div>
          )}
          {act.tipo_campo === "texto" && (
            <Input
              value={textoRespuesta}
              onChange={(e) => setTextoRespuesta(e.target.value)}
              onBlur={handleTextoBlur}
              className="w-48 h-7 text-sm"
              placeholder="Respuesta…"
            />
          )}
          {act.tipo_campo === "foto" && (
            <Badge variant="outline" className="text-xs">Foto — ver OS</Badge>
          )}
        </div>
      </div>
      {/* Notas de resultado */}
      {(act.resultado === "no_ok" || notas) && (
        <div className="pl-12">
          <Textarea
            rows={1}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            onBlur={handleNotasBlur}
            placeholder="Notas sobre el resultado…"
            className="text-xs min-h-0 resize-none"
          />
        </div>
      )}
    </div>
  );
}

// ─── Empty state con botón "Cargar protocolo" ─────────────────
function CargarProtocoloEmpty({ ordenId, equipoId }: { ordenId: string; equipoId: string | null }) {
  const { ejecutar, isPending, protocolo } = useCargarProtocolo(ordenId, equipoId);
  const { data: equipo } = useEquipoInstalado(equipoId);
  const modeloId = equipo?.modelo_equipo?.id ?? (equipo as unknown as Record<string, unknown>)?.modelo_id as string | undefined;

  const handleCargar = async () => {
    try { await ejecutar(); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="py-10 text-center text-muted-foreground">
      <ClipboardCheck className="size-10 mx-auto mb-2 opacity-30" />
      <p className="font-medium text-sm">Sin actividades cargadas</p>
      {protocolo ? (
        <>
          <p className="text-xs mt-1">
            Protocolo disponible: <span className="font-medium text-foreground">{protocolo.nombre}</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={handleCargar}
            disabled={isPending}
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${isPending ? "animate-spin" : ""}`} />
            {isPending ? "Cargando…" : "Cargar protocolo"}
          </Button>
        </>
      ) : (
        <p className="text-xs mt-1">
          {modeloId
            ? "No hay protocolo configurado para este modelo."
            : "Las actividades se cargan al crear la OS con un equipo que tenga modelo asignado."}
        </p>
      )}
    </div>
  );
}

// ─── Hook auxiliar para cargar/recargar protocolo ─────────────
function useCargarProtocolo(ordenId: string, equipoId: string | null) {
  const { data: equipo } = useEquipoInstalado(equipoId);
  const modeloId = equipo?.modelo_equipo?.id ?? (equipo as unknown as Record<string, unknown>)?.modelo_id as string | undefined;
  const { data: protocolos = [] } = useProtocolos(modeloId);
  const cargar = useCargarActividadesProtocolo();
  const protocolo = protocolos[0] ?? null;

  const ejecutar = async () => {
    if (!protocolo) { toast.error("No hay protocolo disponible para este equipo"); return; }
    let meses: number | undefined;
    if (equipo?.fecha_instalacion) {
      const instalacion = new Date(equipo.fecha_instalacion);
      const ahora = new Date();
      meses = Math.floor(
        (ahora.getFullYear() - instalacion.getFullYear()) * 12
        + (ahora.getMonth() - instalacion.getMonth()),
      );
    }
    await cargar.mutateAsync({ orden_id: ordenId, protocolo_id: protocolo.id, meses_acumulados: meses });
    toast.success("Protocolo recargado correctamente");
  };

  return { ejecutar, isPending: cargar.isPending, protocolo };
}

// ─── Componente principal ─────────────────────────────────────
interface OsChecklistProps {
  ordenId: string;
  equipoId?: string | null;
}

export function OsChecklist({ ordenId, equipoId = null }: OsChecklistProps) {
  const { data: actividades = [], isLoading } = useOsActividades(ordenId);
  const { data: resumen } = useResumenOsActividades(ordenId);
  const { ejecutar: recargar, isPending: recargando, protocolo } = useCargarProtocolo(ordenId, equipoId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Cargando checklist…</p>;
  }

  if (actividades.length === 0) {
    return <CargarProtocoloEmpty ordenId={ordenId} equipoId={equipoId} />;
  }

  // Agrupar por sección
  const secciones = actividades.reduce<Record<string, OsActividad[]>>((acc, a) => {
    const key = a.seccion_titulo ?? "Sin sección";
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  const pct = resumen ? Math.round((resumen.completadas / resumen.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Barra de progreso */}
      {resumen && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Progreso del checklist</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{resumen.completadas}/{resumen.total} actividades</span>
              {protocolo && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={recargar}
                  disabled={recargando}
                  title="Elimina las actividades actuales y recarga el protocolo desde cero"
                >
                  <RefreshCw className={`size-3 mr-1 ${recargando ? "animate-spin" : ""}`} />
                  {recargando ? "Recargando…" : "Recargar"}
                </Button>
              )}
            </div>
          </div>
          <Progress value={pct} className="h-2" />
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1 text-green-700">
              <CheckCircle2 className="size-3" />{resumen.ok} OK
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <XCircle className="size-3" />{resumen.no_ok} No OK
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <MinusCircle className="size-3" />{resumen.na} N/A
            </span>
            {resumen.criticas_no_ok > 0 && (
              <span className="flex items-center gap-1 text-red-700 font-medium">
                <AlertTriangle className="size-3" />{resumen.criticas_no_ok} críticas con falla
              </span>
            )}
          </div>
        </div>
      )}

      {/* Secciones en acordeón */}
      <Accordion type="multiple" defaultValue={Object.keys(secciones)}>
        {Object.entries(secciones).map(([titulo, acts]) => {
          const completadas = acts.filter((a) => a.resultado !== null).length;
          return (
            <AccordionItem key={titulo} value={titulo}>
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                <span className="flex-1 text-left">{titulo}</span>
                <Badge variant="outline" className="mr-2 text-xs">
                  {completadas}/{acts.length}
                </Badge>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1 pb-2">
                  {acts.map((act) => (
                    <ActividadRow key={act.id} act={act} ordenId={ordenId} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
