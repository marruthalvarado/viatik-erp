/**
 * Servicio: Contratos de Mantenimiento
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/database";

export type ContratoMantenimiento = Database["public"]["Tables"]["contratos_mantenimiento"]["Row"];
export type ContratoEquipo = Database["public"]["Tables"]["contrato_equipos"]["Row"];

export interface ContratoConRelaciones extends ContratoMantenimiento {
  cliente?: { id: string; nombre: string } | null;
  proyecto?: { id: string; nombre: string } | null;
  equipos?: Array<{
    id: string;
    equipo_id: string;
    equipo?: { id: string; nombre: string; numero_serie: string | null; estado: string } | null;
  }>;
}

export interface ContratoPayload {
  cliente_id: string;
  proyecto_id?: string | null;
  incluye_preventivos?: boolean;
  incluye_correctivos?: boolean;
  visitas_incluidas?: number | null;
  periodicidad_meses?: number;
  fecha_inicio: string;
  fecha_fin: string;
  valor_contrato?: number;
  estado?: string;
  observaciones?: string | null;
}

const CONTRATO_SELECT = `
  *,
  cliente:clientes(id, nombre),
  proyecto:proyectos(id, nombre),
  equipos:contrato_equipos(
    id, equipo_id,
    equipo:equipos_instalados(id, nombre, numero_serie, estado)
  )
`;

export async function getContratosMantenimiento(empresa_id: string): Promise<ContratoConRelaciones[]> {
  const { data, error } = await supabase
    .from("contratos_mantenimiento")
    .select(CONTRATO_SELECT)
    .eq("empresa_id", empresa_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ContratoConRelaciones[];
}

export async function getContratoMantenimiento(id: string): Promise<ContratoConRelaciones> {
  const { data, error } = await supabase
    .from("contratos_mantenimiento")
    .select(CONTRATO_SELECT)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as ContratoConRelaciones;
}

export async function crearContratoMantenimiento(
  empresa_id: string,
  payload: ContratoPayload,
  equipos: string[] = [],
): Promise<{ id: string; numero: string }> {
  const { data, error } = await supabase.rpc("crear_contrato_mantenimiento", {
    p_empresa_id: empresa_id,
    p_datos: payload,
    p_equipos: equipos,
  });
  if (error) throw new Error(error.message);
  return data as { id: string; numero: string };
}

export async function actualizarContratoMantenimiento(
  id: string,
  payload: Partial<ContratoPayload>,
  equipos?: string[],
): Promise<void> {
  const { error } = await supabase.rpc("actualizar_contrato_mantenimiento", {
    p_id: id,
    p_datos: payload,
    p_equipos: equipos ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function eliminarContratoMantenimiento(id: string): Promise<void> {
  const { error } = await supabase
    .from("contratos_mantenimiento")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}
