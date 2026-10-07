import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { EmbarquesLayout } from "@/components/importaciones/embarques-layout";

export const Route = createFileRoute("/importaciones/embarques")({
  head: () => ({ meta: [{ title: "Embarques · VIATIQ" }] }),
  component: () => (
    <AppShell>
      <EmbarquesLayout />
    </AppShell>
  ),
});
