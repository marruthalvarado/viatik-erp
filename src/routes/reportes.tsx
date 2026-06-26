import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { PagePlaceholder } from "@/components/common/page-placeholder";

export const Route = createFileRoute("/reportes")({
  head: () => ({ meta: [{ title: "Reportes · Viatik" }] }),
  component: () => (
    <AppShell>
      <PagePlaceholder title="Reportes" description="Analítica financiera y exportaciones." />
    </AppShell>
  ),
});
