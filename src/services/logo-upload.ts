/**
 * Servicio para subir y gestionar el logo de la empresa.
 * Usa el bucket público "logos-empresa" en Supabase Storage.
 * La URL pública se guarda en empresas.logo_url.
 */
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "logos-empresa";

export async function uploadLogoEmpresa(
  empresaId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${empresaId}/logo.${ext}`;

  // Subir (upsert para reemplazar si ya existe)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw new Error(`Error subiendo logo: ${error.message}`);

  // Obtener URL pública
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`; // cache-bust

  // Guardar en empresas.logo_url
  const { error: updErr } = await supabase
    .from("empresas")
    .update({ logo_url: publicUrl })
    .eq("id", empresaId);

  if (updErr) throw new Error(`Error guardando logo_url: ${updErr.message}`);

  return publicUrl;
}
