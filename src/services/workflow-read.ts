/**
 * workflow-read.ts
 * Todas las operaciones de lectura del workflow.
 * Ninguna de estas funciones muta estado.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  WorkflowAprobacion,
  WorkflowPaso,
  Aprobacion,
  AccionAprobacion,
  HistorialWorkflow,
  Comentario,
} from "@/types/entities";

// ---------------------------------------------------------------------------
// Tipos enriquecidos para lectura
// ---------------------------------------------------------------------------

export interface AprobacionConDetalle extends Aprobacion {
  usuario_nombre: string | null;
  accion_codigo: string | null;
  accion_nombre: string | null;
  paso_nombre: string | null;
  paso_orden: number | null;
}

export interface HistorialConDetalle extends HistorialWorkflow {
  usuario_nombre: string | null;
  paso_nombre: string | null;
}

export interface ComentarioConUsuario extends Comentario {
  usuario_nombre: string | null;
}

export interface PasoActual {
  paso_id: string;
  nombre: string | null;
  orden: number;
  rol_id: string;
  es_ultimo: boolean;
}

export interface AprobacionPendiente {
  rendicion_id: string;
  numero: string;
  descripcion: string | null;
  proyecto_id: string;
  total_facturado: number | null;
  total_reembolsable: number | null;
  fecha_rendicion: string | null;
  fecha_envio: string | null;
  estado_codigo: string;
  estado_nombre: string;
  paso_nombre: string | null;
  paso_orden: number;
  usuario_nombre: string | null;
  workflow_paso_id: string;
}

// ---------------------------------------------------------------------------
// Workflows disponibles en la empresa
// ---------------------------------------------------------------------------

export async function getWorkflows(empresaId: string): Promise<WorkflowAprobacion[]> {
  const { data, error } = await supabase
    .from("workflows_aprobacion")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("nombre");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getWorkflowPasos(workflowId: string): Promise<WorkflowPaso[]> {
  const { data, error } = await supabase
    .from("workflow_pasos")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("orden");

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Catálogo de acciones
// ---------------------------------------------------------------------------

export async function getAccionesAprobacion(): Promise<AccionAprobacion[]> {
  const { data, error } = await supabase.from("acciones_aprobacion").select("*").order("nombre");

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Paso actual (vía RPC — lógica centralizada en Supabase)
// ---------------------------------------------------------------------------

export async function getPasoActual(rendicionId: string): Promise<PasoActual | null> {
  const { data, error } = await supabase.rpc("wf_paso_actual", {
    p_rendicion_id: rendicionId,
  });

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;
  return data[0] as PasoActual;
}

// ---------------------------------------------------------------------------
// Bandeja del aprobador — combina Sistema 1 (aprobacion directa) y
// Sistema 2 (workflow por pasos). wf_mis_pendientes tiene un mismatch de
// columnas en la BD; lo reemplazamos con queries directas.
// ---------------------------------------------------------------------------

export async function getMisAprobacionesPendientes(
  usuarioId: string,
  empresaId: string,
): Promise<AprobacionPendiente[]> {
  // ── Sistema 1: aprobacion directa (aprobador_id = yo, estado = enviada) ──
  const directasProm = supabase.rpc("rendir_mis_pendientes");

  // ── Sistema 2: workflow por pasos ─────────────────────────────────────────
  // 1. Obtener rol_ids del usuario en la empresa (primario + adicionales)
  const rolesProm = supabase
    .from("empresas_usuarios")
    .select("rol_id, roles_adicionales")
    .eq("usuario_id", usuarioId)
    .eq("empresa_id", empresaId)
    .eq("activo", true);

  const [directasResult, rolesResult] = await Promise.all([directasProm, rolesProm]);

  // Directas
  type RendicionMisPendientes = {
    id: string; numero: string; descripcion?: string | null;
    proyecto_id: string; empresa_id: string; usuario_id: string;
    total_facturado: number; fecha_envio?: string | null; fecha_rendicion?: string | null;
  };
  const directasRows = ((directasResult.data ?? []) as RendicionMisPendientes[]);

  // Roles del usuario: aplanar rol_id + roles_adicionales de todas las filas
  const rolIds = [...new Set(
    (rolesResult.data ?? []).flatMap((r) => [
      r.rol_id as string,
      ...((r.roles_adicionales as string[] | null) ?? []),
    ]).filter(Boolean)
  )];

  // 2. Pasos de workflows donde el rol del usuario puede actuar
  const wfPendientes: AprobacionPendiente[] = [];

  if (rolIds.length > 0) {
    const { data: pasosMatchData } = await supabase
      .from("workflow_pasos")
      .select("id, workflow_id, orden, nombre")
      .in("rol_id", rolIds);

    const pasosMatch = pasosMatchData ?? [];
    const workflowIdsConMiRol = [...new Set(pasosMatch.map((p) => p.workflow_id as string))];

    if (workflowIdsConMiRol.length > 0) {
      // 3. Rendiciones en esta empresa con esos workflows — filtramos por estado "enviada"
      //    via join para evitar el lookup de estado_id (estados_rendicion puede ser catálogo global)
      const { data: wfRendData } = await supabase
        .from("rendiciones")
        .select(
          "id, numero, descripcion, proyecto_id, total_facturado, fecha_rendicion, fecha_envio, usuario_id, workflow_id, estados_rendicion(codigo)",
        )
        .eq("empresa_id", empresaId)
        .in("workflow_id", workflowIdsConMiRol);

      if (wfRendData && wfRendData.length > 0) {
        // Filtrar solo las "enviada" client-side
        const wfRendiciones = wfRendData.filter((r) => {
          const est = r.estados_rendicion as unknown as { codigo: string } | null;
          return est?.codigo === "enviada";
        });

        if (wfRendiciones.length > 0) {
          // 4. Aprobaciones ya realizadas (para determinar paso actual)
          const { data: aprobData } = await supabase
            .from("aprobaciones")
            .select("rendicion_id, workflow_paso_id, acciones_aprobacion(codigo)")
            .in("rendicion_id", wfRendiciones.map((r) => r.id as string));

          // Construir set de pasos aprobados por rendicion
          const aprobadosPorRendicion = new Map<string, Set<string>>();
          for (const ap of aprobData ?? []) {
            const codigo = (ap.acciones_aprobacion as unknown as { codigo: string } | null)?.codigo;
            if (codigo === "aprobar") {
              const rid = ap.rendicion_id as string;
              if (!aprobadosPorRendicion.has(rid)) aprobadosPorRendicion.set(rid, new Set());
              aprobadosPorRendicion.get(rid)!.add(ap.workflow_paso_id as string);
            }
          }

          // Pasos por workflow (ordenados)
          const pasosPorWorkflow = new Map<string, typeof pasosMatch>();
          for (const paso of pasosMatch) {
            const wid = paso.workflow_id as string;
            if (!pasosPorWorkflow.has(wid)) pasosPorWorkflow.set(wid, []);
            pasosPorWorkflow.get(wid)!.push(paso);
          }

          const pasoIdsConMiRol = new Set(pasosMatch.map((p) => p.id as string));

          for (const r of wfRendiciones) {
            const wid = r.workflow_id as string;
            const pasos = [...(pasosPorWorkflow.get(wid) ?? [])].sort(
              (a, b) => (a.orden as number) - (b.orden as number),
            );
            const aprobados = aprobadosPorRendicion.get(r.id as string) ?? new Set();
            const pasoActual = pasos.find((p) => !aprobados.has(p.id as string));

            // El paso actual debe ser uno que yo pueda resolver
            if (pasoActual && pasoIdsConMiRol.has(pasoActual.id as string)) {
              wfPendientes.push({
                rendicion_id: r.id as string,
                numero: r.numero as string,
                descripcion: r.descripcion as string | null,
                proyecto_id: r.proyecto_id as string,
                total_facturado: r.total_facturado as number,
                total_reembolsable: null,
                fecha_rendicion: r.fecha_rendicion as string | null,
                fecha_envio: r.fecha_envio as string | null,
                estado_codigo: "enviada",
                estado_nombre: "Enviada",
                paso_nombre: pasoActual.nombre as string | null,
                paso_orden: pasoActual.orden as number,
                usuario_nombre: null, // se enriquece abajo
                workflow_paso_id: pasoActual.id as string,
              });
            }
          }
        }
      }
    }
  }

  // ── Combinar y enriquecer con nombres de solicitantes ─────────────────────
  const todasRows: AprobacionPendiente[] = [
    ...directasRows.map((r) => ({
      rendicion_id: r.id,
      numero: r.numero,
      descripcion: r.descripcion ?? null,
      proyecto_id: r.proyecto_id,
      total_facturado: r.total_facturado,
      total_reembolsable: null,
      fecha_rendicion: r.fecha_rendicion ?? null,
      fecha_envio: r.fecha_envio ?? null,
      estado_codigo: "enviada",
      estado_nombre: "Enviada",
      paso_nombre: null,
      paso_orden: 1,
      usuario_nombre: null,
      workflow_paso_id: "",
    } as AprobacionPendiente)),
    ...wfPendientes,
  ];

  // Deduplicar por rendicion_id (podría aparecer en ambos sistemas)
  const vistas = new Set<string>();
  const unicas = todasRows.filter((r) => {
    if (vistas.has(r.rendicion_id)) return false;
    vistas.add(r.rendicion_id);
    return true;
  });

  // Enriquecer nombres
  const uids = [...new Set(unicas.map((r) => r.usuario_nombre === null ? r.rendicion_id : null).filter(Boolean))];
  // Obtener usuario_id de directasRows y wfPendientes para lookup
  const idToUsuarioId = new Map<string, string>();
  for (const r of directasRows) idToUsuarioId.set(r.id, r.usuario_id);
  for (const r of (wfPendientes as AprobacionPendiente[])) {
    // wfPendientes no tienen usuario_id directamente, buscar en wfRendData derivado
  }

  // Re-query para obtener nombres — más simple y confiable
  const rendicionIds = unicas.map((r) => r.rendicion_id);
  if (rendicionIds.length > 0) {
    const { data: rendNombres } = await supabase
      .from("rendiciones")
      .select("id, usuario_id, usuarios(nombres, apellidos)")
      .in("id", rendicionIds);

    for (const rn of rendNombres ?? []) {
      const u = rn.usuarios as unknown as { nombres: string; apellidos: string | null } | null;
      const nombre = u ? `${u.nombres} ${u.apellidos ?? ""}`.trim() : null;
      const found = unicas.find((x) => x.rendicion_id === rn.id);
      if (found) found.usuario_nombre = nombre;
    }
  }

  void uids; // usado implícitamente arriba

  return unicas;
}

// ---------------------------------------------------------------------------
// Aprobaciones de una rendición (historial de decisiones)
// ---------------------------------------------------------------------------

export async function getAprobacionesByRendicion(
  rendicionId: string,
): Promise<AprobacionConDetalle[]> {
  const { data, error } = await supabase
    .from("aprobaciones")
    .select(
      `
      *,
      usuarios(nombres, apellidos),
      acciones_aprobacion(codigo, nombre),
      workflow_pasos(nombre, orden)
    `,
    )
    .eq("rendicion_id", rendicionId)
    .order("fecha_accion", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const usuario = row.usuarios as unknown as { nombres: string; apellidos: string | null } | null;
    const accion = row.acciones_aprobacion as unknown as {
      codigo: string;
      nombre: string;
    } | null;
    const paso = row.workflow_pasos as unknown as { nombre: string | null; orden: number } | null;

    return {
      ...row,
      usuario_nombre: usuario ? `${usuario.nombres} ${usuario.apellidos ?? ""}`.trim() : null,
      accion_codigo: accion?.codigo ?? null,
      accion_nombre: accion?.nombre ?? null,
      paso_nombre: paso?.nombre ?? null,
      paso_orden: paso?.orden ?? null,
    } as AprobacionConDetalle;
  });
}

// ---------------------------------------------------------------------------
// Historial de workflow de una rendición
// ---------------------------------------------------------------------------

export async function getHistorialByRendicion(rendicionId: string): Promise<HistorialConDetalle[]> {
  const { data, error } = await supabase
    .from("historial_workflow")
    .select(
      `
      *,
      usuarios(nombres, apellidos),
      workflow_pasos(nombre)
    `,
    )
    .eq("rendicion_id", rendicionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const usuario = row.usuarios as unknown as { nombres: string; apellidos: string | null } | null;
    const paso = row.workflow_pasos as unknown as { nombre: string | null } | null;

    return {
      ...row,
      usuario_nombre: usuario ? `${usuario.nombres} ${usuario.apellidos ?? ""}`.trim() : null,
      paso_nombre: paso?.nombre ?? null,
    } as HistorialConDetalle;
  });
}

// ---------------------------------------------------------------------------
// Comentarios de una rendición
// ---------------------------------------------------------------------------

export async function getComentariosByRendicion(
  rendicionId: string,
): Promise<ComentarioConUsuario[]> {
  const { data, error } = await supabase
    .from("comentarios")
    .select("*, usuarios(nombres, apellidos)")
    .eq("rendicion_id", rendicionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const usuario = row.usuarios as unknown as { nombres: string; apellidos: string | null } | null;
    return {
      ...row,
      usuario_nombre: usuario ? `${usuario.nombres} ${usuario.apellidos ?? ""}`.trim() : null,
    } as ComentarioConUsuario;
  });
}
