/**
 * step1-info-general.tsx
 * Paso 1: Información general de la evaluación.
 * Los campos se auto-completan con la última evaluación del ciclotrón seleccionado.
 * El nombre del ingeniero se pre-llena con el usuario conectado.
 */
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CicloEvaluacion } from "@/types/entities";
import type { UseMutationResult } from "@tanstack/react-query";
import type { CrearEvaluacionParams } from "@/services/servicio-tecnico/ciclo-evaluaciones";
import { supabase } from "@/integrations/supabase/client";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  ciclotrón_id:     z.string().min(1, "Selecciona un ciclotrón"),
  tipo_evaluacion:  z.enum(["assessment", "upgrade_eval", "eosss", "10yr_refurbish"]),
  modelo_pt:        z.string().min(1, "Selecciona el modelo PT"),
  version_sw:       z.string().optional(),
  ingeniero_nombre: z.string().optional(),
  tiene_deuterio:   z.boolean(),
});
type FormData = z.infer<typeof schema>;

interface Ciclotrón { id: string; nombre: string }

interface Props {
  ciclotrones:             Ciclotrón[];
  crear:                   UseMutationResult<CicloEvaluacion, Error, Omit<CrearEvaluacionParams, "empresa_id">>;
  onNext:                  (ev: CicloEvaluacion) => void;
  defaultCiclotrónId?:     string;
  defaultIngenieroNombre?: string;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function Step1InfoGeneral({
  ciclotrones,
  crear,
  onNext,
  defaultCiclotrónId,
  defaultIngenieroNombre,
}: Props) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo_evaluacion:  "assessment",
      tiene_deuterio:   false,
      ciclotrón_id:     defaultCiclotrónId ?? "",
      ingeniero_nombre: "",
    },
  });

  const tieneDeuterio  = watch("tiene_deuterio");
  const selectedModelo = watch("modelo_pt");
  const selectedCiclo  = watch("ciclotrón_id");
  const selectedTipo   = watch("tipo_evaluacion");

  // Actualizar nombre del ingeniero cuando llegue el dato del usuario (carga asíncrona)
  useEffect(() => {
    if (defaultIngenieroNombre) {
      setValue("ingeniero_nombre", defaultIngenieroNombre);
    }
  }, [defaultIngenieroNombre, setValue]);

  // Auto-llenar con última evaluación al montar si hay ciclotrón pre-seleccionado
  useEffect(() => {
    if (defaultCiclotrónId) {
      void fillFromLastEval(defaultCiclotrónId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Busca la última evaluación del ciclotrón y pre-llena modelo, versión y deuterón */
  async function fillFromLastEval(ciclotrónId: string) {
    const { data } = await supabase
      .from("ciclo_evaluaciones")
      .select("modelo_pt, version_sw, tiene_deuterio")
      .eq("ciclotrón_id", ciclotrónId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      if (data.modelo_pt)  setValue("modelo_pt",      data.modelo_pt);
      if (data.version_sw) setValue("version_sw",     data.version_sw);
      setValue("tiene_deuterio", data.tiene_deuterio ?? false);
    }
  }

  async function handleCiclotrónChange(id: string) {
    setValue("ciclotrón_id", id);
    await fillFromLastEval(id);
  }

  async function onSubmit(data: FormData) {
    const ev = await crear.mutateAsync({
      ciclotrón_id:     data.ciclotrón_id,
      tipo_evaluacion:  data.tipo_evaluacion,
      modelo_pt:        data.modelo_pt,
      version_sw:       data.version_sw ?? undefined,
      ingeniero_nombre: data.ingeniero_nombre ?? undefined,
      tiene_deuterio:   data.tiene_deuterio,
    });
    onNext(ev);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex gap-2 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 flex-none" />
        <span>
          Los campos se auto-completan con la última evaluación de este ciclotrón. Puedes editarlos si es necesario.
        </span>
      </div>

      {/* Ciclotrón */}
      <div className="space-y-1">
        <Label>Ciclotrón *</Label>
        <Select value={selectedCiclo} onValueChange={handleCiclotrónChange}>
          <SelectTrigger className={errors.ciclotrón_id ? "border-red-500" : ""}>
            <SelectValue placeholder="Selecciona el ciclotrón…" />
          </SelectTrigger>
          <SelectContent>
            {ciclotrones.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.ciclotrón_id && <p className="text-xs text-red-500">{errors.ciclotrón_id.message}</p>}
      </div>

      {/* Tipo de evaluación */}
      <div className="space-y-1">
        <Label>Tipo de Evaluación *</Label>
        <Select
          value={selectedTipo}
          onValueChange={v => setValue("tipo_evaluacion", v as FormData["tipo_evaluacion"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="assessment">Assessment (general)</SelectItem>
            <SelectItem value="upgrade_eval">Upgrade Evaluation (aumento de potencia)</SelectItem>
            <SelectItem value="eosss">EoSSS (fin de contrato de servicio)</SelectItem>
            <SelectItem value="10yr_refurbish">10-Year Refurbishment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Modelo PT */}
      <div className="space-y-1">
        <Label>Modelo del equipo *</Label>
        <Select value={selectedModelo ?? ""} onValueChange={v => setValue("modelo_pt", v)}>
          <SelectTrigger className={errors.modelo_pt ? "border-red-500" : ""}>
            <SelectValue placeholder="Selecciona el modelo…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PT840">PETtrace 840 (Single Beam)</SelectItem>
            <SelectItem value="PT860">PETtrace 860 (Dual 2×50µA)</SelectItem>
            <SelectItem value="PT880">PETtrace 880 (Dual 2×65µA)</SelectItem>
          </SelectContent>
        </Select>
        {errors.modelo_pt && <p className="text-xs text-red-500">{errors.modelo_pt.message}</p>}
      </div>

      {/* Versión SW */}
      <div className="space-y-1">
        <Label>Versión de software (PT Release)</Label>
        <Input placeholder="ej. 3.6.3" {...register("version_sw")} />
      </div>

      {/* Ingeniero */}
      <div className="space-y-1">
        <Label>Nombre del Ingeniero</Label>
        <Input placeholder="Nombre completo del FE" {...register("ingeniero_nombre")} />
      </div>

      {/* Toggle Deuterón */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="font-medium">Sistema con modo Deuterón (D-)</p>
          <p className="text-sm text-muted-foreground">
            Activa para mostrar los sub-tests de RF en modo D-.
            Los tests de Deuterón solo aparecerán cuando esté habilitado.
          </p>
        </div>
        <Switch
          checked={tieneDeuterio}
          onCheckedChange={v => setValue("tiene_deuterio", v)}
        />
      </div>
      {tieneDeuterio && (
        <div className="rounded border border-purple-200 bg-purple-50 p-3 text-sm text-purple-800">
          Modo Deuterón activado — se incluirá el sub-test RF Performance (D-mode) @ 40µA.
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={crear.isPending} className="gap-2">
          {crear.isPending ? "Creando…" : "Siguiente"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
