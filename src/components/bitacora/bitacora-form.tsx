import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NIVEL_BLOQUEO_LABELS, type NivelBloqueo } from "@/services/bitacora";

const schema = z.object({
  fecha:             z.string().min(1, "Ingresa la fecha"),
  ayer:              z.string().optional(),
  hoy:               z.string().optional(),
  bloqueos:          z.string().optional(),
  nivel_bloqueo:     z.enum(["ninguno", "bajo", "medio", "critico"]),
  novedades:         z.string().optional(),
  porcentaje_avance: z.coerce.number().min(0).max(100).optional(),
});

export type BitacoraFormValues = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<BitacoraFormValues>;
  onSubmit: (values: BitacoraFormValues) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  submitLabel?: string;
}

const today = new Date().toISOString().split("T")[0];

export function BitacoraForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading,
  submitLabel = "Registrar actualización",
}: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BitacoraFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fecha: today,
      nivel_bloqueo: "ninguno",
      ...defaultValues,
    },
  });

  const nivelBloqueo = watch("nivel_bloqueo");
  const [submitting, setSubmitting] = useState(false);

  async function onFormSubmit(values: BitacoraFormValues) {
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {/* Fecha + % Avance */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fecha">Fecha</Label>
          <Input id="fecha" type="date" {...register("fecha")} />
          {errors.fecha && (
            <p className="text-xs text-destructive">{errors.fecha.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="porcentaje_avance">% Avance del proyecto</Label>
          <div className="relative">
            <Input
              id="porcentaje_avance"
              type="number"
              min={0}
              max={100}
              placeholder="0–100"
              {...register("porcentaje_avance")}
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
          </div>
          {errors.porcentaje_avance && (
            <p className="text-xs text-destructive">{errors.porcentaje_avance.message}</p>
          )}
        </div>
      </div>

      {/* Ayer */}
      <div className="space-y-1.5">
        <Label htmlFor="ayer">✅ Ayer — ¿Qué completaste?</Label>
        <Textarea
          id="ayer"
          placeholder="Describe brevemente lo que hiciste ayer..."
          rows={3}
          {...register("ayer")}
        />
      </div>

      {/* Hoy */}
      <div className="space-y-1.5">
        <Label htmlFor="hoy">🎯 Hoy — ¿Qué harás?</Label>
        <Textarea
          id="hoy"
          placeholder="¿Cuál es tu plan para hoy?"
          rows={3}
          {...register("hoy")}
        />
      </div>

      {/* Bloqueos */}
      <div className="space-y-1.5">
        <Label>🚧 Bloqueos</Label>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Textarea
              id="bloqueos"
              placeholder="Describe cualquier impedimento..."
              rows={2}
              {...register("bloqueos")}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Severidad</Label>
            <Select
              value={nivelBloqueo}
              onValueChange={(v) => setValue("nivel_bloqueo", v as NivelBloqueo)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(NIVEL_BLOQUEO_LABELS) as [NivelBloqueo, string][]).map(
                  ([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Novedades */}
      <div className="space-y-1.5">
        <Label htmlFor="novedades">⚠️ Novedades (opcional)</Label>
        <Textarea
          id="novedades"
          placeholder="Cualquier novedad relevante para el equipo..."
          rows={2}
          {...register("novedades")}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading || submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading || submitting}>
          {loading || submitting ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
