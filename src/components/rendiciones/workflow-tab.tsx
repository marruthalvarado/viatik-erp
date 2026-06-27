/**
 * workflow-tab.tsx
 * Tab de workflow integrada en el detalle de rendición.
 * Orquesta permisos, pasos, timeline y acciones — sin lógica de permisos inline.
 */

import { useAuth } from "@/contexts/auth-context";
import { toast } from "@/components/common/toast";

import {
  usePasoActual,
  useAprobacionesRendicion,
  useHistorialRendicion,
  useComentariosRendicion,
  useRolUsuarioEnEmpresa,
  useWorkflowPasos,
  useEnviarAprobacion,
  useRegistrarAccion,
  useAgregarComentario,
} from "@/hooks/entities/use-workflow";

import { canEnviarAprobacion, canActuarEnPaso, canAgregarComentario } from "@/services/permissions";

import { WorkflowPanel } from "@/components/workflow/workflow-actions";
import { WorkflowTimeline } from "@/components/workflow/workflow-timeline";
import { buildTimeline, type PasoConEstado } from "@/components/workflow/workflow-types";
import type { AprobacionConDetalle } from "@/services/workflow-read";
import type { Rendicion } from "@/types/entities";

interface WorkflowTabProps {
  rendicion: Rendicion;
  estadoCodigo: string | null;
  tieneWorkflowActivo: boolean;
}

export function WorkflowTab({ rendicion, estadoCodigo, tieneWorkflowActivo }: WorkflowTabProps) {
  const { user } = useAuth();

  // Datos del workflow
  const { data: pasoActual, isLoading: loadingPaso } = usePasoActual(rendicion.id);
  const { data: aprobaciones = [], isLoading: loadingAprobaciones } = useAprobacionesRendicion(
    rendicion.id,
  );
  const { data: historial = [], isLoading: loadingHistorial } = useHistorialRendicion(rendicion.id);
  const { data: comentarios = [], isLoading: loadingComentarios } = useComentariosRendicion(
    rendicion.id,
  );
  const { data: pasosDef = [] } = useWorkflowPasos(rendicion.workflow_id);
  const { data: rolUsuario } = useRolUsuarioEnEmpresa();

  // Mutaciones
  const enviarMut = useEnviarAprobacion();
  const accionMut = useRegistrarAccion();
  const comentarioMut = useAgregarComentario();

  // Permisos — centralizados en permissions.ts, nunca inline en UI
  const puedeEnviar = canEnviarAprobacion({
    estadoCodigo,
    rendicionUsuarioId: rendicion.usuario_id,
    usuarioActualId: user?.id,
    tieneWorkflowActivo,
  });

  const puedeActuar = canActuarEnPaso({
    estadoCodigo,
    pasoRolId: pasoActual?.rol_id ?? null,
    usuarioRolId: rolUsuario?.rol_id ?? null,
    rendicionUsuarioId: rendicion.usuario_id,
    usuarioActualId: user?.id,
  });

  const puedeComentar = canAgregarComentario({
    estadoCodigo,
    rendicionUsuarioId: rendicion.usuario_id,
    usuarioActualId: user?.id,
    esAprobadorEnEmpresa: !!rolUsuario,
  });

  // Construir pasos con estado para el stepper
  const aprobacionesByPaso = new Map<string, AprobacionConDetalle>();
  for (const ap of aprobaciones) {
    if (ap.accion_codigo === "aprobar") {
      aprobacionesByPaso.set(ap.workflow_paso_id, ap);
    }
  }

  const pasosConEstado: PasoConEstado[] = pasosDef.map((paso) => {
    const aprobacion = aprobacionesByPaso.get(paso.id);
    const esPasoActivo = pasoActual?.paso_id === paso.id;

    // Verificar si hay un rechazo en este paso
    const tieneRechazo = aprobaciones.some(
      (a) => a.workflow_paso_id === paso.id && a.accion_codigo === "rechazar",
    );

    let estado: PasoConEstado["estado"] = "pendiente";
    if (aprobacion) estado = "aprobado";
    else if (tieneRechazo) estado = "rechazado";
    else if (esPasoActivo) estado = "activo";

    return {
      id: paso.id,
      nombre: paso.nombre,
      orden: paso.orden,
      rol_id: paso.rol_id,
      es_ultimo: paso.orden === Math.max(...pasosDef.map((p) => p.orden)),
      estado,
      aprobacion,
    };
  });

  // Construir timeline combinado
  const timeline = buildTimeline(historial, comentarios, aprobaciones);

  const loadingAll = loadingPaso || loadingAprobaciones || loadingHistorial || loadingComentarios;

  // Paso activo como PasoConEstado (para el panel del aprobador)
  const pasoActivoConEstado = pasosConEstado.find((p) => p.estado === "activo") ?? null;

  async function handleEnviar() {
    try {
      await enviarMut.mutateAsync(rendicion.id);
      toast.success("Rendición enviada a aprobación.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar la rendición.");
    }
  }

  async function handleAccion(
    accion: "aprobar" | "rechazar" | "devolver",
    comentario: string | null,
  ) {
    if (!pasoActual) return;
    try {
      await accionMut.mutateAsync({
        rendicionId: rendicion.id,
        workflowPasoId: pasoActual.paso_id,
        accionCodigo: accion,
        comentario,
      });
      const labels = { aprobar: "aprobada", rechazar: "rechazada", devolver: "devuelta" };
      toast.success(`Rendición ${labels[accion]}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar la acción.");
    }
  }

  async function handleComentario(texto: string) {
    try {
      await comentarioMut.mutateAsync({ rendicionId: rendicion.id, comentario: texto });
      toast.success("Comentario agregado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al agregar el comentario.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Panel de acciones (izquierda) */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Estado del workflow</h3>
        <WorkflowPanel
          pasos={pasosConEstado}
          pasoActivo={pasoActivoConEstado}
          estadoCodigo={estadoCodigo}
          puedeEnviar={puedeEnviar}
          puedeActuar={puedeActuar}
          puedeComentar={puedeComentar}
          loadingEnviar={enviarMut.isPending}
          loadingAccion={accionMut.isPending}
          loadingComentario={comentarioMut.isPending}
          onEnviar={() => void handleEnviar()}
          onAccion={(accion, comentario) => void handleAccion(accion, comentario)}
          onComentario={(texto) => void handleComentario(texto)}
          loading={loadingAll}
        />
      </div>

      {/* Timeline (derecha) */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Historial</h3>
        <WorkflowTimeline entradas={timeline} loading={loadingHistorial || loadingComentarios} />
      </div>
    </div>
  );
}
