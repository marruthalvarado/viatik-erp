import { supabase } from "@/integrations/supabase/client";

// ── Tipos ────────────────────────────────────────────────────────────────────

export type TipoCampoActividad = "check3" | "medicion" | "texto" | "foto";

export interface Protocolo {
  id: string;
  empresa_id: string;
  modelo_id: string;
  nombre: string;
  version: string | null;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
}

export interface ProtocoloSeccion {
  id: string;
  protocolo_id: string;
  numero: number;
  titulo: string;
  intervalo_meses: number | null;
  descripcion_frecuencia: string | null;
  created_at: string;
}

export interface ProtocoloActividad {
  id: string;
  seccion_id: string;
  orden: number;
  numero_paso: string | null;
  descripcion: string;
  referencia_proc: string | null;
  tipo_campo: TipoCampoActividad;
  aplica_config: string | null;
  valor_min: number | null;
  valor_max: number | null;
  unidad: string | null;
  es_critico: boolean;
  notas: string | null;
  created_at: string;
}

export interface ProtocoloConDetalle extends Protocolo {
  secciones: (ProtocoloSeccion & { actividades: ProtocoloActividad[] })[];
}

// ── Protocolos ────────────────────────────────────────────────────────────────

export async function getProtocolos(empresaId: string, modeloId?: string): Promise<Protocolo[]> {
  let q = supabase
    .from("protocolos_mantenimiento")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("nombre");
  if (modeloId) q = q.eq("modelo_id", modeloId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getProtocoloDetalle(protocoloId: string): Promise<ProtocoloConDetalle | null> {
  const { data: proto, error: e1 } = await supabase
    .from("protocolos_mantenimiento")
    .select("*")
    .eq("id", protocoloId)
    .single();
  if (e1) throw e1;
  if (!proto) return null;

  const { data: secciones, error: e2 } = await supabase
    .from("protocolo_secciones")
    .select("*")
    .eq("protocolo_id", protocoloId)
    .order("numero");
  if (e2) throw e2;

  const seccionIds = (secciones ?? []).map((s) => s.id);
  let actividades: ProtocoloActividad[] = [];
  if (seccionIds.length > 0) {
    const { data: acts, error: e3 } = await supabase
      .from("protocolo_actividades")
      .select("*")
      .in("seccion_id", seccionIds)
      .order("orden");
    if (e3) throw e3;
    actividades = acts ?? [];
  }

  return {
    ...proto,
    secciones: (secciones ?? []).map((s) => ({
      ...s,
      actividades: actividades.filter((a) => a.seccion_id === s.id),
    })),
  } as ProtocoloConDetalle;
}

export async function crearProtocolo(
  empresaId: string,
  payload: { modelo_id: string; nombre: string; version?: string | null; descripcion?: string | null }
): Promise<Protocolo> {
  const { data, error } = await supabase.rpc("rpc_crear_protocolo_mantenimiento", {
    p_empresa_id: empresaId,
    p_modelo_id: payload.modelo_id,
    p_nombre: payload.nombre,
    p_version: payload.version ?? null,
    p_descripcion: payload.descripcion ?? null,
  });
  if (error) throw error;
  return data as Protocolo;
}

export async function actualizarProtocolo(
  id: string,
  payload: Partial<{ nombre: string; version: string | null; descripcion: string | null; activo: boolean }>
): Promise<Protocolo> {
  const { data, error } = await supabase.rpc("rpc_actualizar_protocolo_mantenimiento", {
    p_id: id,
    p_nombre: payload.nombre ?? null,
    p_version: payload.version ?? null,
    p_descripcion: payload.descripcion ?? null,
    p_activo: payload.activo ?? null,
  });
  if (error) throw error;
  return data as Protocolo;
}

// ── Secciones ────────────────────────────────────────────────────────────────

export async function crearSeccion(payload: {
  protocolo_id: string;
  numero: number;
  titulo: string;
  intervalo_meses?: number | null;
  descripcion_frecuencia?: string | null;
}): Promise<ProtocoloSeccion> {
  const { data, error } = await supabase.rpc("rpc_crear_protocolo_seccion", {
    p_protocolo_id: payload.protocolo_id,
    p_numero: payload.numero,
    p_titulo: payload.titulo,
    p_intervalo_meses: payload.intervalo_meses ?? null,
    p_descripcion_frecuencia: payload.descripcion_frecuencia ?? null,
  });
  if (error) throw error;
  return data as ProtocoloSeccion;
}

export async function actualizarSeccion(
  id: string,
  payload: Partial<{ titulo: string; intervalo_meses: number | null; descripcion_frecuencia: string | null }>
): Promise<ProtocoloSeccion> {
  const { data, error } = await supabase.rpc("rpc_actualizar_protocolo_seccion", {
    p_id: id,
    p_titulo: payload.titulo ?? null,
    p_intervalo_meses: payload.intervalo_meses ?? null,
    p_descripcion_frecuencia: payload.descripcion_frecuencia ?? null,
  });
  if (error) throw error;
  return data as ProtocoloSeccion;
}

export async function eliminarSeccion(id: string): Promise<void> {
  const { error } = await supabase.rpc("rpc_eliminar_protocolo_seccion", { p_id: id });
  if (error) throw error;
}

// ── Actividades ───────────────────────────────────────────────────────────────

export async function crearActividad(payload: {
  seccion_id: string;
  orden: number;
  descripcion: string;
  numero_paso?: string | null;
  referencia_proc?: string | null;
  tipo_campo?: TipoCampoActividad;
  aplica_config?: string | null;
  valor_min?: number | null;
  valor_max?: number | null;
  unidad?: string | null;
  es_critico?: boolean;
  notas?: string | null;
}): Promise<ProtocoloActividad> {
  const { data, error } = await supabase.rpc("rpc_crear_protocolo_actividad", {
    p_seccion_id: payload.seccion_id,
    p_orden: payload.orden,
    p_descripcion: payload.descripcion,
    p_numero_paso: payload.numero_paso ?? null,
    p_referencia_proc: payload.referencia_proc ?? null,
    p_tipo_campo: payload.tipo_campo ?? "check3",
    p_aplica_config: payload.aplica_config ?? null,
    p_valor_min: payload.valor_min ?? null,
    p_valor_max: payload.valor_max ?? null,
    p_unidad: payload.unidad ?? null,
    p_es_critico: payload.es_critico ?? false,
    p_notas: payload.notas ?? null,
  });
  if (error) throw error;
  return data as ProtocoloActividad;
}

export async function actualizarActividad(
  id: string,
  payload: Partial<Omit<ProtocoloActividad, "id" | "seccion_id" | "created_at">>
): Promise<ProtocoloActividad> {
  const { data, error } = await supabase.rpc("rpc_actualizar_protocolo_actividad", {
    p_id: id,
    p_orden: payload.orden ?? null,
    p_descripcion: payload.descripcion ?? null,
    p_numero_paso: payload.numero_paso ?? null,
    p_referencia_proc: payload.referencia_proc ?? null,
    p_tipo_campo: payload.tipo_campo ?? null,
    p_aplica_config: payload.aplica_config ?? null,
    p_valor_min: payload.valor_min ?? null,
    p_valor_max: payload.valor_max ?? null,
    p_unidad: payload.unidad ?? null,
    p_es_critico: payload.es_critico ?? null,
    p_notas: payload.notas ?? null,
  });
  if (error) throw error;
  return data as ProtocoloActividad;
}

export async function eliminarActividad(id: string): Promise<void> {
  const { error } = await supabase.rpc("rpc_eliminar_protocolo_actividad", { p_id: id });
  if (error) throw error;
}

// ── Importación desde PDF (IA) ────────────────────────────────────────────────

export interface SeccionIA {
  numero: number;
  titulo: string;
  intervalo_meses: number | null;
  descripcion_frecuencia: string | null;
  actividades: ActividadIA[];
}

export interface ActividadIA {
  numero_paso: string | null;
  descripcion: string;
  tipo_campo: TipoCampoActividad;
  es_critico: boolean;
  valor_min: number | null;
  valor_max: number | null;
  unidad: string | null;
  referencia_proc: string | null;
}

/**
 * Llama a la Edge Function st-extract-protocolo para extraer actividades
 * del texto plano de un PDF de mantenimiento.
 */
export async function extractProtocoloFromPdfText(text: string): Promise<SeccionIA[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("No autenticado");

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/st-extract-protocolo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Error en la extracción AI");
  }

  const data = await res.json();
  return (data.secciones ?? []) as SeccionIA[];
}

/**
 * Crea en batch las secciones y actividades extraídas por AI para un protocolo.
 * Si replaceExisting=true, el llamador debe haber eliminado las secciones previas.
 */
export async function importarSeccionesYActividades(
  protocoloId: string,
  secciones: SeccionIA[],
): Promise<{ totalSecciones: number; totalActividades: number }> {
  let totalActividades = 0;

  for (let si = 0; si < secciones.length; si++) {
    const sec = secciones[si];
    const secRow = await crearSeccion({
      protocolo_id: protocoloId,
      numero: si + 1,
      titulo: sec.titulo,
      intervalo_meses: sec.intervalo_meses ?? null,
      descripcion_frecuencia: sec.descripcion_frecuencia ?? null,
    });

    for (let ai = 0; ai < sec.actividades.length; ai++) {
      const act = sec.actividades[ai];
      await crearActividad({
        seccion_id: secRow.id,
        orden: ai,
        descripcion: act.descripcion,
        numero_paso: act.numero_paso ?? null,
        referencia_proc: act.referencia_proc ?? null,
        tipo_campo: act.tipo_campo ?? "check3",
        valor_min: act.valor_min ?? null,
        valor_max: act.valor_max ?? null,
        unidad: act.unidad ?? null,
        es_critico: act.es_critico ?? false,
      });
      totalActividades++;
    }
  }

  return { totalSecciones: secciones.length, totalActividades };
}
