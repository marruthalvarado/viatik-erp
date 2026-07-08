/**
 * politica-form.tsx
 * Drawer con formulario para crear/editar una Política de reembolso.
 */
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/common/drawer";
import { EntityForm } from "@/components/common/entity-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { politicaSchema, EMPTY_POLITICA, toPoliticaForm } from "./politica-types";
import type { PoliticaFormValues } from "./politica-types";
import type { Politica } from "@/types/entities";
import { useAprobadoresDisponibles } from "@/hooks/entities/use-rendicion-aprobacion";

interface PoliticaFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Politica | null;
  loading: boolean;
  onSubmit: (values: PoliticaFormValues) => Promise<void>;
}

const TOPES = [
  "tope_desayuno",
  "tope_almuerzo",
  "tope_cena",
  "tope_hospedaje",
  "tope_miscelaneo",
] as const;

const TOPE_LABELS: Record<string, string> = {
  tope_desayuno: "Desayuno",
  tope_almuerzo: "Almuerzo",
  tope_cena: "Cena",
  tope_hospedaje: "Hospedaje (por noche)",
  tope_miscelaneo: "Misceláneo",
};

const BOOLEANS = ["paga_combustible", "paga_peajes", "activo", "acepta_facturas_fuera_rango"] as const;

const BOOL_LABELS: Record<string, string> = {
  paga_combustible: "Paga combustible",
  paga_peajes: "Paga peajes",
  activo: "Política activa",
  acepta_facturas_fuera_rango: "Acepta facturas fuera del rango de fecha del viaje",
};

export function PoliticaFormDrawer({
  open,
  onOpenChange,
  editing,
  loading,
  onSubmit,
}: PoliticaFormDrawerProps) {
  const { data: aprobadores = [], isLoading: aprobadoresLoading } = useAprobadoresDisponibles();

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o) onOpenChange(false);
      }}
    >
      <DrawerContent className="sm:max-w-lg">
        <DrawerHeader>
          <DrawerTitle>{editing ? "Editar política" : "Nueva política"}</DrawerTitle>
          <DrawerDescription>Define topes y condiciones de reembolso.</DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          <EntityForm
            schema={politicaSchema}
            defaultValues={editing ? toPoliticaForm(editing) : EMPTY_POLITICA}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            loading={loading}
            submitLabel={editing ? "Guardar cambios" : "Crear política"}
          >
            {(form) => (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Nombre *</FormLabel>
                      <FormControl>
                        <Input placeholder="Política estándar" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="codigo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código</FormLabel>
                      <FormControl>
                        <Input placeholder="POL-001" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="aprobador_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aprobador predeterminado</FormLabel>
                      <Select
                        value={field.value ?? "__none__"}
                        onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                        disabled={aprobadoresLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={aprobadoresLoading ? "Cargando..." : "Sin aprobador"}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Sin aprobador</SelectItem>
                          {aprobadores.map((a) => (
                            <SelectItem key={a.usuario_id} value={a.usuario_id}>
                              {a.nombres}
                              {a.apellidos ? ` ${a.apellidos}` : ""}
                              {a.email ? ` (${a.email})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="valor_km"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor por km (viaje)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value === "" ? null : Number(e.target.value))
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="km_ciudad_por_dia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Km ciudad / día</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value === "" ? null : Number(e.target.value))
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Descripción de la política"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <p className="col-span-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Topes de reembolso
                </p>

                {TOPES.map((fieldName) => (
                  <FormField
                    key={fieldName}
                    control={form.control}
                    name={fieldName}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{TOPE_LABELS[fieldName]}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value === "" ? null : Number(e.target.value))
                            }
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}

                <div className="col-span-2 flex flex-col gap-3">
                  {BOOLEANS.map((fieldName) => (
                    <FormField
                      key={fieldName}
                      control={form.control}
                      name={fieldName}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-3 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-input"
                              checked={field.value ?? false}
                              onChange={(e) => field.onChange(e.target.checked)}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer font-normal">
                            {BOOL_LABELS[fieldName]}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
          </EntityForm>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
