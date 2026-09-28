import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { BaseInstaladaLayout } from "@/components/servicio-tecnico/base-instalada-layout";

export const Route = createFileRoute("/servicio-tecnico/base-instalada")({
  head: () => ({ meta: [{ title: "Base Instalada · VIATIQ" }] }),
  component: BaseInstaladaPage,
});

function BaseInstaladaPage() {
  return (
    <AppShell>
      <BaseInstaladaLayout />
    </AppShell>
  );
}
