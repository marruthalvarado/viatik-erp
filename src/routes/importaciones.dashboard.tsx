import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { ImportacionesDashboard } from "@/components/importaciones/importaciones-dashboard";

export const Route = createFileRoute("/importaciones/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard Importaciones · VIATIQ" }] }),
  component: () => (
    <AppShell>
      <ImportacionesDashboard />
    </AppShell>
  ),
});
