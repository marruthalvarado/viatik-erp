/**
 * use-consultar-ruc.ts
 * Hook para consultar datos de un contribuyente en el SRI por RUC/cédula.
 * Devuelve estado de carga/error y una función para disparar la consulta.
 */
import { useState, useCallback } from "react";
import { consultarRuc, type DatosContribuyente } from "@/services/sri-ruc";

interface UseConsultarRucResult {
  datos: DatosContribuyente | null;
  loading: boolean;
  error: string | null;
  consultar: (ruc: string) => Promise<DatosContribuyente | null>;
  reset: () => void;
}

export function useConsultarRuc(): UseConsultarRucResult {
  const [datos, setDatos] = useState<DatosContribuyente | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consultar = useCallback(async (ruc: string): Promise<DatosContribuyente | null> => {
    const rucLimpio = ruc.trim();
    if (!rucLimpio) return null;

    setLoading(true);
    setError(null);
    setDatos(null);

    try {
      const result = await consultarRuc(rucLimpio);
      setDatos(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al consultar el SRI";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setDatos(null);
    setError(null);
  }, []);

  return { datos, loading, error, consultar, reset };
}
