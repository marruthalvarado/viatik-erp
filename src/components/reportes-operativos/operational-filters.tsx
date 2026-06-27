/**
 * Filtros globales para Reportes Operativos — FASE 8D
 *
 * Selectores: Año, Mes Desde, Mes Hasta, Estado (rendición).
 * Persistencia manejada por el layout vía loadFiltrosOperativos / saveFiltrosOperativos.
 */
import { RotateCcw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { defaultFiltrosOperativos, type FiltrosOperativos } from "./operational-filter-types";

export type { FiltrosOperativos } from "./operational-filter-types";

interface OperationalFiltersProps {
  filtros: FiltrosOperativos;
  onFiltrosChange: (f: FiltrosOperativos) => void;
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

const currentYear = new Date().getFullYear();
const ANIOS = Array.from({ length: 5 }, (_, i) => currentYear - i);

function mesDesde(f: FiltrosOperativos) {
  return f.fecha_desde.slice(5, 7);
}

function mesHasta(f: FiltrosOperativos) {
  return f.fecha_hasta.slice(5, 7);
}

export function OperationalFilters({ filtros, onFiltrosChange }: OperationalFiltersProps) {
  const anio = filtros.anio;

  function setAnio(val: string) {
    const y = Number(val);
    onFiltrosChange({
      ...filtros,
      anio: y,
      fecha_desde: `${y}-${mesDesde(filtros)}-01`,
      fecha_hasta: `${y}-${mesHasta(filtros)}-${lastDay(y, Number(mesHasta(filtros)))}`,
    });
  }

  function setMesDesde(mes: string) {
    onFiltrosChange({
      ...filtros,
      fecha_desde: `${anio}-${mes}-01`,
    });
  }

  function setMesHasta(mes: string) {
    const d = lastDay(anio, Number(mes));
    onFiltrosChange({
      ...filtros,
      fecha_hasta: `${anio}-${mes}-${d}`,
    });
  }

  function handleReset() {
    onFiltrosChange(defaultFiltrosOperativos());
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Año */}
      <Select value={String(anio)} onValueChange={setAnio}>
        <SelectTrigger className="h-8 w-[90px] text-xs" aria-label="Seleccionar año">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ANIOS.map((y) => (
            <SelectItem key={y} value={String(y)} className="text-xs">
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Mes desde */}
      <Select value={mesDesde(filtros)} onValueChange={setMesDesde}>
        <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Mes inicio">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MESES.map((m) => (
            <SelectItem key={m.value} value={m.value} className="text-xs">
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-xs text-muted-foreground">—</span>

      {/* Mes hasta */}
      <Select value={mesHasta(filtros)} onValueChange={setMesHasta}>
        <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Mes fin">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MESES.map((m) => (
            <SelectItem key={m.value} value={m.value} className="text-xs">
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Reset */}
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={handleReset}
        aria-label="Restablecer filtros operativos"
      >
        <RotateCcw className="size-3.5" />
      </Button>
    </div>
  );
}

// Devuelve el ultimo dia del mes (zeropadded string)
function lastDay(year: number, month: number): string {
  return String(new Date(year, month, 0).getDate()).padStart(2, "0");
}
