import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { CatalogoLayout } from "@/components/catalogo/catalogo-layout";

export const Route = createFileRoute("/catalogo")({
  head: () => ({ meta: [{ title: "Catálogo · VIATIQ" }] }),
  component: CatalogoPage,
});

function CatalogoPage() {
  return (
    <AppShell>
      <CatalogoLayout />
    </AppShell>
  );
}
