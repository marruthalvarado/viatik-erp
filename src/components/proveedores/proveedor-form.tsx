import { useRef, useState } from "react";
import { EntityForm } from "@/components/common/entity-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RucConsultaButton } from "@/components/common/ruc-consulta-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { proveedorSchema } from "./proveedor-types";
import type { ProveedorFormValues } from "./proveedor-types";

export interface ProveedorFormProps {
  defaultValues: ProveedorFormValues;
  onSubmit: (values: ProveedorFormValues) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
}

export function ProveedorForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading,
  submitLabel,
}: ProveedorFormProps) {
  return (
    <EntityForm
      schema={proveedorSchema}
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
            name="nombre"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Nombre *</FormLabel>
                <FormControl>
                  <Input placeholder="Nombre del proveedor" {...field} />
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
                  <Input placeholder="PRV-001" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="identificacion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>RUC / Identificación</FormLabel>
                <div className="flex gap-1.5">
                  <FormControl>
                    <Input placeholder="20123456789" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <RucConsultaButton
                    ruc={field.value}
                    onDatos={(datos) => {
                      form.setValue("identificacion", datos.ruc);
                      form.setValue("nombre", datos.razon_social);
                    }}
                  />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="correo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="contacto@proveedor.com"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="telefono"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <Input placeholder="+51 999 999 999" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ciudad"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ciudad</FormLabel>
                <FormControl>
                  <Input placeholder="Lima" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="pais"
            render={({ field }) => (
              <FormItem>
                <FormLabel>País</FormLabel>
                <FormControl>
                  <Input placeholder="Perú" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="estado"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? "activo"}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                    <SelectItem value="suspendido">Suspendido</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="es_internacional"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-3 space-y-0 pt-6">
                <FormControl>
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div>
                  <FormLabel className="cursor-pointer font-normal">
                    Proveedor internacional
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Fabricante o distribuidor del exterior
                  </p>
                </div>
              </FormItem>
            )}
          />

          {form.watch("es_internacional") && (
            <FormField
              control={form.control}
              name="logo_url"
              render={({ field }) => {
                // eslint-disable-next-line react-hooks/rules-of-hooks
                const fileRef = useRef<HTMLInputElement>(null);
                // eslint-disable-next-line react-hooks/rules-of-hooks
                const [uploading, setUploading] = useState(false);

                const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const ext = file.name.split(".").pop();
                    const path = `logo_${Date.now()}.${ext}`;
                    const { error } = await supabase.storage
                      .from("proveedores-logos")
                      .upload(path, file, { upsert: true });
                    if (error) throw error;
                    const { data: pub } = supabase.storage
                      .from("proveedores-logos")
                      .getPublicUrl(path);
                    field.onChange(pub.publicUrl);
                  } catch (err) {
                    console.error("Error subiendo logo:", err);
                  } finally {
                    setUploading(false);
                    if (fileRef.current) fileRef.current.value = "";
                  }
                };

                return (
                  <FormItem className="col-span-2">
                    <FormLabel>Logo del fabricante</FormLabel>
                    <div className="flex items-center gap-3">
                      {field.value ? (
                        <div className="relative size-16 shrink-0 rounded border bg-muted flex items-center justify-center overflow-hidden">
                          <img
                            src={field.value}
                            alt="Logo"
                            className="object-contain w-full h-full p-1"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <button
                            type="button"
                            onClick={() => field.onChange("")}
                            className="absolute top-0.5 right-0.5 rounded-full bg-destructive text-white p-0.5"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ) : null}
                      <div className="flex flex-col gap-1.5 flex-1">
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="hidden"
                          onChange={handleFile}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileRef.current?.click()}
                          disabled={uploading}
                          className="w-fit"
                        >
                          {uploading
                            ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" />Subiendo…</>
                            : <><Upload className="size-3.5 mr-1.5" />Subir imagen</>}
                        </Button>
                        <p className="text-xs text-muted-foreground">PNG, JPG, WebP o SVG · máx. 5 MB</p>
                        {field.value && (
                          <Input
                            placeholder="https://..."
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="text-xs h-7"
                          />
                        )}
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          )}
        </div>
      )}
    </EntityForm>
  );
}
