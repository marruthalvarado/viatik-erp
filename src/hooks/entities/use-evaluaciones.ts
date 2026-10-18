/**
 * use-evaluaciones.ts
 * Hook React Query para Evaluaciones de Ciclotrón
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEmpresa } from "@/hooks/use-empresa";
import * as svc from "@/services/servicio-tecnico/ciclo-evaluaciones";
import type {
  CicloEvaluacion,
  DatosSitio,
  DatosPerformance,
} from "@/types/entities";
import type {
  CrearEvaluacionParams,
  ProduccionDualInput,
} from "@/services/servicio-tecnico/ciclo-evaluaciones";

// ── Keys ─────────────────────────────────────────────────────────────────────

const KEYS = {
  all:        (eid: string)              => ["evaluaciones", eid] as const,
  byCiclo:    (eid: string, cid: string) => ["evaluaciones", eid, "ciclo", cid] as const,
  detail:     (id: string)               => ["evaluacion", id] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

/** Lista todas las evaluaciones de la empresa */
export function useEvaluaciones() {
  const { empresa } = useEmpresa();
  const eid = empresa?.id ?? "";
  return useQuery({
    queryKey: KEYS.all(eid),
    queryFn:  () => svc.getEvaluaciones(eid),
    enabled:  !!eid,
  });
}

/** Lista evaluaciones de un ciclotrón */
export function useEvaluacionesByCiclotrón(ciclotrónId: string) {
  const { empresa } = useEmpresa();
  const eid = empresa?.id ?? "";
  return useQuery({
    queryKey: KEYS.byCiclo(eid, ciclotrónId),
    queryFn:  () => svc.getEvaluacionesByCiclotrón(eid, ciclotrónId),
    enabled:  !!eid && !!ciclotrónId,
  });
}

/** Obtiene una evaluación por ID */
export function useEvaluacion(id: string) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn:  () => svc.getEvaluacion(id),
    enabled:  !!id,
  });
}

// ── Mutaciones ────────────────────────────────────────────────────────────────

/** Crea una nueva evaluación */
export function useCrearEvaluacion() {
  const { empresa } = useEmpresa();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Omit<CrearEvaluacionParams, "empresa_id">) =>
      svc.crearEvaluacion({ ...params, empresa_id: empresa?.id ?? "" }),
    onSuccess: (data: CicloEvaluacion) => {
      qc.invalidateQueries({ queryKey: KEYS.all(empresa?.id ?? "") });
      qc.invalidateQueries({ queryKey: KEYS.byCiclo(empresa?.id ?? "", data.ciclotrón_id) });
    },
  });
}

/** Guarda datos del sitio */
export function useGuardarDatosSitio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ evalId, datos }: { evalId: string; datos: DatosSitio }) =>
      svc.guardarDatosSitio(evalId, datos),
    onSuccess: (data: CicloEvaluacion) => {
      qc.setQueryData(KEYS.detail(data.id), data);
    },
  });
}

/** Guarda datos del Performance Test */
export function useGuardarDatosPerformance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ evalId, datos }: { evalId: string; datos: DatosPerformance }) =>
      svc.guardarDatosPerformance(evalId, datos),
    onSuccess: (data: CicloEvaluacion) => {
      qc.setQueryData(KEYS.detail(data.id), data);
    },
  });
}

/** Guarda datos de System Evaluation */
export function useGuardarDatosEvaluacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ evalId, producciones }: { evalId: string; producciones: ProduccionDualInput[] }) =>
      svc.guardarDatosEvaluacion(evalId, producciones),
    onSuccess: (data: CicloEvaluacion) => {
      qc.setQueryData(KEYS.detail(data.id), data);
    },
  });
}

/** Completa la evaluación */
export function useCompletarEvaluacion() {
  const { empresa } = useEmpresa();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      evalId,
      resultado,
      observaciones,
    }: {
      evalId: string;
      resultado: "pass" | "fail";
      observaciones?: string;
    }) => svc.completarEvaluacion(evalId, resultado, observaciones),
    onSuccess: (data: CicloEvaluacion) => {
      qc.setQueryData(KEYS.detail(data.id), data);
      qc.invalidateQueries({ queryKey: KEYS.all(empresa?.id ?? "") });
      qc.invalidateQueries({ queryKey: KEYS.byCiclo(empresa?.id ?? "", data.ciclotrón_id) });
    },
  });
}

/** Elimina una evaluación en borrador */
export function useEliminarEvaluacion() {
  const { empresa } = useEmpresa();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (evalId: string) => svc.eliminarEvaluacion(evalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all(empresa?.id ?? "") });
    },
  });
}
