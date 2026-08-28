/**
 * Tipos TypeScript para el módulo de Facturación Electrónica SRI Ecuador.
 */

export interface EmpresaFacConfig {
  id: string;
  empresa_id: string;
  ruc: string;
  razon_social: string;
  nombre_comercial: string | null;
  dir_matriz: string;
  dir_establecimiento: string | null;
  obligado_contabilidad: boolean;
  contribuyente_especial: string | null;
  ambiente: "pruebas" | "produccion";
  establecimiento: string;
  punto_emision: string;
  cert_storage_path: string | null;
  cert_clave: string | null;
  cert_vigencia: string | null;
  sec_factura: number;
  sec_nota_credito: number;
  sec_nota_debito: number;
  sec_retencion: number;
  sec_guia_remision: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ComprobanteElectronico {
  id: string;
  empresa_id: string;
  tipo: "factura" | "nota_credito" | "nota_debito" | "retencion" | "guia_remision";
  numero: string;
  clave_acceso: string | null;
  estado: "pendiente" | "enviado" | "autorizado" | "rechazado" | "anulado";
  fecha_emision: string;
  xml_sin_firma: string | null;
  xml_firmado: string | null;
  xml_autorizado: string | null;
  numero_autorizacion: string | null;
  fecha_autorizacion: string | null;
  mensaje_sri: string | null;
  referencia_tipo: string | null;
  referencia_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmitirFacturaPayload {
  empresa_id: string;
  factura_id: string;
  descripcion_servicio?: string;
  forma_pago?: string;
}

export interface EmitirFacturaResult {
  ok: boolean;
  clave_acceso?: string;
  numero?: string;
  estado?: string;
  numero_autorizacion?: string;
  fecha_autorizacion?: string;
  mensaje_sri?: string;
  error?: string;
}

export interface ConsultarEstadoResult {
  ok: boolean;
  estado?: string;
  numero_autorizacion?: string;
  fecha_autorizacion?: string;
  mensajes?: string;
  error?: string;
}

/** Formas de pago SRI Ecuador */
export const FORMAS_PAGO_SRI = [
  { codigo: "01", nombre: "Sin utilización del sistema financiero (Efectivo)" },
  { codigo: "16", nombre: "Transferencia de fondos" },
  { codigo: "17", nombre: "Tarjeta de débito" },
  { codigo: "18", nombre: "Dinero electrónico" },
  { codigo: "19", nombre: "Tarjeta prepago" },
  { codigo: "20", nombre: "Tarjeta de crédito" },
  { codigo: "21", nombre: "Otros con utilización del sistema financiero" },
  { codigo: "15", nombre: "Compensación de deudas" },
  { codigo: "12", nombre: "Tarjeta de crédito exterior" },
] as const;

export const ESTADO_BADGE: Record<ComprobanteElectronico["estado"], string> = {
  pendiente: "bg-gray-100 text-gray-600",
  enviado:   "bg-blue-100 text-blue-700",
  autorizado:"bg-emerald-100 text-emerald-700",
  rechazado: "bg-red-100 text-red-700",
  anulado:   "bg-amber-100 text-amber-700",
};
