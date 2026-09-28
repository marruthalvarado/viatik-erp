import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { OrdenesLayout } from "@/components/servicio-tecnico/ordenes-layout";

export const Route = createFileRoute("/servicio-tecnico/ordenes")({
  head: () => ({ meta: [{ title: "Órdenes de Servicio · VIATIQ" }] }),
  component: OrdenesPage,
});

function OrdenesPage() {
  return (
    <AppShell>
      <OrdenesLayout />
    </AppShell>
  );
}
