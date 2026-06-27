/**
 * use-notifications.ts — FASE 9A
 *
 * Hooks de notificaciones para todos los componentes del ERP.
 * Los componentes nunca acceden a Supabase directamente.
 *
 * Arquitectura: Componente → Hook → Service → Supabase
 *
 * Exports:
 *   useNotificaciones   — listado con polling cada 30s
 *   useConteoNoLeidas   — contador badge con polling cada 60s
 *   useMarcarLeida      — mutación: marcar una como leída
 *   useMarcarTodasLeidas — mutación: marcar todas como leídas
 *   useEliminarNotificacion — mutación: eliminar
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useCompany } from "@/contexts/company-context";
import {
  getNotificaciones,
  getConteoNoLeidas,
  type NotificacionesParams,
  type NotificacionTipo,
} from "@/services/notifications/notifications-read";
import {
  marcarComoLeida,
  marcarTodasComoLeidas,
  eliminarNotificacion,
} from "@/services/notifications/notifications-actions";

// ---------------------------------------------------------------------------
// Claves de caché
// ---------------------------------------------------------------------------

const QUERY_KEYS = {
  list: (uid: string, eid: string, soloNoLeidas?: boolean, tipo?: NotificacionTipo) =>
    ["notificaciones", uid, eid, soloNoLeidas ?? false, tipo ?? "all"] as const,
  count: (uid: string, eid: string) => ["notificaciones-count", uid, eid] as const,
} as const;

// ---------------------------------------------------------------------------
// Opciones de filtro para el listado
// ---------------------------------------------------------------------------

export interface UseNotificacionesOptions {
  soloNoLeidas?: boolean;
  limite?: number;
  tipo?: NotificacionTipo;
}

// ---------------------------------------------------------------------------
// useNotificaciones — listado con polling
// ---------------------------------------------------------------------------

export function useNotificaciones(opts: UseNotificacionesOptions = {}) {
  const { user } = useAuth();
  const { empresaActivaId } = useCompany();

  const enabled = !!user && !!empresaActivaId;

  return useQuery({
    queryKey: QUERY_KEYS.list(user?.id ?? "", empresaActivaId ?? "", opts.soloNoLeidas, opts.tipo),
    queryFn: () => {
      const params: NotificacionesParams = {
        empresaId: empresaActivaId!,
        usuarioId: user!.id,
        soloNoLeidas: opts.soloNoLeidas,
        limite: opts.limite,
        tipo: opts.tipo,
      };
      return getNotificaciones(params);
    },
    enabled,
    staleTime: 30_000, // 30 s
    refetchInterval: 30_000, // polling cada 30 s
    refetchIntervalInBackground: false,
  });
}

// ---------------------------------------------------------------------------
// useConteoNoLeidas — badge counter con polling más frecuente
// ---------------------------------------------------------------------------

export function useConteoNoLeidas() {
  const { user } = useAuth();
  const { empresaActivaId } = useCompany();

  const enabled = !!user && !!empresaActivaId;

  return useQuery({
    queryKey: QUERY_KEYS.count(user?.id ?? "", empresaActivaId ?? ""),
    queryFn: () => getConteoNoLeidas(user!.id, empresaActivaId!),
    enabled,
    staleTime: 60_000,
    refetchInterval: 60_000, // polling cada 60 s
    refetchIntervalInBackground: false,
    placeholderData: 0,
  });
}

// ---------------------------------------------------------------------------
// useMarcarLeida — mutación individual
// ---------------------------------------------------------------------------

export function useMarcarLeida() {
  const { user } = useAuth();
  const { empresaActivaId } = useCompany();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (notificacionId: string) => marcarComoLeida(notificacionId),
    onSuccess: () => {
      if (!user || !empresaActivaId) return;
      void qc.invalidateQueries({
        queryKey: ["notificaciones", user.id, empresaActivaId],
      });
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.count(user.id, empresaActivaId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// useMarcarTodasLeidas — mutación masiva (RPC)
// ---------------------------------------------------------------------------

export function useMarcarTodasLeidas() {
  const { user } = useAuth();
  const { empresaActivaId } = useCompany();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!user || !empresaActivaId) return Promise.resolve(0);
      return marcarTodasComoLeidas(user.id, empresaActivaId);
    },
    onSuccess: () => {
      if (!user || !empresaActivaId) return;
      void qc.invalidateQueries({
        queryKey: ["notificaciones", user.id, empresaActivaId],
      });
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.count(user.id, empresaActivaId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// useEliminarNotificacion — mutación eliminar
// ---------------------------------------------------------------------------

export function useEliminarNotificacion() {
  const { user } = useAuth();
  const { empresaActivaId } = useCompany();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (notificacionId: string) => eliminarNotificacion(notificacionId),
    onSuccess: () => {
      if (!user || !empresaActivaId) return;
      void qc.invalidateQueries({
        queryKey: ["notificaciones", user.id, empresaActivaId],
      });
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.count(user.id, empresaActivaId),
      });
    },
  });
}
