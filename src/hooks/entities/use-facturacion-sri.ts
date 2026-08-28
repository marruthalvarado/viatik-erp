/**
 * Hooks para Facturación Electrónica SRI.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getEmpresaFacConfig,
  uploadCertificado,
  getComprobantesElectronicos,
  getComprobanteByReferencia,
  emitirFactura,
  consultarEstadoSRI,
} from "@/services/facturacion-electronica";
import type { EmitirFacturaPayload } from "@/types/facturacion-sri";

// ─── Configuración ────────────────────────────────────────────────────────────

export function useEmpresaFacConfig(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["empresa_fac_config", empresaId],
    queryFn: () => getEmpresaFacConfig(empresaId!),
    enabled: !!empresaId,
  });
}

export function useGuardarFacConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadCertificado,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["empresa_fac_config", vars.empresaId] });
    },
  });
}

// ─── Comprobantes ─────────────────────────────────────────────────────────────

export function useComprobantesElectronicos(empresaId: string | null | undefined, tipo?: string) {
  return useQuery({
    queryKey: ["comprobantes_electronicos", empresaId, tipo],
    queryFn: () => getComprobantesElectronicos(empresaId!, tipo),
    enabled: !!empresaId,
  });
}

export function useComprobanteByReferencia(referenciaId: string | null | undefined, tipo = "factura") {
  return useQuery({
    queryKey: ["comprobante_by_ref", referenciaId, tipo],
    queryFn: () => getComprobanteByReferencia(referenciaId!, tipo),
    enabled: !!referenciaId,
    staleTime: 30_000,
  });
}

// ─── Emisión ──────────────────────────────────────────────────────────────────

export function useEmitirFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: EmitirFacturaPayload) => emitirFactura(payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["comprobante_by_ref", vars.factura_id] });
      qc.invalidateQueries({ queryKey: ["comprobantes_electronicos", vars.empresa_id] });
    },
  });
}

export function useConsultarEstado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ empresaId, claveAcceso }: { empresaId: string; claveAcceso: string }) =>
      consultarEstadoSRI(empresaId, claveAcceso),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comprobantes_electronicos"] });
      qc.invalidateQueries({ queryKey: ["comprobante_by_ref"] });
    },
  });
}
