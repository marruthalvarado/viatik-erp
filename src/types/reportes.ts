/**
 * Tipos del módulo BI/Reportes — FASE 8A
 *
 * Contiene:
 *   · Parámetros de filtros para cada grupo de reportes
 *   · DTOs de retorno de vistas y RPCs analíticas
 *   · Tipos de paginación y exportación compartidos
 *
 * Reglas:
 *   · Sin `any`. Tipado estricto.
 *   · Todos los campos nullable de vistas se marcan `| null`.
 *   · Los RPCs tienen sus propios tipos de retorno derivados de database.ts.
 */

// =============================================================================
// PARÁMETROS COMUNES
// =============================================================================

/** Rango de fechas usado en la mayoría de filtros de reportes. */
export interface FiltroFechas {
  fecha_desde: string; // ISO date: "YYYY-MM-DD"
  fecha_hasta: string;
}

/** Filtros globales persistentes en localStorage bajo `viatik:filtros:globales`. */
export interface FiltrosGlobales {
  fecha_desde: string;
  fecha_hasta: string;
  proyecto_id?: string;
  usuario_id?: string;
}

// =============================================================================
// REPORTES OPERATIVOS
// =============================================================================

/** Filtros para RPT-OPS-01: Estado de rendiciones */
export interface FiltroRendicionesEstado extends FiltroFechas {
  empresa_id: string;
  estado_codigo?: string;
  usuario_id?: string;
  proyecto_id?: string;
}

/** Fila de vw_rpt_rendiciones_estado */
export interface RendicionEstadoRow {
  id: string;
  numero: string | null;
  fecha_rendicion: string | null;
  fecha_envio: string | null;
  fecha_aprobacion: string | null;
  created_at: string | null;
  estado_codigo: string | null;
  estado_nombre: string | null;
  tipo_nombre: string | null;
  proyecto_nombre: string | null;
  proyecto_id: string | null;
  usuario_nombre: string | null;
  usuario_id: string | null;
  total_facturado: number | null;
  total_reembolsable: number | null;
  total_anticipos: number | null;
  saldo: number | null;
  dias_en_estado: number | null;
  score_auditoria: number | null;
  empresa_id: string | null;
  politica_id: string | null;
  tipo_rendicion_id: string | null;
  estado_rendicion_id: string | null;
  workflow_id: string | null;
}

/** Filtros para RPT-OPS-02: Detalle de gastos */
export interface FiltroGastosDetalle extends FiltroFechas {
  empresa_id: string;
  categoria_gasto_id?: string;
  proveedor_id?: string;
  proyecto_id?: string;
  estado_codigo?: string;
}

/** Fila de vw_rpt_gastos_detalle */
export interface GastoDetalleRow {
  id: string;
  fecha: string | null;
  rendicion_id: string | null;
  rendicion_numero: string | null;
  proyecto_id: string | null;
  proyecto_nombre: string | null;
  categoria_nombre: string | null;
  categoria_gasto_id: string | null;
  proveedor_nombre: string | null;
  proveedor_id: string | null;
  valor_factura: number | null;
  valor_reembolsable: number | null;
  valor_moneda_base: number | null;
  valor_moneda_origen: number | null;
  moneda_codigo: string | null;
  tipo_cambio: number | null;
  numero_documento: string | null;
  es_manual: boolean | null;
  estado_codigo: string | null;
  origen_nombre: string | null;
  empresa_id: string | null;
  created_at: string | null;
  observaciones: string | null;
}

/** Filtros para RPT-OPS-03: Detalle de viajes */
export interface FiltroViajesDetalle extends FiltroFechas {
  empresa_id: string;
  usuario_id?: string;
  proyecto_id?: string;
  pais_id?: string;
}

/** Fila de vw_rpt_viajes_detalle */
export interface ViajeDetalleRow {
  id: string;
  numero: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  destino: string | null;
  pais_nombre: string | null;
  pais_id: string | null;
  distancia_km: number | null;
  vehiculo_propio: boolean | null;
  observaciones: string | null;
  duracion_dias: number | null;
  empresa_id: string | null;
  proyecto_id: string | null;
  proyecto_nombre: string | null;
  usuario_id: string | null;
  usuario_nombre: string | null;
  rendicion_id: string | null;
  rendicion_numero: string | null;
}

/** Filtros para RPT-OPS-04: Anticipos */
export interface FiltroAnticipos extends FiltroFechas {
  empresa_id: string;
  proyecto_id?: string;
  liquidado?: boolean;
}

/** Fila de vw_rpt_anticipos */
export interface AnticipoRow {
  id: string;
  numero: string | null;
  fecha: string | null;
  valor: number | null;
  moneda_codigo: string | null;
  observacion: string | null;
  proyecto_id: string | null;
  proyecto_nombre: string | null;
  rendicion_id: string | null;
  rendicion_numero: string | null;
  empresa_id: string | null;
  liquidado: boolean | null;
}

// =============================================================================
// REPORTES FINANCIEROS
// =============================================================================

/** Filtros para RPT-FIN-01: Ejecución presupuestaria */
export interface FiltroEjecucionPresupuestaria {
  empresa_id: string;
  proyecto_id?: string;
  anio?: number;
}

/** Fila de vw_rpt_ejecucion_presupuestaria */
export interface EjecucionPresupuestariaRow {
  presupuesto_id: string;
  presupuesto_nombre: string | null;
  anio: number | null;
  proyecto_id: string | null;
  proyecto_nombre: string | null;
  empresa_id: string | null;
  detalle_id: string | null;
  categoria_gasto_id: string | null;
  categoria_nombre: string | null;
  valor_presupuestado: number | null;
  ejecutado: number | null;
  disponible: number | null;
  pct_ejecucion: number | null;
}

/** Parámetros para RPC rpt_evolucion_mensual */
export interface ParamsEvolucionMensual {
  p_empresa_id: string;
  p_anio_desde: number;
  p_anio_hasta: number;
  p_categoria_id?: string;
}

/** Fila de retorno de rpt_evolucion_mensual */
export interface EvolucionMensualRow {
  anio: number;
  mes: number;
  label: string;
  facturado: number;
  reembolsable: number;
}

// =============================================================================
// REPORTES GERENCIALES
// =============================================================================

/** KPIs del resumen ejecutivo (campo `kpis` del JSON retornado por rpt_resumen_ejecutivo) */
export interface ResumenEjecutivoKpis {
  total_facturado: number;
  total_reembolsable: number;
  total_rendiciones: number;
  rendiciones_aprobadas: number;
  rendiciones_rechazadas: number;
  pendientes: number;
  tasa_aprobacion: number | null;
  score_promedio_ia: number | null;
  total_anticipos: number;
  anticipos_liquidados: number;
}

/** Respuesta completa de rpt_resumen_ejecutivo */
export interface ResumenEjecutivoResponse {
  kpis: ResumenEjecutivoKpis;
  periodo: {
    fecha_desde: string;
    fecha_hasta: string;
  };
}

/** Parámetros para RPC rpt_resumen_ejecutivo */
export interface ParamsResumenEjecutivo extends FiltroFechas {
  p_empresa_id: string;
  p_fecha_desde: string;
  p_fecha_hasta: string;
}

/** Parámetros para RPC rpt_top_proveedores */
export interface ParamsTopProveedores extends FiltroFechas {
  p_empresa_id: string;
  p_fecha_desde: string;
  p_fecha_hasta: string;
  p_limite?: number;
}

/** Fila de retorno de rpt_top_proveedores */
export interface TopProveedorRow {
  proveedor_id: string;
  nombre: string;
  pais: string;
  ciudad: string;
  n_gastos: number;
  total: number;
  pct_total: number;
  categoria_principal: string;
}

// =============================================================================
// REPORTES DE AUDITORÍA
// =============================================================================

/** Filtros para RPT-AUD-04: Cumplimiento de políticas */
export interface FiltroCumplimientoPoliticas extends FiltroFechas {
  empresa_id: string;
  usuario_id?: string;
  categoria_gasto_id?: string;
  politica_id?: string;
  solo_excedentes?: boolean;
}

/** Fila de vw_rpt_cumplimiento_politicas */
export interface CumplimientoPoliticaRow {
  gasto_id: string;
  fecha: string | null;
  rendicion_id: string | null;
  rendicion_numero: string | null;
  usuario_id: string | null;
  usuario_nombre: string | null;
  categoria_nombre: string | null;
  categoria_gasto_id: string | null;
  categoria_codigo: string | null;
  politica_id: string | null;
  politica_nombre: string | null;
  tope_politica: number | null;
  valor_gasto: number | null;
  excedente: number | null;
  empresa_id: string | null;
}

// =============================================================================
// REPORTES DE WORKFLOW
// =============================================================================

/** Filtros para RPT-WF-02/03: Eficiencia de aprobaciones */
export interface FiltroAprobacionesEficiencia extends FiltroFechas {
  empresa_id: string;
  aprobador_id?: string;
  workflow_id?: string;
  accion_codigo?: string;
}

/** Fila de vw_rpt_aprobaciones_eficiencia */
export interface AprobacionEficienciaRow {
  aprobacion_id: string;
  rendicion_id: string | null;
  rendicion_numero: string | null;
  aprobador_id: string | null;
  aprobador_nombre: string | null;
  workflow_nombre: string | null;
  workflow_id: string | null;
  paso_nombre: string | null;
  paso_orden: number | null;
  accion_codigo: string | null;
  accion_nombre: string | null;
  fecha_accion: string | null;
  comentario: string | null;
  empresa_id: string | null;
  created_at: string | null;
}

/** Parámetros para RPC rpt_tiempos_workflow */
export interface ParamsTiemposWorkflow extends FiltroFechas {
  p_empresa_id: string;
  p_fecha_desde: string;
  p_fecha_hasta: string;
}

/** Fila de retorno de rpt_tiempos_workflow */
export interface TiempoWorkflowRow {
  rendicion_id: string;
  rendicion_numero: string;
  usuario_nombre: string;
  fecha_envio: string;
  fecha_primera_accion: string | null;
  fecha_aprobacion_final: string | null;
  horas_espera_total: number | null;
  n_acciones: number;
  n_rechazos: number;
}

// =============================================================================
// EXPORTACIÓN
// =============================================================================

/** Formatos de exportación disponibles */
export type FormatoExportacion = "xlsx" | "pdf" | "csv";

/** Opciones para exportar un reporte */
export interface OpcionesExportacion {
  formato: FormatoExportacion;
  nombre_archivo: string;
  incluir_filtros?: boolean;
}

// =============================================================================
// PAGINACIÓN Y UI
// =============================================================================

/** Configuración de paginación para tablas de reportes */
export interface PaginacionReporte {
  pagina: number;
  por_pagina: number;
}

/** Estado genérico de un reporte en la UI */
export interface EstadoReporte<T> {
  datos: T[];
  total: number;
  cargando: boolean;
  error: string | null;
}
