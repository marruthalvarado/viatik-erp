/**
 * evaluaciones-layout.tsx
 * Lista de evaluaciones de ciclotrón + botón nueva evaluación
 */
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ClipboardList, Plus, CheckCircle2, XCircle,
  Clock, ChevronRight, Trash2, FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useCompany } from "@/contexts/company-context";
import { useEvaluaciones, useEliminarEvaluacion } from "@/hooks/entities/use-evaluaciones";
import type { CicloEvaluacion } from "@/types/entities";

const ADMIN_ROLES = ["admin", "SUPER_ADMIN"];
import { EvaluacionWizard } from "./evaluacion-wizard";
import { EvaluacionDetalle } from "./evaluacion-detalle";

// ── Badges ────────────────────────────────────────────────────────────────────

function BadgeEstado({ estado }: { estado: CicloEvaluacion["estado"] }) {
  if (estado === "completado") return <Badge className="bg-green-100 text-green-800">Completado</Badge>;
  if (estado === "en_progreso") return <Badge className="bg-blue-100 text-blue-800">En progreso</Badge>;
  return <Badge variant="secondary">Borrador</Badge>;
}

function BadgeResultado({ resultado }: { resultado: CicloEvaluacion["resultado_general"] }) {
  if (resultado === "pass")
    return <Badge className="bg-green-100 text-green-800 gap-1"><CheckCircle2 className="h-3 w-3" />PASS</Badge>;
  if (resultado === "fail")
    return <Badge className="bg-red-100 text-red-800 gap-1"><XCircle className="h-3 w-3" />FAIL</Badge>;
  return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pendiente</Badge>;
}

function badgeTipo(tipo: string) {
  const map: Record<string, string> = {
    assessment:      "Assessment",
    upgrade_eval:    "Upgrade Eval",
    eosss:           "EoSSS",
    "10yr_refurbish": "10 Años",
  };
  return map[tipo] ?? tipo;
}

// ── Componente principal ──────────────────────────────────────────────────────

export function EvaluacionesLayout() {
  const { rolActivo } = useCompany();
  const isAdmin = ADMIN_ROLES.includes(rolActivo?.codigo ?? "");
  const { data: evaluaciones = [], isLoading } = useEvaluaciones();
  const eliminar = useEliminarEvaluacion();

  const [showWizard, setShowWizard]             = useState(false);
  const [selectedId, setSelectedId]             = useState<string | null>(null);
  const [resumeEval, setResumeEval]             = useState<CicloEvaluacion | null>(null);
  const [confirmDelete, setConfirmDelete]       = useState<string | null>(null);

  const selected = evaluaciones.find(e => e.id === selectedId) ?? null;

  function handleNueva() {
    setSelectedId(null);
    setResumeEval(null);
    setShowWizard(true);
  }

  function handleClickEval(ev: CicloEvaluacion) {
    if (ev.estado === "borrador") {
      // Reanudar en el wizard desde donde se dejó
      setResumeEval(ev);
      setShowWizard(true);
    } else {
      setSelectedId(ev.id);
    }
  }

  function handleWizardDone(eval_: CicloEvaluacion) {
    setShowWizard(false);
    setResumeEval(null);
    setSelectedId(eval_.id);
  }

  function handleWizardCancel() {
    setShowWizard(false);
    setResumeEval(null);
  }

  if (showWizard) {
    return (
      <EvaluacionWizard
        onCancel={handleWizardCancel}
        onComplete={handleWizardDone}
        evaluacionInicial={resumeEval ?? undefined}
      />
    );
  }

  if (selectedId && selected) {
    return (
      <EvaluacionDetalle
        evaluacion={selected}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Evaluaciones de Ciclotrón</h2>
          <Badge variant="secondary">{evaluaciones.length}</Badge>
        </div>
        <Button onClick={handleNueva} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Evaluación
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Cargando…</div>
      ) : evaluaciones.length === 0 ? (
        <div className="border rounded-lg p-12 text-center space-y-2">
          <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="font-medium">No hay evaluaciones registradas</p>
          <p className="text-sm text-muted-foreground">
            Crea una nueva evaluación para iniciar el protocolo DOC1604037
          </p>
          <Button onClick={handleNueva} className="mt-2 gap-2">
            <Plus className="h-4 w-4" />
            Nueva Evaluación
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {evaluaciones.map(ev => (
            <div
              key={ev.id}
              className="flex items-center gap-4 p-4 hover:bg-muted/40 cursor-pointer transition-colors"
              onClick={() => handleClickEval(ev)}
            >
              {/* Icono resultado */}
              <div className="flex-none">
                {ev.resultado_general === "pass"
                  ? <CheckCircle2 className="h-8 w-8 text-green-500" />
                  : ev.resultado_general === "fail"
                  ? <XCircle className="h-8 w-8 text-red-500" />
                  : <Clock className="h-8 w-8 text-muted-foreground" />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{ev.numero}</span>
                  <Badge variant="outline" className="text-xs">{badgeTipo(ev.tipo_evaluacion)}</Badge>
                  <BadgeEstado estado={ev.estado} />
                  <BadgeResultado resultado={ev.resultado_general} />
                  {ev.tiene_deuterio && (
                    <Badge variant="outline" className="text-xs text-purple-700 border-purple-300">D-mode</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                  <span>{format(new Date(ev.fecha), "d MMM yyyy", { locale: es })}</span>
                  {ev.modelo_pt && <span>{ev.modelo_pt}</span>}
                  {ev.ingeniero_nombre && <span>Ing. {ev.ingeniero_nombre}</span>}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2">
                {ev.estado === "borrador" && (
                  <span className="text-xs text-blue-600 font-medium hidden sm:inline">Continuar →</span>
                )}
                <div onClick={e => e.stopPropagation()}>
                  {(ev.estado === "borrador" || isAdmin) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => setConfirmDelete(ev.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog confirmar eliminar */}
      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar evaluación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es irreversible y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (confirmDelete) {
                  const ev = evaluaciones.find(e => e.id === confirmDelete);
                  const force = isAdmin && ev?.estado !== "borrador";
                  eliminar.mutate({ evalId: confirmDelete, force });
                }
                setConfirmDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
