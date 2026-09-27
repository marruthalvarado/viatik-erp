import { createFileRoute } from "@tanstack/react-router";
import { CatalogoLayout } from "@/components/catalogo/catalogo-layout";

export const Route = createFileRoute("/catalogo")({
  component: CatalogoPage,
});

function CatalogoPage() {
  return <CatalogoLayout />;
}
