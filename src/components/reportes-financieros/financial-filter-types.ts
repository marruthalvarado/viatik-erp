/** Tipos y utilidades de filtros para Reportes Financieros — sin JSX (react-refresh). */

export interface FiltrosFinancieros {
  fecha_desde: string; // "YYYY-MM-DD"
  fecha_hasta: string;
  anio: number;
  proyecto_id?: string;
  categoria_id?: string;
}

const LS_KEY_FIN = "viatik:filtros:financieros";

export function defaultFiltrosFinancieros(): FiltrosFinancieros {
  const y = new Date().getFullYear();
  return { fecha_desde: `${y}-01-01`, fecha_hasta: `${y}-12-31`, anio: y };
}

export function loadFiltrosFinancieros(): FiltrosFinancieros {
  try {
    const raw = localStorage.getItem(LS_KEY_FIN);
    if (raw) {
      return {
        ...defaultFiltrosFinancieros(),
        ...(JSON.parse(raw) as Partial<FiltrosFinancieros>),
      };
    }
  } catch {
    // localStorage no disponible
  }
  return defaultFiltrosFinancieros();
}

export function saveFiltrosFinancieros(f: FiltrosFinancieros): void {
  try {
    localStorage.setItem(LS_KEY_FIN, JSON.stringify(f));
  } catch {
    // localStorage no disponible
  }
}
