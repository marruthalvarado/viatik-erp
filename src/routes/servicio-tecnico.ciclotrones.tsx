import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { CiclotronsLayout } from "@/components/ciclotrones/ciclotrones-layout";

export const Route = createFileRoute("/servicio-tecnico/ciclotrones")({
  head: () => ({ meta: [{ title: "Ciclotrones · VIATIQ" }] }),
  component: CiclotronsPage,
});

function CiclotronsPage() {
  return (
    <AppShell>
      <CiclotronsLayout />
    </AppShell>
  );
}
