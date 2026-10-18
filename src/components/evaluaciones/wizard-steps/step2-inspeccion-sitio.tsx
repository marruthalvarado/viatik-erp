/**
 * step2-inspeccion-sitio.tsx
 * Paso 2: Inspección de Sitio (Hojas 1–5 condensadas)
 * DOC1604037 rev9
 */
import { useForm } from "react-hook-form";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import type { CicloEvaluacion, DatosSitio } from "@/types/entities";
import { useGuardarDatosSitio } from "@/hooks/entities/use-evaluaciones";

interface Props {
  evaluacion: CicloEvaluacion;
  onNext:     (ev: CicloEvaluacion) => void;
  onBack:     () => void;
}

export function Step2InspeccionSitio({ evaluacion, onNext, onBack }: Props) {
  const guardar = useGuardarDatosSitio();
  const { register, handleSubmit, watch, setValue } = useForm<DatosSitio>({
    defaultValues: evaluacion.datos_sitio ?? {},
  });

  async function onSubmit(data: DatosSitio) {
    const ev = await guardar.mutateAsync({ evalId: evaluacion.id, datos: data });
    onNext(ev);
  }

  const seccionHeader = (title: string, hint?: string) => (
    <div className="space-y-1">
      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">{title}</h3>
      {hint && <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1">{hint}</p>}
      <Separator />
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-2xl">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex gap-2 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 flex-none" />
        <span>
          Registra la información del sitio antes de realizar los tests.
          Todos los campos son opcionales pero ayudan a contextualizar el reporte final.
        </span>
      </div>

      {/* ── 1. Site Info ─────────────────────────────────────────────────── */}
      {seccionHeader("1. Site Info", "DOC1604037 — Tab 1.Site info")}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Año de instalación</Label>
          <Input type="number" {...register("anioInstalacion", { valueAsNumber: true })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nombre del cliente</Label>
          <Input {...register("clienteNombre")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nombre del sitio</Label>
          <Input {...register("sitioNombre")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Dirección del sitio</Label>
          <Input {...register("sitioAddress")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Site Manager</Label>
          <Input {...register("siteManagerNombre")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Contacto</Label>
          <Input {...register("contactoDetalles")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">System ID</Label>
          <Input {...register("ciclotrónSystemId")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Serial # (286XXX)</Label>
          <Input {...register("ciclotrónSerial")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">FE local (nombre)</Label>
          <Input {...register("localFeName")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Voltaje / Frecuencia</Label>
          <Input placeholder="ej. 220V / 60Hz" {...register("voltajeHertz")} />
        </div>
      </div>

      {/* ── 2. Master Room ───────────────────────────────────────────────── */}
      {seccionHeader("2. Master Room", "DOC1604037 — Tab 2.Master room")}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">PT Release (versión software)</Label>
          <Input placeholder="ej. 3.6.3" {...register("ptRelease")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">ACS Version</Label>
          <Input {...register("acsVersion")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">PSS Version</Label>
          <Input {...register("pssVersion")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Master Station modelo</Label>
          <Input {...register("masterStationModel")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Licencia (µA)</Label>
          <Input type="number" {...register("licenciaUA", { valueAsNumber: true })} />
        </div>
      </div>

      {/* ── 3. Equipment Room ────────────────────────────────────────────── */}
      {seccionHeader("3. Equipment Room", "DOC1604037 — Tab 3.Equipment room")}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Temperatura sala equipos (°C)</Label>
          <Input type="number" step="0.1" {...register("tempCuartoEquipos", { valueAsNumber: true })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Humedad sala equipos (%)</Label>
          <Input type="number" step="0.1" {...register("humedadCuartoEquipos", { valueAsNumber: true })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Vacío en Standby (mbar)</Label>
          <Input placeholder="ej. 1.3E-7" {...register("vacuumPressureStandby")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Vacío con haz (mbar)</Label>
          <Input placeholder="ej. 1.3E-5" {...register("vacuumPressureBeamOn")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">ACU versión</Label>
          <Input placeholder="OLD / NEW" {...register("acuVersion")} />
        </div>
      </div>

      {/* ── 4. Cyclotron Room ────────────────────────────────────────────── */}
      {seccionHeader("4. Cyclotron Room", "DOC1604037 — Tab 4.Cyclotron room")}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Tiempo desde última producción (h)</Label>
          <Input type="number" {...register("tiempoDesdeProduccion", { valueAsNumber: true })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Temperatura sala ciclotrón (°C)</Label>
          <Input type="number" step="0.1" {...register("tempCuartoCiclotrón", { valueAsNumber: true })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Humedad sala ciclotrón (%)</Label>
          <Input type="number" step="0.1" {...register("humedadCuartoCiclotrón", { valueAsNumber: true })} />
        </div>
      </div>

      {/* Radiación */}
      <div>
        <Label className="text-xs font-semibold">Medición de radiación (µSv/h)</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Herramienta: Gamma Survey meter calibrado. Anotar tiempo desde última producción arriba.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Punto 1 (100 cm)</Label>
            <Input type="number" step="0.1" {...register("radiacion100cm", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Punto 2 (30 cm)</Label>
            <Input type="number" step="0.1" {...register("radiacion30cm1", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Punto 3 (30 cm)</Label>
            <Input type="number" step="0.1" {...register("radiacion30cm2", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Punto 4 (0 cm)</Label>
            <Input type="number" step="0.1" {...register("radiacion0cm1", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Punto 5 (0 cm)</Label>
            <Input type="number" step="0.1" {...register("radiacion0cm2", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Punto 6 (0 cm)</Label>
            <Input type="number" step="0.1" {...register("radiacion0cm3", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Punto 7 (0 cm)</Label>
            <Input type="number" step="0.1" {...register("radiacion0cm4", { valueAsNumber: true })} />
          </div>
        </div>
      </div>

      {/* Targets por posición */}
      <div>
        <Label className="text-xs font-semibold">Targets instalados</Label>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {([1,2,3,4,5,6] as const).map(pos => (
            <div key={pos} className="space-y-1">
              <Label className="text-xs">Posición {pos}</Label>
              <Input
                placeholder="ej. NB25"
                {...register(`targetPos${pos}` as keyof DatosSitio)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. Other Info ────────────────────────────────────────────────── */}
      {seccionHeader("5. Other Info", "DOC1604037 — Tab 5.Other Info")}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3 col-span-2">
          <Switch
            checked={watch("bajoContrato") ?? false}
            onCheckedChange={v => setValue("bajoContrato", v)}
          />
          <Label className="text-xs">¿Sitio bajo contrato de servicio?</Label>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Vencimiento contrato</Label>
          <Input type="date" {...register("vencimientoContrato")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Promedio producciones ¹⁸F / semana (h)</Label>
          <Input type="number" step="0.1" {...register("utilizacionPromedio18F", { valueAsNumber: true })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Corriente promedio ¹⁸F (µA)</Label>
          <Input type="number" step="0.1" {...register("corrientePromedio18F", { valueAsNumber: true })} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Estado del sistema</Label>
          <Input {...register("estadoSistema")} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Problemas conocidos</Label>
          <Textarea rows={2} {...register("problemasConocidos")} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Observaciones adicionales</Label>
          <Textarea rows={2} {...register("observacionesAdicionales")} />
        </div>
      </div>

      {/* Navegación */}
      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack} className="gap-1">
          <ChevronLeft className="h-4 w-4" />
          Atrás
        </Button>
        <div className="flex gap-2">
          <Button type="submit" variant="outline" disabled={guardar.isPending}
            onClick={() => {/* guarda sin avanzar */}}>
            Guardar borrador
          </Button>
          <Button type="submit" disabled={guardar.isPending} className="gap-2">
            {guardar.isPending ? "Guardando…" : "Siguiente"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
