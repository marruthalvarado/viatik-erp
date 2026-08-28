/**
 * Panel de configuración de Facturación Electrónica SRI por empresa.
 * Se muestra dentro del módulo Administración.
 */
import { useState, useRef } from "react";
import { ShieldCheck, Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/common/toast";
import { useCompany } from "@/contexts/company-context";
import { useEmpresaFacConfig, useGuardarFacConfig } from "@/hooks/entities/use-facturacion-sri";

export function FacturacionSriSection() {
  const { empresaActivaId } = useCompany();
  const { data: config, isLoading } = useEmpresaFacConfig(empresaActivaId);
  const guardar = useGuardarFacConfig();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    ruc: "",
    razon_social: "",
    nombre_comercial: "",
    dir_matriz: "",
    dir_establecimiento: "",
    obligado_contabilidad: true,
    contribuyente_especial: "",
    ambiente: "pruebas" as "pruebas" | "produccion",
    establecimiento: "001",
    punto_emision: "001",
  });
  const [certFile, setCertFile] = useState<File | null>(null);
  const [clave, setClave] = useState("");

  // Prefill cuando carga la configuración existente
  const initialized = useRef(false);
  if (config && !initialized.current) {
    initialized.current = true;
    setForm({
      ruc: config.ruc ?? "",
      razon_social: config.razon_social ?? "",
      nombre_comercial: config.nombre_comercial ?? "",
      dir_matriz: config.dir_matriz ?? "",
      dir_establecimiento: config.dir_establecimiento ?? "",
      obligado_contabilidad: config.obligado_contabilidad ?? true,
      contribuyente_especial: config.contribuyente_especial ?? "",
      ambiente: config.ambiente ?? "pruebas",
      establecimiento: config.establecimiento ?? "001",
      punto_emision: config.punto_emision ?? "001",
    });
  }

  function set(field: string, value: unknown) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleGuardar() {
    if (!empresaActivaId) return;
    if (!form.ruc || !form.razon_social || !form.dir_matriz) {
      toast.error("RUC, razón social y dirección matriz son obligatorios.");
      return;
    }
    try {
      const result = await guardar.mutateAsync({
        empresaId: empresaActivaId,
        certFile: certFile ?? undefined,
        clave: clave || undefined,
        ruc: form.ruc,
        razonSocial: form.razon_social,
        nombreComercial: form.nombre_comercial || undefined,
        dirMatriz: form.dir_matriz,
        dirEstablecimiento: form.dir_establecimiento || undefined,
        obligadoContabilidad: form.obligado_contabilidad,
        contribuyenteEspecial: form.contribuyente_especial || undefined,
        ambiente: form.ambiente,
        establecimiento: form.establecimiento,
        puntoEmision: form.punto_emision,
      });
      if (result.ok) {
        toast.success("Configuración guardada correctamente.");
        setCertFile(null);
        setClave("");
        if (fileRef.current) fileRef.current.value = "";
      } else {
        toast.error(result.error ?? "Error guardando la configuración.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error inesperado.");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-6">
        <Loader2 className="size-4 animate-spin" />
        Cargando configuración…
      </div>
    );
  }

  const certVigente = config?.cert_vigencia
    ? new Date(config.cert_vigencia) > new Date()
    : false;

  return (
    <div className="space-y-6">
      {/* Estado del certificado */}
      {config?.cert_storage_path && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${certVigente ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          {certVigente
            ? <CheckCircle2 className="size-4 shrink-0" />
            : <AlertCircle className="size-4 shrink-0" />}
          <span>
            {certVigente
              ? `Certificado activo — vigente hasta ${config.cert_vigencia}`
              : `Certificado vencido el ${config.cert_vigencia}. Actualízalo.`}
          </span>
          <span className="ml-auto rounded px-2 py-0.5 text-xs font-medium bg-white/60 border">
            {config.ambiente === "produccion" ? "Producción" : "Pruebas"}
          </span>
        </div>
      )}

      {/* Datos del emisor */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Datos del emisor
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>RUC *</Label>
            <Input value={form.ruc} onChange={(e) => set("ruc", e.target.value)} placeholder="0990000000001" maxLength={13} />
          </div>
          <div>
            <Label>Razón social *</Label>
            <Input value={form.razon_social} onChange={(e) => set("razon_social", e.target.value)} />
          </div>
          <div>
            <Label>Nombre comercial</Label>
            <Input value={form.nombre_comercial} onChange={(e) => set("nombre_comercial", e.target.value)} />
          </div>
          <div>
            <Label>Contribuyente especial N°</Label>
            <Input value={form.contribuyente_especial} onChange={(e) => set("contribuyente_especial", e.target.value)} placeholder="Número de resolución (opcional)" />
          </div>
          <div className="col-span-2">
            <Label>Dirección matriz *</Label>
            <Input value={form.dir_matriz} onChange={(e) => set("dir_matriz", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Dirección establecimiento</Label>
            <Input value={form.dir_establecimiento} onChange={(e) => set("dir_establecimiento", e.target.value)} placeholder="Si es diferente a la matriz" />
          </div>
        </div>
      </div>

      {/* Serie y ambiente */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Serie y ambiente
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Establecimiento</Label>
            <Input value={form.establecimiento} onChange={(e) => set("establecimiento", e.target.value)} maxLength={3} placeholder="001" />
          </div>
          <div>
            <Label>Punto de emisión</Label>
            <Input value={form.punto_emision} onChange={(e) => set("punto_emision", e.target.value)} maxLength={3} placeholder="001" />
          </div>
          <div>
            <Label>Ambiente SRI</Label>
            <Select value={form.ambiente} onValueChange={(v) => set("ambiente", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pruebas">Pruebas (celcer.sri.gob.ec)</SelectItem>
                <SelectItem value="produccion">Producción (cel.sri.gob.ec)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Obligado a llevar contabilidad</Label>
            <Select
              value={form.obligado_contabilidad ? "si" : "no"}
              onValueChange={(v) => set("obligado_contabilidad", v === "si")}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="si">Sí</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Certificado .p12 */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Certificado de firma electrónica (.p12)
        </h3>
        <div className="rounded-lg border border-dashed p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            El certificado se almacena en un bucket privado de Supabase Storage.
            Solo se puede acceder a él desde las Edge Functions del servidor.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Archivo .p12</Label>
              <Input
                ref={fileRef}
                type="file"
                accept=".p12,.pfx"
                onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
              />
              {certFile && (
                <p className="mt-1 text-xs text-emerald-600">
                  ✓ {certFile.name} ({(certFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
            <div>
              <Label>Clave del certificado</Label>
              <Input
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="Contraseña del .p12"
              />
            </div>
          </div>
          {config?.cert_storage_path && !certFile && (
            <p className="text-xs text-muted-foreground">
              <ShieldCheck className="inline size-3 mr-1" />
              Ya hay un certificado almacenado. Selecciona un nuevo archivo solo si deseas reemplazarlo.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleGuardar} disabled={guardar.isPending}>
          {guardar.isPending ? (
            <><Loader2 className="size-4 mr-2 animate-spin" />Guardando…</>
          ) : "Guardar configuración"}
        </Button>
      </div>
    </div>
  );
}
