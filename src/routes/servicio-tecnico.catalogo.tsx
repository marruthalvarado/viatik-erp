import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { CatalogoEquiposLayout } from "@/components/servicio-tecnico/catalogo-equipos-layout";

export const Route = createFileRoute("/servicio-tecnico/catalogo")({
  head: () => ({ meta: [{ title: "Catálogo de Equipos · VIATIQ" }] }),
  component: CatalogoPage,
});

function CatalogoPage() {
  return (
    <AppShell>
      <CatalogoEquiposLayout />
    </AppShell>
  );
}
