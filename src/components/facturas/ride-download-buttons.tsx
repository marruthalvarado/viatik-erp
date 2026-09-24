/**
 * RideDownloadButtons — Botones para descargar XML y PDF RIDE de una factura autorizada.
 */
import { useState } from "react";
import { FileDown, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/common/toast";
import { useEmpresaFacConfig } from "@/hooks/entities/use-facturacion-sri";
import { useEmpresa } from "@/hooks/entities/use-empresas";
import { generarYDescargarRIDE, descargarXML } from "@/services/ride-generator";
import type { FacturaEmitida } from "@/services/facturas-emitidas";
import type { ComprobanteElectronico } from "@/types/facturacion-sri";

interface Props {
  factura: FacturaEmitida;
  comprobante: ComprobanteElectronico;
  empresaId: string;
  /** Si es true muestra labels de texto además del ícono */
  showLabels?: boolean;
}

export function RideDownloadButtons({ factura, comprobante, empresaId, showLabels }: Props) {
  const [loadingPdf, setLoadingPdf] = useState(false);

  const { data: config } = useEmpresaFacConfig(empresaId);
  const { data: empresa } = useEmpresa(empresaId);

  function handleXml() {
    if (!comprobante.xml_firmado) {
      toast.error("El XML firmado no está disponible.");
      return;
    }
    descargarXML(
      comprobante.xml_firmado,
      factura.numero ?? "factura",
      config?.ruc ?? empresaId,
    );
    toast.success("XML descargado.");
  }

  async function handlePdf() {
    if (!config) {
      toast.error("No se encontró la configuración de facturación.");
      return;
    }
    setLoadingPdf(true);
    try {
      await generarYDescargarRIDE({
        factura,
        comprobante,
        config,
        logoUrl: empresa?.logo_url ?? null,
      });
      toast.success("RIDE descargado.");
    } catch (e) {
      toast.error(`Error generando RIDE: ${e instanceof Error ? e.message : "Error"}`);
    } finally {
      setLoadingPdf(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size={showLabels ? "sm" : "icon"}
        variant="outline"
        className={showLabels ? "gap-1.5" : "size-7"}
        onClick={handleXml}
        title="Descargar XML firmado"
        disabled={!comprobante.xml_firmado}
      >
        <FileText className="size-3.5 text-blue-600" />
        {showLabels && <span>XML</span>}
      </Button>
      <Button
        size={showLabels ? "sm" : "icon"}
        variant="outline"
        className={showLabels ? "gap-1.5" : "size-7"}
        onClick={handlePdf}
        title="Descargar PDF RIDE"
        disabled={loadingPdf || !config}
      >
        {loadingPdf
          ? <Loader2 className="size-3.5 animate-spin" />
          : <FileDown className="size-3.5 text-emerald-600" />}
        {showLabels && <span>PDF RIDE</span>}
      </Button>
    </div>
  );
}
