/**
 * Tipos y helpers de filtros para Reportes Operativos — FASE 8D
 *
 * Separado del .tsx para cumplir con react-refresh/only-export-components.
 * Clave localStorage: `viatik:filtros:operativos`
 */

const LS_KEY = "viatik:filtros:operativos";

export interface FiltrosOperativos {
  fecha_desde: string; // "YYYY-MM-DD"
  fecha_hasta: string;
  anio: number;
  proyecto_id?: string;
  estado_codigo?: string;
}

export function defaultFiltrosOperativos(): FiltrosOperativos {
  const y = new Date().getFullYear();
  return {
    fecha_desde: `${y}-01-01`,
    fecha_hasta: `${y}-12-31`,
    anio: y,
  };
}

export function loadFiltrosOperativos(): FiltrosOperativos {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultFiltrosOperativos();
    return { ...defaultFiltrosOperativos(), ...(JSON.parse(raw) as Partial<FiltrosOperativos>) };
  } catch {
    // localStorage no disponible (SSR, modo privado, cuota llena)
    return defaultFiltrosOperativos();
  }
}

export function saveFiltrosOperativos(f: FiltrosOperativos): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(f));
  } catch {
    // localStorage no disponible (SSR, modo privado, cuota llena)
  }
}
