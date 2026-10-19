/**
 * ciclo-error-logs-tab.tsx
 * Tab de Error Logs en el detalle del ciclotrón.
 *
 * Funcionalidades:
 *  - Subir archivos .txt de log del GE PETtrace
 *  - Ver lista de logs subidos con resumen de faults/warnings
 *  - Ver eventos individuales con filtros por tipo y subsistema
 *  - Panel de patrones detectados y memoria histórica
 *  - Alertas de tendencias crecientes
 *  - Botón para pre-llenar OS correctiva con contexto de faults
 */
import { useState, useRef, useCallback } from "react";
import {
  Upload, FileText, Trash2, AlertCircle, AlertTriangle,
  Info, ChevronDown, ChevronUp, TrendingUp, History,
  Zap, Filter, X, ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import type { Ciclotrón, CicloErrorLog, EventoLog, TipoEventoLog, SubsistemaLog } from "@/types/entities";
import { useCompany } from "@/contexts/company-context";
import {
  useErrorLogs, useErrorLogCompleto, useSubirErrorLog, useEliminarErrorLog,
  useFaultResumen,
} from "@/hooks/entities/use-ciclo-error-logs";
import {
  parsearArchivoLog,
} from "@/services/servicio-tecnico/ciclo-error-log-parser";
import {
  labelTipo, labelSubsistema, CLAVE_DESCRIPCION,
} from "@/services/servicio-tecnico/ciclo-error-log-parser";
import {
  detectarPatrones, analizarTendencias, generarTextoOsCorrectiva,
} from "@/services/servicio-tecnico/ciclo-fault-patterns";

// ── Helpers visuales ──────────────────────────────────────────────────────────

function TipoBadge({ tipo }: { tipo: TipoEventoLog }) {
  if (tipo === "fault")   return <Badge className="bg-red-100 text-red-700 border-0 text-xs">Fault</Badge>;
  if (tipo === "warning") return <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">Warning</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">Info</Badge>;
}

function TipoIcon({ tipo }: { tipo: TipoEventoLog }) {
  if (tipo === "fault")   return <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-none" />;
  if (tipo === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 flex-none" />;
  return <Info className="h-3.5 w-3.5 text-gray-400 flex-none" />;
}

function SeveridadBadge({ sev }: { sev: "critico" | "advertencia" | "informativo" }) {
  if (sev === "critico")     return <Badge className="bg-red-100 text-red-700 border-0 text-xs">Crítico</Badge>;
  if (sev === "advertencia") return <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">Advertencia</Badge>;
  return <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">Informativo</Badge>;
}

// ── Sub-componente: lista de logs ─────────────────────────────────────────────

function LogsList({
  ciclotrón,
  selectedLogId,
  onSelect,
}: {
  ciclotrón: Ciclotrón;
  selectedLogId: string | null;
  onSelect: (id: string) => void;
}) {
  const { empresaActiva } = useCompany();
  const { data: logs, isLoading } = useErrorLogs(ciclotrón.id);
  const eliminar = useEliminarErrorLog();

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Cargando…</p>;
  if (!logs?.length) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p>No hay logs subidos aún</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map(log => (
        <div
          key={log.id}
          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
            selectedLogId === log.id
              ? "border-primary bg-primary/5"
              : "hover:bg-muted/50"
          }`}
          onClick={() => onSelect(log.id)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{log.archivo_nombre}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {log.fecha_inicio && (
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(log.fecha_inicio), "dd MMM yyyy", { locale: es })}
                    {log.fecha_fin && log.fecha_fin.substring(0, 10) !== log.fecha_inicio.substring(0, 10) && (
                      <> — {format(new Date(log.fecha_fin), "dd MMM yyyy", { locale: es })}</>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                {log.total_faults > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    {log.total_faults} fault{log.total_faults > 1 ? "s" : ""}
                  </span>
                )}
                {log.total_warnings > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
                    <AlertTriangle className="h-3 w-3" />
                    {log.total_warnings} warning{log.total_warnings > 1 ? "s" : ""}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {log.total_eventos} eventos
                </span>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost" size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-red-600 flex-none"
                  onClick={e => e.stopPropagation()}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar log</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminará el log "{log.archivo_nombre}" y todos sus eventos.
                    Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => eliminar.mutate({
                      id: log.id,
                      ciclotrónId: ciclotrón.id,
                      empresaId: empresaActiva!.id,
                    })}
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sub-componente: viewer de eventos ────────────────────────────────────────

function EventosViewer({ log }: { log: CicloErrorLog }) {
  const [filtroTipo, setFiltroTipo] = useState<TipoEventoLog | "todos">("todos");
  const [filtroSub, setFiltroSub] = useState<SubsistemaLog | "todos">("todos");
  const [expandido, setExpandido] = useState(true);

  const eventos = log.eventos.filter(e => {
    if (filtroTipo !== "todos" && e.tipo !== filtroTipo) return false;
    if (filtroSub !== "todos" && e.subsistema !== filtroSub) return false;
    return true;
  });

  // Subsistemas presentes en este log
  const subsistemas = [...new Set(log.eventos.map(e => e.subsistema))];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-1 text-sm font-medium"
          onClick={() => setExpandido(!expandido)}
        >
          {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Eventos del log ({log.total_eventos})
        </button>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filtroTipo} onValueChange={v => setFiltroTipo(v as typeof filtroTipo)}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="fault">Fault</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroSub} onValueChange={v => setFiltroSub(v as typeof filtroSub)}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los sistemas</SelectItem>
              {subsistemas.map(s => (
                <SelectItem key={s} value={s}>{labelSubsistema(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {expandido && (
        <ScrollArea className="h-72 rounded-lg border">
          <div className="p-2 space-y-0.5">
            {eventos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No hay eventos con los filtros seleccionados
              </p>
            ) : (
              eventos.map((e, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                    e.tipo === "fault"
                      ? "bg-red-50 hover:bg-red-100"
                      : e.tipo === "warning"
                      ? "bg-yellow-50 hover:bg-yellow-100"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <TipoIcon tipo={e.tipo} />
                  <span className="text-muted-foreground font-mono whitespace-nowrap">
                    {e.ts.replace("T", " ").replace("Z", "").substring(0, 19)}
                  </span>
                  <span className={`flex-1 ${e.tipo === "fault" ? "text-red-800 font-medium" : e.tipo === "warning" ? "text-yellow-800" : "text-gray-700"}`}>
                    {CLAVE_DESCRIPCION[e.clave] ?? e.mensaje}
                  </span>
                  <span className="text-muted-foreground font-mono">({e.codigo})</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ── Sub-componente: panel de patrones y memoria ───────────────────────────────

function PatronesPanel({
  ciclotrón,
  log,
  onGenerarOs,
}: {
  ciclotrón: Ciclotrón;
  log: CicloErrorLog;
  onGenerarOs: (texto: string) => void;
}) {
  const { data: historiales = [] } = useFaultResumen(ciclotrón.id, 90);
  const [expandedPatron, setExpandedPatron] = useState<string | null>(null);

  const patrones = detectarPatrones(log.eventos, historiales);
  const tendencias = analizarTendencias(log.eventos);
  const alertasTendencias = tendencias.filter(t => t.tendencia === "creciente");

  if (patrones.length === 0 && alertasTendencias.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-4 flex items-center gap-2 text-sm text-green-700">
          <Zap className="h-4 w-4" />
          No se detectaron patrones de fault en este log. Sistema en operación normal.
        </CardContent>
      </Card>
    );
  }

  const textoOs = generarTextoOsCorrectiva(patrones);

  return (
    <div className="space-y-3">
      {/* Alertas de tendencias */}
      {alertasTendencias.map(t => (
        <div key={t.clave} className="rounded-lg border border-orange-200 bg-orange-50 p-3 flex gap-2">
          <TrendingUp className="h-4 w-4 text-orange-600 flex-none mt-0.5" />
          <div className="text-sm text-orange-800">
            <span className="font-semibold">Tendencia creciente: </span>
            {t.alerta}
          </div>
        </div>
      ))}

      {/* Patrones detectados */}
      {patrones.map(p => {
        const isOpen = expandedPatron === p.clave;
        // Buscar en historial cuántas veces ha ocurrido en los últimos 90 días
        const hist = historiales.find(h => h.clave === p.clave);

        return (
          <Card
            key={p.clave}
            className={`border ${
              p.severidad === "critico" ? "border-red-200" :
              p.severidad === "advertencia" ? "border-yellow-200" : "border-blue-200"
            }`}
          >
            <CardHeader className="py-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SeveridadBadge sev={p.severidad} />
                  <CardTitle className="text-sm">{p.titulo}</CardTitle>
                </div>
                <button
                  onClick={() => setExpandedPatron(isOpen ? null : p.clave)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{p.ocurrencias} vez{p.ocurrencias > 1 ? "es" : ""} en este log</span>
                {hist && hist.total > p.ocurrencias && (
                  <span className="flex items-center gap-1">
                    <History className="h-3 w-3" />
                    {hist.total} total en 90 días
                  </span>
                )}
                {hist && (
                  <span>
                    Último: {format(new Date(hist.ultima_vez), "dd MMM yyyy", { locale: es })}
                  </span>
                )}
              </div>
            </CardHeader>

            {isOpen && (
              <CardContent className="pt-0 pb-4 px-4 space-y-3">
                <p className="text-sm text-muted-foreground">{p.descripcion}</p>

                {p.sugerencia_os && (
                  <div className="bg-blue-50 border border-blue-100 rounded p-3">
                    <div className="flex items-center gap-1 text-xs font-semibold text-blue-700 mb-1">
                      <ClipboardList className="h-3.5 w-3.5" />
                      Acciones sugeridas (del manual)
                    </div>
                    <p className="text-xs text-blue-800 whitespace-pre-line">{p.sugerencia_os}</p>
                  </div>
                )}

                {p.referencia_manual && (
                  <p className="text-xs text-muted-foreground">
                    Ref: {p.referencia_manual}
                  </p>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Botón generar OS */}
      {patrones.some(p => p.severidad !== "informativo") && textoOs && (
        <Button
          variant="outline"
          className="w-full gap-2 border-dashed"
          onClick={() => onGenerarOs(textoOs)}
        >
          <ClipboardList className="h-4 w-4" />
          Usar estos faults en una OS Correctiva
        </Button>
      )}
    </div>
  );
}

// ── Sub-componente: dialog de preview de sugerencia OS ───────────────────────

function OsSugerenciaDialog({
  texto,
  onClose,
}: {
  texto: string;
  onClose: () => void;
}) {
  const [editado, setEditado] = useState(texto);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg border shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Texto sugerido para OS Correctiva</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Puedes editar este texto antes de usarlo. Solo incluye los faults relevantes
          según el manual de servicio.
        </p>
        <textarea
          className="w-full h-48 text-sm border rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          value={editado}
          onChange={e => setEditado(e.target.value)}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(editado).catch(() => undefined);
              onClose();
            }}
          >
            Copiar al portapapeles
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  ciclotrón: Ciclotrón;
}

export function CicloErrorLogsTab({ ciclotrón }: Props) {
  const { empresaActiva } = useCompany();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [osSugerencia, setOsSugerencia] = useState<string | null>(null);

  const subir = useSubirErrorLog();
  const { data: logCompleto } = useErrorLogCompleto(selectedLogId);

  const handleFile = useCallback(async (file: File) => {
    if (!empresaActiva?.id) return;
    if (!file.name.endsWith(".txt")) {
      setUploadError("Solo se aceptan archivos .txt del GE PETtrace");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const resultado = await parsearArchivoLog(file);
      const log = await subir.mutateAsync({
        empresa_id:     empresaActiva.id,
        ciclotrón_id:   ciclotrón.id,
        archivo_nombre: file.name,
        fecha_inicio:   resultado.fecha_inicio,
        fecha_fin:      resultado.fecha_fin,
        total_eventos:  resultado.total_eventos,
        total_faults:   resultado.total_faults,
        total_warnings: resultado.total_warnings,
        total_info:     resultado.total_info,
        eventos:        resultado.eventos,
      });
      setSelectedLogId(log.id);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Error al subir el log");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [empresaActiva?.id, ciclotrón.id, subir]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  return (
    <div className="flex gap-6 h-full">
      {/* Panel izquierdo — lista de logs */}
      <div className="w-64 flex-none space-y-3">
        {/* Upload */}
        <div
          className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">
            {uploading ? "Procesando…" : "Arrastra un .txt o haz clic"}
          </p>
        </div>

        {uploadError && (
          <p className="text-xs text-red-600 px-1">{uploadError}</p>
        )}

        <LogsList
          ciclotrón={ciclotrón}
          selectedLogId={selectedLogId}
          onSelect={setSelectedLogId}
        />
      </div>

      {/* Panel derecho — detalle del log */}
      <div className="flex-1 space-y-6 min-w-0">
        {!selectedLogId && (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm">
            <FileText className="h-10 w-10 mb-2 opacity-30" />
            <p>Selecciona un log para ver su análisis</p>
          </div>
        )}

        {selectedLogId && logCompleto && (
          <>
            {/* Encabezado del log */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-sm">{logCompleto.archivo_nombre}</h3>
                {logCompleto.fecha_inicio && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(logCompleto.fecha_inicio), "dd MMM yyyy HH:mm", { locale: es })}
                    {" → "}
                    {logCompleto.fecha_fin
                      ? format(new Date(logCompleto.fecha_fin), "dd MMM yyyy HH:mm", { locale: es })
                      : "—"
                    }
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs">
                {logCompleto.total_faults > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {logCompleto.total_faults} fault{logCompleto.total_faults > 1 ? "s" : ""}
                  </span>
                )}
                {logCompleto.total_warnings > 0 && (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {logCompleto.total_warnings} warning{logCompleto.total_warnings > 1 ? "s" : ""}
                  </span>
                )}
                <span className="text-muted-foreground">{logCompleto.total_info} info</span>
              </div>
            </div>

            <Separator />

            {/* Patrones detectados */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-primary" />
                Análisis de patrones
              </h4>
              <PatronesPanel
                ciclotrón={ciclotrón}
                log={logCompleto}
                onGenerarOs={texto => setOsSugerencia(texto)}
              />
            </div>

            <Separator />

            {/* Todos los eventos */}
            <EventosViewer log={logCompleto} />
          </>
        )}

        {selectedLogId && !logCompleto && (
          <p className="text-sm text-muted-foreground">Cargando log…</p>
        )}
      </div>

      {/* Dialog sugerencia OS */}
      {osSugerencia && (
        <OsSugerenciaDialog
          texto={osSugerencia}
          onClose={() => setOsSugerencia(null)}
        />
      )}
    </div>
  );
}
