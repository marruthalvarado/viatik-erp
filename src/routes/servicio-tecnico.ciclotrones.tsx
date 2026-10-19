import { createFileRoute } from "@tanstack/react-router";
import { FullPageShell } from "@/components/layout/full-page-shell";
import { CiclotronsLayout } from "@/components/ciclotrones/ciclotrones-layout";

export const Route = createFileRoute("/servicio-tecnico/ciclotrones")({
  head: () => ({ meta: [{ title: "Ciclotrones · VIATIQ" }] }),
  component: CiclotronsPage,
});

function CiclotronsPage() {
  return (
    <FullPageShell>
      <CiclotronsLayout />
    </FullPageShell>
  );
}
