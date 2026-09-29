import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/hooks/use-company";
import {
  createActualizacion,
  deleteActualizacion,
  getBitacoraProyecto,
  getResumenBitacora,
  updateActualizacion,
  type InsertProyectoActualizacion,
} from "@/services/bitacora";

// ── Timeline de un proyecto ────────────────────────────────
export function useBitacoraProyecto(proyectoId: string) {
  return useQuery({
    queryKey: ["bitacora", proyectoId],
    queryFn: () => getBitacoraProyecto(proyectoId),
    enabled: !!proyectoId,
  });
}

// ── Resumen para dashboard ─────────────────────────────────
export function useResumenBitacora() {
  const { empresaActiva } = useCompany();
  return useQuery({
    queryKey: ["bitacora-resumen", empresaActiva?.id],
    queryFn: () => getResumenBitacora(empresaActiva!.id),
    enabled: !!empresaActiva?.id,
  });
}

// ── Crear actualización ────────────────────────────────────
export function useCrearActualizacion(proyectoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: InsertProyectoActualizacion) =>
      createActualizacion(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bitacora", proyectoId] });
      void qc.invalidateQueries({ queryKey: ["bitacora-resumen"] });
    },
  });
}

// ── Editar actualización ───────────────────────────────────
export function useEditarActualizacion(proyectoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<InsertProyectoActualizacion>;
    }) => updateActualizacion(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bitacora", proyectoId] });
      void qc.invalidateQueries({ queryKey: ["bitacora-resumen"] });
    },
  });
}

// ── Eliminar actualización ─────────────────────────────────
export function useEliminarActualizacion(proyectoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteActualizacion(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bitacora", proyectoId] });
      void qc.invalidateQueries({ queryKey: ["bitacora-resumen"] });
    },
  });
}
