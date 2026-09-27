import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { CotizacionesLayout } from "@/components/cotizaciones/cotizaciones-layout";

export const Route = createFileRoute("/cotizaciones")({
  head: () => ({ meta: [{ title: "Cotizaciones · VIATIQ" }] }),
  component: CotizacionesPage,
});

function CotizacionesPage() {
  return (
    <AppShell>
      <CotizacionesLayout />
    </AppShell>
  );
}
