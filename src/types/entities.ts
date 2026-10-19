/**
 * Aliases tipados por entidad, derivados del esquema real de Supabase
 * generado en `src/types/database.ts`.
 */
import type { Tables, TablesInsert, TablesUpdate } from "./database";

export type Cliente = Tables<"clientes">;
export type ClienteInsert = TablesInsert<"clientes">;
export type ClienteUpdate = TablesUpdate<"clientes">;

export type Proyecto = Tables<"proyectos">;
export type ProyectoInsert = TablesInsert<"proyectos">;
export type ProyectoUpdate = TablesUpdate<"proyectos">;

export type Proveedor = Tables<"proveedores">;
export type ProveedorInsert = TablesInsert<"proveedores">;
export type ProveedorUpdate = TablesUpdate<"proveedores">;

export type Presupuesto = Tables<"presupuestos">;
export type PresupuestoInsert = TablesInsert<"presupuestos">;
export type PresupuestoUpdate = TablesUpdate<"presupuestos">;

export type Gasto = Tables<"gastos">;
export type GastoInsert = TablesInsert<"gastos">;
export type GastoUpdate = TablesUpdate<"gastos">;

export type Documento = Tables<"documentos">;
export type DocumentoInsert = TablesInsert<"documentos">;
export type DocumentoUpdate = TablesUpdate<"documentos">;

export type OcrExtraccion = Tables<"ocr_extracciones">;
export type OcrExtraccionInsert = TablesInsert<"ocr_extracciones">;
export type OcrExtraccionUpdate = TablesUpdate<"ocr_extracciones">;

export type Rendicion = Tables<"rendiciones">;
export type RendicionInsert = TablesInsert<"rendiciones">;
export type RendicionUpdate = TablesUpdate<"rendiciones">;

export type Viaje = Tables<"viajes">;
export type ViajeInsert = TablesInsert<"viajes">;
export type ViajeUpdate = TablesUpdate<"viajes">;

export type Usuario = Tables<"usuarios">;
export type UsuarioInsert = TablesInsert<"usuarios">;
export type UsuarioUpdate = TablesUpdate<"usuarios">;

export type Empresa = Tables<"empresas">;
export type EmpresaInsert = TablesInsert<"empresas">;
export type EmpresaUpdate = TablesUpdate<"empresas">;

export type EmpresaUsuario = Tables<"empresas_usuarios">;

// Catálogos
export type CategoriaGasto = Tables<"categorias_gasto">;
export type CategoriaGastoInsert = TablesInsert<"categorias_gasto">;
export type CategoriaGastoUpdate = TablesUpdate<"categorias_gasto">;

export type EstadoGasto = Tables<"estados_gasto">;
export type EstadoGastoInsert = TablesInsert<"estados_gasto">;
export type EstadoGastoUpdate = TablesUpdate<"estados_gasto">;

export type Moneda = Tables<"monedas">;
export type MonedaInsert = TablesInsert<"monedas">;
export type MonedaUpdate = TablesUpdate<"monedas">;

export type OrigenGasto = Tables<"origenes_gasto">;
export type OrigenGastoInsert = TablesInsert<"origenes_gasto">;
export type OrigenGastoUpdate = TablesUpdate<"origenes_gasto">;

export type CategoriaDocumento = Tables<"categorias_documento">;
export type CategoriaDocumentoInsert = TablesInsert<"categorias_documento">;
export type CategoriaDocumentoUpdate = TablesUpdate<"categorias_documento">;

export type TipoDocumento = Tables<"tipos_documento">;
export type TipoDocumentoInsert = TablesInsert<"tipos_documento">;
export type TipoDocumentoUpdate = TablesUpdate<"tipos_documento">;

export type EstadoRendicion = Tables<"estados_rendicion">;
export type EstadoRendicionInsert = TablesInsert<"estados_rendicion">;
export type EstadoRendicionUpdate = TablesUpdate<"estados_rendicion">;

export type TipoRendicion = Tables<"tipos_rendicion">;
export type TipoRendicionInsert = TablesInsert<"tipos_rendicion">;
export type TipoRendicionUpdate = TablesUpdate<"tipos_rendicion">;

export type Rol = Tables<"roles">;
export type RolInsert = TablesInsert<"roles">;
export type RolUpdate = TablesUpdate<"roles">;

export type ParametroSistema = Tables<"parametros_sistema">;
export type ParametroSistemaInsert = TablesInsert<"parametros_sistema">;
export type ParametroSistemaUpdate = TablesUpdate<"parametros_sistema">;

export type Politica = Tables<"politicas">;
export type PoliticaInsert = TablesInsert<"politicas">;
export type PoliticaUpdate = TablesUpdate<"politicas">;
// Workflow de aprobaciones
export type WorkflowAprobacion = Tables<"workflows_aprobacion">;
export type WorkflowAprobacionInsert = TablesInsert<"workflows_aprobacion">;
export type WorkflowAprobacionUpdate = TablesUpdate<"workflows_aprobacion">;
export type WorkflowPaso = Tables<"workflow_pasos">;
export type WorkflowPasoInsert = TablesInsert<"workflow_pasos">;
export type WorkflowPasoUpdate = TablesUpdate<"workflow_pasos">;
export type Aprobacion = Tables<"aprobaciones">;
export type AprobacionInsert = TablesInsert<"aprobaciones">;
export type AccionAprobacion = Tables<"acciones_aprobacion">;
export type HistorialWorkflow = Tables<"historial_workflow">;
export type HistorialWorkflowInsert = TablesInsert<"historial_workflow">;
export type Comentario = Tables<"comentarios">;
export type ComentarioInsert = TablesInsert<"comentarios">;
export type Notificacion = Tables<"notificaciones">;
export type RendirLog = Tables<"rendir_log">;
export type RendirLogEntry = {
  id: string;
  created_at: string;
  estado_codigo: string;
  observacion: string | null;
  usuario_nombre: string;
};

export type FacturaEmitida = Tables<"facturas_emitidas">;
export type FacturaEmitidaInsert = TablesInsert<"facturas_emitidas">;
export type FacturaEmitidaUpdate = TablesUpdate<"facturas_emitidas">;

/** Factura enriquecida con datos de cobros (saldo derivado). */
export type FacturaConSaldo = FacturaEmitida & {
  monto_cobrado: number;
  saldo_pendiente: number;
  estado_cobro: "pendiente" | "parcial" | "cobrado";
};

export type Cobro = Tables<"cobros">;
export type CobroInsert = TablesInsert<"cobros">;
export type CobroUpdate = TablesUpdate<"cobros">;

// ── Módulo Ciclotrones ────────────────────────────────────────────────────────
export type Ciclotrón = Tables<"ciclotrones">;
export type CiclotrónInsert = TablesInsert<"ciclotrones">;
export type CiclotrónUpdate = TablesUpdate<"ciclotrones">;

/** Ciclotrón enriquecido con datos del equipo físico vinculado */
export interface CiclotrónConEquipo extends Ciclotrón {
  // De equipos_instalados
  numero_serie:         string | null;
  equipo_ubicacion:     string | null;
  fecha_instalacion:    string | null;
  garantia_hasta:       string | null;
  proximo_mantenimiento: string | null;
  equipo_estado:        string | null;
  // De clientes
  cliente_id:           string | null;
  cliente_nombre:       string | null;
  // De modelos_equipo
  modelo_id:            string | null;
  modelo_nombre:        string | null;
  fabricante_nombre:    string | null;
}

export type CicloProduccion = Tables<"ciclo_producciones">;
export type CicloProduccionInsert = TablesInsert<"ciclo_producciones">;
export type CicloProduccionUpdate = TablesUpdate<"ciclo_producciones">;

/** Perfil de parámetros operativos del ciclotrón */
export interface CiclotrónParametros {
  gas_flow:            { setpoint: number; min: number; max: number; alertar: boolean };
  magnet_i:            { setpoint: number; min: number; max: number; alertar: boolean };
  dee1_kv:             { setpoint: number; min: number; max: number; alertar: boolean };
  dee2_kv:             { setpoint: number; min: number; max: number; alertar: boolean };
  target_i_spike_ua:   number;   // µA de variación abrupta que dispara alerta
  coll_max_pct:        number;   // % máximo de Target-I para colimadores
  vacuum_p_max:        number;   // Pa máximos en producción
  target_p_min:        number;   // mbar mínimos Target-P en producción
  target_p_max:        number;   // mbar máximos Target-P en producción
  target_p_end_max:    number;   // mbar máximos al fin de producción
  he_cool_p_min:       number;
  he_cool_p_max:       number;
  arc_i_min:           number;
  arc_i_max:           number;
  arc_v_min:           number;
  arc_v_max:           number;
  // Phase load durante irradiación activa
  phase_load_irrad_max: number;  // % máximo normal (encima = desajuste RF)
  phase_load_irrad_min: number;  // % mínimo normal (debajo = resonancia fuera del punto)
  // Balance de haz: Foil-I − Target-I − Coll-l-I − Coll-r-I debe ≈ 0
  foil_balance_max_ua:  number;  // µA máxima desviación del promedio respecto a 0
}

/** Una anomalía detectada durante el análisis de un batch */
export interface CicloAnomalia {
  tiempo:       string;  // HH:MM:SS del log
  fila:         number;  // índice 0-based en el array de lecturas
  fase:         "startup" | "ramp" | "irradiation" | "end";
  parametro:    string;  // clave legible: "Vacuum-P", "Magnet-I", …
  valor:        number;
  limite_min?:  number;
  limite_max?:  number;
  severidad:    "warning" | "critical";
  hint:         string;  // Referencia al manual PETtrace 800
}

// ─────────────────────────────────────────────────────────────────────────────
// EVALUACIONES DE CICLOTRÓN — DOC1604037 rev9
// ─────────────────────────────────────────────────────────────────────────────

/** Fila de la tabla isocrona (un paso de corriente de magneto) */
export interface FilaIsocrona {
  magnet: number;        // A
  foil: number | null;   // µA
  collLow: number | null;
  target: number | null;
  collUp: number | null;
  sumColl?: number;      // calculado
  ratio?: number;        // I-Coll/I-Target, calculado
}

/** Sub-test: Test Isocrono */
export interface TestIsocrono {
  posicion: number;                  // 1, 2, 3, 4, 5, 6
  magnetStart: number;               // A
  magnetStep: number;                // A (normalmente 0.2)
  deeVoltage: number;                // kV
  deltaVoltage: number;              // kV
  vacuumPressure: number | null;     // mbar
  gasFlow: number | null;            // sccm
  isCurrentMA: number | null;        // mA
  probeCurrentStart: number | null;  // µA
  probeCurrentEnd: number | null;    // µA
  filas: FilaIsocrona[];
}

/** Resultado del Phase-Analysis Tool (RF Performance) */
export interface ResultadoPhaseAnalysis {
  reflectedPowerP95: number | null;  // kW
  anodeCurrentP95: number | null;    // A
  screenCurrentP95: number | null;   // mA
  dpaFwdVoltageP95: number | null;   // V
  pass: boolean | null;
}

/** Tabla RF manual (equipos sin SCU Gen II) */
export interface TablaRFManual {
  deeVoltage1: { standby?: number; normalStartH?: number; normalEndH?: number; normalStartD?: number; normalEndD?: number };
  deeVoltage2: { standby?: number; normalStartH?: number; normalEndH?: number; normalStartD?: number; normalEndD?: number };
  forwardPower: { standby?: number; normalStartH?: number; normalEndH?: number; normalStartD?: number; normalEndD?: number };
  reflectedPower: { standby?: number; normalStartH?: number; normalEndH?: number; normalStartD?: number; normalEndD?: number };
  flap1: { standby?: number; normalStartH?: number; normalEndH?: number; normalStartD?: number; normalEndD?: number };
  flap2: { standby?: number; normalStartH?: number; normalEndH?: number; normalStartD?: number; normalEndD?: number };
  anodeVolt: { standby?: number; normalStartH?: number; normalEndH?: number; normalStartD?: number; normalEndD?: number };
  anodeCurrent: { standby?: number; normalStartH?: number; normalEndH?: number; normalStartD?: number; normalEndD?: number };
  screenCurrent: { standby?: number; normalStartH?: number; normalEndH?: number; normalStartD?: number; normalEndD?: number };
}

/** Sub-test: RF Performance */
export interface TestRFPerformance {
  modo: 'H' | 'D';
  phaseAnalysis?: ResultadoPhaseAnalysis;
  rfManual?: TablaRFManual;
  anodeVoltageStandby?: number;    // kV — para Main Voltage Variation
  anodeVoltagePass?: boolean | null;
}

/** Fila: I-arc vs Beam Current */
export interface FilaIarcBeam {
  targetCurrentUA: number;    // set point: 50, 100, 130
  foilCurrentUA: number | null;
  arcCurrentMA: number | null;
  maxArcCurrentMA: number;    // límite GE
  maxFoilCurrentUA: number;   // límite GE
  pass?: boolean;
}

/** Fila: Ion Source Performance */
export interface FilaIonSource {
  isCurrentMA: number;         // 0, 50, 100, 200, 300, 400, 600, 800, 1000
  probeCurrentH: number | null;
  probeCurrentD: number | null;
  maxProbeH: number;           // límite GE
}

/** Fila: Beam Transmission */
export interface FilaTransmision {
  targetCurrentUA: number;
  foilCurrentUA: number | null;
  probeInCurrentUA: number | null;
  isCurrentMA: number | null;
  transmissionToTarget?: number;  // %
  transmissionToFoil?: number;    // %
  passTarget?: boolean;
  passFoil?: boolean;
}

/** Fila: Vacuum Tightness */
export interface FilaVacioTightness {
  gasFlowSccm: number;
  chamberPressureMbar: number | null;
  backingPressureMbar: number | null;
  maxChamberMbar: number;
  maxBackingMbar: number;
}

/** Fila: Vacuum Leak */
export interface FilaVacioLeak {
  timeSec: number;
  pressureMbar: number | null;
  maxLeakRate: number;
}

/** Datos Performance Test completo (Hoja 6) */
export interface DatosPerformance {
  isocronos: TestIsocrona[];      // array de 2 tests (pos 1-3 y pos 4-6)
  rfProton?: TestRFPerformance;
  rfDeuteron?: TestRFPerformance;  // solo si tiene_deuterio
  mainVoltage?: { anodeVoltStandby: number | null; pass: boolean | null };
  iarcVsBeam?: FilaIarcBeam[];
  ionSource?: {
    magnetCurrent: number;
    deeVoltage: number;
    deltaVoltage: number;
    vacuum: number;
    gasFlow: number;
    filas: FilaIonSource[];
  };
  transmision?: FilaTransmision[];
  vacuumTightness?: FilaVacioTightness[];
  vacuumLeak?: FilaVacioLeak[];
  /** IDs de sub-tests marcados como "No realizado" — no afectan al resultado general */
  skippedTests?: string[];
}

// Alias para el array de isochronous (plural correcto)
export type TestIsocrona = TestIsocrono;

/** Datos de una producción dual beam (Hoja 7) */
export interface ProduccionDualBeam {
  numero: number;   // 1 a 10
  site?: string;
  batch?: string;
  target?: string;
  fecha?: string;
  configuracion?: string;
  // Parámetros del Beam Evaluator Tool
  anodeCurrentHigh?: number;
  anodeCurrentLimitEvents?: number;
  anodeVoltageAvg?: number;
  balanceAvg?: number;
  balanceMax?: number;
  balanceMin?: number;
  balanceVariation?: number;
  dee1Avg?: number;
  dee1Variation?: number;
  dee2Avg?: number;
  dee2Variation?: number;
  dpaFwdVoltHigh?: number;
  flap1Avg?: number;
  flap1Max?: number;
  flap1Min?: number;
  flap1Variation?: number;
  flap2Avg?: number;
  flap2Max?: number;
  flap2Min?: number;
  flap2Variation?: number;
  gasFlowAvg?: number;
  gasFlowVariance?: number;
  isAvg?: number;
  isMax?: number;
  isVariation?: number;
  magnetWorkingDiffAvg?: number;
  magnetWorkingPointAvg?: number;
  phaseErrorVariation?: number;
  phaseLoadMax?: number;
  phaseLoadMin?: number;
  probeCurAvg?: number;
  reflectedPowerHigh?: number;
  reflectedVoltLimitEvents?: number;
  residualBeamHigh?: number;
  rfApparentPowerAvg?: number;
  screenCurrentHigh?: number;
  vacuumAvg?: number;
  vacuumVariation?: number;
  // Por posición activa
  pos?: Record<string, {
    beamBalanceHigh?: number;
    beamBalanceLow?: number;
    collimatorPctHigh?: number;
    extractionPosAvg?: number;
    extractionPosVariation?: number;
    foilCurrentVariation?: number;
    lossToTargetHigh?: number;
    lossToTargetLow?: number;
    lowerCollAvg?: number;
    lowerCollVariation?: number;
    targetCurrentAvg?: number;
    targetCurrentErrorAvg?: number;
    targetCurrentMax?: number;
    targetCurrentVariation?: number;
    upperCollAvg?: number;
    upperCollVariation?: number;
  }>;
}

/** Datos Inspección de Sitio (Hojas 1-5 condensadas) */
export interface DatosSitio {
  // Site Info (H1)
  anioInstalacion?: number;
  clienteNombre?: string;
  sitioNombre?: string;
  sitioAddress?: string;
  siteManagerNombre?: string;
  contactoDetalles?: string;
  ciclotrónSystemId?: string;
  ciclotrónSerial?: string;
  localFeName?: string;
  voltajeHertz?: string;
  tieneUPS?: string;
  // Master Room (H2)
  ptRelease?: string;
  acsVersion?: string;
  pssVersion?: string;
  masterStationModel?: string;
  licenciaUA?: number;
  // Equipment Room (H3)
  tempCuartoEquipos?: number;
  humedadCuartoEquipos?: number;
  vacuumPressureStandby?: number;
  vacuumPressureBeamOn?: number;
  acuVersion?: string;
  // Cyclotron Room (H4)
  radiacion100cm?: number;
  radiacion30cm1?: number;
  radiacion30cm2?: number;
  radiacion0cm1?: number;
  radiacion0cm2?: number;
  radiacion0cm3?: number;
  radiacion0cm4?: number;
  tiempoDesdeProduccion?: number;
  tempCuartoCiclotrón?: number;
  humedadCuartoCiclotrón?: number;
  targetPos1?: string;
  targetPos2?: string;
  targetPos3?: string;
  targetPos4?: string;
  targetPos5?: string;
  targetPos6?: string;
  ltfTipo?: string;
  ltfCantidad?: number;
  // Other Info (H5)
  bajoContrato?: boolean;
  vencimientoContrato?: string;
  utilizacionPromedio18F?: number;
  corrientePromedio18F?: number;
  estadoSistema?: string;
  satisfaccionCliente?: string;
  problemasConocidos?: string;
  observacionesAdicionales?: string;
}

// ── Error Logs de Ciclotrón ───────────────────────────────────────────────────

/** Tipo de evento en el log */
export type TipoEventoLog = 'info' | 'warning' | 'fault';

/** Subsistema al que pertenece el evento */
export type SubsistemaLog =
  | 'ion_source'
  | 'vacuum'
  | 'safety'
  | 'network'
  | 'target'
  | 'maintenance'
  | 'production'
  | 'other';

/** Un evento parseado del .txt del GE PETtrace */
export interface EventoLog {
  /** Timestamp ISO del evento */
  ts: string;
  tipo: TipoEventoLog;
  subsistema: SubsistemaLog;
  /** Texto original del mensaje */
  mensaje: string;
  /** Código numérico entre paréntesis al final de la línea */
  codigo: number;
  /** Clave normalizada para agrupación (ej: "gas_flow_fault") */
  clave: string;
}

/** Archivo de log subido y parseado */
export interface CicloErrorLog {
  id: string;
  empresa_id: string;
  ciclotrón_id: string;
  archivo_nombre: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  total_eventos: number;
  total_faults: number;
  total_warnings: number;
  total_info: number;
  eventos: EventoLog[];
  created_at: string;
  updated_at: string;
}

/** Resumen de un fault_key para detección de tendencias */
export interface CicloFaultResumen {
  clave: string;
  subsistema: SubsistemaLog;
  tipo: TipoEventoLog;
  total: number;
  primera_vez: string;
  ultima_vez: string;
  mensaje_ref: string;
}

/** Patrón detectado por el motor de análisis */
export interface CicloFaultPatron {
  clave: string;
  titulo: string;
  descripcion: string;
  severidad: 'critico' | 'advertencia' | 'informativo';
  /** Referencia al manual de servicio */
  referencia_manual: string | null;
  /** Texto sugerido para pre-llenar descripción_problema en OS */
  sugerencia_os: string | null;
  ocurrencias: number;
  ultima_vez: string | null;
  /** IDs de OS correctivas generadas previamente para este fault */
  os_previas_ids: string[];
}

/** Entidad principal: Evaluación de ciclotrón */
export interface CicloEvaluacion {
  id: string;
  empresa_id: string;
  ciclotrón_id: string;
  equipo_id: string | null;
  numero: string;
  fecha: string;
  tipo_evaluacion: 'assessment' | 'upgrade_eval' | 'eosss' | '10yr_refurbish';
  ingeniero_nombre: string | null;
  estado: 'borrador' | 'en_progreso' | 'completado';
  resultado_general: 'pass' | 'fail' | 'pendiente' | null;
  tiene_deuterio: boolean;
  modelo_pt: string | null;
  version_sw: string | null;
  datos_sitio: DatosSitio;
  datos_performance: DatosPerformance;
  datos_evaluacion: { skipped?: boolean; producciones: ProduccionDualBeam[] };
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}
