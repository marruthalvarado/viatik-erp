/**
 * RucConsultaButton
 * Botón "Consultar SRI" que se coloca al lado del campo RUC.
 * Al hacer clic llama al SRI y retorna los datos al padre via onDatos().
 *
 * Uso:
 *   <RucConsultaButton ruc={form.watch("ruc")} onDatos={(d) => { form.setValue("nombre", d.razon_social); ... }} />
 */
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConsultarRuc } from "@/hooks/use-consultar-ruc";
import type { DatosContribuyente } from "@/services/sri-ruc";
import { toast } from "@/components/common/toast";

interface RucConsultaButtonProps {
  ruc: string | null | undefined;
  onDatos: (datos: DatosContribuyente) => void;
  disabled?: boolean;
}

export function RucConsultaButton({ ruc, onDatos, disabled }: RucConsultaButtonProps) {
  const { loading, consultar } = useConsultarRuc();

  async function handleClick() {
    const rucLimpio = (ruc ?? "").trim();
    if (!rucLimpio) {
      toast.error("Ingresa un RUC o cédula antes de consultar.");
      return;
    }
    if (rucLimpio.length !== 10 && rucLimpio.length !== 13) {
      toast.error("El RUC debe tener 10 o 13 dígitos.");
      return;
    }

    const datos = await consultar(rucLimpio);
    if (datos) {
      if (datos.estado !== "ACTIVO") {
        toast.warning(`Contribuyente ${datos.estado} en el SRI. Se cargaron los datos de todas formas.`);
      } else {
        toast.success(`Datos cargados: ${datos.razon_social}`);
      }
      onDatos(datos);
    } else {
      toast.error("No se encontró el RUC en el SRI. Verifica el número e intenta de nuevo.");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="shrink-0"
      title="Consultar SRI"
      aria-label="Consultar datos en el SRI"
      disabled={disabled || loading || !ruc}
      onClick={() => void handleClick()}
    >
      {loading ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Search className="size-4" />
      )}
    </Button>
  );
}
