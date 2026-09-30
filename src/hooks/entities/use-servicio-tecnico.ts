/**
 * Hooks React Query para el módulo de Servicio Técnico
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/contexts/company-context";

import {
  getEquiposInstalados, getEquipoInstalado,
  crearEquipoInstalado, actualizarEquipoInstalado, eliminarEquipoInstalado,
  type EquipoInstaladoPayload, type EquipoInstaladoConRelaciones,
} from "@/services/servicio-tecnico/equipos-instalados";

import {
  getContratosMantenimiento, getContratoMantenimiento,
  crearContratoMantenimiento, actualizarContratoMantenimiento, eliminarContratoMantenimiento,
  type ContratoPayload,
} from "@/services/servicio-tecnico/contratos-mantenimiento";

import {
  getOrdenesServicio, getOrdenServicio,
  crearOrdenServicio, actualizarOrdenServicio, cerrarOrdenServicio,
  eliminarOrdenServicio, generarOrdenesPreventivasManual,
  getOsActividades, cargarActividadesProtocolo, actualizarOsActividad, getResumenOsActividades,
  type OrdenServicioPayload, type OsRepuestoPayload,
  type OsActividad, type ResumenOsActividades,
} from "@/services/servicio-tecnico/ordenes-servicio";

import {
  getOrdenActividades, actualizarActividad, crearActividadManual,
  eliminarActividad, poblarActividadesOrden, guardarFirmaOrden,
  getPlantillasActividad, crearPlantillaActividad, actualizarPlantillaActividad,
  type ActividadUpdate, type FirmaPayload,
} from "@/services/servicio-tecnico/actividades";

import {
  getModalidades, crearModalidad, actualizarModalidad,
  type Modalidad, type ModalidadPayload,
} from "@/services/servicio-tecnico/modalidades";

import {
  getModelosEquipo, crearModeloEquipo, actualizarModeloEquipo,
  type ModeloEquipo, type ModeloEquipoPayload,
} from "@/services/servicio-tecnico/modelos-equipo";

import {
  getProtocolos, getProtocoloDetalle,
  crearProtocolo, actualizarProtocolo,
  crearSeccion, actualizarSeccion, eliminarSeccion,
  crearActividad as crearActividadProtocolo,
  actualizarActividad as actualizarActividadProtocolo,
  eliminarActividad as eliminarActividadProtocolo,
  type Protocolo, type ProtocoloSeccion, type ProtocoloActividad, type ProtocoloConDetalle,
} from "@/services/servicio-tecnico/protocolos";

// ── EQUIPOS INSTALADOS ────────────────────────────────────────────────────────

export function useEquiposInstalados() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["equipos_instalados", empresaActivaId],
    queryFn: () => getEquiposInstalados(empresaActivaId!),
    enabled: !!empresaActivaId,
  });
}

export function useEquipoInstalado(id: string | null) {
  return useQuery({
    queryKey: ["equipo_instalado", id],
    queryFn: () => getEquipoInstalado(id!),
    enabled: !!id,
  });
}

export function useCrearEquipoInstalado() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: (payload: EquipoInstaladoPayload) =>
      crearEquipoInstalado(empresaActivaId!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["equipos_instalados"] }),
  });
}

export function useActualizarEquipoInstalado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<EquipoInstaladoPayload> }) =>
      actualizarEquipoInstalado(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["equipos_instalados"] });
      qc.invalidateQueries({ queryKey: ["equipo_instalado", id] });
    },
  });
}

export function useEliminarEquipoInstalado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarEquipoInstalado(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["equipos_instalados"] }),
  });
}

// ── CONTRATOS DE MANTENIMIENTO ─────────────────────────────────────────────────

export function useContratosMantenimiento() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["contratos_mantenimiento", empresaActivaId],
    queryFn: () => getContratosMantenimiento(empresaActivaId!),
    enabled: !!empresaActivaId,
  });
}

export function useContratoMantenimiento(id: string | null) {
  return useQuery({
    queryKey: ["contrato_mantenimiento", id],
    queryFn: () => getContratoMantenimiento(id!),
    enabled: !!id,
  });
}

export function useCrearContratoMantenimiento() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({ payload, equipos }: { payload: ContratoPayload; equipos?: string[] }) =>
      crearContratoMantenimiento(empresaActivaId!, payload, equipos),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contratos_mantenimiento"] }),
  });
}

export function useActualizarContratoMantenimiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload, equipos }: { id: string; payload: Partial<ContratoPayload>; equipos?: string[] }) =>
      actualizarContratoMantenimiento(id, payload, equipos),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["contratos_mantenimiento"] });
      qc.invalidateQueries({ queryKey: ["contrato_mantenimiento", id] });
    },
  });
}

export function useEliminarContratoMantenimiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarContratoMantenimiento(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contratos_mantenimiento"] }),
  });
}

// ── ÓRDENES DE SERVICIO ────────────────────────────────────────────────────────

export function useOrdenesServicio() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["ordenes_servicio", empresaActivaId],
    queryFn: () => getOrdenesServicio(empresaActivaId!),
    enabled: !!empresaActivaId,
  });
}

export function useOrdenServicio(id: string | null) {
  return useQuery({
    queryKey: ["orden_servicio", id],
    queryFn: () => getOrdenServicio(id!),
    enabled: !!id,
  });
}

export function useCrearOrdenServicio() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({
      payload,
      repuestos,
    }: {
      payload: OrdenServicioPayload;
      repuestos?: OsRepuestoPayload[];
    }) => crearOrdenServicio(empresaActivaId!, payload, repuestos),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordenes_servicio"] });
      qc.invalidateQueries({ queryKey: ["equipos_instalados"] });
    },
  });
}

export function useActualizarOrdenServicio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
      repuestos,
    }: {
      id: string;
      payload: Partial<OrdenServicioPayload>;
      repuestos?: OsRepuestoPayload[];
    }) => actualizarOrdenServicio(id, payload, repuestos),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["ordenes_servicio"] });
      qc.invalidateQueries({ queryKey: ["orden_servicio", id] });
    },
  });
}

export function useCerrarOrdenServicio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      trabajos_realizados,
      observaciones,
      costo_mano_obra,
    }: {
      id: string;
      trabajos_realizados: string;
      observaciones?: string;
      costo_mano_obra?: number;
    }) => cerrarOrdenServicio(id, trabajos_realizados, observaciones, costo_mano_obra),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordenes_servicio"] });
      qc.invalidateQueries({ queryKey: ["equipos_instalados"] });
    },
  });
}

export function useEliminarOrdenServicio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarOrdenServicio(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ordenes_servicio"] }),
  });
}

export function useGenerarOrdenesPreventivasManual() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: (dias_horizonte?: number) =>
      generarOrdenesPreventivasManual(empresaActivaId!, dias_horizonte),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ordenes_servicio"] }),
  });
}

// ── ACTIVIDADES ───────────────────────────────────────────────────────────────

export function useOrdenActividades(orden_id: string | null) {
  return useQuery({
    queryKey: ["orden_actividades", orden_id],
    queryFn: () => getOrdenActividades(orden_id!),
    enabled: !!orden_id,
  });
}

export function useActualizarActividad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ActividadUpdate }) =>
      actualizarActividad(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orden_actividades"] });
    },
  });
}

export function useCrearActividadManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orden_id, nombre, descripcion }: { orden_id: string; nombre: string; descripcion?: string }) =>
      crearActividadManual(orden_id, nombre, descripcion),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orden_actividades"] }),
  });
}

export function useEliminarActividad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarActividad(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orden_actividades"] }),
  });
}

export function usePoblarActividadesOrden() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: ({ orden_id, tipo_os, fabricante_id }: { orden_id: string; tipo_os: string; fabricante_id?: string | null }) =>
      poblarActividadesOrden(orden_id, empresaActivaId!, tipo_os, fabricante_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orden_actividades"] }),
  });
}

export function useGuardarFirmaOrden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orden_id, firma }: { orden_id: string; firma: FirmaPayload }) =>
      guardarFirmaOrden(orden_id, firma),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordenes_servicio"] });
    },
  });
}

// ── PLANTILLAS DE ACTIVIDAD ───────────────────────────────────────────────────

export function usePlantillasActividad() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["plantillas_actividad", empresaActivaId],
    queryFn: () => getPlantillasActividad(empresaActivaId!),
    enabled: !!empresaActivaId,
  });
}

export function useCrearPlantillaActividad() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: (payload: Parameters<typeof crearPlantillaActividad>[1]) =>
      crearPlantillaActividad(empresaActivaId!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plantillas_actividad"] }),
  });
}

export function useActualizarPlantillaActividad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof actualizarPlantillaActividad>[1] }) =>
      actualizarPlantillaActividad(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plantillas_actividad"] }),
  });
}

// ── MODALIDADES ───────────────────────────────────────────────────────────────

export function useModalidades() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["modalidades", empresaActivaId],
    queryFn: () => getModalidades(empresaActivaId!),
    enabled: !!empresaActivaId,
  });
}

export function useCrearModalidad() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: (payload: ModalidadPayload) => crearModalidad(empresaActivaId!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modalidades"] }),
  });
}

export function useActualizarModalidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ModalidadPayload & { activa: boolean }> }) =>
      actualizarModalidad(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modalidades"] }),
  });
}

// ── MODELOS DE EQUIPO ─────────────────────────────────────────────────────────

export function useModelosEquipo(modalidadId?: string) {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["modelos_equipo", empresaActivaId, modalidadId],
    queryFn: () => getModelosEquipo(empresaActivaId!, modalidadId),
    enabled: !!empresaActivaId,
  });
}

export function useCrearModeloEquipo() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: (payload: ModeloEquipoPayload) => crearModeloEquipo(empresaActivaId!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modelos_equipo"] }),
  });
}

export function useActualizarModeloEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<ModeloEquipoPayload, "modalidad_id"> & { activo: boolean }> }) =>
      actualizarModeloEquipo(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modelos_equipo"] }),
  });
}

// ── PROTOCOLOS ────────────────────────────────────────────────────────────────

export function useProtocolos(modeloId?: string) {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["protocolos", empresaActivaId, modeloId],
    queryFn: () => getProtocolos(empresaActivaId!, modeloId),
    enabled: !!empresaActivaId,
  });
}

export function useProtocoloDetalle(protocoloId: string | null) {
  return useQuery({
    queryKey: ["protocolo_detalle", protocoloId],
    queryFn: () => getProtocoloDetalle(protocoloId!),
    enabled: !!protocoloId,
  });
}

export function useCrearProtocolo() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: (payload: { modelo_id: string; nombre: string; version?: string | null; descripcion?: string | null }) =>
      crearProtocolo(empresaActivaId!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["protocolos"] }),
  });
}

export function useActualizarProtocolo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<{ nombre: string; version: string | null; descripcion: string | null; activo: boolean }> }) =>
      actualizarProtocolo(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["protocolos"] }),
  });
}

export function useCrearSeccion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crearSeccion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["protocolo_detalle"] }),
  });
}

export function useActualizarSeccion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<{ titulo: string; intervalo_meses: number | null; descripcion_frecuencia: string | null }> }) =>
      actualizarSeccion(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["protocolo_detalle"] }),
  });
}

export function useEliminarSeccion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: eliminarSeccion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["protocolo_detalle"] }),
  });
}

export function useCrearActividadProtocolo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crearActividadProtocolo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["protocolo_detalle"] }),
  });
}

export function useActualizarActividadProtocolo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof actualizarActividadProtocolo>[1] }) =>
      actualizarActividadProtocolo(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["protocolo_detalle"] }),
  });
}

export function useEliminarActividadProtocolo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: eliminarActividadProtocolo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["protocolo_detalle"] }),
  });
}

// ── OS ACTIVIDADES (checklist protocolo) ───────────────────────────────────────

export function useOsActividades(ordenId: string | null) {
  return useQuery({
    queryKey: ["os_actividades", ordenId],
    queryFn: () => getOsActividades(ordenId!),
    enabled: !!ordenId,
  });
}

export function useCargarActividadesProtocolo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orden_id,
      protocolo_id,
      meses_acumulados,
    }: { orden_id: string; protocolo_id: string; meses_acumulados?: number }) =>
      cargarActividadesProtocolo(orden_id, protocolo_id, meses_acumulados),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["os_actividades", vars.orden_id] }),
  });
}

export function useActualizarOsActividad(ordenId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, resultado, valor_medido, texto_respuesta, notas_resultado,
    }: { id: string; resultado?: string | null; valor_medido?: number | null; texto_respuesta?: string | null; notas_resultado?: string | null }) =>
      actualizarOsActividad(id, resultado, valor_medido, texto_respuesta, notas_resultado),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os_actividades", ordenId] }),
  });
}

export function useResumenOsActividades(ordenId: string | null) {
  return useQuery({
    queryKey: ["os_actividades_resumen", ordenId],
    queryFn: () => getResumenOsActividades(ordenId!),
    enabled: !!ordenId,
  });
}

// Re-exports de tipos para consumo en componentes
export type {
  Modalidad, ModeloEquipo, Protocolo, ProtocoloSeccion, ProtocoloActividad, ProtocoloConDetalle,
  OsActividad, ResumenOsActividades,
};
