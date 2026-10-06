/**
 * sri-ruc.ts
 * Servicio para consultar información de contribuyentes en el SRI por RUC/cédula.
 * Delega a la Edge Function sri-consultar-ruc para evitar CORS.
 */
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

async function parseFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };
      if (body.error) return body.error;
    } catch {
      // fall through
    }
  }
  if (error instanceof Error) return error.message;
  return "Error desconocido";
}

export interface DatosContribuyente {
  ruc: string;
  razon_social: string;
  nombre_comercial: string;
  estado: string; // "ACTIVO" | "SUSPENDIDO" | "PASIVO" | etc.
  tipo_contribuyente: string;
  direccion: string;
}

interface SriRucResponse {
  ok: boolean;
  datos?: DatosContribuyente;
  error?: string;
}

/**
 * Consulta el SRI por RUC o cédula y retorna los datos del contribuyente.
 * Lanza un error con mensaje legible si el RUC no existe o el SRI no responde.
 */
export async function consultarRuc(ruc: string): Promise<DatosContribuyente> {
  const { data, error } = await supabase.functions.invoke<SriRucResponse>(
    "sri-consultar-ruc",
    { body: { ruc } },
  );

  if (error) {
    throw new Error(await parseFunctionError(error));
  }

  if (!data?.ok || !data.datos) {
    throw new Error(data?.error ?? "No se pudo obtener información del RUC");
  }

  return data.datos;
}
