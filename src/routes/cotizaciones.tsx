import { createFileRoute } from "@tanstack/react-router";
import { CotizacionesLayout } from "@/components/cotizaciones/cotizaciones-layout";

export const Route = createFileRoute("/cotizaciones")({
  component: CotizacionesPage,
});

function CotizacionesPage() {
  return <CotizacionesLayout />;
}
