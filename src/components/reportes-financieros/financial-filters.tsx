/**
 * Controles de filtros para Reportes Financieros.
 * UI pura — el estado y localStorage viven en reportes-financieros-layout.tsx.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { type FiltrosFinancieros, defaultFiltrosFinancieros } from "./financial-filter-types";

export type { FiltrosFinancieros } from "./financial-filter-types";

interface FinancialFiltersProps {
  filtros: FiltrosFinancieros;
  onFiltrosChange: (f: FiltrosFinancieros) => void;
}

function buildYears(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => current - i);
}

const MESES = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

export function FinancialFilters({ filtros, onFiltrosChange }: FinancialFiltersProps) {
  const years = buildYears();

  function onAnio(v: string) {
    const y = Number(v);
    onFiltrosChange({ ...filtros, anio: y, fecha_desde: `${y}-01-01`, fecha_hasta: `${y}-12-31` });
  }

  function onMesDesde(v: string) {
    const y = filtros.anio;
    onFiltrosChange({ ...filtros, fecha_desde: `${y}-${v}-01` });
  }

  function onMesHasta(v: string) {
    const y = filtros.anio;
    const ultimo = new Date(y, Number(v), 0).getDate();
    onFiltrosChange({ ...filtros, fecha_hasta: `${y}-${v}-${String(ultimo).padStart(2, "0")}` });
  }

  const mesDesde = filtros.fecha_desde.slice(5, 7);
  const mesHasta = filtros.fecha_hasta.slice(5, 7);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Período:</span>

      <Select value={String(filtros.anio)} onValueChange={onAnio}>
        <SelectTrigger className="h-8 w-24 text-xs" aria-label="Seleccionar año">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={mesDesde} onValueChange={onMesDesde}>
        <SelectTrigger className="h-8 w-28 text-xs" aria-label="Mes desde">
          <SelectValue placeholder="Desde" />
        </SelectTrigger>
        <SelectContent>
          {MESES.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-xs text-muted-foreground">-</span>

      <Select value={mesHasta} onValueChange={onMesHasta}>
        <SelectTrigger className="h-8 w-28 text-xs" aria-label="Mes hasta">
          <SelectValue placeholder="Hasta" />
        </SelectTrigger>
        <SelectContent>
          {MESES.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label="Restablecer filtros"
        onClick={() => onFiltrosChange(defaultFiltrosFinancieros())}
      >
        <RotateCcw className="size-3.5" />
      </Button>
    </div>
  );
}
