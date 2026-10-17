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
