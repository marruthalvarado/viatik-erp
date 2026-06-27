/**
 * Filtros globales del Dashboard Ejecutivo.
 * Año actual y selección de rango.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardFiltersProps {
  anio: number;
  onAnioChange: (anio: number) => void;
}

function buildYearOptions(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y >= current - 4; y--) {
    years.push(y);
  }
  return years;
}

export function DashboardFilters({ anio, onAnioChange }: DashboardFiltersProps) {
  const years = buildYearOptions();

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">Período:</span>
      <Select value={String(anio)} onValueChange={(v) => onAnioChange(Number(v))}>
        <SelectTrigger className="w-28 h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
          <SelectItem value="0">Todos</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
