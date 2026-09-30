import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { PlantillasLayout } from "@/components/servicio-tecnico/plantillas-layout";

export const Route = createFileRoute("/servicio-tecnico/plantillas")({
  head: () => ({ meta: [{ title: "Plantillas de Actividad · VIATIQ" }] }),
  component: PlantillasPage,
});

function PlantillasPage() {
  return (
    <AppShell>
      <PlantillasLayout />
    </AppShell>
  );
}
