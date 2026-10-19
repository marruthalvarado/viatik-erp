/**
 * Hooks React Query para el módulo de Ciclotrones.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCompany } from "@/contexts/company-context";

import {
  getCiclotrones, getCiclotrón,
  crearCiclotrón, actualizarCiclotrón, eliminarCiclotrón,
  parsearParametros,
  type CiclotrónParametros,
} from "@/services/servicio-tecnico/ciclotrones";

import {
  getCicloProduccionesDeciclotron, getCicloProduccion,
  crearCicloProduccion, actualizarCicloProduccion, eliminarCicloProduccion,
  subirArchivoBatch, estadoDesdeAnomalias,
} from "@/services/servicio-tecnico/ciclo-producciones";

import {
  parseBatchFile, calcDuracionSegundos, calcTargetISetpoint,
} from "@/services/servicio-tecnico/ciclo-batch-parser";

import {
  detectAnomalias, resumirAnomalias,
} from "@/services/servicio-tecnico/ciclo-anomaly";

import type { CiclotrónInsert, CiclotrónUpdate, CicloProduccionInsert, CicloAnomalia } from "@/types/entities";

export type { CiclotrónParametros };

// ── Ciclotrones ───────────────────────────────────────────────────────────────

export function useCiclotrones() {
  const { empresaActivaId } = useCompany();
  return useQuery({
    queryKey: ["ciclotrones", empresaActivaId],
    queryFn: () => getCiclotrones(empresaActivaId!),
    enabled: !!empresaActivaId,
    staleTime: 5 * 60_000,
  });
}

export function useCiclotrón(id: string | null | undefined) {
  return useQuery({
    queryKey: ["ciclotrones", "one", id],
    queryFn: () => getCiclotrón(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useCrearCiclotrón() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();
  return useMutation({
    mutationFn: (payload: Omit<CiclotrónInsert, "empresa_id">) =>
      crearCiclotrón({ ...payload, empresa_id: empresaActivaId! }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ciclotrones"] });
      toast.success("Ciclotrón creado");
    },
    onError: (e) => toast.error(`Error al crear ciclotrón: ${(e as Error).message}`),
  });
}

export function useActualizarCiclotrón() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: CiclotrónUpdate & { id: string }) =>
      actualizarCiclotrón(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ciclotrones"] });
      toast.success("Ciclotrón actualizado");
    },
    onError: (e) => toast.error(`Error: ${(e as Error).message}`),
  });
}

export function useEliminarCiclotrón() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarCiclotrón(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ciclotrones"] });
      toast.success("Ciclotrón eliminado");
    },
    onError: (e) => toast.error(`Error: ${(e as Error).message}`),
  });
}

// Re-exportar helper de parámetros
export { parsearParametros };

// ── Producciones ──────────────────────────────────────────────────────────────

export function useCicloProduccionesDeCiclotrón(ciclotrónId: string | null | undefined) {
  return useQuery({
    queryKey: ["ciclo-producciones", ciclotrónId],
    queryFn: () => getCicloProduccionesDeciclotron(ciclotrónId!),
    enabled: !!ciclotrónId,
    staleTime: 2 * 60_000,
  });
}

export function useCicloProduccion(id: string | null | undefined) {
  return useQuery({
    queryKey: ["ciclo-producciones", "one", id],
    queryFn: () => getCicloProduccion(id!),
    enabled: !!id,
    staleTime: 2 * 60_000,
  });
}

export function useEliminarCicloProduccion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarCicloProduccion(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ciclo-producciones"] });
      toast.success("Producción eliminada");
    },
    onError: (e) => toast.error(`Error: ${(e as Error).message}`),
  });
}

// ── Upload + análisis en un solo hook ────────────────────────────────────────

export interface SubirAnalizarPayload {
  ciclotrónId: string;
  file: File;
  params: CiclotrónParametros;
  notas?: string;
}

/**
 * Sube el archivo, lo parsea en el browser, corre el motor de anomalías
 * y guarda el resultado en BD.
 */
export function useSubirAnalizarBatch() {
  const qc = useQueryClient();
  const { empresaActivaId } = useCompany();

  return useMutation({
    mutationFn: async ({ ciclotrónId, file, params, notas }: SubirAnalizarPayload) => {
      // 1. Parsear en el browser
      const parsed = await parseBatchFile(file);

      // 2. Calcular estadísticas
      const duracion  = calcDuracionSegundos(parsed.rows);
      const targetISp = calcTargetISetpoint(parsed.rows, params.gas_flow.min);

      // 3. Detectar anomalías
      const anomalias: CicloAnomalia[] = detectAnomalias(parsed.rows, params, targetISp);
      const resumen   = resumirAnomalias(anomalias);

      // 4. Subir archivo a Storage
      const archivoPath = await subirArchivoBatch(empresaActivaId!, ciclotrónId, file);

      // 5. Determinar tipo de archivo
      const ext = file.name.split(".").pop()?.toLowerCase();
      const archivoTipo: "log" | "ods" | "xlsx" =
        ext === "ods" ? "ods" : ext === "xlsx" ? "xlsx" : "log";

      // 6. Crear registro en BD
      const insert: CicloProduccionInsert = {
        "ciclotrón_id":   ciclotrónId,
        empresa_id:       empresaActivaId!,
        numero_batch:     parsed.meta.numeroBatch,
        tracer:           parsed.meta.tracer,
        sitio:            parsed.meta.sitio,
        fecha:            parsed.meta.fecha,
        archivo_path:     archivoPath,
        archivo_nombre:   file.name,
        archivo_tipo:     archivoTipo,
        duracion_segundos: duracion,
        target_i_setpoint: targetISp,
        total_filas:      parsed.rows.length,
        anomalias_count:  resumen.total,
        anomalias:        anomalias as unknown as import("@/types/database").Json,
        estado:           estadoDesdeAnomalias(anomalias),
        notas:            notas ?? null,
      };

      return crearCicloProduccion(insert);
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["ciclo-producciones", data["ciclotrón_id"]] });
      const msg = data.anomalias_count === 0
        ? "Batch analizado — sin anomalías"
        : `Batch analizado — ${data.anomalias_count} anomalía(s) detectada(s)`;
      toast.success(msg);
    },
    onError: (e) => toast.error(`Error al procesar batch: ${(e as Error).message}`),
  });
}

/**
 * Actualiza en BD el resultado del análisis de un batch ya existente.
 * Se llama silenciosamente desde ProduccionAnalisis después de re-analizar
 * con el motor actual (p.ej. cuando el motor fue mejorado y los datos en BD
 * quedaron obsoletos).
 */
export function useResincronizarAnalisisBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      produccionId,
      ciclotronId,
      anomalias,
      targetISetpoint,
    }: {
      produccionId: string;
      ciclotronId: string;
      anomalias: CicloAnomalia[];
      targetISetpoint?: number;
    }) => {
      const resumen = resumirAnomalias(anomalias);
      return actualizarCicloProduccion(produccionId, {
        anomalias_count:   resumen.total,
        anomalias:         anomalias as unknown as import("@/types/database").Json,
        estado:            estadoDesdeAnomalias(anomalias),
        ...(targetISetpoint != null && { target_i_setpoint: targetISetpoint }),
      });
    },
    onSuccess: (_data, { ciclotronId }) => {
      void qc.invalidateQueries({ queryKey: ["ciclo-producciones", ciclotronId] });
    },
    // Error silencioso — no mostrar toast para no interrumpir al usuario
    onError: () => { /* silencioso */ },
  });
}
