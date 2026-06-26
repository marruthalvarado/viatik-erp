import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { PagePlaceholder } from "@/components/common/page-placeholder";

export const Route = createFileRoute("/configuracion")({
  head: () => ({ meta: [{ title: "Configuración · Viatik" }] }),
  component: () => (
    <AppShell>
      <PagePlaceholder title="Configuración" description="Preferencias generales del workspace." />
    </AppShell>
  ),
});
