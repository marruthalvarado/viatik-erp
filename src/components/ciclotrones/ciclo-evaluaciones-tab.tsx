/**
 * ciclo-evaluaciones-tab.tsx
 * Tab de Evaluaciones dentro del panel de detalle de un ciclotrón.
 * Muestra las evaluaciones del equipo y permite crear nuevas con el
 * ciclotrón pre-seleccionado en el wizard.
 */
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Plus, CheckCircle2, XCircle, Clock,
  ChevronRight, Trash2, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Ciclotrón } from "@/types/entities";
import type { CicloEvaluacion } from "@/types/entities";
import { useEvaluacionesByCiclotrón, useEliminarEvaluacion } from "@/hooks/entities/use-evaluaciones";
import { EvaluacionWizard } from "@/components/evaluaciones/evaluacion-wizard";
import { EvaluacionDetalle } from "@/components/evaluaciones/evaluacion-detalle";

// ── Helpers de badge ──────────────────────────────────────────────────────────

function BadgeResultado({ resultado }: { resultado: CicloEvaluacion["resultado_general"] }) {
  if (resultado === "pass")
    return <Badge className="bg-green-100 text-green-800 gap-1 text-xs"><CheckCircle2 className="h-3 w-3" />PASS</Badge>;
  if (resultado === "fail")
    return <Badge className="bg-red-100 text-red-800 gap-1 text-xs"><XCircle className="h-3 w-3" />FAIL</Badge>;
  return <Badge variant="outline" className="gap-1 text-xs"><Clock className="h-3 w-3" />Pendiente</Badge>;
}

function BadgeEstado({ estado }: { estado: CicloEvaluacion["estado"] }) {
  if (estado === "completado") return <Badge className="bg-green-100 text-green-800 text-xs">Completado</Badge>;
  if (estado === "en_progreso") return <Badge className="bg-blue-100 text-blue-800 text-xs">En progreso</Badge>;
  return <Badge variant="secondary" className="text-xs">Borrador</Badge>;
}

const TIPO_MAP: Record<string, string> = {
  assessment:       "Assessment",
  upgrade_eval:     "Upgrade Eval",
  eosss:            "EoSSS",
  "10yr_refurbish": "10 Años",
};

// ── Componente ────────────────────────────────────────────────────────────────

interface Props {
  ciclotrón: Ciclotrón;
}

export function CicloEvaluacionesTab({ ciclotrón }: Props) {
  const { data: evaluaciones = [], isLoading } = useEvaluacionesByCiclotrón(ciclotrón.id);
  const eliminar = useEliminarEvaluacion();

  const [showWizard, setShowWizard]           = useState(false);
  const [wizardEv, setWizardEv]               = useState<CicloEvaluacion | undefined>(undefined);
  const [selectedEv, setSelectedEv]           = useState<CicloEvaluacion | null>(null);
  const [confirmDelete, setConfirmDelete]     = useState<string | null>(null);

  function openNueva() {
    setWizardEv(undefined);
    setShowWizard(true);
  }

  function openContinuar(ev: CicloEvaluacion) {
    setWizardEv(ev);
    setShowWizard(true);
  }

  function handleRowClick(ev: CicloEvaluacion) {
    if (ev.estado === "borrador") {
      openContinuar(ev);
    } else {
      setSelectedEv(ev);
    }
  }

  function handleWizardDone(ev: CicloEvaluacion) {
    setShowWizard(false);
    setWizardEv(undefined);
    setSelectedEv(ev);
  }

  function handleWizardClose(open: boolean) {
    if (!open) {
      setShowWizard(false);
      setWizardEv(undefined);
    }
  }

  return (
    <>
      <ScrollArea className="flex-1 px-4 pt-3 pb-6">
        {/* Sub-header */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Evaluaciones
          </p>
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={openNueva}>
            <Plus className="h-3 w-3" />
            Nueva
          </Button>
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground py-6 text-center">Cargando…</p>
        )}

        {!isLoading && evaluaciones.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
            <ClipboardList className="h-8 w-8" />
            <p className="text-sm">No hay evaluaciones para este ciclotrón</p>
            <Button size="sm" onClick={openNueva} className="gap-1">
              <Plus className="h-3 w-3" />
              Nueva Evaluación
            </Button>
          </div>
        )}

        {evaluaciones.length > 0 && (
          <div className="space-y-2">
            {evaluaciones.map(ev => (
              <div
                key={ev.id}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleRowClick(ev)}
              >
                {/* Icono resultado */}
                <div className="flex-none">
                  {ev.resultado_general === "pass"
                    ? <CheckCircle2 className="h-6 w-6 text-green-500" />
                    : ev.resultado_general === "fail"
                    ? <XCircle className="h-6 w-6 text-red-500" />
                    : <Clock className="h-6 w-6 text-muted-foreground" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium">{ev.numero}</span>
                    <Badge variant="outline" className="text-xs">{TIPO_MAP[ev.tipo_evaluacion] ?? ev.tipo_evaluacion}</Badge>
                    <BadgeEstado estado={ev.estado} />
                    <BadgeResultado resultado={ev.resultado_general} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(ev.fecha), "d MMM yyyy", { locale: es })}
                    {ev.ingeniero_nombre && ` · Ing. ${ev.ingeniero_nombre}`}
                  </p>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  {ev.estado === "borrador" && (
                    <Button
                      variant="ghost" size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-red-600"
                      onClick={() => setConfirmDelete(ev.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Wizard — Sheet full-width (nueva o continuar borrador) */}
      <Sheet open={showWizard} onOpenChange={handleWizardClose}>
        <SheetContent
          side="right"
          className="!w-screen !max-w-full h-screen flex flex-col p-0 gap-0"
        >
          <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
            <SheetTitle>
              {wizardEv
                ? `Continuar evaluación ${wizardEv.numero} — ${ciclotrón.nombre}`
                : `Nueva Evaluación — ${ciclotrón.nombre}`}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 px-6 py-4">
            <EvaluacionWizard
              defaultCiclotrónId={ciclotrón.id}
              evaluacionInicial={wizardEv}
              onCancel={() => handleWizardClose(false)}
              onComplete={handleWizardDone}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Detalle evaluación — Sheet full-width */}
      <Sheet open={!!selectedEv} onOpenChange={o => !o && setSelectedEv(null)}>
        <SheetContent
          side="right"
          className="!w-screen !max-w-full h-screen flex flex-col p-0 gap-0"
        >
          <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
            <SheetTitle>Evaluación {selectedEv?.numero}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 px-6 py-4">
            {selectedEv && (
              <EvaluacionDetalle
                evaluacion={selectedEv}
                onBack={() => setSelectedEv(null)}
              />
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Confirm delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar evaluación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es irreversible. Solo se pueden eliminar evaluaciones en borrador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (confirmDelete) eliminar.mutate({ evalId: confirmDelete, ciclotrónId: ciclotrón.id });
                setConfirmDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
