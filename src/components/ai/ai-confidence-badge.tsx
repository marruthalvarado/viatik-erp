/**
 * ai-confidence-badge.tsx — IA-3
 *
 * Badge visual de confianza de la extracción IA.
 *
 * Niveles:
 *   ≥95%  → verde (alta confianza, prellenado confiable)
 *   80-94% → amarillo (revisar campos marcados)
 *   <80%   → rojo (revisión manual recomendada)
 */
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AiConfidenceBadgeProps {
  confianza: number;
  /** Muestra el porcentaje numérico junto al nivel. Default: true. */
  showPercent?: boolean;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type NivelConfianza = "alta" | "media" | "baja";

function getNivel(confianza: number): NivelConfianza {
  if (confianza >= 95) return "alta";
  if (confianza >= 80) return "media";
  return "baja";
}

const CONFIG: Record<
  NivelConfianza,
  {
    label: string;
    descripcion: string;
    icon: React.ComponentType<{ className?: string }>;
    clases: string;
  }
> = {
  alta: {
    label: "Alta confianza",
    descripcion: "El documento fue extraído con alta precisión.",
    icon: CheckCircle2,
    clases: "bg-emerald-50 border-emerald-200 text-emerald-800",
  },
  media: {
    label: "Confianza media",
    descripcion: "Revisa los campos resaltados antes de guardar.",
    icon: AlertTriangle,
    clases: "bg-amber-50 border-amber-200 text-amber-800",
  },
  baja: {
    label: "Revisión manual",
    descripcion: "La extracción fue imprecisa. Verifica todos los campos.",
    icon: XCircle,
    clases: "bg-red-50 border-red-200 text-red-700",
  },
};

// ─── Componente ───────────────────────────────────────────────────────────────

export function AiConfidenceBadge({
  confianza,
  showPercent = true,
  className,
}: AiConfidenceBadgeProps) {
  const nivel = getNivel(confianza);
  const { label, descripcion, icon: Icon, clases } = CONFIG[nivel];

  return (
    <div
      role="status"
      aria-label={`Confianza IA: ${label} (${confianza}%)`}
      className={cn("flex items-start gap-2 rounded-lg border px-3 py-2", clases, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {label}
          {showPercent && (
            <span className="ml-1.5 text-xs font-normal opacity-70">({confianza}%)</span>
          )}
        </p>
        <p className="text-xs opacity-80">{descripcion}</p>
      </div>
    </div>
  );
}

/** Versión compacta (solo ícono + porcentaje) para tablas o listas. */
export function AiConfidenceChip({
  confianza,
  className,
}: {
  confianza: number;
  className?: string;
}) {
  const nivel = getNivel(confianza);
  const { icon: Icon, clases } = CONFIG[nivel];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        clases,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {confianza}%
    </span>
  );
}
