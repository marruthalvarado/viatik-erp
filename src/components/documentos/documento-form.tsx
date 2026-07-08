import { EntityForm } from "@/components/common/entity-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { documentoSchema } from "./documento-types";
import type { DocumentoFormValues } from "./documento-types";

export interface DocumentoFormProps {
  defaultValues: DocumentoFormValues;
  onSubmit: (values: DocumentoFormValues) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
  rendiciones: Array<{ id: string; numero: string }>;
  categorias: Array<{ id: string; nombre: string }>;
  tipos: Array<{ id: string; nombre: string }>;
}

export function DocumentoForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading,
  submitLabel,
  rendiciones,
  categorias,
  tipos,
}: DocumentoFormProps) {
  return (
    <EntityForm
      schema={documentoSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
      loading={loading}
      submitLabel={submitLabel}
    >
      {(form) => (
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="rendicion_id"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Rendición</FormLabel>
                <Select
                  value={field.value ?? "__none__"}
                  onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin rendición asociada" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Sin rendición asociada</SelectItem>
                    {rendiciones.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.numero}
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
            name="nombre_archivo"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Nombre del archivo</FormLabel>
                <FormControl>
                  <Input placeholder="factura-001.pdf" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="categoria_documento_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoría</FormLabel>
                <Select
                  value={field.value ?? "__none__"}
                  onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin categoría" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Sin categoría</SelectItem>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
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
            name="tipo_documento_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select
                  value={field.value ?? "__none__"}
                  onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Sin tipo</SelectItem>
                    {tipos.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre}
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
            name="procesado"
            render={({ field }) => (
              <FormItem className="col-span-2 flex flex-row items-center gap-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="cursor-pointer font-normal">
                  Marcado como procesado (OCR)
                </FormLabel>
              </FormItem>
            )}
          />
        </div>
      )}
    </EntityForm>
  );
}
