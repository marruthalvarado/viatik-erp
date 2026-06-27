/**
 * Panel de alertas ejecutivas del Dashboard BI.
 *
 * Alertas implementadas (con severidad, icono y contador):
 *   · CRÍTICO: Proyectos sobre presupuesto (pct_ejecucion > 1)
 *   · ALTO:    Presupuesto >90% ejecutado (pct_ejecucion > 0.9)
 *   · ALTO:    Gastos que exceden política (excedente > 0)
 *   · MEDIO:   Rendiciones vencidas >30 días sin resolver
 *   · INFO:    Rendiciones pendientes de aprobación
 */
import { AlertTriangle, AlertCircle, Clock, CheckCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  EjecucionPresupuestariaRow,
  CumplimientoPoliticaRow,
  RendicionEstadoRow,
} from "@/types/reportes";

type Severidad = "critico" | "alto" | "medio" | "info";

interface Alerta {
  id: string;
  severidad: Severidad;
  titulo: string;
  contador: number;
  descripcion: string;
  ruta: string;
}

interface BiAlertsProps {
  ejecucion: EjecucionPresupuestariaRow[];
  cumplimiento: CumplimientoPoliticaRow[];
  rendiciones: RendicionEstadoRow[];
  pendientes: number;
  loading: boolean;
  onNavigate: (ruta: string) => void;
}

const SEVERIDAD_STYLES: Record<Severidad, string> = {
  critico: "border-destructive/40 bg-destructive/5 text-destructive",
  alto: "border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400",
  medio: "border-orange-400/40 bg-orange-400/5 text-orange-600 dark:text-orange-400",
  info: "border-primary/30 bg-primary/5 text-primary",
};

const SEVERIDAD_ICON: Record<Severidad, React.ElementType> = {
  critico: AlertCircle,
  alto: AlertTriangle,
  medio: Clock,
  info: Info,
};

function AlertaItem({
  alerta,
  onNavigate,
}: {
  alerta: Alerta;
  onNavigate: (ruta: string) => void;
}) {
  const Icon = SEVERIDAD_ICON[alerta.severidad];
  return (
    <button
      type="button"
      onClick={() => onNavigate(alerta.ruta)}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-opacity hover:opacity-80",
        SEVERIDAD_STYLES[alerta.severidad],
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">{alerta.titulo}</span>
            <span className="shrink-0 rounded-full bg-current/10 px-1.5 py-0.5 text-xs font-bold tabular-nums">
              {alerta.contador}
            </span>
          </div>
          <p className="mt-0.5 text-xs opacity-80">{alerta.descripcion}</p>
        </div>
      </div>
    </button>
  );
}

function buildAlertas(
  ejecucion: EjecucionPresupuestariaRow[],
  cumplimiento: CumplimientoPoliticaRow[],
  rendiciones: RendicionEstadoRow[],
  pendientes: number,
): Alerta[] {
  const alertas: Alerta[] = [];

  const sobrePresupuesto = ejecucion.filter((r) => (r.pct_ejecucion ?? 0) > 1);
  if (sobrePresupuesto.length > 0) {
    alertas.push({
      id: "sobre-presupuesto",
      severidad: "critico",
      titulo: "Proyectos sobre presupuesto",
      contador: sobrePresupuesto.length,
      descripcion: "Categorías que superaron el monto presupuestado.",
      ruta: "/proyectos",
    });
  }

  const presupuestoAlto = ejecucion.filter(
    (r) => (r.pct_ejecucion ?? 0) > 0.9 && (r.pct_ejecucion ?? 0) <= 1,
  );
  if (presupuestoAlto.length > 0) {
    alertas.push({
      id: "presupuesto-90",
      severidad: "alto",
      titulo: "Presupuesto >90% ejecutado",
      contador: presupuestoAlto.length,
      descripcion: "Categorías con margen crítico de presupuesto.",
      ruta: "/proyectos",
    });
  }

  const excedentes = cumplimiento.filter((r) => (r.excedente ?? 0) > 0);
  if (excedentes.length > 0) {
    alertas.push({
      id: "excede-politica",
      severidad: "alto",
      titulo: "Gastos que exceden política",
      contador: excedentes.length,
      descripcion: "Gastos por encima del tope de política vigente.",
      ruta: "/rendiciones",
    });
  }

  const vencidas = rendiciones.filter(
    (r) =>
      (r.dias_en_estado ?? 0) > 30 &&
      r.estado_codigo !== "aprobada" &&
      r.estado_codigo !== "rechazada",
  );
  if (vencidas.length > 0) {
    alertas.push({
      id: "vencidas",
      severidad: "medio",
      titulo: "Rendiciones vencidas",
      contador: vencidas.length,
      descripcion: "Más de 30 días sin resolución.",
      ruta: "/rendiciones",
    });
  }

  if (pendientes > 0) {
    alertas.push({
      id: "pendientes",
      severidad: "info",
      titulo: "Pendientes de aprobación",
      contador: pendientes,
      descripcion: "Rendiciones esperando acción del aprobador.",
      ruta: "/workflow",
    });
  }

  return alertas;
}

export function BiAlerts({
  ejecucion,
  cumplimiento,
  rendiciones,
  pendientes,
  loading,
  onNavigate,
}: BiAlertsProps) {
  const alertas = buildAlertas(ejecucion, cumplimiento, rendiciones, pendientes);

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold tracking-tight">Alertas ejecutivas</h2>

      {loading ? (
        <div className="py-8 text-center text-xs text-muted-foreground">Calculando alertas…</div>
      ) : alertas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CheckCircle className="size-8 text-success" />
          <p className="text-xs text-muted-foreground">Sin alertas activas para el período.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alertas.map((a) => (
            <AlertaItem key={a.id} alerta={a} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </section>
  );
}
