/** Tipos y utilidades de filtros BI — sin JSX para cumplir react-refresh. */

export interface BiFiltros {
  fecha_desde: string; // "YYYY-MM-DD"
  fecha_hasta: string;
  anio: number;
}

export function defaultBiFiltros(): BiFiltros {
  const y = new Date().getFullYear();
  return { fecha_desde: `${y}-01-01`, fecha_hasta: `${y}-12-31`, anio: y };
}
