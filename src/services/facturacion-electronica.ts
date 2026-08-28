/**
 * Servicio de Facturación Electrónica SRI Ecuador.
 * CRUD para empresa_facturacion_config y comprobantes_electronicos.
 * Llamadas a las Edge Functions: sri-upload-cert, sri-emitir, sri-consultar.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  EmpresaFacConfig,
  ComprobanteElectronico,
  EmitirFacturaPayload,
  EmitirFacturaResult,
  ConsultarEstadoResult,
} from "@/types/facturacion-sri";

// ─── Configuración empresa ────────────────────────────────────────────────────

export async function getEmpresaFacConfig(empresaId: string): Promise<EmpresaFacConfig | null> {
  const { data, error } = await supabase
    .from("empresa_facturacion_config")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as EmpresaFacConfig | null;
}

/** Sube el .p12 y guarda toda la configuración vía Edge Function. */
export async function uploadCertificado(params: {
  empresaId: string;
  certFile?: File;
  clave?: string;
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  dirMatriz: string;
  dirEstablecimiento?: string;
  obligadoContabilidad: boolean;
  contribuyenteEspecial?: string;
  ambiente: "pruebas" | "produccion";
  establecimiento: string;
  puntoEmision: string;
}): Promise<{ ok: boolean; cert_vigencia?: string | null; error?: string }> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error("Sin sesión activa");

  const form = new FormData();
  form.append("empresa_id", params.empresaId);
  form.append("ruc", params.ruc);
  form.append("razon_social", params.razonSocial);
  if (params.nombreComercial) form.append("nombre_comercial", params.nombreComercial);
  form.append("dir_matriz", params.dirMatriz);
  if (params.dirEstablecimiento) form.append("dir_establecimiento", params.dirEstablecimiento);
  form.append("obligado_contabilidad", params.obligadoContabilidad ? "true" : "false");
  if (params.contribuyenteEspecial) form.append("contribuyente_especial", params.contribuyenteEspecial);
  form.append("ambiente", params.ambiente);
  form.append("establecimiento", params.establecimiento);
  form.append("punto_emision", params.puntoEmision);
  if (params.certFile) {
    form.append("cert", params.certFile);
    form.append("clave", params.clave ?? "");
  }

  const { data: { session: s } } = await supabase.auth.getSession();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sri-upload-cert`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${s?.access_token}` },
    body: form,
  });
  return resp.json();
}

// ─── Comprobantes electrónicos ────────────────────────────────────────────────

export async function getComprobantesElectronicos(
  empresaId: string,
  tipo?: string,
): Promise<ComprobanteElectronico[]> {
  let q = supabase
    .from("comprobantes_electronicos")
    .select("*")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (tipo) q = q.eq("tipo", tipo);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ComprobanteElectronico[];
}

export async function getComprobanteByReferencia(
  referenciaId: string,
  tipo = "factura",
): Promise<ComprobanteElectronico | null> {
  const { data, error } = await supabase
    .from("comprobantes_electronicos")
    .select("*")
    .eq("referencia_id", referenciaId)
    .eq("tipo", tipo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ComprobanteElectronico | null;
}

// ─── Edge Functions ───────────────────────────────────────────────────────────

async function callEdgeFunction<T>(fnName: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return resp.json() as Promise<T>;
}

export async function emitirFactura(payload: EmitirFacturaPayload): Promise<EmitirFacturaResult> {
  return callEdgeFunction<EmitirFacturaResult>("sri-emitir", payload);
}

export async function consultarEstadoSRI(
  empresaId: string,
  claveAcceso: string,
): Promise<ConsultarEstadoResult> {
  return callEdgeFunction<ConsultarEstadoResult>("sri-consultar", {
    empresa_id: empresaId,
    clave_acceso: claveAcceso,
  });
}
