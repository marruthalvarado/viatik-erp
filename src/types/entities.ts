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
