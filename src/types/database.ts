export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acciones_aprobacion: {
        Row: {
          codigo: string
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      adjuntos: {
        Row: {
          created_at: string | null
          descripcion: string | null
          empresa_id: string
          id: string
          nombre: string | null
          rendicion_id: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          empresa_id: string
          id?: string
          nombre?: string | null
          rendicion_id: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          empresa_id?: string
          id?: string
          nombre?: string | null
          rendicion_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adjuntos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjuntos_rendicion_id_fkey"
            columns: ["rendicion_id"]
            isOneToOne: false
            referencedRelation: "rendiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      anticipos: {
        Row: {
          created_at: string | null
          empresa_id: string
          fecha: string | null
          id: string
          moneda_codigo: string | null
          numero: string | null
          observacion: string | null
          proyecto_id: string | null
          rendicion_id: string | null
          valor: number | null
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          fecha?: string | null
          id?: string
          moneda_codigo?: string | null
          numero?: string | null
          observacion?: string | null
          proyecto_id?: string | null
          rendicion_id?: string | null
          valor?: number | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          fecha?: string | null
          id?: string
          moneda_codigo?: string | null
          numero?: string | null
          observacion?: string | null
          proyecto_id?: string | null
          rendicion_id?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "anticipos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticipos_moneda_codigo_fkey"
            columns: ["moneda_codigo"]
            isOneToOne: false
            referencedRelation: "monedas"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "anticipos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anticipos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_proyectos"
            referencedColumns: ["proyecto_id"]
          },
          {
            foreignKeyName: "anticipos_rendicion_id_fkey"
            columns: ["rendicion_id"]
            isOneToOne: false
            referencedRelation: "rendiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      aprobaciones: {
        Row: {
          accion_id: string | null
          comentario: string | null
          created_at: string | null
          empresa_id: string
          fecha_accion: string | null
          id: string
          rendicion_id: string
          usuario_id: string
          workflow_paso_id: string
        }
        Insert: {
          accion_id?: string | null
          comentario?: string | null
          created_at?: string | null
          empresa_id: string
          fecha_accion?: string | null
          id?: string
          rendicion_id: string
          usuario_id: string
          workflow_paso_id: string
        }
        Update: {
          accion_id?: string | null
          comentario?: string | null
          created_at?: string | null
          empresa_id?: string
          fecha_accion?: string | null
          id?: string
          rendicion_id?: string
          usuario_id?: string
          workflow_paso_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aprobaciones_accion_id_fkey"
            columns: ["accion_id"]
            isOneToOne: false
            referencedRelation: "acciones_aprobacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprobaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprobaciones_rendicion_id_fkey"
            columns: ["rendicion_id"]
            isOneToOne: false
            referencedRelation: "rendiciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprobaciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprobaciones_workflow_paso_id_fkey"
            columns: ["workflow_paso_id"]
            isOneToOne: false
            referencedRelation: "workflow_pasos"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          accion: string | null
          created_at: string | null
          empresa_id: string | null
          id: string
          ip: string | null
          registro_id: string | null
          tabla: string | null
          user_agent: string | null
          usuario_id: string | null
          valor_anterior: Json | null
          valor_nuevo: Json | null
        }
        Insert: {
          accion?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          ip?: string | null
          registro_id?: string | null
          tabla?: string | null
          user_agent?: string | null
          usuario_id?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Update: {
          accion?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          ip?: string | null
          registro_id?: string | null
          tabla?: string | null
          user_agent?: string | null
          usuario_id?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      auditorias_ia: {
        Row: {
          created_at: string | null
          empresa_id: string
          explicacion: string | null
          hallazgos: Json | null
          id: string
          nivel_riesgo_id: string | null
          procesado_en: string | null
          recomendaciones: Json | null
          rendicion_id: string
          score: number | null
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          explicacion?: string | null
          hallazgos?: Json | null
          id?: string
          nivel_riesgo_id?: string | null
          procesado_en?: string | null
          recomendaciones?: Json | null
          rendicion_id: string
          score?: number | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          explicacion?: string | null
          hallazgos?: Json | null
          id?: string
          nivel_riesgo_id?: string | null
          procesado_en?: string | null
          recomendaciones?: Json | null
          rendicion_id?: string
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auditorias_ia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditorias_ia_nivel_riesgo_id_fkey"
            columns: ["nivel_riesgo_id"]
            isOneToOne: false
            referencedRelation: "niveles_riesgo_ia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditorias_ia_rendicion_id_fkey"
            columns: ["rendicion_id"]
            isOneToOne: false
            referencedRelation: "rendiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_documento: {
        Row: {
          codigo: string
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      categorias_gasto: {
        Row: {
          codigo: string
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      centros_costo: {
        Row: {
          codigo: string | null
          created_at: string | null
          deleted_at: string | null
          descripcion: string | null
          empresa_id: string
          estado: string | null
          id: string
          nombre: string
          presupuesto: number | null
          updated_at: string | null
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          deleted_at?: string | null
          descripcion?: string | null
          empresa_id: string
          estado?: string | null
          id?: string
          nombre: string
          presupuesto?: number | null
          updated_at?: string | null
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          deleted_at?: string | null
          descripcion?: string | null
          empresa_id?: string
          estado?: string | null
          id?: string
          nombre?: string
          presupuesto?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "centros_costo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          codigo: string | null
          contacto_principal: string | null
          correo: string | null
          created_at: string | null
          deleted_at: string | null
          empresa_id: string
          estado: string | null
          id: string
          meta_facturacion_anual: number | null
          nombre: string
          nombre_comercial: string | null
          ruc: string | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          codigo?: string | null
          contacto_principal?: string | null
          correo?: string | null
          created_at?: string | null
          deleted_at?: string | null
          empresa_id: string
          estado?: string | null
          id?: string
          meta_facturacion_anual?: number | null
          nombre: string
          nombre_comercial?: string | null
          ruc?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo?: string | null
          contacto_principal?: string | null
          correo?: string | null
          created_at?: string | null
          deleted_at?: string | null
          empresa_id?: string
          estado?: string | null
          id?: string
          meta_facturacion_anual?: number | null
          nombre?: string
          nombre_comercial?: string | null
          ruc?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      comentarios: {
        Row: {
          comentario: string
          created_at: string | null
          empresa_id: string
          id: string
          rendicion_id: string
          usuario_id: string
        }
        Insert: {
          comentario: string
          created_at?: string | null
          empresa_id: string
          id?: string
          rendicion_id: string
          usuario_id: string
        }
        Update: {
          comentario?: string
          created_at?: string | null
          empresa_id?: string
          id?: string
          rendicion_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_rendicion_id_fkey"
            columns: ["rendicion_id"]
            isOneToOne: false
            referencedRelation: "rendiciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          categoria_documento_id: string | null
          created_at: string | null
          deleted_at: string | null
          empresa_id: string
          hash_archivo: string | null
          id: string
          nombre_archivo: string | null
          ocr_confianza: number | null
          pais_id: string | null
          procesado: boolean | null
          rendicion_id: string
          storage_path: string | null
          tamano: number | null
          tipo_documento_id: string | null
          viaje_id: string | null
        }
        Insert: {
          categoria_documento_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          empresa_id: string
          hash_archivo?: string | null
          id?: string
          nombre_archivo?: string | null
          ocr_confianza?: number | null
          pais_id?: string | null
          procesado?: boolean | null
          rendicion_id: string
          storage_path?: string | null
          tamano?: number | null
          tipo_documento_id?: string | null
          viaje_id?: string | null
        }
        Update: {
          categoria_documento_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          empresa_id?: string
          hash_archivo?: string | null
          id?: string
          nombre_archivo?: string | null
          ocr_confianza?: number | null
          pais_id?: string | null
          procesado?: boolean | null
          rendicion_id?: string
          storage_path?: string | null
          tamano?: number | null
          tipo_documento_id?: string | null
          viaje_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_categoria_documento_id_fkey"
            columns: ["categoria_documento_id"]
            isOneToOne: false
            referencedRelation: "categorias_documento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_pais_id_fkey"
            columns: ["pais_id"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_rendicion_id_fkey"
            columns: ["rendicion_id"]
            isOneToOne: false
            referencedRelation: "rendiciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_tipo_documento_id_fkey"
            columns: ["tipo_documento_id"]
            isOneToOne: false
            referencedRelation: "tipos_documento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          codigo: string | null
          correo: string | null
          created_at: string | null
          deleted_at: string | null
          direccion: string | null
          estado: string | null
          id: string
          logo_url: string | null
          moneda_base: string | null
          nombre: string
          ruc: string | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          codigo?: string | null
          correo?: string | null
          created_at?: string | null
          deleted_at?: string | null
          direccion?: string | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          moneda_base?: string | null
          nombre: string
          ruc?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo?: string | null
          correo?: string | null
          created_at?: string | null
          deleted_at?: string | null
          direccion?: string | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          moneda_base?: string | null
          nombre?: string
          ruc?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_moneda_base_fkey"
            columns: ["moneda_base"]
            isOneToOne: false
            referencedRelation: "monedas"
            referencedColumns: ["codigo"]
          },
        ]
      }
      empresas_usuarios: {
        Row: {
          activo: boolean | null
          created_at: string | null
          empresa_id: string
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          rol_id: string
          usuario_id: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          empresa_id: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          rol_id: string
          usuario_id: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          empresa_id?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          rol_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_usuarios_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_usuarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      estados_documento: {
        Row: {
          codigo: string
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      estados_gasto: {
        Row: {
          codigo: string
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      estados_proyecto: {
        Row: {
          codigo: string
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      estados_rendicion: {
        Row: {
          codigo: string
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      gastos: {
        Row: {
          categoria_gasto_id: string | null
          created_at: string | null
          deleted_at: string | null
          descripcion: string | null
          documento_id: string | null
          empresa_id: string
          es_manual: boolean | null
          estado_gasto_id: string | null
          fecha: string | null
          id: string
          moneda_codigo: string | null
          numero_documento: string | null
          observaciones: string | null
          origen_gasto_id: string | null
          proveedor_id: string | null
          rendicion_id: string
          tipo_cambio: number | null
          updated_at: string | null
          valor_factura: number | null
          valor_moneda_base: number | null
          valor_moneda_origen: number | null
          valor_reembolsable: number | null
          viaje_id: string | null
        }
        Insert: {
          categoria_gasto_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          descripcion?: string | null
          documento_id?: string | null
          empresa_id: string
          es_manual?: boolean | null
          estado_gasto_id?: string | null
          fecha?: string | null
          id?: string
          moneda_codigo?: string | null
          numero_documento?: string | null
          observaciones?: string | null
          origen_gasto_id?: string | null
          proveedor_id?: string | null
          rendicion_id: string
          tipo_cambio?: number | null
          updated_at?: string | null
          valor_factura?: number | null
          valor_moneda_base?: number | null
          valor_moneda_origen?: number | null
          valor_reembolsable?: number | null
          viaje_id?: string | null
        }
        Update: {
          categoria_gasto_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          descripcion?: string | null
          documento_id?: string | null
          empresa_id?: string
          es_manual?: boolean | null
          estado_gasto_id?: string | null
          fecha?: string | null
          id?: string
          moneda_codigo?: string | null
          numero_documento?: string | null
          observaciones?: string | null
          origen_gasto_id?: string | null
          proveedor_id?: string | null
          rendicion_id?: string
          tipo_cambio?: number | null
          updated_at?: string | null
          valor_factura?: number | null
          valor_moneda_base?: number | null
          valor_moneda_origen?: number | null
          valor_reembolsable?: number | null
          viaje_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_categoria_gasto_id_fkey"
            columns: ["categoria_gasto_id"]
            isOneToOne: false
            referencedRelation: "categorias_gasto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_estado_gasto_id_fkey"
            columns: ["estado_gasto_id"]
            isOneToOne: false
            referencedRelation: "estados_gasto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_moneda_codigo_fkey"
            columns: ["moneda_codigo"]
            isOneToOne: false
            referencedRelation: "monedas"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "gastos_origen_gasto_id_fkey"
            columns: ["origen_gasto_id"]
            isOneToOne: false
            referencedRelation: "origenes_gasto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_rendicion_id_fkey"
            columns: ["rendicion_id"]
            isOneToOne: false
            referencedRelation: "rendiciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_workflow: {
        Row: {
          created_at: string | null
          detalle: string | null
          empresa_id: string
          evento: string | null
          id: string
          rendicion_id: string
          usuario_id: string | null
          workflow_paso_id: string | null
        }
        Insert: {
          created_at?: string | null
          detalle?: string | null
          empresa_id: string
          evento?: string | null
          id?: string
          rendicion_id: string
          usuario_id?: string | null
          workflow_paso_id?: string | null
        }
        Update: {
          created_at?: string | null
          detalle?: string | null
          empresa_id?: string
          evento?: string | null
          id?: string
          rendicion_id?: string
          usuario_id?: string | null
          workflow_paso_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historial_workflow_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_workflow_rendicion_id_fkey"
            columns: ["rendicion_id"]
            isOneToOne: false
            referencedRelation: "rendiciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_workflow_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_workflow_workflow_paso_id_fkey"
            columns: ["workflow_paso_id"]
            isOneToOne: false
            referencedRelation: "workflow_pasos"
            referencedColumns: ["id"]
          },
        ]
      }
      monedas: {
        Row: {
          codigo: string
          created_at: string | null
          estado: string | null
          nombre: string
          simbolo: string | null
        }
        Insert: {
          codigo: string
          created_at?: string | null
          estado?: string | null
          nombre: string
          simbolo?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string | null
          estado?: string | null
          nombre?: string
          simbolo?: string | null
        }
        Relationships: []
      }
      niveles_riesgo_ia: {
        Row: {
          codigo: string
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      notificaciones: {
        Row: {
          created_at: string | null
          empresa_id: string
          fecha_lectura: string | null
          id: string
          leida: boolean | null
          mensaje: string | null
          titulo: string | null
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          fecha_lectura?: string | null
          id?: string
          leida?: boolean | null
          mensaje?: string | null
          titulo?: string | null
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          fecha_lectura?: string | null
          id?: string
          leida?: boolean | null
          mensaje?: string | null
          titulo?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_extracciones: {
        Row: {
          confianza: number | null
          created_at: string | null
          documento_id: string
          fecha_detectada: string | null
          id: string
          impuesto_detectado: number | null
          json_ocr: Json | null
          moneda_detectada: string | null
          numero_documento_detectado: string | null
          proveedor_detectado: string | null
          subtotal_detectado: number | null
          texto_extraido: string | null
          total_detectado: number | null
        }
        Insert: {
          confianza?: number | null
          created_at?: string | null
          documento_id: string
          fecha_detectada?: string | null
          id?: string
          impuesto_detectado?: number | null
          json_ocr?: Json | null
          moneda_detectada?: string | null
          numero_documento_detectado?: string | null
          proveedor_detectado?: string | null
          subtotal_detectado?: number | null
          texto_extraido?: string | null
          total_detectado?: number | null
        }
        Update: {
          confianza?: number | null
          created_at?: string | null
          documento_id?: string
          fecha_detectada?: string | null
          id?: string
          impuesto_detectado?: number | null
          json_ocr?: Json | null
          moneda_detectada?: string | null
          numero_documento_detectado?: string | null
          proveedor_detectado?: string | null
          subtotal_detectado?: number | null
          texto_extraido?: string | null
          total_detectado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_extracciones_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      origenes_gasto: {
        Row: {
          codigo: string
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      paises: {
        Row: {
          codigo_iso: string
          created_at: string | null
          id: string
          moneda_codigo: string | null
          nombre: string
        }
        Insert: {
          codigo_iso: string
          created_at?: string | null
          id?: string
          moneda_codigo?: string | null
          nombre: string
        }
        Update: {
          codigo_iso?: string
          created_at?: string | null
          id?: string
          moneda_codigo?: string | null
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "paises_moneda_codigo_fkey"
            columns: ["moneda_codigo"]
            isOneToOne: false
            referencedRelation: "monedas"
            referencedColumns: ["codigo"]
          },
        ]
      }
      parametros_sistema: {
        Row: {
          clave: string
          created_at: string | null
          descripcion: string | null
          empresa_id: string
          id: string
          valor: string | null
        }
        Insert: {
          clave: string
          created_at?: string | null
          descripcion?: string | null
          empresa_id: string
          id?: string
          valor?: string | null
        }
        Update: {
          clave?: string
          created_at?: string | null
          descripcion?: string | null
          empresa_id?: string
          id?: string
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parametros_sistema_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      politicas: {
        Row: {
          activo: boolean | null
          codigo: string | null
          created_at: string | null
          descripcion: string | null
          empresa_id: string
          id: string
          nombre: string
          paga_combustible: boolean | null
          paga_peajes: boolean | null
          tope_almuerzo: number | null
          tope_cena: number | null
          tope_desayuno: number | null
          tope_hospedaje: number | null
          tope_miscelaneo: number | null
          updated_at: string | null
          valor_km: number | null
        }
        Insert: {
          activo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa_id: string
          id?: string
          nombre: string
          paga_combustible?: boolean | null
          paga_peajes?: boolean | null
          tope_almuerzo?: number | null
          tope_cena?: number | null
          tope_desayuno?: number | null
          tope_hospedaje?: number | null
          tope_miscelaneo?: number | null
          updated_at?: string | null
          valor_km?: number | null
        }
        Update: {
          activo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa_id?: string
          id?: string
          nombre?: string
          paga_combustible?: boolean | null
          paga_peajes?: boolean | null
          tope_almuerzo?: number | null
          tope_cena?: number | null
          tope_desayuno?: number | null
          tope_hospedaje?: number | null
          tope_miscelaneo?: number | null
          updated_at?: string | null
          valor_km?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "politicas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuesto_detalle: {
        Row: {
          categoria_gasto_id: string | null
          created_at: string | null
          id: string
          presupuesto_id: string
          valor_presupuestado: number | null
        }
        Insert: {
          categoria_gasto_id?: string | null
          created_at?: string | null
          id?: string
          presupuesto_id: string
          valor_presupuestado?: number | null
        }
        Update: {
          categoria_gasto_id?: string | null
          created_at?: string | null
          id?: string
          presupuesto_id?: string
          valor_presupuestado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_detalle_categoria_gasto_id_fkey"
            columns: ["categoria_gasto_id"]
            isOneToOne: false
            referencedRelation: "categorias_gasto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuesto_detalle_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      presupuestos: {
        Row: {
          activo: boolean | null
          anio: number
          codigo: string | null
          created_at: string | null
          descripcion: string | null
          empresa_id: string
          id: string
          nombre: string
          proyecto_id: string | null
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          activo?: boolean | null
          anio: number
          codigo?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa_id: string
          id?: string
          nombre: string
          proyecto_id?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          activo?: boolean | null
          anio?: number
          codigo?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa_id?: string
          id?: string
          nombre?: string
          proyecto_id?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_proyectos"
            referencedColumns: ["proyecto_id"]
          },
        ]
      }
      proveedores: {
        Row: {
          ciudad: string | null
          codigo: string | null
          correo: string | null
          created_at: string | null
          deleted_at: string | null
          empresa_id: string
          estado: string | null
          id: string
          identificacion: string | null
          nombre: string
          pais: string | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          ciudad?: string | null
          codigo?: string | null
          correo?: string | null
          created_at?: string | null
          deleted_at?: string | null
          empresa_id: string
          estado?: string | null
          id?: string
          identificacion?: string | null
          nombre: string
          pais?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          ciudad?: string | null
          codigo?: string | null
          correo?: string | null
          created_at?: string | null
          deleted_at?: string | null
          empresa_id?: string
          estado?: string | null
          id?: string
          identificacion?: string | null
          nombre?: string
          pais?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proveedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      proyectos: {
        Row: {
          centro_costo_id: string | null
          cliente_id: string
          codigo: string | null
          created_at: string | null
          deleted_at: string | null
          descripcion: string | null
          empresa_id: string
          estado_financiero: string | null
          estado_proyecto_id: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          nombre: string
          presupuesto: number | null
          responsable_usuario_id: string | null
          sucursal_id: string | null
          updated_at: string | null
          valor_contrato: number | null
        }
        Insert: {
          centro_costo_id?: string | null
          cliente_id: string
          codigo?: string | null
          created_at?: string | null
          deleted_at?: string | null
          descripcion?: string | null
          empresa_id: string
          estado_financiero?: string | null
          estado_proyecto_id?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          nombre: string
          presupuesto?: number | null
          responsable_usuario_id?: string | null
          sucursal_id?: string | null
          updated_at?: string | null
          valor_contrato?: number | null
        }
        Update: {
          centro_costo_id?: string | null
          cliente_id?: string
          codigo?: string | null
          created_at?: string | null
          deleted_at?: string | null
          descripcion?: string | null
          empresa_id?: string
          estado_financiero?: string | null
          estado_proyecto_id?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          nombre?: string
          presupuesto?: number | null
          responsable_usuario_id?: string | null
          sucursal_id?: string | null
          updated_at?: string | null
          valor_contrato?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proyectos_centro_costo_id_fkey"
            columns: ["centro_costo_id"]
            isOneToOne: false
            referencedRelation: "centros_costo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyectos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyectos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_clientes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "proyectos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyectos_estado_proyecto_id_fkey"
            columns: ["estado_proyecto_id"]
            isOneToOne: false
            referencedRelation: "estados_proyecto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyectos_responsable_usuario_id_fkey"
            columns: ["responsable_usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyectos_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      rendicion_tags: {
        Row: {
          id: string
          rendicion_id: string
          tag_id: string
        }
        Insert: {
          id?: string
          rendicion_id: string
          tag_id: string
        }
        Update: {
          id?: string
          rendicion_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rendicion_tags_rendicion_id_fkey"
            columns: ["rendicion_id"]
            isOneToOne: false
            referencedRelation: "rendiciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendicion_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      rendiciones: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          descripcion: string | null
          empresa_id: string
          estado_rendicion_id: string | null
          fecha_aprobacion: string | null
          fecha_envio: string | null
          fecha_rendicion: string | null
          id: string
          numero: string
          politica_id: string | null
          proyecto_id: string
          saldo: number | null
          score_auditoria: number | null
          tipo_rendicion_id: string | null
          total_anticipos: number | null
          total_facturado: number | null
          total_reembolsable: number | null
          updated_at: string | null
          usuario_id: string
          workflow_id: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          descripcion?: string | null
          empresa_id: string
          estado_rendicion_id?: string | null
          fecha_aprobacion?: string | null
          fecha_envio?: string | null
          fecha_rendicion?: string | null
          id?: string
          numero: string
          politica_id?: string | null
          proyecto_id: string
          saldo?: number | null
          score_auditoria?: number | null
          tipo_rendicion_id?: string | null
          total_anticipos?: number | null
          total_facturado?: number | null
          total_reembolsable?: number | null
          updated_at?: string | null
          usuario_id: string
          workflow_id?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          descripcion?: string | null
          empresa_id?: string
          estado_rendicion_id?: string | null
          fecha_aprobacion?: string | null
          fecha_envio?: string | null
          fecha_rendicion?: string | null
          id?: string
          numero?: string
          politica_id?: string | null
          proyecto_id?: string
          saldo?: number | null
          score_auditoria?: number | null
          tipo_rendicion_id?: string | null
          total_anticipos?: number | null
          total_facturado?: number | null
          total_reembolsable?: number | null
          updated_at?: string | null
          usuario_id?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rendiciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendiciones_estado_rendicion_id_fkey"
            columns: ["estado_rendicion_id"]
            isOneToOne: false
            referencedRelation: "estados_rendicion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendiciones_politica_id_fkey"
            columns: ["politica_id"]
            isOneToOne: false
            referencedRelation: "politicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendiciones_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendiciones_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_proyectos"
            referencedColumns: ["proyecto_id"]
          },
          {
            foreignKeyName: "rendiciones_tipo_rendicion_id_fkey"
            columns: ["tipo_rendicion_id"]
            isOneToOne: false
            referencedRelation: "tipos_rendicion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendiciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendiciones_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows_aprobacion"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          codigo: string
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      sucursales: {
        Row: {
          codigo: string | null
          created_at: string | null
          deleted_at: string | null
          direccion: string | null
          empresa_id: string
          estado: string | null
          id: string
          nombre: string
          updated_at: string | null
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          deleted_at?: string | null
          direccion?: string | null
          empresa_id: string
          estado?: string | null
          id?: string
          nombre: string
          updated_at?: string | null
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          deleted_at?: string | null
          direccion?: string | null
          empresa_id?: string
          estado?: string | null
          id?: string
          nombre?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sucursales_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          empresa_id: string
          id: string
          nombre: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          empresa_id: string
          id?: string
          nombre: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_cambio: {
        Row: {
          created_at: string | null
          fecha: string
          fuente: string | null
          id: string
          moneda_destino: string | null
          moneda_origen: string | null
          valor: number
        }
        Insert: {
          created_at?: string | null
          fecha: string
          fuente?: string | null
          id?: string
          moneda_destino?: string | null
          moneda_origen?: string | null
          valor: number
        }
        Update: {
          created_at?: string | null
          fecha?: string
          fuente?: string | null
          id?: string
          moneda_destino?: string | null
          moneda_origen?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "tipos_cambio_moneda_destino_fkey"
            columns: ["moneda_destino"]
            isOneToOne: false
            referencedRelation: "monedas"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "tipos_cambio_moneda_origen_fkey"
            columns: ["moneda_origen"]
            isOneToOne: false
            referencedRelation: "monedas"
            referencedColumns: ["codigo"]
          },
        ]
      }
      tipos_documento: {
        Row: {
          codigo: string
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      tipos_rendicion: {
        Row: {
          codigo: string
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          apellidos: string | null
          cargo: string | null
          created_at: string | null
          deleted_at: string | null
          estado: string | null
          foto_url: string | null
          id: string
          nombres: string
          telefono: string | null
          ultimo_acceso: string | null
          updated_at: string | null
        }
        Insert: {
          apellidos?: string | null
          cargo?: string | null
          created_at?: string | null
          deleted_at?: string | null
          estado?: string | null
          foto_url?: string | null
          id: string
          nombres: string
          telefono?: string | null
          ultimo_acceso?: string | null
          updated_at?: string | null
        }
        Update: {
          apellidos?: string | null
          cargo?: string | null
          created_at?: string | null
          deleted_at?: string | null
          estado?: string | null
          foto_url?: string | null
          id?: string
          nombres?: string
          telefono?: string | null
          ultimo_acceso?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      viajes: {
        Row: {
          created_at: string | null
          destino: string
          distancia_km: number | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          numero: string | null
          observaciones: string | null
          pais_id: string | null
          rendicion_id: string
          updated_at: string | null
          vehiculo_propio: boolean | null
        }
        Insert: {
          created_at?: string | null
          destino: string
          distancia_km?: number | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          numero?: string | null
          observaciones?: string | null
          pais_id?: string | null
          rendicion_id: string
          updated_at?: string | null
          vehiculo_propio?: boolean | null
        }
        Update: {
          created_at?: string | null
          destino?: string
          distancia_km?: number | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          numero?: string | null
          observaciones?: string | null
          pais_id?: string | null
          rendicion_id?: string
          updated_at?: string | null
          vehiculo_propio?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "viajes_pais_id_fkey"
            columns: ["pais_id"]
            isOneToOne: false
            referencedRelation: "paises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viajes_rendicion_id_fkey"
            columns: ["rendicion_id"]
            isOneToOne: false
            referencedRelation: "rendiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_pasos: {
        Row: {
          created_at: string | null
          id: string
          nombre: string | null
          obligatorio: boolean | null
          orden: number
          rol_id: string
          workflow_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nombre?: string | null
          obligatorio?: boolean | null
          orden: number
          rol_id: string
          workflow_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nombre?: string | null
          obligatorio?: boolean | null
          orden?: number
          rol_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_pasos_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_pasos_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows_aprobacion"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows_aprobacion: {
        Row: {
          activo: boolean | null
          codigo: string | null
          created_at: string | null
          descripcion: string | null
          empresa_id: string
          id: string
          nombre: string
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa_id: string
          id?: string
          nombre: string
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          descripcion?: string | null
          empresa_id?: string
          id?: string
          nombre?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflows_aprobacion_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_dashboard_clientes: {
        Row: {
          cliente: string | null
          cliente_id: string | null
          empresa_id: string | null
          total_gastado: number | null
          total_proyectos: number | null
          total_rendiciones: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proyectos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_dashboard_ejecutivo: {
        Row: {
          empresa_id: string | null
          total_anticipos: number | null
          total_gastado: number | null
          total_proyectos_con_movimiento: number | null
          total_reembolsable: number | null
          total_rendiciones: number | null
          total_usuarios_con_movimiento: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rendiciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_dashboard_ia: {
        Row: {
          empresa_id: string | null
          score_promedio: number | null
          total_auditorias: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auditorias_ia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_dashboard_proveedores: {
        Row: {
          cantidad_gastos: number | null
          empresa_id: string | null
          id: string | null
          nombre: string | null
          total_gastado: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_dashboard_proyectos: {
        Row: {
          empresa_id: string | null
          gasto_real: number | null
          margen_estimado: number | null
          nombre: string | null
          presupuesto: number | null
          proyecto_id: string | null
          saldo_presupuesto: number | null
          valor_contrato: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proyectos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      generar_codigo: {
        Args: { numero: number; prefijo: string }
        Returns: string
      }
      mi_empresa_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
