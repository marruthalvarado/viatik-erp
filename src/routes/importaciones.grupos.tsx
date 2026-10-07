import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { GruposEmbarqueLayout } from "@/components/importaciones/grupos-embarque-layout";

export const Route = createFileRoute("/importaciones/grupos")({
  head: () => ({ meta: [{ title: "Grupos de Embarque · VIATIQ" }] }),
  component: () => (
    <AppShell>
      <GruposEmbarqueLayout />
    </AppShell>
  ),
});
