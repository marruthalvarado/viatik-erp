/**
 * Filtros globales del Dashboard Ejecutivo.
 * Año, mes, cliente y proyecto (proyectos filtrados por cliente).
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { ProyectoSimple, ClienteSimple } from "@/services/dashboard";

const MES_LABELS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function buildYearOptions(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y >= current - 4; y--) years.push(y);
  return years;
}

interface DashboardFiltersProps {
  anio: number;
  onAnioChange: (anio: number) => void;
  mes: number | null;
  onMesChange: (mes: number | null) => void;
  clienteId: string | null;
  onClienteChange: (id: string | null) => void;
  proyectoId: string | null;
  onProyectoChange: (id: string | null) => void;
  clientes: ClienteSimple[];
  proyectos: ProyectoSimple[];
}

export function DashboardFilters({
  anio,
  onAnioChange,
  mes,
  onMesChange,
  clienteId,
  onClienteChange,
  proyectoId,
  onProyectoChange,
  clientes,
  proyectos,
}: DashboardFiltersProps) {
  const years = buildYearOptions();
  const hasFilters = mes !== null || clienteId !== null || proyectoId !== null;

  // Filtrar proyectos por cliente seleccionado
  const proyectosFiltrados = clienteId
    ? proyectos.filter((p) => p.cliente_id === clienteId)
    : proyectos;

  function handleClienteChange(id: string | null) {
    onClienteChange(id);
    onProyectoChange(null); // reset proyecto al cambiar cliente
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Año */}
      <Select value={String(anio)} onValueChange={(v) => onAnioChange(Number(v))}>
        <SelectTrigger className="w-24 h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Mes */}
      <Select
        value={mes !== null ? String(mes) : "__todos__"}
        onValueChange={(v) => onMesChange(v === "__todos__" ? null : Number(v))}
      >
        <SelectTrigger className="w-32 h-8 text-sm">
          <SelectValue placeholder="Todos los meses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__todos__">Todos los meses</SelectItem>
          {MES_LABELS.map((label, i) => (
            <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Cliente */}
      {clientes.length > 0 && (
        <Select
          value={clienteId ?? "__todos__"}
          onValueChange={(v) => handleClienteChange(v === "__todos__" ? null : v)}
        >
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue placeholder="Todos los clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos los clientes</SelectItem>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Proyecto (filtrado por cliente si hay uno seleccionado) */}
      {proyectosFiltrados.length > 0 && (
        <Select
          value={proyectoId ?? "__todos__"}
          onValueChange={(v) => onProyectoChange(v === "__todos__" ? null : v)}
        >
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue placeholder="Todos los proyectos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos los proyectos</SelectItem>
            {proyectosFiltrados.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Limpiar filtros */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-muted-foreground"
          onClick={() => {
            onMesChange(null);
            onClienteChange(null);
            onProyectoChange(null);
          }}
        >
          <X className="size-3" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
