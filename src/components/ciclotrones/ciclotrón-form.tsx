/**
 * Formulario de creación / edición de un ciclotrón.
 * Incluye configuración de rangos de parámetros operativos (JSONB).
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

import type { Ciclotrón } from "@/types/entities";
import type { CiclotrónParametros } from "@/services/servicio-tecnico/ciclotrones";
import { DEFAULT_CICLOTRÓN_PARAMETROS, parsearParametros } from "@/services/servicio-tecnico/ciclotrones";
import {
  useCrearCiclotrón, useActualizarCiclotrón,
} from "@/hooks/entities/use-ciclotrones";
import { useEquiposInstalados } from "@/hooks/entities/use-servicio-tecnico";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ciclotrón?: Ciclotrón | null;
}

interface NumRangeFieldProps {
  label: string;
  unit: string;
  field: keyof Pick<CiclotrónParametros,
    "gas_flow" | "magnet_i" | "dee1_kv" | "dee2_kv">;
  params: CiclotrónParametros;
  onChange: (f: keyof CiclotrónParametros, v: Partial<CiclotrónParametros["gas_flow"]>) => void;
}

function NumRangeField({ label, unit, field, params, onChange }: NumRangeFieldProps) {
  const val = params[field] as CiclotrónParametros["gas_flow"];
  return (
    <div className="grid grid-cols-4 gap-2 items-end">
      <div className="col-span-4 flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label} <span className="text-muted-foreground text-xs">({unit})</span></span>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Alertar</Label>
          <Switch
            checked={val.alertar}
            onCheckedChange={(checked) => onChange(field, { alertar: checked })}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Setpoint</Label>
        <Input type="number" step="any" value={val.setpoint}
          onChange={(e) => onChange(field, { setpoint: parseFloat(e.target.value) || 0 })} />
      </div>
      <div>
        <Label className="text-xs">Mínimo</Label>
        <Input type="number" step="any" value={val.min}
          onChange={(e) => onChange(field, { min: parseFloat(e.target.value) || 0 })} />
      </div>
      <div>
        <Label className="text-xs">Máximo</Label>
        <Input type="number" step="any" value={val.max}
          onChange={(e) => onChange(field, { max: parseFloat(e.target.value) || 0 })} />
      </div>
    </div>
  );
}

export function CiclotrónForm({ open, onOpenChange, ciclotrón }: Props) {
  const crear = useCrearCiclotrón();
  const actualizar = useActualizarCiclotrón();
  const isPending = crear.isPending || actualizar.isPending;
  const { data: equipos = [] } = useEquiposInstalados();

  const [equipoId, setEquipoId] = useState<string>("");
  const [nombre, setNombre] = useState("");
  const [sitio, setSitio] = useState("");
  const [modelo, setModelo] = useState("GE PETtrace 800");
  const [notas, setNotas] = useState("");
  const [params, setParams] = useState<CiclotrónParametros>({ ...DEFAULT_CICLOTRÓN_PARAMETROS });

  // Inicializar al abrir
  useEffect(() => {
    if (ciclotrón) {
      setEquipoId(ciclotrón.equipo_id ?? "");
      setNombre(ciclotrón.nombre);
      setSitio(ciclotrón.sitio ?? "");
      setModelo(ciclotrón.modelo ?? "GE PETtrace 800");
      setNotas(ciclotrón.notas ?? "");
      setParams(parsearParametros(ciclotrón));
    } else {
      setEquipoId(""); setNombre(""); setSitio(""); setModelo("GE PETtrace 800"); setNotas("");
      setParams({ ...DEFAULT_CICLOTRÓN_PARAMETROS });
    }
  }, [ciclotrón, open]);

  function handleEquipoChange(id: string) {
    setEquipoId(id);
    const equipo = equipos.find((e) => e.id === id);
    if (equipo) {
      if (!ciclotrón) setNombre(equipo.nombre);
      setSitio(equipo.ubicacion_instalacion ?? "");
      setModelo(equipo.modelo_equipo?.nombre ?? equipo.modelo ?? "GE PETtrace 800");
    }
  }

  function updateParam<K extends keyof CiclotrónParametros>(
    field: K,
    partial: Partial<CiclotrónParametros["gas_flow"]>,
  ) {
    setParams((prev) => ({
      ...prev,
      [field]: { ...(prev[field] as object), ...partial },
    }));
  }

  function updateScalar(field: keyof CiclotrónParametros, value: number) {
    setParams((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!nombre.trim()) return;
    const payload = {
      nombre: nombre.trim(),
      sitio: sitio.trim() || null,
      modelo: modelo.trim(),
      notas: notas.trim() || null,
      equipo_id: equipoId || null,
      parametros: params as unknown as import("@/types/database").Json,
    };
    if (ciclotrón) {
      await actualizar.mutateAsync({ id: ciclotrón.id, ...payload });
    } else {
      await crear.mutateAsync(payload);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ciclotrón ? "Editar Ciclotrón" : "Nuevo Ciclotrón"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
            <TabsTrigger value="params" className="flex-1">Parámetros</TabsTrigger>
            <TabsTrigger value="limites" className="flex-1">Límites</TabsTrigger>
          </TabsList>

          {/* ── General ── */}
          <TabsContent value="general" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label>Equipo base instalada</Label>
              <Select value={equipoId} onValueChange={handleEquipoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar equipo…" />
                </SelectTrigger>
                <SelectContent>
                  {equipos.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="font-medium">{e.nombre}</span>
                      {e.cliente && (
                        <span className="text-muted-foreground ml-2 text-xs">— {e.cliente.nombre}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Vincula este ciclotrón al equipo en base instalada. El sitio y modelo se auto-completan.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Nombre del equipo *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)}
                placeholder="GE PETtrace 800 — SOLCA Guayaquil" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sitio / Ubicación</Label>
                <Input value={sitio} onChange={(e) => setSitio(e.target.value)}
                  placeholder="SOLCA Guayaquil" />
              </div>
              <div className="space-y-1.5">
                <Label>Modelo</Label>
                <Input value={modelo} onChange={(e) => setModelo(e.target.value)}
                  placeholder="GE PETtrace 800" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea value={notas} onChange={(e) => setNotas(e.target.value)}
                rows={3} placeholder="Observaciones del equipo…" />
            </div>
          </TabsContent>

          {/* ── Parámetros de acelerador ── */}
          <TabsContent value="params" className="space-y-6 pt-4">
            <p className="text-sm text-muted-foreground">
              Configure los rangos normales de operación. Valores fuera de estos rangos
              durante la irradiación activa generarán alertas.
            </p>
            <NumRangeField label="Gas flow (H₂)" unit="sccm"
              field="gas_flow" params={params} onChange={updateParam} />
            <Separator />
            <NumRangeField label="Magnet-I" unit="A"
              field="magnet_i" params={params} onChange={updateParam} />
            <Separator />
            <NumRangeField label="Dee-1-kV" unit="kV"
              field="dee1_kv" params={params} onChange={updateParam} />
            <Separator />
            <NumRangeField label="Dee-2-kV" unit="kV"
              field="dee2_kv" params={params} onChange={updateParam} />
          </TabsContent>

          {/* ── Límites adicionales ── */}
          <TabsContent value="limites" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Límites globales aplicados durante la producción activa.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Target-I — spike máx. (µA)</Label>
                <Input type="number" value={params.target_i_spike_ua}
                  onChange={(e) => updateScalar("target_i_spike_ua", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>Coll máx. (% de Target-I)</Label>
                <Input type="number" value={params.coll_max_pct}
                  onChange={(e) => updateScalar("coll_max_pct", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>Vacuum-P máx. (Pa)</Label>
                <Input type="number" step="any" value={params.vacuum_p_max}
                  onChange={(e) => updateScalar("vacuum_p_max", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>He cool-P mín. (bar)</Label>
                <Input type="number" value={params.he_cool_p_min}
                  onChange={(e) => updateScalar("he_cool_p_min", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>He cool-P máx. (bar)</Label>
                <Input type="number" value={params.he_cool_p_max}
                  onChange={(e) => updateScalar("he_cool_p_max", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>Target-P mín. prod. (mbar)</Label>
                <Input type="number" value={params.target_p_min}
                  onChange={(e) => updateScalar("target_p_min", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>Target-P máx. prod. (mbar)</Label>
                <Input type="number" value={params.target_p_max}
                  onChange={(e) => updateScalar("target_p_max", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>Target-P máx. fin (mbar)</Label>
                <Input type="number" value={params.target_p_end_max}
                  onChange={(e) => updateScalar("target_p_end_max", parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending || !nombre.trim()}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {ciclotrón ? "Guardar cambios" : "Crear ciclotrón"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
