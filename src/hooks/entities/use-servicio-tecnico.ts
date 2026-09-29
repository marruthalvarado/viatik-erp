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
  type OrdenServicioPayload, type OsRepuestoPayload,
} from "@/services/servicio-tecnico/ordenes-servicio";

import {
  getOrdenActividades, actualizarActividad, crearActividadManual,
  eliminarActividad, poblarActividadesOrden, guardarFirmaOrden,
  getPlantillasActividad, crearPlantillaActividad, actualizarPlantillaActividad,
  type ActividadUpdate, type FirmaPayload,
} from "@/services/servicio-tecnico/actividades";

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
