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
import { politicaSchema, EMPTY_POLITICA, toPoliticaForm } from "./politica-types";
import type { PoliticaFormValues } from "./politica-types";
import type { Politica } from "@/types/entities";

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
  tope_hospedaje: "Hospedaje",
  tope_miscelaneo: "Misceláneo",
};

const BOOLEANS = ["paga_combustible", "paga_peajes", "activo"] as const;

const BOOL_LABELS: Record<string, string> = {
  paga_combustible: "Paga combustible",
  paga_peajes: "Paga peajes",
  activo: "Política activa",
};

export function PoliticaFormDrawer({
  open,
  onOpenChange,
  editing,
  loading,
  onSubmit,
}: PoliticaFormDrawerProps) {
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
        <div className="overflow-y-auto px-6 pb-6">
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
                  name="valor_km"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor por km</FormLabel>
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
