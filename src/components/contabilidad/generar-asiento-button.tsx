/**
 * Botón reutilizable para generar asientos automáticos
 * desde facturas, gastos empresa y cobros.
 */
import { useState } from "react";
import { BookOpen, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useAutoAsiento } from "@/hooks/entities/use-contabilidad";

type RefTipo = "factura" | "gasto" | "cobro";

interface GenerarAsientoButtonProps {
  tipo: RefTipo;
  referenciaId: string;
  empresaId: string;
  /** Si ya existe asiento contable para este ref, muestra badge en verde */
  yaGenerado?: boolean;
  onGenerado?: (asientoId: string) => void;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
}

const LABELS: Record<RefTipo, string> = {
  factura: "Generar asiento de factura",
  gasto: "Generar asiento de gasto",
  cobro: "Generar asiento de cobro",
};

export function GenerarAsientoButton({
  tipo,
  referenciaId,
  empresaId,
  yaGenerado = false,
  onGenerado,
  size = "sm",
  variant = "outline",
}: GenerarAsientoButtonProps) {
  const { loading, generarFactura, generarGasto, generarCobro } = useAutoAsiento();
  const [generado, setGenerado] = useState(yaGenerado);

  const handleGenerar = async () => {
    if (generado) return;
    try {
      let id: string | null = null;
      if (tipo === "factura") id = await generarFactura(referenciaId, empresaId);
      else if (tipo === "gasto") id = await generarGasto(referenciaId, empresaId);
      else id = await generarCobro(referenciaId, empresaId);

      if (id) {
        setGenerado(true);
        onGenerado?.(id);
        toast.success("Asiento contable generado");
      }
    } catch {
      // error already set in hook; toast handled by caller if needed
    }
  };

  if (generado) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 className="size-3.5" />
              Asiento generado
            </span>
          </TooltipTrigger>
          <TooltipContent>Ya existe un asiento contable para este registro.</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button size={size} variant={variant} onClick={handleGenerar} disabled={loading}>
      {loading ? (
        <Loader2 className="size-3.5 animate-spin mr-1.5" />
      ) : (
        <BookOpen className="size-3.5 mr-1.5" />
      )}
      {loading ? "Generando…" : LABELS[tipo]}
    </Button>
  );
}
