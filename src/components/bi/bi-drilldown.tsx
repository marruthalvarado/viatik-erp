/**
 * Componentes de drill-down del Dashboard Ejecutivo BI.
 *
 * Provee enlaces de navegación contextual con icono, etiqueta y contador.
 * Usado en alertas, KPIs y gráficos para navegar a módulos relacionados.
 */
import { type LucideIcon, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrillDownLinkProps {
  label: string;
  onClick: () => void;
  count?: number;
  icon?: LucideIcon;
  className?: string;
}

/**
 * Enlace de drill-down inline.
 * Renderiza una etiqueta clicable que navega a otro módulo del ERP.
 */
export function DrillDownLink({
  label,
  onClick,
  count,
  icon: Icon,
  className,
}: DrillDownLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    >
      {Icon && <Icon className="size-3 shrink-0" aria-hidden="true" />}
      <span>{label}</span>
      {count != null && (
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-semibold tabular-nums">
          {count}
        </span>
      )}
      <ExternalLink className="size-2.5 shrink-0 opacity-60" aria-hidden="true" />
    </button>
  );
}

interface DrillDownBarProps {
  items: Array<{
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
    count?: number;
  }>;
  className?: string;
}

/**
 * Barra horizontal de accesos rápidos de drill-down.
 * Usada en la sección inferior del Dashboard para acceso a reportes relacionados.
 */
export function DrillDownBar({ items, className }: DrillDownBarProps) {
  return (
    <div className={cn("flex flex-wrap gap-3 rounded-xl border bg-card px-5 py-3", className)}>
      <span className="self-center text-xs font-medium text-muted-foreground">Accesos:</span>
      {items.map((item, i) => (
        <DrillDownLink
          key={i}
          label={item.label}
          onClick={item.onClick}
          icon={item.icon}
          count={item.count}
        />
      ))}
    </div>
  );
}
