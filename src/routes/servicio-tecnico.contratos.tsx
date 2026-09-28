import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { ContratosLayout } from "@/components/servicio-tecnico/contratos-layout";

export const Route = createFileRoute("/servicio-tecnico/contratos")({
  head: () => ({ meta: [{ title: "Contratos Mant. · VIATIQ" }] }),
  component: ContratosPage,
});

function ContratosPage() {
  return (
    <AppShell>
      <ContratosLayout />
    </AppShell>
  );
}
