/**
 * evaluacion-wizard.tsx
 * Wizard de 4 pasos para crear/continuar una evaluación de ciclotrón
 * DOC1604037 rev9 — GE PETtrace 800
 */
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CicloEvaluacion } from "@/types/entities";
import { useCrearEvaluacion } from "@/hooks/entities/use-evaluaciones";
import { useCiclotrones } from "@/hooks/entities/use-ciclotrones";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Step1InfoGeneral } from "./wizard-steps/step1-info-general";
import { Step2InspeccionSitio } from "./wizard-steps/step2-inspeccion-sitio";
import { Step3PerformanceTest } from "./wizard-steps/step3-performance-test";
import { Step4SystemEvaluation } from "./wizard-steps/step4-system-evaluation";

// ── Pasos del wizard ──────────────────────────────────────────────────────────

const PASOS = [
  { id: 1, label: "Info General",        desc: "Ciclotrón, tipo y configuración" },
  { id: 2, label: "Inspección de Sitio", desc: "Sitio, sala de equipo y ciclotrón" },
  { id: 3, label: "Performance Test",    desc: "9 sub-tests con PASS/FAIL" },
  { id: 4, label: "System Evaluation",   desc: "10 producciones dual beam" },
];

// ── Detectar paso inicial según datos ya guardados ────────────────────────────

function detectarPasoInicial(ev: CicloEvaluacion): number {
  // Si ya tiene datos de performance, ir al paso 4
  const perf = ev.datos_performance;
  if (perf && (
    perf.isocronos?.length || perf.rfProton || perf.mainVoltage ||
    perf.iarcVsBeam?.length || perf.ionSource || perf.transmision?.length ||
    perf.vacuumTightness?.length || perf.vacuumLeak?.length
  )) return 4;
  // Si ya tiene datos de sitio, ir al paso 3
  const sitio = ev.datos_sitio;
  if (sitio && Object.values(sitio).some(v => v != null && v !== "")) return 3;
  // Por defecto, ir al paso 2
  return 2;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onCancel:            () => void;
  onComplete:          (ev: CicloEvaluacion) => void;
  defaultCiclotrónId?: string;
  /** Borrador existente para continuar donde se dejó */
  evaluacionInicial?:  CicloEvaluacion;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function EvaluacionWizard({ onCancel, onComplete, defaultCiclotrónId, evaluacionInicial }: Props) {
  const [paso, setPaso]       = useState(() =>
    evaluacionInicial ? detectarPasoInicial(evaluacionInicial) : 1
  );
  const [evaluacion, setEval] = useState<CicloEvaluacion | null>(evaluacionInicial ?? null);
  const [ingenieroNombre, setIngenieroNombre] = useState("");

  const crear = useCrearEvaluacion();
  const { data: ciclotrones = [] } = useCiclotrones();
  const { user } = useAuth();

  // Cargar nombre del usuario conectado desde public.usuarios
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("usuarios")
      .select("nombres, apellidos")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setIngenieroNombre(`${data.nombres ?? ""} ${data.apellidos ?? ""}`.trim());
        }
      });
  }, [user?.id]);

  // Avanza al paso siguiente
  function handleNext(ev: CicloEvaluacion) {
    setEval(ev);
    if (paso < 4) setPaso(paso + 1);
    else onComplete(ev);
  }

  // El paso 1 crea la evaluación; los pasos 2-4 actualizan secciones
  function handleStep1(ev: CicloEvaluacion) {
    setEval(ev);
    setPaso(2);
  }

  return (
    <div className="space-y-0">
      {/* Header con stepper */}
      <div className="border-b pb-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Cancelar
          </Button>
          <h2 className="text-lg font-semibold">Nueva Evaluación</h2>
        </div>

        {/* Stepper visual */}
        <div className="flex items-start gap-0">
          {PASOS.map((p, i) => (
            <div key={p.id} className="flex items-start flex-1">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors",
                  paso > p.id
                    ? "bg-primary border-primary text-primary-foreground"
                    : paso === p.id
                    ? "border-primary text-primary bg-primary/10"
                    : "border-muted-foreground/30 text-muted-foreground"
                )}>
                  {paso > p.id ? <Check className="h-4 w-4" /> : p.id}
                </div>
                <div className="text-center mt-1 px-1">
                  <p className={cn("text-xs font-medium", paso === p.id ? "text-primary" : "text-muted-foreground")}>
                    {p.label}
                  </p>
                </div>
              </div>
              {i < PASOS.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 mt-4 mx-1 transition-colors",
                  paso > p.id ? "bg-primary" : "bg-muted-foreground/20"
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contenido del paso */}
      <div className="min-h-[500px]">
        {paso === 1 && (
          <Step1InfoGeneral
            ciclotrones={ciclotrones}
            crear={crear}
            onNext={handleStep1}
            defaultCiclotrónId={defaultCiclotrónId}
            defaultIngenieroNombre={ingenieroNombre}
          />
        )}
        {paso === 2 && evaluacion && (
          <Step2InspeccionSitio
            evaluacion={evaluacion}
            onNext={handleNext}
            onBack={() => setPaso(1)}
            ingenieroNombre={evaluacion.ingeniero_nombre ?? ingenieroNombre}
          />
        )}
        {paso === 3 && evaluacion && (
          <Step3PerformanceTest
            evaluacion={evaluacion}
            onNext={handleNext}
            onBack={() => setPaso(2)}
          />
        )}
        {paso === 4 && evaluacion && (
          <Step4SystemEvaluation
            evaluacion={evaluacion}
            onNext={onComplete}
            onBack={() => setPaso(3)}
          />
        )}
      </div>
    </div>
  );
}
