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

  // Guardar en empresas.logo_url (se usa .select para detectar 0 filas afectadas por RLS)
  const { error: updErr, data: updData } = await supabase
    .from("empresas")
    .update({ logo_url: publicUrl })
    .eq("id", empresaId)
    .select("id");

  if (updErr) throw new Error(`Error guardando logo_url: ${updErr.message}`);
  // Si RLS bloqueó silenciosamente el UPDATE (0 filas afectadas), informar al usuario
  if (!updData || updData.length === 0) throw new Error("Sin permisos para actualizar el logo de esta empresa.");

  return publicUrl;
}
