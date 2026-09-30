import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { ProtocolosLayout } from "@/components/servicio-tecnico/protocolos-layout";

export const Route = createFileRoute("/servicio-tecnico/protocolos")({
  head: () => ({ meta: [{ title: "Protocolos de Mantenimiento · VIATIQ" }] }),
  component: ProtocolosPage,
});

function ProtocolosPage() {
  return (
    <AppShell>
      <ProtocolosLayout />
    </AppShell>
  );
}
