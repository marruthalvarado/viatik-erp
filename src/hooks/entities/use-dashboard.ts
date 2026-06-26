/**
 * Hooks React Query para el Dashboard Ejecutivo.
 * Wrappea src/services/dashboard.ts.
 */
import { useQuery } from "@tanstack/react-query";
import {
  getEjecutivo,
  getProyectos,
  getClientes,
  getProveedores,
  getIA,
  getGastosPorCategoria,
  getEvolucionMensual,
  getRendicionesPendientes,
  getTopViajeros,
} from "@/services/dashboard";

export function useDashboardEjecutivo(empresaId: string | null) {
  return useQuery({
    queryKey: ["dashboard", "ejecutivo", empresaId],
    queryFn: () => getEjecutivo(empresaId!),
    enabled: !!empresaId,
  });
}

export function useDashboardProyectos(empresaId: string | null, limit = 10) {
  return useQuery({
    queryKey: ["dashboard", "proyectos", empresaId, limit],
    queryFn: () => getProyectos(empresaId!, limit),
    enabled: !!empresaId,
  });
}

export function useDashboardClientes(empresaId: string | null, limit = 10) {
  return useQuery({
    queryKey: ["dashboard", "clientes", empresaId, limit],
    queryFn: () => getClientes(empresaId!, limit),
    enabled: !!empresaId,
  });
}

export function useDashboardProveedores(empresaId: string | null, limit = 10) {
  return useQuery({
    queryKey: ["dashboard", "proveedores", empresaId, limit],
    queryFn: () => getProveedores(empresaId!, limit),
    enabled: !!empresaId,
  });
}

export function useDashboardIA(empresaId: string | null) {
  return useQuery({
    queryKey: ["dashboard", "ia", empresaId],
    queryFn: () => getIA(empresaId!),
    enabled: !!empresaId,
  });
}

export function useGastosPorCategoria(empresaId: string | null, anio?: number) {
  return useQuery({
    queryKey: ["dashboard", "gastos_categoria", empresaId, anio],
    queryFn: () => getGastosPorCategoria(empresaId!, anio),
    enabled: !!empresaId,
  });
}

export function useEvolucionMensual(empresaId: string | null, anio: number) {
  return useQuery({
    queryKey: ["dashboard", "evolucion_mensual", empresaId, anio],
    queryFn: () => getEvolucionMensual(empresaId!, anio),
    enabled: !!empresaId,
  });
}

export function useRendicionesPendientes(empresaId: string | null, limit = 10) {
  return useQuery({
    queryKey: ["dashboard", "rendiciones_pendientes", empresaId, limit],
    queryFn: () => getRendicionesPendientes(empresaId!, limit),
    enabled: !!empresaId,
  });
}

export function useTopViajeros(empresaId: string | null, anio?: number, limit = 10) {
  return useQuery({
    queryKey: ["dashboard", "top_viajeros", empresaId, anio, limit],
    queryFn: () => getTopViajeros(empresaId!, anio, limit),
    enabled: !!empresaId,
  });
}
