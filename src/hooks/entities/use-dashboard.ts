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
  getPresupuestoTotal,
  getResumenFinancieroProyectos,
} from "@/services/dashboard";

export function useDashboardEjecutivo(empresaId: string | null, anio?: number) {
  return useQuery({
    queryKey: ["dashboard", "ejecutivo", empresaId, anio],
    queryFn: () => getEjecutivo(empresaId!, anio),
    enabled: !!empresaId,
  });
}

export function useDashboardProyectos(empresaId: string | null, limit = 10, anio?: number) {
  return useQuery({
    queryKey: ["dashboard", "proyectos", empresaId, limit, anio],
    queryFn: () => getProyectos(empresaId!, limit, anio),
    enabled: !!empresaId,
  });
}

export function useDashboardClientes(empresaId: string | null, limit = 10, anio?: number) {
  return useQuery({
    queryKey: ["dashboard", "clientes", empresaId, limit, anio],
    queryFn: () => getClientes(empresaId!, limit, anio),
    enabled: !!empresaId,
  });
}

export function useDashboardProveedores(empresaId: string | null, limit = 10, anio?: number) {
  return useQuery({
    queryKey: ["dashboard", "proveedores", empresaId, limit, anio],
    queryFn: () => getProveedores(empresaId!, limit, anio),
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

export function usePresupuestoTotal(empresaId: string | null) {
  return useQuery({
    queryKey: ["presupuestos", "total", empresaId],
    queryFn: () => getPresupuestoTotal(empresaId!),
    enabled: !!empresaId,
  });
}

export function useResumenFinancieroProyectos(empresaId: string | null) {
  return useQuery({
    queryKey: ["presupuestos", "resumen_financiero", empresaId],
    queryFn: () => getResumenFinancieroProyectos(empresaId!),
    enabled: !!empresaId,
  });
}
