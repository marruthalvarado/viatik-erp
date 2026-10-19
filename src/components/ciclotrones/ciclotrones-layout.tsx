/**
 * Layout principal del módulo de Ciclotrones.
 *
 * Vista de dos paneles:
 *  Izquierda — lista de ciclotrones de la empresa
 *  Derecha   — producciones del ciclotrón seleccionado + análisis de batch
 */
import { useState } from "react";
import {
  Plus, Settings2, Trash2, Upload, ChevronRight,
  AlertCircle, AlertTriangle, CheckCircle2, Clock, Activity,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import type { Ciclotrón, CicloProduccion } from "@/types/entities";
import {
  useCiclotrones, useCicloProduccionesDeCiclotrón,
  useEliminarCiclotrón, useEliminarCicloProduccion,
  parsearParametros,
} from "@/hooks/entities/use-ciclotrones";
import { CiclotrónForm } from "./ciclotrón-form";
import { ProduccionUpload } from "./produccion-upload";
import { ProduccionAnalisis } from "./produccion-analisis";
import { CicloEvaluacionesTab } from "./ciclo-evaluaciones-tab";
import { CicloErrorLogsTab } from "./ciclo-error-logs-tab";

// ── Configuración visual de estados ──────────────────────────────────────────
const ESTADO_CFG: Record<CicloProduccion["estado"], {
  label: string; className: string; icon: React.ElementType;
}> = {
  pendiente:   { label: "Pendiente",   className: "bg-gray-100 text-gray-600",    icon: Clock },
  normal:      { label: "Normal",      className: "bg-green-100 text-green-700",  icon: CheckCircle2 },
  con_alertas: { label: "Con alertas", className: "bg-yellow-100 text-yellow-700",icon: AlertTriangle },
  critico:     { label: "Crítico",     className: "bg-red-100 text-red-700",      icon: AlertCircle },
};

function EstadoBadge({ estado }: { estado: CicloProduccion["estado"] }) {
  const cfg = ESTADO_CFG[estado];
  const Icon = cfg.icon;
  return (
    <Badge className={`${cfg.className} border-0 gap-1 text-xs`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

// ── Sub-componente: lista de producciones ─────────────────────────────────────
function ProduccionesList({
  ciclotrón,
  onSelect,
  selectedId,
  onUpload,
}: {
  ciclotrón: Ciclotrón;
  onSelect: (p: CicloProduccion) => void;
  selectedId: string | null;
  onUpload: () => void;
}) {
  const { data: producciones, isLoading } = useCicloProduccionesDeCiclotrón(ciclotrón.id);
  const eliminar = useEliminarCicloProduccion();

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Cargando…</p>;
  if (!producciones?.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground text-sm">
        <Activity className="h-8 w-8" />
        <p>No hay batches cargados aún</p>
        <Button size="sm" onClick={onUpload}>
          <Upload className="h-4 w-4 mr-2" /> Cargar primer batch
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {producciones.map((p) => (
        <div
          key={p.id}
          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
            ${selectedId === p.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
          onClick={() => onSelect(p)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">
                {p.tracer ?? "Batch"}
                {p.numero_batch != null && ` #${p.numero_batch}`}
              </span>
              <EstadoBadge estado={p.estado} />
              {p.anomalias_count > 0 && (
                <span className="text-xs text-red-600">{p.anomalias_count} anomalía(s)</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex gap-3">
              {p.fecha && (
                <span>{format(new Date(p.fecha.includes("T") ? p.fecha : p.fecha + "T00:00:00"), "dd MMM yyyy", { locale: es })}</span>
              )}
              {p.duracion_segundos != null && (
                <span>{Math.round(p.duracion_segundos / 60)} min</span>
              )}
              {p.target_i_setpoint != null && (
                <span>{p.target_i_setpoint.toFixed(0)} µA</span>
              )}
            </div>
            {p.notas && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{p.notas}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-600"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar producción</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminará el registro del batch y su análisis. El archivo en Storage también se eliminará.
                    Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => eliminar.mutate(p.id)}
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

// ── Layout principal ──────────────────────────────────────────────────────────
export function CiclotronsLayout() {
  const { data: ciclotrones, isLoading } = useCiclotrones();
  const eliminarCiclotrón = useEliminarCiclotrón();

  const [selectedCiclotrón, setSelectedCiclotrón] = useState<Ciclotrón | null>(null);
  const [selectedProduccion, setSelectedProduccion] = useState<CicloProduccion | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCiclotrón, setEditingCiclotrón] = useState<Ciclotrón | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showAnalisis, setShowAnalisis] = useState(false);
  const [activeTab, setActiveTab] = useState<"producciones" | "evaluaciones" | "error_logs">("producciones");

  function openEdit(c: Ciclotrón) {
    setEditingCiclotrón(c);
    setShowForm(true);
  }

  function openUpload(c: Ciclotrón) {
    setSelectedCiclotrón(c);
    setShowUpload(true);
  }

  function openAnalisis(p: CicloProduccion) {
    setSelectedProduccion(p);
    setShowAnalisis(true);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-lg font-semibold">Ciclotrones</h1>
          <p className="text-sm text-muted-foreground">
            Análisis de logs de producción — GE PETtrace 800
          </p>
        </div>
        <Button onClick={() => { setEditingCiclotrón(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo ciclotrón
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground p-6">Cargando ciclotrones…</p>
      )}

      {!isLoading && (!ciclotrones || ciclotrones.length === 0) && (
        <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
          <Activity className="h-12 w-12" />
          <p className="font-medium">No hay ciclotrones registrados</p>
          <p className="text-sm">Crea el primer perfil de ciclotrón para empezar a cargar logs de producción.</p>
          <Button onClick={() => { setEditingCiclotrón(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Crear ciclotrón
          </Button>
        </div>
      )}

      {/* Lista de ciclotrones */}
      {ciclotrones && ciclotrones.length > 0 && (
        <div className="flex flex-1 overflow-hidden">
          {/* Panel izquierdo: lista de ciclotrones */}
          <div className="w-72 border-r flex flex-col">
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-2">
                {ciclotrones.map((c) => (
                  <Card
                    key={c.id}
                    className={`cursor-pointer transition-colors hover:border-primary/50
                      ${selectedCiclotrón?.id === c.id ? "border-primary" : ""}`}
                    onClick={() => setSelectedCiclotrón(c)}
                  >
                    <CardHeader className="p-3 pb-1.5">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span className="truncate">{c.nombre}</span>
                        <div className="flex gap-1 ml-2 flex-shrink-0">
                          <Button
                            variant="ghost" size="icon" className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                          >
                            <Settings2 className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-red-600"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar ciclotrón</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se eliminarán también todas las producciones registradas.
                                  Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-600 hover:bg-red-700"
                                  onClick={() => {
                                    eliminarCiclotrón.mutate(c.id);
                                    if (selectedCiclotrón?.id === c.id) setSelectedCiclotrón(null);
                                  }}
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <p className="text-xs text-muted-foreground">{c.modelo}</p>
                      {c.sitio && <p className="text-xs text-muted-foreground">{c.sitio}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Panel derecho: producciones / evaluaciones del ciclotrón seleccionado */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedCiclotrón ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Selecciona un ciclotrón para ver sus datos
              </div>
            ) : (
              <>
                {/* Header del panel */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                  <div>
                    <h2 className="font-medium">{selectedCiclotrón.nombre}</h2>
                    <p className="text-xs text-muted-foreground">{selectedCiclotrón.sitio}</p>
                  </div>
                  {activeTab === "producciones" && (
                    <Button size="sm" onClick={() => openUpload(selectedCiclotrón)}>
                      <Upload className="h-4 w-4 mr-2" /> Cargar batch
                    </Button>
                  )}
                  {activeTab === "error_logs" && null}
                </div>

                {/* Tabs */}
                <div className="flex border-b bg-background px-4">
                  <button
                    className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === "producciones"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setActiveTab("producciones")}
                  >
                    Producciones
                  </button>
                  <button
                    className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === "evaluaciones"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setActiveTab("evaluaciones")}
                  >
                    Evaluaciones
                  </button>
                  <button
                    className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === "error_logs"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setActiveTab("error_logs")}
                  >
                    Error Logs
                  </button>
                </div>

                {/* Contenido del tab activo */}
                {activeTab === "producciones" && (
                  <ScrollArea className="flex-1 p-4">
                    <ProduccionesList
                      ciclotrón={selectedCiclotrón}
                      selectedId={selectedProduccion?.id ?? null}
                      onSelect={(p) => openAnalisis(p)}
                      onUpload={() => openUpload(selectedCiclotrón)}
                    />
                  </ScrollArea>
                )}
                {activeTab === "evaluaciones" && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <CicloEvaluacionesTab ciclotrón={selectedCiclotrón} />
                  </div>
                )}
                {activeTab === "error_logs" && (
                  <div className="flex-1 overflow-auto p-4">
                    <CicloErrorLogsTab ciclotrón={selectedCiclotrón} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CiclotrónForm
        open={showForm}
        onOpenChange={setShowForm}
        ciclotrón={editingCiclotrón}
      />

      {selectedCiclotrón && (
        <ProduccionUpload
          open={showUpload}
          onOpenChange={setShowUpload}
          ciclotrónId={selectedCiclotrón.id}
          params={parsearParametros(selectedCiclotrón)}
        />
      )}

      {/* Sheet de análisis — pantalla completa */}
      <Sheet open={showAnalisis} onOpenChange={setShowAnalisis}>
        <SheetContent
          side="right"
          className="!w-screen !max-w-full h-screen flex flex-col p-0 gap-0"
        >
          <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
            <SheetTitle>Análisis de producción</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden px-6 py-4">
            {selectedProduccion && selectedCiclotrón && (
              <ProduccionAnalisis
                produccion={selectedProduccion}
                params={parsearParametros(selectedCiclotrón)}
                ciclotrón={selectedCiclotrón}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
